import {
  refKey,
  sameRef,
  type AttributeSchema,
  type ConstraintDef,
  type DomainDiagnostic,
  type ObjectRef,
  type ScheduleDocument,
  type ScheduleEdge,
  type ScheduleNode,
  type SystemDefinition,
} from "@/schema/model"

/**
 * 外层调度编译：ScheduleDocument + System 定义 → 逻辑并行组、归约与提交阶段、访问分析和诊断。
 * 只依据边的语义（order / effect / product）与访问声明推导，不看节点在画布上的位置。
 */
export interface ScheduleModelView {
  systems: SystemDefinition[]
  constraints: ConstraintDef[]
  attributes: AttributeSchema[]
  /** 所有 System 读取的 previous 视图所在提交。 */
  baseCommit: string
}

export type SystemLinkKind = "order" | "product"
export type ConnectionCheck = { ok: true ;kind: ScheduleEdge["kind"] } | {
  ok: false
  reason: string
}

export const EDGE_KIND_LABEL: Record<ScheduleEdge["kind"], string> = {
  order: "顺序 order",
  effect: "效果 effect",
  product: "中间产物 product",
}
export const NODE_TYPE_LABEL: Record<ScheduleNode["type"], string> = {
  SystemNode: "System",
  ReducerNode: "归约器",
  ContractNode: "合同裁决",
  CommitNode: "原子提交",
}

export const PRODUCT_UNSUPPORTED =
  "product（显式中间产物）边要求执行器把一个 System 的输出交给另一个 System；当前 mock 执行器不支持，因此不创建这条边。只需要先后顺序时请改用 order 边。"

const isConstraintNode = (n: ScheduleNode): n is Extract<ScheduleNode, {
  constraintRef: ObjectRef
}> => n.type === "ReducerNode" || n.type === "ContractNode"

/** access 声明里的 `self.<propertyId>` → propertyId。 */
export function accessProperty(path: string): string {
  return path.startsWith("self.") ? path.slice(5) : path
}

/** System 的贡献属性中，使用 constraintRef 归约的那些。 */
export function contributionsFor(
  system: SystemDefinition,
  constraintRef: ObjectRef,
  attributes: AttributeSchema[],
): string[] {
  return system.access.contribute.map(accessProperty).filter((pid) => {
    const a = attributes.find((x) => x.id === pid)
    return (
      a?.writeMode === "contribution" && sameRef(a.reducerRef, constraintRef)
    )
  })
}

function nodeLabel(n: ScheduleNode | undefined): string {
  if (!n) return "（不存在的节点）"
  if (n.type === "SystemNode") return n.systemRef
  if (isConstraintNode(n)) return refKey(n.constraintRef)
  return "提交"
}

/** 按两端节点类型决定边的语义；不合法的组合给出原因。 */
export function checkConnection(
  schedule: ScheduleDocument,
  model: ScheduleModelView,
  sourceId: string,
  targetId: string,
  systemLink: SystemLinkKind,
): ConnectionCheck {
  const source = schedule.nodes.find((n) => n.id === sourceId)
  const target = schedule.nodes.find((n) => n.id === targetId)
  if (!source || !target) return { ok: false, reason: "连线端点不存在" }
  if (source.id === target.id)
    return { ok: false, reason: "节点不能连接到自身" }
  if (
    schedule.edges.some((e) => e.source === sourceId && e.target === targetId)
  )
    return {
      ok: false,
      reason: `${nodeLabel(source)} → ${nodeLabel(target)} 已有连线`,
    }
  if (source.type === "CommitNode")
    return { ok: false, reason: "原子提交是调度的终点，不能再有出边" }

  if (target.type === "SystemNode") {
    if (source.type === "SystemNode")
      return systemLink === "product"
        ? { ok: false, reason: PRODUCT_UNSUPPORTED }
        : { ok: true, kind: "order" }
    return {
      ok: false,
      reason:
        "归约结果只在原子提交之后才成为新状态；System 读取 previous 视图，不能排在归约器之后",
    }
  }
  if (isConstraintNode(target)) {
    if (source.type !== "SystemNode")
      return {
        ok: false,
        reason: "归约器 / 合同裁决只接收 System 的效果，不能串联",
      }
    const system = model.systems.find((s) => s.id === source.systemRef)
    if (!system)
      return { ok: false, reason: `System ${source.systemRef} 不存在` }
    const props = contributionsFor(
      system,
      target.constraintRef,
      model.attributes,
    )
    if (props.length === 0)
      return {
        ok: false,
        reason: `${system.id} 没有使用 ${refKey(target.constraintRef)} 归约的贡献属性（contribute: ${system.access.contribute.join("、") || "无"}）`,
      }
    return { ok: true, kind: "effect" }
  }
  // target 为提交节点
  if (isConstraintNode(source)) return { ok: true, kind: "order" }
  const system = model.systems.find(
    (s) =>
      s.id ===
      (source as Extract<ScheduleNode, { type: "SystemNode" }>).systemRef,
  )
  if (system && system.access.exclusive.length > 0)
    return { ok: true, kind: "order" }
  return {
    ok: false,
    reason: `${nodeLabel(source)} 没有独占写入；它的贡献必须先流入归约器，再由归约器提交`,
  }
}

