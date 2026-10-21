import {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Controls,
  ReactFlow,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type Viewport,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { useEffect, useMemo, useRef, useState } from "react"
import type { EditorLayout, ScheduleDocument } from "@/schema/model"
import type { ScheduleModelView } from "@/services/scheduleCompiler"
import { applyEdit } from "@/stores/draftRegistry"
import type { ScheduleContent } from "@/stores/modelDocuments"
import { toast } from "@/stores/toast"
import {
  scheduleToFlow,
  type ScheduleFlowEdge,
  type ScheduleFlowNode,
} from "./codec"
import { systemNodeForFocus } from "./focus"
import { SCHEDULE_NODE_TYPES } from "./nodes"
import { DRAG_MIME, type DragPayload } from "./SystemLibrary"
import * as ops from "./ops"

/**
 * React Flow 画布：ScheduleDocument 草稿是事实来源，画布状态由 codec 派生。
 * 位置拖动 / 视口写 layout（coalesce 合并）；语义改动（增删节点、连线）走 applyEdit 单条历史。
 */
export default function ScheduleCanvas({
  docId,
  model,
  schedule,
  layout,
  readOnly,
  focusSystemId,
  onSelectionChange,
  onSystemPairConnect,
}: {
  docId: string
  model: ScheduleModelView
  schedule: ScheduleDocument
  layout: EditorLayout
  readOnly: boolean
  /** 路由 systemId 聚焦：选中对应 SystemNode 并平移视野，不写草稿。 */
  focusSystemId?: string
  onSelectionChange: (
    node: ScheduleFlowNode | null,
    edge: ScheduleFlowEdge | null,
  ) => void
  onSystemPairConnect: (source: string, target: string) => void
}) {
  const flow = useMemo(() => scheduleToFlow(schedule, layout), [schedule, layout])
  const [nodes, setNodes] = useState<ScheduleFlowNode[]>(flow.nodes)
  const [edges, setEdges] = useState<ScheduleFlowEdge[]>(flow.edges)
  const selectedRef = useRef<{ nodes: string[] ;edges: string[] }>({
    nodes: [],
    edges: [],
  })

  useEffect(() => {
    setNodes(
      flow.nodes.map((n) =>
        selectedRef.current.nodes.includes(n.id) ? { ...n, selected: true } : n,
      ),
    )
  }, [flow.nodes])
  useEffect(() => {
    setEdges(
      flow.edges.map((e) =>
        selectedRef.current.edges.includes(e.id) ? { ...e, selected: true } : e,
      ),
    )
  }, [flow.edges])

  const { screenToFlowPosition, setCenter } = useReactFlow()
  // 首挂载 fitView 会触发一次 onMoveEnd；那不是用户操作，不写进草稿。
  const isDefaultViewport =
    layout.viewport.x === 0 && layout.viewport.y === 0 && layout.viewport.zoom === 1
  const skipInitialMoveEnd = useRef(isDefaultViewport)
  /** 路由聚焦引起的视野移动同样不是用户编辑，不写 layout。 */
  const programmaticMove = useRef(false)
  const selectionCallback = useRef(onSelectionChange)
  selectionCallback.current = onSelectionChange
  const focusedSystem = useRef<string | null>(null)

  useEffect(() => {
    if (!focusSystemId || focusedSystem.current === focusSystemId) return
    const nodeId = systemNodeForFocus(schedule, focusSystemId)
    if (!nodeId) return
    const node = flow.nodes.find((n) => n.id === nodeId)
    if (!node) return
    focusedSystem.current = focusSystemId
    selectedRef.current = { nodes: [nodeId], edges: [] }
    setNodes((ns) => ns.map((n) => ({ ...n, selected: n.id === nodeId })))
    selectionCallback.current(node, null)
    programmaticMove.current = true
    void setCenter(node.position.x + 110, node.position.y + 60, {
      zoom: 1,
      duration: 300,
    })
  }, [focusSystemId, flow.nodes, schedule, setCenter])

  const onNodesChange = (changes: NodeChange<ScheduleFlowNode>[]) =>
    setNodes((ns) =>
      applyNodeChanges(changes.filter((c) => c.type !== "remove"), ns),
    )
  const onEdgesChange = (changes: EdgeChange<ScheduleFlowEdge>[]) =>
    setEdges((es) =>
      applyEdgeChanges(changes.filter((c) => c.type !== "remove"), es),
    )

  const commitPositions = () => {
    const positions = Object.fromEntries(
      nodes.map((n) => [
        n.id,
        { x: Math.round(n.position.x), y: Math.round(n.position.y) },
      ]),
    )
    applyEdit<ScheduleContent>(docId, "移动节点", (c) =>
      ops.withPositions(c, positions),
    )
  }

  return (
    <div className="h-full min-h-0 w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={SCHEDULE_NODE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={commitPositions}
        onConnect={(connection: Connection) => {
          if (!connection.source || !connection.target) return
          const source = schedule.nodes.find((n) => n.id === connection.source)
          const target = schedule.nodes.find((n) => n.id === connection.target)
          if (source?.type === "SystemNode" && target?.type === "SystemNode") {
            onSystemPairConnect(connection.source, connection.target)
            return
          }
          const result = ops.connectNodes(
            { schedule, layout },
            model,
            connection.source,
            connection.target,
            "order",
          )
          if (!result.ok) {
            toast(result.reason, "warning")
            return
          }
          applyEdit<ScheduleContent>(
            docId,
            `连接 ${connection.source} → ${connection.target}`,
            () => result.content,
          )
        }}
        onBeforeDelete={async ({ nodes: dn, edges: de }) => {
          if (readOnly) return false
          const label =
            dn.length > 0
              ? `删除节点 ${dn.map((n) => n.id).join("、")}`
              : `删除边 ${de.map((e) => e.id).join("、")}`
          applyEdit<ScheduleContent>(docId, label, (c) =>
            ops.removeEdges(
              ops.removeNodes(c, dn.map((n) => n.id)),
              de.map((e) => e.id),
            ),
          )
          return false
        }}
        onSelectionChange={({ nodes: sn, edges: se }) => {
          selectedRef.current = {
            nodes: sn.map((n) => n.id),
            edges: se.map((e) => e.id),
          }
          onSelectionChange(
            (sn[0] as ScheduleFlowNode | undefined) ?? null,
            (se[0] as ScheduleFlowEdge | undefined) ?? null,
          )
        }}
        onMoveEnd={(_event, viewport: Viewport) => {
          if (skipInitialMoveEnd.current) {
            skipInitialMoveEnd.current = false
            return
          }
          if (programmaticMove.current) {
            programmaticMove.current = false
            return
          }
          const rounded = {
            x: Math.round(viewport.x),
            y: Math.round(viewport.y),
            zoom: Math.round(viewport.zoom * 1000) / 1000,
          }
          applyEdit<ScheduleContent>(docId, "移动视口", (c) =>
            ops.withViewport(c, rounded),
          )
        }}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes(DRAG_MIME)) {
            e.preventDefault()
            e.dataTransfer.dropEffect = "move"
          }
        }}
        onDrop={(e) => {
          const raw = e.dataTransfer.getData(DRAG_MIME)
          if (!raw || readOnly) return
          e.preventDefault()
          const payload = JSON.parse(raw) as DragPayload
          const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
          const content: ScheduleContent = { schedule, layout }
          const result =
            payload.kind === "system"
              ? ops.addSystemNode(content, payload.systemId, position)
              : payload.kind === "commit"
                ? ops.addCommitNode(content, position)
                : model.constraints[0]
                  ? ops.addConstraintNode(
                      content,
                      payload.kind === "reducer" ? "ReducerNode" : "ContractNode",
                      model.constraints[0],
                      position,
                    )
                  : { ok: false as const, message: "模型中没有可用约束" }
          if (!result.ok) {
            toast(result.message, "warning")
            return
          }
          applyEdit<ScheduleContent>(docId, "拖入节点", () => result.content)
        }}
        defaultViewport={layout.viewport}
        fitView={isDefaultViewport}
        minZoom={0.3}
        maxZoom={2}
        deleteKeyCode={readOnly ? null : ["Backspace", "Delete"]}
        connectionRadius={48}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable
        proOptions={{ hideAttribution: false }}
      >
        <Background gap={16} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}
