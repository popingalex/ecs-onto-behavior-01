import type { ObjectRef, ScheduleEdge, ScheduleNode } from "@/schema/model"
import {
  checkConnection,
  type ScheduleModelView,
  type SystemLinkKind,
} from "@/services/scheduleCompiler"
import type { ScheduleContent } from "@/stores/modelDocuments"

/**
 * 调度草稿的纯函数操作：全部返回新内容（不原地修改），由调用方走 applyEdit。
 * 连线合法性一律经过 scheduleCompiler.checkConnection，UI 不另写一份规则。
 */
export type OpResult =
  | { ok: true ;content: ScheduleContent }
  | { ok: false ;message: string }

const fail = (message: string): OpResult => ({ ok: false, message })

function nextNumericId(existing: string[], prefix: string): string {
  let i = 1
  const taken = new Set(existing)
  while (taken.has(`${prefix}-${i}`)) i++
  return `${prefix}-${i}`
}

export function nextEdgeId(content: ScheduleContent): string {
  return nextNumericId(content.schedule.edges.map((e) => e.id), "se")
}

/** 拖入 System：同一 System 在调度中只能出现一次（编译器也按重复报错）。 */
export function addSystemNode(
  content: ScheduleContent,
  systemId: string,
  position: { x: number ;y: number },
): OpResult {
  if (
    content.schedule.nodes.some(
      (n) => n.type === "SystemNode" && n.systemRef === systemId,
    )
  )
    return fail(`System ${systemId} 已在调度中；同一 System 只能出现一次`)
  const node: ScheduleNode = { id: systemId, type: "SystemNode", systemRef: systemId }
  return {
    ok: true,
    content: {
      schedule: {
        ...content.schedule,
        nodes: [...content.schedule.nodes, node],
      },
      layout: {
        ...content.layout,
        positions: {
          ...content.layout.positions,
          [node.id]: { x: Math.round(position.x), y: Math.round(position.y) },
        },
      },
    },
  }
}

export function addConstraintNode(
  content: ScheduleContent,
  type: "ReducerNode" | "ContractNode",
  constraintRef: ObjectRef,
  position: { x: number ;y: number },
): OpResult {
  const prefix = type === "ReducerNode" ? "reduce" : "contract"
  const node: ScheduleNode = {
    id: nextNumericId(content.schedule.nodes.map((n) => n.id), prefix),
    type,
    constraintRef,
  }
  return {
    ok: true,
    content: {
      schedule: {
        ...content.schedule,
        nodes: [...content.schedule.nodes, node],
      },
      layout: {
        ...content.layout,
        positions: {
          ...content.layout.positions,
          [node.id]: { x: Math.round(position.x), y: Math.round(position.y) },
        },
      },
    },
  }
}

/** 原子提交每回合只能有一个。 */
export function addCommitNode(
  content: ScheduleContent,
  position: { x: number ;y: number },
): OpResult {
  if (content.schedule.nodes.some((n) => n.type === "CommitNode"))
    return fail("调度已有原子提交节点；一次回合只能原子提交一次")
  const node: ScheduleNode = { id: "commit", type: "CommitNode" }
  return {
    ok: true,
    content: {
      schedule: {
        ...content.schedule,
        nodes: [...content.schedule.nodes, node],
      },
      layout: {
        ...content.layout,
        positions: {
          ...content.layout.positions,
          [node.id]: { x: Math.round(position.x), y: Math.round(position.y) },
        },
      },
    },
  }
}

/** 删除节点连同其出入边。 */
export function removeNodes(
  content: ScheduleContent,
  nodeIds: string[],
): ScheduleContent {
  const gone = new Set(nodeIds)
  return {
    schedule: {
      ...content.schedule,
      nodes: content.schedule.nodes.filter((n) => !gone.has(n.id)),
      edges: content.schedule.edges.filter(
        (e) => !gone.has(e.source) && !gone.has(e.target),
      ),
    },
    layout: {
      ...content.layout,
      positions: Object.fromEntries(
        Object.entries(content.layout.positions).filter(([id]) => !gone.has(id)),
      ),
    },
  }
}

export function removeEdges(
  content: ScheduleContent,
  edgeIds: string[],
): ScheduleContent {
  const gone = new Set(edgeIds)
  return {
    ...content,
    schedule: {
      ...content.schedule,
      edges: content.schedule.edges.filter((e) => !gone.has(e.id)),
    },
  }
}

/** 连线：先过 checkConnection（order / effect 推导、product 拒绝），再生成新边。 */
export function connectNodes(
  content: ScheduleContent,
  model: ScheduleModelView,
  source: string,
  target: string,
  systemLink: SystemLinkKind,
): { ok: true ;content: ScheduleContent ;edge: ScheduleEdge } | {
  ok: false
  reason: string
} {
  const check = checkConnection(
    content.schedule,
    model,
    source,
    target,
    systemLink,
  )
  if (!check.ok) return { ok: false, reason: check.reason }
  const edge: ScheduleEdge = {
    id: nextEdgeId(content),
    source,
    target,
    kind: check.kind,
  }
  return {
    ok: true,
    edge,
    content: {
      ...content,
      schedule: {
        ...content.schedule,
        edges: [...content.schedule.edges, edge],
      },
    },
  }
}

/** 拖动结束 / 视口变化：只写布局，调度语义不变。 */
export function withPositions(
  content: ScheduleContent,
  positions: Record<string, { x: number ;y: number }>,
): ScheduleContent {
  return { ...content, layout: { ...content.layout, positions } }
}

export function withViewport(
  content: ScheduleContent,
  viewport: { x: number ;y: number ;zoom: number },
): ScheduleContent {
  return { ...content, layout: { ...content.layout, viewport } }
}

export function setConstraintRef(
  content: ScheduleContent,
  nodeId: string,
  constraintRef: ObjectRef,
): ScheduleContent {
  return {
    ...content,
    schedule: {
      ...content.schedule,
      nodes: content.schedule.nodes.map((n) =>
        n.id === nodeId && (n.type === "ReducerNode" || n.type === "ContractNode")
          ? { ...n, constraintRef }
          : n,
      ),
    },
  }
}