export interface PlannedSystem {
  nodeId: string
  systemId: string
  label: string
  enabled: boolean
  queryRef: string
  programRef: string
  reads: string[]
  contributes: string[]
  exclusive: string[]
  /** 通过 order 边排在它之前的 System。 */
  after: string[]
}
export interface PlanGroup {
  index: number
  systems: PlannedSystem[]
}
export interface PlannedReducer {
  nodeId: string
  type: "ReducerNode" | "ContractNode"
  constraint: string
  strategy: string | null
  inputs: Array<{ systemId: string ;properties: string[] }>
}
export interface ConcurrencyNote {
  id: string
  level: "safe" | "ordered" | "conflict"
  systems: [string, string]
  property: string
  message: string
}
export interface SchedulePlan {
  executable: boolean
  groups: PlanGroup[]
  reducers: PlannedReducer[]
  commitNodeId: string | null
  concurrency: ConcurrencyNote[]
  /** 顺序边的数据可见性解释。 */
  orderNotes: string[]
  diagnostics: DomainDiagnostic[]
}

/** 找出图中的一个环（返回环上的节点 id），没有则返回 null。 */
function findCycle(nodeIds: string[], edges: ScheduleEdge[]): string[] | null {
  const out = new Map<string, string[]>(nodeIds.map((id) => [id, []]))
  for (const e of edges) out.get(e.source)?.push(e.target)
  const state = new Map<string, 0 | 1 | 2>()
  const stack: string[] = []
  const visit = (id: string): string[] | null => {
    state.set(id, 1)
    stack.push(id)
    for (const next of out.get(id) ?? []) {
      if (state.get(next) === 1) return stack.slice(stack.indexOf(next))
      if (!state.get(next)) {
        const found = visit(next)
        if (found) return found
      }
    }
    stack.pop()
    state.set(id, 2)
    return null
  }
  for (const id of nodeIds) {
    if (state.get(id)) continue
    const found = visit(id)
    if (found) return found
  }
  return null
}

function reachable(from: string, edges: ScheduleEdge[]): Set<string> {
  const seen = new Set<string>()
  const queue = [from]
  while (queue.length) {
    const id = queue.shift()!
    for (const e of edges)
      if (e.source === id && !seen.has(e.target))
        seen.add(e.target), queue.push(e.target)
  }
  return seen
}

