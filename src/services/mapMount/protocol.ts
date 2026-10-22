/**
 * MapEngineMount 宿主协议(G0 无地图部分):协议状态机 + 上下文护栏 + 替身可测。
 * 不含 Cesium、不创建 iframe——真实挂载经微前端评审后接入(契约 design/04/next/07_mapengine_mount_contract.md)。
 */

export const MAP_MOUNT_PROTOCOL_VERSION = "1"

export type HostToMapMessage =
  | { type: "INIT"; protocolVersion: string; context: MountContext }
  | { type: "LOAD_SCENE"; sceneId: string; sceneRevision: string; correlationId: string }
  | { type: "SET_VIEW_TIME"; context: MountContext; correlationId: string }
  | { type: "SELECT_ENTITY"; entityId: string; correlationId: string; context: MountContext }

export type MapToHostMessage =
  | { type: "READY"; protocolVersion: string; capabilities: string[] }
  | { type: "SCENE_LOADED"; sceneId: string; sceneRevision: string; correlationId: string }
  | { type: "ENTITY_SELECTED"; entityId: string; correlationId: string }
  | { type: "VIEW_CHANGED"; camera: unknown; context: MountContext }
  | { type: "ERROR"; code: string; detail?: string }

export interface MountContext {
  simulationId: string
  branchId: string
  /** 视图时刻:引擎帧或工作台提交 id。 */
  viewRef: string
  sceneId: string
  sceneRevision: string
}

/** 传输抽象:iframe/微前端/测试替身都实现它。宿主只依赖此接口。 */
export interface MapTransport {
  send(message: HostToMapMessage): void
  onMessage(handler: (message: MapToHostMessage) => void): void
  /** 来源校验(跨 iframe 校验 origin/发送方身份;替身恒真)。 */
  acceptsOrigin(origin: string): boolean
}

export type MountState = "idle" | "init-sent" | "ready" | "error"

/**
 * 宿主状态机:
 * - INIT 携带协议版本,READY 版本不符 → error(不降级冒充已连接);
 * - 上下文护栏:仅接受"当前上下文"的回包;旧分支/旧帧的迟到 ENTITY_SELECTED/SCENE_LOADED 丢弃(MAP-04);
 * - 选择回环防护:宿主发起的 SELECT_ENTITY 不再作为地图回选事件广播(MAP-02)。
 */
export class MapMountHost {
  private state: MountState = "idle"
  private handler: ((message: MapToHostMessage) => void) | null = null
  private currentContext: MountContext | null = null
  private pendingSelect: { correlationId: string; entityId: string; contextKey: string } | null = null
  private lastHostInitiatedEntity: string | null = null

