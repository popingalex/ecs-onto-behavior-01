import { useEffect, useMemo, useRef } from "react"
import {
  EditorRenderer,
  FreeLayoutEditorProvider,
  TransformData,
  useClientContext,
  usePlaygroundTools,
  WorkflowContentChangeType,
  WorkflowNodeEntity,
  type FreeLayoutProps,
  type WorkflowLineEntity,
} from "@flowgram.ai/free-layout-editor"
import "@flowgram.ai/free-layout-editor/index.css"
import { Maximize, Minus, Plus } from "lucide-react"
import { IconButton } from "@/components/ui/Button"
import type { DomainDiagnostic, LogicGraphDocument } from "@/schema/model"
import {
  checkEdge,
  compatible,
  connect,
  createNode,
  edgeIdFor,
  nextNodeId,
  nodeTypeDef,
  removeEdges,
  removeNodes,
  type DomainModel,
} from "@/services/domainBindingService"
import {
  programToWorkflow,
  type LogicEdgeData,
} from "@/services/logicGraphCodec"
import { applyEdit, getDocument } from "@/stores/draftRegistry"
import {
  useModelDocument,
  type ProgramContent,
} from "@/stores/modelDocuments"
import { toast } from "@/stores/toast"
import LogicNodeCard, { logicNodeRegistries } from "./LogicNodeCard"
import { LOGIC_NODE_MIME } from "./editorContext"
import { NODE_WIDTH } from "./geometry"

/**
 * FlowGram 画布封装。LogicGraphDocument（草稿文档）是唯一事实来源：
 * 画布事件只作为意图翻译成 connect / removeEdges / removeNodes / 布局更新写入文档；
 * 文档修订变化（表单、撤销重做、导入）再整体回灌画布。布局只写 layout，不进语义哈希。
 */
interface SyncState {
  /** 回灌画布期间忽略画布事件。 */
  muted: boolean
  /** 画布自己发起的 applyEdit 预期到达的 revision：跳过那次回灌。 */
  skipRevision: number | null
}

interface LiveState {
  program: LogicGraphDocument
  model: DomainModel
  diagnostics: DomainDiagnostic[]
}

export interface LogicCanvasProps {
  docId: string
  model: DomainModel
  program: LogicGraphDocument
  diagnostics: DomainDiagnostic[]
  readOnly: boolean
  onSelectionChange: (nodeId: string | null) => void
  focusRequest: { nodeId: string; seq: number } | null
}