export function compileSchedule(
  schedule: ScheduleDocument,
  model: ScheduleModelView,
): SchedulePlan {
  const diagnostics: DomainDiagnostic[] = []
  const add = (
    severity: DomainDiagnostic["severity"],
    code: string,
    message: string,
    nodeId?: string,
  ) =>
    diagnostics.push({
      id: `${schedule.id}:${code}:${diagnostics.length + 1}`,
      severity,
      code,
      message,
      target: { documentId: schedule.id, nodeId },
    })

  const nodes = new Map(schedule.nodes.map((n) => [n.id, n]))
  const systemNodes = schedule.nodes.filter(
    (n): n is Extract<ScheduleNode, { type: "SystemNode" }> =>
      n.type === "SystemNode",
  )
  const systemOf = (n: Extract<ScheduleNode, { type: "SystemNode" }>) =>
    model.systems.find((s) => s.id === n.systemRef)

  // 1. 结构：悬空、语义不匹配、product
  const validEdges: ScheduleEdge[] = []
  for (const e of schedule.edges) {
    const source = nodes.get(e.source)
    const target = nodes.get(e.target)
    if (!source || !target) {
      add(
        "error",
        "SCHEDULE_EDGE_DANGLING",
        `调度边 ${e.id} 指向不存在的节点`,
        e.target,
      )
      continue
    }
    validEdges.push(e)
    if (e.kind === "product") {
      add(
        "error",
        "SCHEDULE_PRODUCT_UNSUPPORTED",
        `边 ${e.id}（${nodeLabel(source)} → ${nodeLabel(target)}）：${PRODUCT_UNSUPPORTED}`,
        e.source,
      )
      continue
    }
    const expected = checkConnection(
      { ...schedule, edges: [] },
      model,
      e.source,
      e.target,
      "order",
    )
    if (!expected.ok)
      add(
        "error",
        "SCHEDULE_EDGE_INVALID",
        `边 ${e.id}：${expected.reason}`,
        e.target,
      )
    else if (expected.kind !== e.kind)
      add(
        "error",
        "SCHEDULE_EDGE_KIND",
        `边 ${e.id} 标为 ${e.kind}，但 ${nodeLabel(source)} → ${nodeLabel(target)} 只能是 ${expected.kind}`,
        e.target,
      )
  }

  // 2. 节点引用与唯一性
  const seenSystems = new Map<string, string>()
  for (const n of systemNodes) {
    const s = systemOf(n)
    if (!s)
      add(
        "error",
        "SCHEDULE_SYSTEM_MISSING",
        `调度节点 ${n.id} 引用了不存在的 System ${n.systemRef}`,
        n.id,
      )
    else if (!s.enabled)
      add(
        "warning",
        "SCHEDULE_SYSTEM_DISABLED",
        `System ${s.id} 已停用：仍保留在调度中，但执行时跳过，不产生贡献`,
        n.id,
      )
    if (seenSystems.has(n.systemRef))
      add(
        "error",
        "SCHEDULE_SYSTEM_DUPLICATE",
        `System ${n.systemRef} 在调度中出现两次（${seenSystems.get(n.systemRef)}、${n.id}）`,
        n.id,
      )
    seenSystems.set(n.systemRef, n.id)
  }
  const commits = schedule.nodes.filter((n) => n.type === "CommitNode")
  if (commits.length === 0)
    add(
      "error",
      "SCHEDULE_COMMIT_MISSING",
      "调度没有原子提交节点：计算结果无法形成新提交",
    )
  if (commits.length > 1)
    add(
      "error",
      "SCHEDULE_COMMIT_MULTIPLE",
      `调度有 ${commits.length} 个提交节点；一次回合只能原子提交一次`,
      commits[1].id,
    )
  for (const n of schedule.nodes)
    if (
      isConstraintNode(n) &&
      !model.constraints.some((c) => sameRef(c, n.constraintRef))
    )
      add(
        "error",
        "CONSTRAINT_REF_MISSING",
        `调度节点 ${n.id} 的约束 ${refKey(n.constraintRef)} 不存在`,
        n.id,
      )

  // 3. 环
  const cycle = findCycle(
    schedule.nodes.map((n) => n.id),
    validEdges,
  )
  if (cycle)
    add(
      "error",
      "SCHEDULE_CYCLE",
      `调度成环：${[...cycle, cycle[0]].map((id) => nodeLabel(nodes.get(id))).join(" → ")}；成环的调度不能执行`,
      cycle[0],
    )

  // 4. 逻辑并行组：只按 System 之间的 order 边分层
  const orderEdges = validEdges.filter(
    (e) =>
      e.kind === "order" &&
      nodes.get(e.source)?.type === "SystemNode" &&
      nodes.get(e.target)?.type === "SystemNode",
  )
  const planned = new Map<string, PlannedSystem>()
  for (const n of systemNodes) {
    const s = systemOf(n)
    planned.set(n.id, {
      nodeId: n.id,
      systemId: n.systemRef,
      label: s?.label ?? n.systemRef,
      enabled: s?.enabled ?? false,
      queryRef: s ? refKey(s.queryRef) : "—",
      programRef: s ? refKey(s.programRef) : "—",
      reads: s?.access.readPrevious.map(accessProperty) ?? [],
      contributes: s?.access.contribute.map(accessProperty) ?? [],
      exclusive: s?.access.exclusive.map(accessProperty) ?? [],
      after: orderEdges
        .filter((e) => e.target === n.id)
        .map(
          (e) =>
            (nodes.get(e.source) as Extract<ScheduleNode, {
              type: "SystemNode"
            }>).systemRef,
        ),
    })
  }
  const groups: PlanGroup[] = []
  if (!cycle) {
    const remaining = new Set(systemNodes.map((n) => n.id))
    while (remaining.size) {
      const ready = [...remaining].filter(
        (id) =>
          !orderEdges.some((e) => e.target === id && remaining.has(e.source)),
      )
      if (ready.length === 0) break
      ready.sort()
      groups.push({
        index: groups.length + 1,
        systems: ready.map((id) => planned.get(id)!),
      })
      ready.forEach((id) => remaining.delete(id))
    }
  }

  // 5. 效果路由：每个启用 System 的贡献必须流入使用对应规则的归约器，归约器必须流向提交
  const reducers: PlannedReducer[] = []
  for (const n of schedule.nodes) {
    if (!isConstraintNode(n)) continue
    const constraint = model.constraints.find((c) =>
      sameRef(c, n.constraintRef),
    )
    const inputs = validEdges
      .filter(
        (e) =>
          e.target === n.id &&
          e.kind === "effect" &&
          nodes.get(e.source)?.type === "SystemNode",
      )
      .map((e) => {
        const system = model.systems.find(
          (s) =>
            s.id ===
            (nodes.get(e.source) as Extract<ScheduleNode, {
              type: "SystemNode"
            }>).systemRef,
        )
        return {
          systemId: system?.id ?? e.source,
          properties: system
            ? contributionsFor(system, n.constraintRef, model.attributes)
            : [],
        }
      })
    reducers.push({
      nodeId: n.id,
      type: n.type,
      constraint: refKey(n.constraintRef),
      strategy: constraint?.strategy ?? null,
      inputs,
    })
    if (inputs.length === 0)
      add(
        "warning",
        "SCHEDULE_REDUCER_IDLE",
        `${NODE_TYPE_LABEL[n.type]} ${n.id} 没有任何 System 的效果流入`,
        n.id,
      )
    if (commits[0] && !reachable(n.id, validEdges).has(commits[0].id))
      add(
        "error",
        "SCHEDULE_REDUCER_UNCOMMITTED",
        `${NODE_TYPE_LABEL[n.type]} ${n.id} 的结果没有流向原子提交，归约后的值会丢失`,
        n.id,
      )
  }
  for (const n of systemNodes) {
    const s = systemOf(n)
    if (!s || !s.enabled) continue
    for (const pid of s.access.contribute.map(accessProperty)) {
      const attr = model.attributes.find((a) => a.id === pid)
      if (!attr?.reducerRef) continue
      const routed = validEdges.some(
        (e) =>
          e.source === n.id &&
          e.kind === "effect" &&
          sameRef(
            (nodes.get(e.target) as { constraintRef?: ObjectRef })
              .constraintRef,
            attr.reducerRef,
          ),
      )
      if (!routed)
        add(
          "error",
          "SCHEDULE_EFFECT_UNROUTED",
          `${s.id} 对 ${pid} 的贡献没有流入 ${refKey(attr.reducerRef)} 归约器，执行时会被丢弃`,
          n.id,
        )
    }
    if (
      s.access.exclusive.length > 0 &&
      commits[0] &&
      !reachable(n.id, validEdges).has(commits[0].id)
    )
      add(
        "error",
        "SCHEDULE_EXCLUSIVE_UNCOMMITTED",
        `${s.id} 的独占写入没有流向原子提交`,
        n.id,
      )
  }

  // 6. 访问分析：同组并行只看访问声明；不同组的先后不改变读取视图
  const concurrency: ConcurrencyNote[] = []
  const groupOf = new Map<string, number>()
  groups.forEach((g) =>
    g.systems.forEach((s) => groupOf.set(s.nodeId, g.index)),
  )
  const enabled = [...planned.values()].filter((p) => p.enabled)
  for (let i = 0; i < enabled.length; i++)
    for (let j = i + 1; j < enabled.length; j++) {
      const a = enabled[i]
      const b = enabled[j]
      const sameGroup = groupOf.get(a.nodeId) === groupOf.get(b.nodeId)
      const props = new Set([
        ...a.reads,
        ...a.contributes,
        ...a.exclusive,
        ...b.reads,
        ...b.contributes,
        ...b.exclusive,
      ])
      for (const pid of props) {
        const id = `${a.systemId}|${b.systemId}|${pid}`
        const pair: [string, string] = [a.systemId, b.systemId]
        const bothExclusive =
          a.exclusive.includes(pid) && b.exclusive.includes(pid)
        const mixed =
          (a.exclusive.includes(pid) && b.contributes.includes(pid)) ||
          (b.exclusive.includes(pid) && a.contributes.includes(pid))
        if (bothExclusive || mixed) {
          const message = bothExclusive
            ? `${a.systemId} 与 ${b.systemId} 都独占写 ${pid}；同一回合只能有一个独占写者`
            : `${pid} 同时被独占写和贡献写，无法确定提交值`
          concurrency.push({
            id,
            level: "conflict",
            systems: pair,
            property: pid,
            message,
          })
          add("error", "SCHEDULE_WRITE_CONFLICT", message, b.nodeId)
        } else if (a.contributes.includes(pid) && b.contributes.includes(pid)) {
          const attr = model.attributes.find((x) => x.id === pid)
          concurrency.push({
            id,
            level: sameGroup ? "safe" : "ordered",
            systems: pair,
            property: pid,
            message: `都只提交对 ${pid} 的私有贡献，由 ${
              attr?.reducerRef ? refKey(attr.reducerRef) : "归约器"
            } 统一裁决${sameGroup ? "，可以并行" : ""}`,
          })
        } else if (
          (a.reads.includes(pid) &&
            (b.contributes.includes(pid) || b.exclusive.includes(pid))) ||
          (b.reads.includes(pid) &&
            (a.contributes.includes(pid) || a.exclusive.includes(pid)))
        ) {
          concurrency.push({
            id,
            level: sameGroup ? "safe" : "ordered",
            systems: pair,
            property: pid,
            message: `读取 ${pid} 的 previous 视图（${model.baseCommit}），不受另一方暂存写入影响`,
          })
        }
      }
    }

  const orderNotes = orderEdges.map((e) => {
    const a = planned.get(e.source)!
    const b = planned.get(e.target)!
    return `${b.systemId} 排在 ${a.systemId} 之后执行，但仍读取 ${model.baseCommit} 的 previous 值，看不到 ${a.systemId} 的暂存贡献；新值只在原子提交后可见。`
  })

  return {
    executable: !diagnostics.some((d) => d.severity === "error"),
    groups,
    reducers,
    commitNodeId: commits[0]?.id ?? null,
    concurrency,
    orderNotes,
    diagnostics,
  }
}
