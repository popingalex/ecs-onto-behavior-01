import type { LogicGraphDocument } from "@/schema/model"
import { nodeTypeDef, topoOrder } from "@/services/domainBindingService"
import type {
  NodeExecution,
  RoundResult,
  SystemExecution,
} from "@/services/mock-executor"

/** P22 ViewModel：record → 层级选择、只读图布局、访问日志；页面不复制业务数字。 */

export interface ExecutionGroup {
  systemId: string
  executions: SystemExecution[]
}

export function executionGroups(record: RoundResult): ExecutionGroup[] {
  const map = new Map<string, SystemExecution[]>()
  for (const e of record.systemExecutions)
    map.set(e.systemId, [...(map.get(e.systemId) ?? []), e])
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([systemId, executions]) => ({ systemId, executions }))
}

export function findExecution(
  record: RoundResult,
  systemId: string | undefined,
  entityId: string | undefined,
): SystemExecution | undefined {
  return (
    record.systemExecutions.find(
      (e) => e.systemId === systemId && e.entityId === entityId,
    ) ?? record.systemExecutions[0]
  )
}

export function programFor(
  record: RoundResult,
  execution: SystemExecution | undefined,
): LogicGraphDocument | undefined {
  return execution ? record.programs[execution.programRef] : undefined
}

export function nodeTrace(
  record: RoundResult,
  execution: SystemExecution | undefined,
  nodeId: string | undefined,
): NodeExecution | undefined {
  if (!execution) return undefined
  return (
    record.nodeExecutions.find(
      (n) => n.executionId === execution.id && n.nodeId === nodeId,
    ) ?? record.nodeExecutions.find((n) => n.executionId === execution.id)
  )
}

/** 该执行的访问日志：读取的属性版本（used）与去向（proposed）。 */
export function accessLog(record: RoundResult, executionId: string) {
  return record.dependencyEdges.filter(
    (e) => e.source === executionId || e.target === executionId,
  )
}

/** 确定性自动布局：拓扑深度为列、列内序为行；只依赖记录里的固定图版本。 */
export function layoutProgram(
  program: LogicGraphDocument,
): Map<string, { x: number ;y: number ;w: number ;h: number }> {
  const order = topoOrder(program) ?? program.nodes.map((n) => n.id)
  const depth = new Map<string, number>()
  for (const id of order) {
    let d = 0
    for (const e of program.edges)
      if (e.target.nodeId === id)
        d = Math.max(d, (depth.get(e.source.nodeId) ?? 0) + 1)
    depth.set(id, d)
  }
  const perColumn = new Map<number, number>()
  const out = new Map<string, { x: number ;y: number ;w: number ;h: number }>()
  for (const id of order) {
    const node = program.nodes.find((n) => n.id === id)!
    const d = depth.get(id) ?? 0
    const row = perColumn.get(d) ?? 0
    perColumn.set(d, row + 1)
    const ports =
      Object.keys(node.inputs).length + Object.keys(node.outputs).length
    out.set(id, { x: d * 220 + 16, y: row * 128 + 16, w: 188, h: 64 + ports * 20 })
  }
  return out
}

export function nodeLabel(nodeId: string, program: LogicGraphDocument) {
  const node = program.nodes.find((n) => n.id === nodeId)
  return {
    type: node?.type ?? "?",
    label: node ? (nodeTypeDef(node.type)?.label ?? node.type) : "未知节点",
  }
}

/** 端口单位来源：declared = 记录里固定图快照的端口声明；heuristic = 快照缺该端口时的回落。 */
export interface PortUnit {
  unitId: string | null
  source: "declared" | "heuristic"
}

/**
 * 端口单位映射：优先取记录绑定的固定图版本（record.programs）里节点 inputs/outputs 的
 * TypeRef.unitId——那才是图定义的真实单位。端口不在快照中（记录与图版本不一致）时回落到
 * 启发式（输入 old/source → degC，其余随节点第一输出单位）并用 source 标注。
 */
export function portUnit(
  program: LogicGraphDocument | undefined,
  trace: NodeExecution,
  direction: "input" | "output",
  portId: string,
): PortUnit {
  const node = program?.nodes.find((n) => n.id === trace.nodeId)
  const declared = node
    ? direction === "input"
      ? node.inputs[portId]
      : node.outputs[portId]
    : undefined
  if (declared !== undefined)
    return { unitId: declared.unitId ?? null, source: "declared" }
  return {
    unitId:
      direction === "input" && (portId === "old" || portId === "source")
        ? "degC"
        : trace.outputUnitId,
    source: "heuristic",
  }
}