  private initTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private transport: MapTransport,
    options: { initTimeoutMs?: number } = {},
  ) {
    this.transport.onMessage((m) => this.receive(m))
    if (options.initTimeoutMs !== undefined) {
      this.initTimer = setTimeout(() => {
        if (this.state === "init-sent") {
          this.state = "error"
          this.handler?.({
            type: "ERROR",
            code: "INIT_TIMEOUT",
            detail: `READY 未在 ${String(options.initTimeoutMs)}ms 内到达`,
          })
        }
      }, options.initTimeoutMs)
    }
  }

  dispose(): void {
    if (this.initTimer) clearTimeout(this.initTimer)
  }

  get stateName(): MountState {
    return this.state
  }

  onHostEvent(handler: (message: MapToHostMessage) => void): void {
    this.handler = handler
  }

  init(context: MountContext): void {
    if (!this.transport.acceptsOrigin("map-engine")) {
      this.state = "error"
      this.handler?.({ type: "ERROR", code: "ORIGIN_REJECTED", detail: "传输层来源校验未通过" })
      return
    }
    this.currentContext = context
    this.state = "init-sent"
    this.transport.send({ type: "INIT", protocolVersion: MAP_MOUNT_PROTOCOL_VERSION, context })
  }

  setViewTime(context: MountContext): void {
    this.currentContext = context
    this.pendingSelect = null
    if (this.state !== "ready") return
    this.transport.send({ type: "SET_VIEW_TIME", context, correlationId: `view-${context.viewRef}` })
  }

  /** 宿主→地图选择(P20 选中实体→地图定位)。 */
  selectEntity(entityId: string, correlationId: string): void {
    if (this.state !== "ready" || !this.currentContext) return
    this.lastHostInitiatedEntity = entityId
    this.pendingSelect = {
      correlationId,
      entityId,
      contextKey: contextKeyOf(this.currentContext),
    }
    this.transport.send({
      type: "SELECT_ENTITY",
      entityId,
      correlationId,
      context: this.currentContext,
    })
  }

  private receive(m: MapToHostMessage): void {
    if (m.type === "READY") {
      if (this.state !== "init-sent") {
        this.state = "error"
        this.handler?.({ type: "ERROR", code: "READY_REJECTED", detail: `state=${this.state}` })
        return
      }
      if (m.protocolVersion !== MAP_MOUNT_PROTOCOL_VERSION) {
        this.state = "error"
        this.handler?.({ type: "ERROR", code: "PROTOCOL_VERSION_MISMATCH", detail: `map=${m.protocolVersion}` })
        return
      }
      this.state = "ready"
      if (this.initTimer) {
        clearTimeout(this.initTimer)
        this.initTimer = null
      }
      this.handler?.(m)
      return
    }
    if (this.state !== "ready") {
      this.handler?.({ type: "ERROR", code: "NOT_READY", detail: `收到 ${m.type} 时未就绪` })
      return
    }
    if (m.type === "SCENE_LOADED") {
      // 迟到回包:correlation 对应的上下文已过 → 丢弃(MAP-04)。
      if (!this.currentContext || m.sceneId !== this.currentContext.sceneId) {
        this.handler?.({ type: "ERROR", code: "STALE_RESPONSE_DROPPED", detail: `scene ${m.sceneId}` })
        return
      }
      this.handler?.(m)
      return
    }
    if (m.type === "ENTITY_SELECTED") {
      // 回环防护:地图把宿主刚发起的选择按同 correlationId 回抛 → 吞掉,不广播(MAP-02)。
      if (this.pendingSelect?.correlationId === m.correlationId) {
        this.pendingSelect = null
        return
      }
      // 其余(含异 corr)视为地图侧自发点选:清 pending 并广播给宿主(P20/P22/P24 联动)。
      this.pendingSelect = null
      this.handler?.(m)
      return
    }
    this.handler?.(m)
  }
}

export function contextKeyOf(c: MountContext): string {
  return `${c.sceneId}@${c.sceneRevision}/${c.simulationId}/${c.branchId}/${c.viewRef}`
}

/**
 * 地图位置策略(G0 规则级):Vec3 不自动当经纬度;null 不渲染标记但实体仍在逻辑列表;
 * [0,0,0] 是合法位置(原点);coordinateFrame 未经联调核对前一律 UNRESOLVED。
 */
export type MapPositionClassification =
  | { kind: "NO_MARKER"; reason: "position 为 null(实体仍在逻辑列表)" }
  | { kind: "VALID_ORIGIN"; note: "[0,0,0] 是合法位置" }
  | { kind: "PENDING_FRAME_RESOLUTION"; note: "Vec3 数值有效,但 coordinateFrame 未定(禁猜经纬度)" }
  | { kind: "INVALID"; reason: string }

export function classifyMapPosition(value: unknown): MapPositionClassification {
  if (value === null) return { kind: "NO_MARKER", reason: "position 为 null(实体仍在逻辑列表)" }
  if (Array.isArray(value) && value.length === 3 && value.every((x) => typeof x === "number")) {
    if ((value as number[]).every((x) => x === 0)) return { kind: "VALID_ORIGIN", note: "[0,0,0] 是合法位置" }
    return {
      kind: "PENDING_FRAME_RESOLUTION",
      note: "Vec3 数值有效,但 coordinateFrame 未定(禁猜经纬度)",
    }
  }
  return { kind: "INVALID", reason: "位置值形状不符(期望 null 或 Vec3)" }
}