function LogicCanvasInner({
  docId,
  sync,
  live,
  readOnly,
  onSelectionChange,
  focusRequest,
}: {
  docId: string
  sync: React.MutableRefObject<SyncState>
  live: React.MutableRefObject<LiveState>
  readOnly: boolean
  onSelectionChange: (nodeId: string | null) => void
  focusRequest: LogicCanvasProps["focusRequest"]
}) {
  const ctx = useClientContext()
  const tools = usePlaygroundTools()
  const doc = useModelDocument<ProgramContent>(docId)
  const revision = doc?.revision

  // 文档修订变化（撤销 / 重做 / 表单 / 导入）→ 整体回灌画布；画布发起的修订跳过。
  useEffect(() => {
    if (!doc) return
    if (sync.current.skipRevision === revision) {
      sync.current.skipRevision = null
      return
    }
    const selectedIds = ctx.selection.selection.map((e) => e.id)
    sync.current.muted = true
    // fromJSON 不会销毁新 JSON 里已不存在的线条实体（删除边会留幻影），先清空再回灌。
    ctx.document.clear()
    ctx.document.fromJSON(
      programToWorkflow(doc.content.program, doc.content.layout),
    )
    const timer = setTimeout(() => {
      sync.current.muted = false
      const nodes = ctx.document
        .getAllNodes()
        .filter((n) => selectedIds.includes(n.id))
      ctx.selection.selection = nodes
    }, 0)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision])

  // 画布选择 → 右栏表单
  useEffect(() => {
    const disposable = ctx.selection.onSelectionChanged(
      (entities: unknown[]) => {
        const node = entities.find(
          (e): e is WorkflowNodeEntity => e instanceof WorkflowNodeEntity,
        )
        onSelectionChange(node?.id ?? null)
      },
    )
    return () => disposable.dispose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 线条选中：默认线条渲染不带点击处理，hover 插件在 mousedown 只会清空选择；
  // 用 click（在它们之后触发）把 8px 内的线条补选上，随后 Delete 走默认快捷键断线。
  useEffect(() => {
    const playgroundNode = ctx.playground.node
    const onClick = (e: MouseEvent) => {
      const pos = ctx.playground.config.getPosFromMouseEvent(e)
      const line = ctx.document.linesManager.getCloseInLineFromMousePos(pos)
      if (line) ctx.selection.selection = [line]
    }
    playgroundNode.addEventListener("click", onClick)
    return () => playgroundNode.removeEventListener("click", onClick)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 诊断定位 → 选中节点
  useEffect(() => {
    if (!focusRequest) return
    const target = ctx.document
      .getAllNodes()
      .find((n) => n.id === focusRequest.nodeId)
    if (target) ctx.selection.selection = [target]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest?.seq])

  // 视口：启动时恢复存档的 viewport；缩放 / 平移结束后写回布局（不参与语义哈希）。
  useEffect(() => {
    const config = ctx.playground.config
    const saved = getDocument<ProgramContent>(docId)?.content.layout.viewport
    if (saved)
      config.updateConfig({
        zoom: saved.zoom,
        scrollX: saved.x,
        scrollY: saved.y,
      })
    let timer: ReturnType<typeof setTimeout> | undefined
    const persist = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        const current = getDocument<ProgramContent>(docId)
        if (!current || sync.current.muted) return
        const viewport = {
          x: config.scrollData.scrollX,
          y: config.scrollData.scrollY,
          zoom: config.zoom,
        }
        const savedViewport = current.content.layout.viewport
        if (
          Math.abs(savedViewport.x - viewport.x) < 0.5 &&
          Math.abs(savedViewport.y - viewport.y) < 0.5 &&
          Math.abs(savedViewport.zoom - viewport.zoom) < 0.001
        )
          return
        const ok = applyEdit<ProgramContent>(
          docId,
          "调整视口",
          (c) => ({ ...c, layout: { ...c.layout, viewport } }),
          { coalesceKey: "canvas-viewport" },
        )
        if (ok) sync.current.skipRevision = current.revision + 1
      }, 400)
    }
    const d1 = ctx.playground.onZoom(persist)
    const d2 = ctx.playground.onScroll(persist)
    return () => {
      d1.dispose()
      d2.dispose()
      if (timer) clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className="relative h-full w-full"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(LOGIC_NODE_MIME)) {
          e.preventDefault()
          e.dataTransfer.dropEffect = "copy"
        }
      }}
      onDrop={(e) => {
        const type = e.dataTransfer.getData(LOGIC_NODE_MIME)
        if (!type) return
        e.preventDefault()
        if (readOnly) return
        const current = getDocument<ProgramContent>(docId)
        if (!current) return
        const program = current.content.program
        const model = live.current.model
        const id = nextNodeId(program, type)
        let node
        try {
          node = createNode(model, program, type, id)
        } catch (error) {
          toast(
            error instanceof Error ? error.message : String(error),
            "warning",
          )
          return
        }
        const pos = ctx.playground.config.getPosFromMouseEvent(e.nativeEvent)
        applyEdit<ProgramContent>(
          docId,
          `添加节点 ${nodeTypeDef(type)?.label ?? type} ${id}`,
          (c) => ({
            ...c,
            program: { ...c.program, nodes: [...c.program.nodes, node] },
            layout: {
              ...c.layout,
              positions: {
                ...c.layout.positions,
                [id]: {
                  x: Math.round(pos.x - NODE_WIDTH / 2),
                  y: Math.round(pos.y - 20),
                },
              },
            },
          }),
        )
      }}
    >
      <EditorRenderer className="h-full w-full" />
      <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1 rounded-ui border border-border bg-surface p-1 shadow-card">
        <IconButton
          icon={Minus}
          label="缩小"
          size="sm"
          onClick={() => tools.zoomout(true)}
        />
        <span className="w-10 text-center text-caption tabular text-muted">
          {Math.round(tools.zoom * 100)}%
        </span>
        <IconButton
          icon={Plus}
          label="放大"
          size="sm"
          onClick={() => tools.zoomin(true)}
        />
        <IconButton
          icon={Maximize}
          label="适应视图"
          size="sm"
          onClick={() => tools.fitView(true)}
        />
      </div>
    </div>
  )
}

