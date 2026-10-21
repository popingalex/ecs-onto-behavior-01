import { MarkerType, type Edge, type Node } from "@xyflow/react"
import type {
  EditorLayout,
  ScheduleDocument,
  ScheduleEdge,
  ScheduleNode,
} from "@/schema/model"
import { defaultPosition } from "@/services/logicGraphCodec"
import { EDGE_KIND_LABEL } from "@/services/scheduleCompiler"

/**
 * ScheduleDocument + EditorLayout ⇄ React Flow nodes/edges。
 * React Flow 只是视图层：节点 data 携带完整领域节点，边 data 保留领域边 id 与 kind；
 * 回写时以原文档为基准保持节点 / 边顺序。位置写 EditorLayout，不进语义哈希。
 */
export interface ScheduleNodeData extends Record<string, unknown> {
  node: ScheduleNode
}
export type ScheduleFlowNode = Node<ScheduleNodeData, ScheduleNode["type"]>
export interface ScheduleEdgeData extends Record<string, unknown> {
  id: string
  kind: ScheduleEdge["kind"]
}
export type ScheduleFlowEdge = Edge<ScheduleEdgeData>

/** 边颜色按语义区分：order 主色、effect 成功色、product 危险色（理论上画不出来）。 */
export const EDGE_KIND_COLOR: Record<ScheduleEdge["kind"], string> = {
  order: "#087f8c",
  effect: "#17856b",
  product: "#c14555",
}

export function nodeToFlow(
  node: ScheduleNode,
  position: { x: number ;y: number },
): ScheduleFlowNode {
  const data: ScheduleNodeData = { node: structuredClone(node) }
  return { id: node.id, type: node.type, position: { ...position }, data }
}

export function edgeToFlow(edge: ScheduleEdge): ScheduleFlowEdge {
  const color = EDGE_KIND_COLOR[edge.kind]
  const data: ScheduleEdgeData = { id: edge.id, kind: edge.kind }
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: EDGE_KIND_LABEL[edge.kind],
    labelStyle: { fill: color, fontSize: 11 },
    labelBgStyle: { fill: "#ffffff", fillOpacity: 0.85 },
    style: { stroke: color, strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color },
    data,
  }
}

export function scheduleToFlow(
  schedule: ScheduleDocument,
  layout: EditorLayout,
): { nodes: ScheduleFlowNode[] ;edges: ScheduleFlowEdge[] } {
  return {
    nodes: schedule.nodes.map((n, i) =>
      nodeToFlow(n, layout.positions[n.id] ?? defaultPosition(i)),
    ),
    edges: schedule.edges.map(edgeToFlow),
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

/** React Flow 画布状态 → 调度文档 + 布局；base 提供元数据、视口与原有顺序。 */
export function flowToSchedule(
  nodes: ScheduleFlowNode[],
  edges: ScheduleFlowEdge[],
  base: { schedule: ScheduleDocument ;layout: EditorLayout },
): { schedule: ScheduleDocument ;layout: EditorLayout } {
  const domainNodes = nodes.map((n) => ({
    ...structuredClone(n.data.node),
    id: n.id,
  }))
  const domainEdges: ScheduleEdge[] = edges.map((e) => ({
    id: e.data?.id ?? e.id,
    source: e.source,
    target: e.target,
    kind: e.data?.kind ?? "order",
  }))
  const positions: EditorLayout["positions"] = {}
  for (const n of nodes)
    positions[n.id] = { x: Math.round(n.position.x), y: Math.round(n.position.y) }
  return {
    schedule: {
      ...base.schedule,
      nodes: ordered(
        domainNodes,
        (n) => n.id,
        base.schedule.nodes.map((n) => n.id),
      ),
      edges: ordered(
        domainEdges,
        (e) => e.id,
        base.schedule.edges.map((e) => e.id),
      ),
    },
    layout: { ...base.layout, positions },
  }
}
