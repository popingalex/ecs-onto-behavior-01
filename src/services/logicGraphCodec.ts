import type {
  WorkflowEdgeJSON,
  WorkflowJSON,
  WorkflowNodeJSON,
} from "@flowgram.ai/free-layout-editor"
import type {
  EditorLayout,
  LogicEdge,
  LogicGraphDocument,
  LogicNode,
} from "@/schema/model"
import { edgeIdFor } from "./domainBindingService"

/**
 * LogicGraphDocument + EditorLayout ⇄ FlowGram WorkflowJSON。
 * 节点 data 携带完整领域节点（端口类型、绑定、参数），边 data 保留领域边 id 与 kind；
 * 回写时以原文档为基准保持节点 / 边顺序，参数与元数据不经过 FlowGram。
 */
export interface LogicNodeData {
  node: LogicNode
}
export interface LogicEdgeData {
  id: string
  kind: LogicEdge["kind"]
}

export class LogicGraphCodecError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "LogicGraphCodecError"
  }
}

/** 布局里没有位置的节点：按文档顺序排成一行行网格，保证确定性。 */
export function defaultPosition(index: number): { x: number ;y: number } {
  return { x: (index % 5) * 250, y: 100 + Math.floor(index / 5) * 200 }
}

export function nodeToJSON(
  node: LogicNode,
  position: { x: number ;y: number },
): WorkflowNodeJSON {
  const data: LogicNodeData = { node: structuredClone(node) }
  return {
    id: node.id,
    type: node.type,
    meta: { position: { ...position } },
    data,
  }
}

export function edgeToJSON(edge: LogicEdge): WorkflowEdgeJSON {
  const data: LogicEdgeData = { id: edge.id, kind: edge.kind }
  return {
    sourceNodeID: edge.source.nodeId,
    sourcePortID: edge.source.portId,
    targetNodeID: edge.target.nodeId,
    targetPortID: edge.target.portId,
    data,
  }
}

export function programToWorkflow(
  program: LogicGraphDocument,
  layout: EditorLayout,
): WorkflowJSON {
  return {
    nodes: program.nodes.map((n, i) =>
      nodeToJSON(n, layout.positions[n.id] ?? defaultPosition(i)),
    ),
    edges: program.edges.map(edgeToJSON),
  }
}

export function edgeFromJSON(e: WorkflowEdgeJSON): LogicEdge {
  if (e.sourcePortID === undefined || e.targetPortID === undefined)
    throw new LogicGraphCodecError(
      `连线 ${e.sourceNodeID} → ${e.targetNodeID} 缺少端口 id`,
    )
  const source = { nodeId: e.sourceNodeID, portId: String(e.sourcePortID) }
  const target = { nodeId: e.targetNodeID, portId: String(e.targetPortID) }
  const data = (e.data ?? {}) as Partial<LogicEdgeData>
  return {
    id: data.id ?? edgeIdFor(source, target),
    kind: data.kind ?? "data",
    source,
    target,
  }
}

function ordered<T>(
  items: T[],
  key: (t: T) => string,
  baseOrder: string[],
): T[] {
  const rank = new Map(baseOrder.map((id, i) => [id, i]))
  return items
    .map((item, i) => ({ item, i, r: rank.get(key(item)) }))
    .sort((a, b) => (a.r ?? Infinity) - (b.r ?? Infinity) || a.i - b.i)
    .map((x) => x.item)
}

/** FlowGram 画布 JSON → 程序 + 布局；base 提供参数、元数据、视口与原有顺序。 */
export function workflowToProgram(
  json: WorkflowJSON,
  base: { program: LogicGraphDocument ;layout: EditorLayout },
): { program: LogicGraphDocument ;layout: EditorLayout } {
  const nodes = json.nodes.map((n): LogicNode => {
    const data = n.data as Partial<LogicNodeData> | undefined
    if (!data?.node)
      throw new LogicGraphCodecError(`节点 ${n.id} 缺少领域数据 data.node`)
    if (data.node.type !== String(n.type))
      throw new LogicGraphCodecError(
        `节点 ${n.id} 的类型 ${String(n.type)} 与领域数据 ${data.node.type} 不一致`,
      )
    return { ...structuredClone(data.node), id: n.id }
  })
  const edges = json.edges.map(edgeFromJSON)
  const positions: EditorLayout["positions"] = {}
  for (const n of json.nodes) {
    const p = n.meta?.position
    if (p) positions[n.id] = { x: Math.round(p.x), y: Math.round(p.y) }
  }
  return {
    program: {
      ...base.program,
      nodes: ordered(
        nodes,
        (n) => n.id,
        base.program.nodes.map((n) => n.id),
      ),
      edges: ordered(
        edges,
        (e) => e.id,
        base.program.edges.map((e) => e.id),
      ),
    },
    layout: { ...base.layout, positions },
  }
}