export default function LogicCanvas({
  docId,
  model,
  program,
  diagnostics,
  readOnly,
  onSelectionChange,
  focusRequest,
}: LogicCanvasProps) {
  const sync = useRef<SyncState | null>(null)
  const live = useRef<LiveState>({ program, model, diagnostics })
  live.current = { program, model, diagnostics }
  if (!sync.current) {
    // 初始数据已经覆盖当前 revision，第一次回灌跳过。
    sync.current = {
      muted: false,
      skipRevision:
        getDocument<ProgramContent>(docId)?.revision ?? null,
    }
  }

  const editorProps = useMemo<FreeLayoutProps>(() => {
    const flaggedEdit = (
      label: string,
      recipe: (c: ProgramContent) => ProgramContent,
      options: { coalesceKey?: string } = {},
    ) => {
      const current = getDocument<ProgramContent>(docId)
      if (!current) return
      const ok = applyEdit<ProgramContent>(docId, label, recipe, options)
      if (ok && sync.current) sync.current.skipRevision = current.revision + 1
    }
    // 拖拽经过不兼容端口时 FlowGram 以 silent 模式询问并把目标端口置空，
    // 松手时 toPort 已丢：先记下原因，onDragLineEnd 里补给用户。
    const lastReject = { at: 0, reason: "" }
    const noteReject = (reason: string, silent?: boolean) => {
      if (silent) {
        lastReject.at = Date.now()
        lastReject.reason = reason
      } else {
        toast(reason, "warning")
      }
    }
    let moveTimer: ReturnType<typeof setTimeout> | undefined
    return {
      initialData: programToWorkflow(
        live.current.program,
        getDocument<ProgramContent>(docId)?.content.layout ?? {
          documentId: docId,
          positions: {},
          viewport: { x: 0, y: 0, zoom: 1 },
        },
      ),
      nodeRegistries: logicNodeRegistries(),
      materials: { renderDefaultNode: LogicNodeCard },
      readonly: readOnly,
      history: { enable: false },
      playground: { preventGlobalGesture: true },
      canAddLine: (_ctx, fromPort, toPort, _lines, silent) => {
        const { program: p, model: m } = live.current
        const source = {
          nodeId: fromPort.node.id,
          portId: String(fromPort.portID),
        }
        const target = {
          nodeId: toPort.node.id,
          portId: String(toPort.portID),
        }
        if (
          p.edges.some(
            (e) =>
              e.target.nodeId === target.nodeId &&
              e.target.portId === target.portId,
          )
        ) {
          noteReject(
            `输入 ${target.nodeId}.${target.portId} 已有连线：先断开原连线再改接`,
            silent,
          )
          return false
        }
        const chk = checkEdge(m, p, source, target)
        if (!chk.ok) noteReject(chk.reason, silent)
        return chk.ok
      },
      onDragLineEnd: async (_ctx, params) => {
        if (
          !params.toPort &&
          lastReject.at > 0 &&
          Date.now() - lastReject.at < 2000
        ) {
          toast(lastReject.reason, "warning")
        }
        lastReject.at = 0
      },
      isErrorLine: (_ctx, fromPort, toPort) => {
        if (!toPort) return false
        const { program: p, model: m } = live.current
        const from = p.nodes.find((n) => n.id === fromPort.node.id)
        const to = p.nodes.find((n) => n.id === toPort.node.id)
        const out = from?.outputs[String(fromPort.portID)]
        const input = to?.inputs[String(toPort.portID)]
        if (!out || !input || !to) return true
        const generic = nodeTypeDef(to.type)?.inputs.find(
          (port) => port.id === String(toPort.portID),
        )?.generic
        return !compatible(m, out, input, { generic }).ok
      },
      isErrorPort: (_ctx, port) =>
        port.portType === "input" &&
        live.current.diagnostics.some(
          (d) =>
            d.severity === "error" &&
            d.target?.nodeId === port.node.id &&
            d.target?.portId === String(port.portID),
        ),
      onContentChange: (ctx, event) => {
        const s = sync.current
        if (!s || s.muted) return
        const current = getDocument<ProgramContent>(docId)
        if (!current) return
        const m = live.current.model
        const p = current.content.program
        switch (event.type) {
          case WorkflowContentChangeType.ADD_LINE: {
            const info = (event.entity as WorkflowLineEntity).info
            if (
              !info.from ||
              !info.to ||
              info.fromPort === undefined ||
              info.toPort === undefined
            )
              return
            const source = {
              nodeId: info.from,
              portId: String(info.fromPort),
            }
            const target = { nodeId: info.to, portId: String(info.toPort) }
            // 回灌产生的 ADD_LINE 在文档里已存在；幂等跳过。
            if (p.edges.some((e) => e.id === edgeIdFor(source, target))) return
            applyEdit<ProgramContent>(
              docId,
              `连接 ${source.nodeId}.${source.portId} → ${target.nodeId}.${target.portId}`,
              (c) => ({ ...c, program: connect(c.program, m, source, target) }),
            )
            break
          }
          case WorkflowContentChangeType.DELETE_LINE: {
            const json = event.toJSON() as {
              sourceNodeID?: string
              targetNodeID?: string
              sourcePortID?: string | number
              targetPortID?: string | number
              data?: Partial<LogicEdgeData>
            }
            const source = {
              nodeId: String(json.sourceNodeID),
              portId: String(json.sourcePortID),
            }
            const target = {
              nodeId: String(json.targetNodeID),
              portId: String(json.targetPortID),
            }
            const id = json.data?.id ?? edgeIdFor(source, target)
            if (!p.edges.some((e) => e.id === id)) return
            applyEdit<ProgramContent>(docId, `断开连线 ${id}`, (c) => ({
              ...c,
              program: removeEdges(c.program, m, [id]),
            }))
            break
          }
          case WorkflowContentChangeType.DELETE_NODE: {
            const nodeId = event.entity.id
            if (!p.nodes.some((n) => n.id === nodeId)) return
            applyEdit<ProgramContent>(docId, `删除节点 ${nodeId}`, (c) => ({
              ...c,
              program: removeNodes(c.program, m, [nodeId]),
            }))
            break
          }
          case WorkflowContentChangeType.MOVE_NODE: {
            // 拖拽期间连续触发：拖尾合并成一次布局写入，撤销栈里只有一条“移动节点”。
            if (moveTimer) clearTimeout(moveTimer)
            moveTimer = setTimeout(() => {
              const current = getDocument<ProgramContent>(docId)
              if (!current) return
              const positions = { ...current.content.layout.positions }
              for (const n of ctx.document.getAllNodes()) {
                const pos = n.getData(TransformData).position
                positions[n.id] = {
                  x: Math.round(pos.x),
                  y: Math.round(pos.y),
                }
              }
              flaggedEdit(
                "移动节点",
                (c) => ({ ...c, layout: { ...c.layout, positions } }),
                { coalesceKey: "canvas-move" },
              )
            }, 500)
            break
          }
          default:
            break
        }
      },
    }
    // 画布配置只在挂载时创建；动态数据一律走 live / sync ref。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <FreeLayoutEditorProvider {...editorProps}>
      <LogicCanvasInner
        docId={docId}
        sync={sync as React.MutableRefObject<SyncState>}
        live={live}
        readOnly={readOnly}
        onSelectionChange={onSelectionChange}
        focusRequest={focusRequest}
      />
    </FreeLayoutEditorProvider>
  )
}
