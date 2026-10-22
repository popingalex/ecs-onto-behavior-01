/**
 * MapEngineMount 协议替身测试(MAP-01/02/04 + 版本握手;无 Cesium)。
 */
import {
  classifyMapPosition,
  MapMountHost,
  MAP_MOUNT_PROTOCOL_VERSION,
  type HostToMapMessage,
  type MapToHostMessage,
  type MapTransport,
  type MountContext,
} from "../protocol"

class LoopbackTransport implements MapTransport {
  sent: HostToMapMessage[] = []
  private handler: ((m: MapToHostMessage) => void) | null = null
  private accept = true
  send(message: HostToMapMessage): void {
    this.sent.push(message)
  }
  onMessage(handler: (m: MapToHostMessage) => void): void {
    this.handler = handler
  }
  /** 替身回包通道。 */
  reply(m: MapToHostMessage): void {
    this.handler?.(m)
  }
  acceptsOrigin(): boolean {
    return this.accept
  }
  rejectOrigin(): void {
    this.accept = false
  }
}

const ctx: MountContext = {
  simulationId: "sim-1",
  branchId: "main",
  viewRef: "f3",
  sceneId: "chem-roaded",
  sceneRevision: "native-1",
}

export async function handshakeVersionAndOriginEnforced() {
  // MAP-01:版本不符 → error 状态;来源校验失败 → 拒绝初始化。
  const t1 = new LoopbackTransport()
  const host1 = new MapMountHost(t1)
  host1.init(ctx)
  t1.reply({ type: "READY", protocolVersion: "0", capabilities: [] })
  if (host1.stateName !== "error") throw new Error("版本不符应进入 error")

  const t2 = new LoopbackTransport()
  const host2 = new MapMountHost(t2)
  t2.rejectOrigin()
  host2.init(ctx)
  if (host2.stateName !== "error") throw new Error("来源校验失败应拒绝")

  const t3 = new LoopbackTransport()
  const host3 = new MapMountHost(t3)
  host3.init(ctx)
  t3.reply({ type: "READY", protocolVersion: MAP_MOUNT_PROTOCOL_VERSION, capabilities: ["select"] })
  if (host3.stateName !== "ready") throw new Error("正确握手应 ready")
  if (t3.sent[0]?.type !== "INIT" || t3.sent[0].protocolVersion !== MAP_MOUNT_PROTOCOL_VERSION)
    throw new Error("INIT 消息形状不符")
}

export async function selectionRoundTripWithoutLoop() {
  // MAP-02:宿主选择 → 地图确认(correlationId 一致)不回抛;地图自发点选才广播。
  const t = new LoopbackTransport()
  const host = new MapMountHost(t)
  host.init(ctx)
  t.reply({ type: "READY", protocolVersion: MAP_MOUNT_PROTOCOL_VERSION, capabilities: [] })
  const events: MapToHostMessage[] = []
  host.onHostEvent((m) => events.push(m))
  host.selectEntity("tank-1", "corr-1")
  // 地图把宿主选择按同 correlationId 回抛 → 吞掉(无新事件)。
  t.reply({ type: "ENTITY_SELECTED", entityId: "tank-1", correlationId: "corr-1" })
  if (events.some((e) => e.type === "ENTITY_SELECTED")) throw new Error("回环未被吞掉")
  // 异 correlationId → 视为地图侧新的自发点选:广播给宿主(不吞)。
  host.selectEntity("tank-2", "corr-2")
  t.reply({ type: "ENTITY_SELECTED", entityId: "tank-2", correlationId: "map-gen-1" })
  if (!events.some((e) => e.type === "ENTITY_SELECTED" && e.entityId === "tank-2"))
    throw new Error("地图自发点选未广播")
  // 地图自发点选(无 pendingSelect 语义,corr 由地图生成)→ 广播给宿主。
  t.reply({ type: "ENTITY_SELECTED", entityId: "ball_tank-1", correlationId: "map-1" })
  if (!events.some((e) => e.type === "ENTITY_SELECTED" && e.entityId === "ball_tank-1"))
    throw new Error("地图自发点选未广播")
}

export async function staleResponsesDroppedOnContextSwitch() {
  // MAP-04:切分支/时刻后,旧上下文回包丢弃并报 STALE_RESPONSE_DROPPED。
  const t = new LoopbackTransport()
  const host = new MapMountHost(t)
  host.init(ctx)
  t.reply({ type: "READY", protocolVersion: MAP_MOUNT_PROTOCOL_VERSION, capabilities: [] })
  const events: MapToHostMessage[] = []
  host.onHostEvent((m) => events.push(m))
  host.setViewTime({ ...ctx, branchId: "plan", viewRef: "f5" })
  // 旧场景的迟到 SCENE_LOADED → 丢弃(此处用 sceneId 变化模拟旧上下文)。
  t.reply({ type: "SCENE_LOADED", sceneId: "chem-evacuation", sceneRevision: "native-1", correlationId: "old" })
  if (!events.some((e) => e.type === "ERROR" && e.code === "STALE_RESPONSE_DROPPED"))
    throw new Error("迟到回包未丢弃")
  // 未就绪时的消息 → NOT_READY。
  const t2 = new LoopbackTransport()
  const host2 = new MapMountHost(t2)
  const events2: MapToHostMessage[] = []
  host2.onHostEvent((m) => events2.push(m))
  t2.reply({ type: "VIEW_CHANGED", camera: {}, context: ctx })
  if (!events2.some((e) => e.type === "ERROR" && e.code === "NOT_READY")) throw new Error("未就绪消息未拒绝")
}

export async function initTimeoutFailsClosed() {
  // MAP-01:READY 迟迟不到 → INIT_TIMEOUT 进入 error(不悬挂冒充连接)。
  const t2 = new LoopbackTransport()
  const host = new MapMountHost(t2, { initTimeoutMs: 40 })
  const events: MapToHostMessage[] = []
  host.onHostEvent((m) => events.push(m))
  host.init(ctx)
  await new Promise((r) => setTimeout(r, 90))
  if (host.stateName !== "error") throw new Error("超时未进入 error")
  if (!events.some((e) => e.type === "ERROR" && e.code === "INIT_TIMEOUT"))
    throw new Error("缺 INIT_TIMEOUT 事件")
  host.dispose()
  // READY 在超时后到达也应被拒绝(state 已 error)。
  t2.reply({ type: "READY", protocolVersion: MAP_MOUNT_PROTOCOL_VERSION, capabilities: [] })
  if (host.stateName !== "error") throw new Error("超时后 READY 不得翻转为 ready")
}

export async function positionPolicyRules() {
  // MAP-03/05:null 不渲染但实体保留;[0,0,0] 合法原点;Vec3 待 coordinateFrame,禁猜经纬度。
  if (classifyMapPosition(null).kind !== "NO_MARKER") throw new Error("null 应 NO_MARKER")
  if (classifyMapPosition([0, 0, 0]).kind !== "VALID_ORIGIN") throw new Error("原点应 VALID_ORIGIN")
  if (classifyMapPosition([117.6, 0, 38.7]).kind !== "PENDING_FRAME_RESOLUTION")
    throw new Error("未定坐标系的 Vec3 不得判定为可直接投影")
  if (classifyMapPosition("x").kind !== "INVALID") throw new Error("非 Vec3 应 INVALID")
  if (classifyMapPosition([1, 2]).kind !== "INVALID") throw new Error("长度不符应 INVALID")
}
