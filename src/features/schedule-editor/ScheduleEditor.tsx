import { useCallback, useMemo, useState } from "react"
import { Group, Panel, Separator } from "react-resizable-panels"
import { ReactFlowProvider } from "@xyflow/react"
import Button from "@/components/ui/Button"
import Modal from "@/components/ui/Modal"
import Tabs from "@/components/ui/Tabs"
import { navigate } from "@/router/router"
import { compileSchedule, type ScheduleModelView } from "@/services/scheduleCompiler"
import { applyEdit } from "@/stores/draftRegistry"
import {
  SYSTEMS_DOC,
  useDraftModel,
  useModelDocument,
  type ScheduleContent,
  type SystemsContent,
} from "@/stores/modelDocuments"
import { toast } from "@/stores/toast"
import NodeInspector from "./NodeInspector"
import PlanPanel from "./PlanPanel"
import ScheduleCanvas from "./ScheduleCanvas"
import SystemLibrary from "./SystemLibrary"
import { ScheduleEditorContext } from "./editorContext"
import * as ops from "./ops"
import type { ScheduleFlowEdge, ScheduleFlowNode } from "./codec"

const HANDLE =
  "bg-line transition-colors hover:bg-primary/40 data-[separator=active]:bg-primary/60"

/** System 外层调度编辑器：左 System 库 / 中 React Flow 画布 / 右检查器与计划预览。 */
export default function ScheduleEditor({
  docId,
  readOnly,
  focusSystemId,
}: {
  docId: string
  readOnly: boolean
  /** 路由 systemId：进入页面时聚焦高亮对应 System 节点。 */
  focusSystemId?: string
}) {
  const model = useDraftModel()
  const doc = useModelDocument<ScheduleContent>(docId)
  const [selected, setSelected] = useState<{
    node: ScheduleFlowNode | null
    edge: ScheduleFlowEdge | null
  }>({ node: null, edge: null })
  const [sideTab, setSideTab] = useState<"inspect" | "plan">("plan")
  const [pendingPair, setPendingPair] = useState<{
    source: string
    target: string
  } | null>(null)
  const [pairKind, setPairKind] = useState<"order" | "product">("order")
  const [pairError, setPairError] = useState<string | null>(null)

  const content = doc?.content
  const modelView = useMemo<ScheduleModelView>(
    () => ({
      systems: model.systems,
      constraints: model.constraints,
      attributes: model.attributes,
      baseCommit: model.baseWorld.commitId,
    }),
    [model],
  )
  const plan = useMemo(
    () => (content ? compileSchedule(content.schedule, modelView) : null),
    [content, modelView],
  )

  // 与 ScheduleCanvas 约定：传给 React Flow 的回调需稳定引用，
  // 否则会经 xyflow StoreUpdater 造成「setState → 重渲染」死循环。
  const handleSelectionChange = useCallback(
    (node: ScheduleFlowNode | null, edge: ScheduleFlowEdge | null) =>
      setSelected({ node, edge }),
    [],
  )
  const handleSystemPairConnect = useCallback((source: string, target: string) => {
    setPendingPair({ source, target })
    setPairKind("order")
    setPairError(null)
  }, [])

  const api = useMemo(
    () => ({
      model,
      readOnly,
      openProgram: (systemId: string) => {
        const system = model.systems.find((s) => s.id === systemId)
        if (!system) return
        navigate({ pageId: "P14", params: { programId: system.programRef.id } })
      },
      toggleSystem: (systemId: string) => {
        const system = model.systems.find((s) => s.id === systemId)
        if (!system) return
        applyEdit<SystemsContent>(
          SYSTEMS_DOC,
          `${system.enabled ? "停用" : "启用"} System ${systemId}`,
          (c) => ({
            ...c,
            systems: c.systems.map((s) =>
              s.id === systemId ? { ...s, enabled: !s.enabled } : s,
            ),
          }),
        )
        toast(
          `${systemId} 已${system.enabled ? "停用：执行时跳过，不产生贡献" : "启用"}`,
        )
      },
    }),
    [model, readOnly],
  )

  if (!doc || !content || !plan) return null
  const { schedule, layout } = content

  const confirmPair = () => {
    if (!pendingPair) return
    const result = ops.connectNodes(
      content,
      modelView,
      pendingPair.source,
      pendingPair.target,
      pairKind,
    )
    if (!result.ok) {
      setPairError(result.reason)
      return
    }
    applyEdit<ScheduleContent>(
      docId,
      `连接 ${pendingPair.source} → ${pendingPair.target}`,
      () => result.content,
    )
    setPendingPair(null)
    setPairError(null)
  }

  return (
    <ScheduleEditorContext.Provider value={api}>
      <ReactFlowProvider>
        <Group orientation="horizontal" className="min-h-0 flex-1">
          <Panel
            defaultSize="240px"
            minSize="180px"
            maxSize="320px"
            className="min-h-0 border-r border-border bg-surface"
          >
            <SystemLibrary model={model} schedule={schedule} readOnly={readOnly} />
          </Panel>
          <Separator className={`w-1 ${HANDLE}`} />
          <Panel minSize="30%" className="min-w-0">
            <ScheduleCanvas
              docId={docId}
              model={modelView}
              schedule={schedule}
              layout={layout}
              readOnly={readOnly}
              focusSystemId={focusSystemId}
              onSelectionChange={handleSelectionChange}
              onSystemPairConnect={handleSystemPairConnect}
            />
          </Panel>
          <Separator className={`w-1 ${HANDLE}`} />
          <Panel
            defaultSize="340px"
            minSize="280px"
            maxSize="480px"
            className="flex min-h-0 flex-col border-l border-border bg-surface"
          >
            <div className="shrink-0 border-b border-line px-4">
              <Tabs
                ariaLabel="调度侧栏"
                value={sideTab}
                onChange={(v) => setSideTab(v as "inspect" | "plan")}
                items={[
                  { id: "plan", label: "计划预览" },
                  { id: "inspect", label: "检查器" },
                ]}
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {sideTab === "plan" ? (
                <PlanPanel plan={plan} />
              ) : (
                <NodeInspector
                  node={selected.node}
                  edge={selected.edge}
                  onSetConstraint={(nodeId, key) => {
                    const [id, version] = key.split("@")
                    applyEdit<ScheduleContent>(
                      docId,
                      `修改 ${nodeId} 的约束`,
                      (c) => ops.setConstraintRef(c, nodeId, { id, version }),
                    )
                  }}
                  onDeleteNode={(nodeId) =>
                    applyEdit<ScheduleContent>(
                      docId,
                      `删除节点 ${nodeId}`,
                      (c) => ops.removeNodes(c, [nodeId]),
                    )
                  }
                  onDeleteEdge={(edgeId) =>
                    applyEdit<ScheduleContent>(
                      docId,
                      `删除边 ${edgeId}`,
                      (c) => ops.removeEdges(c, [edgeId]),
                    )
                  }
                />
              )}
            </div>
          </Panel>
        </Group>
      </ReactFlowProvider>

      {pendingPair ? (
        <Modal
          title={`连接 ${pendingPair.source} → ${pendingPair.target}`}
          onClose={() => setPendingPair(null)}
          footer={
            <>
              <Button intent="ghost" onClick={() => setPendingPair(null)}>
                取消
              </Button>
              <Button intent="primary" onClick={confirmPair}>
                创建连线
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3 px-5 py-4">
            <p className="text-body">两个 System 之间有两种关系：</p>
            <label className="flex cursor-pointer items-start gap-2 rounded-ui border border-border px-3 py-2">
              <input
                type="radio"
                name="pair-kind"
                className="mt-1"
                checked={pairKind === "order"}
                onChange={() => {
                  setPairKind("order")
                  setPairError(null)
                }}
              />
              <span className="text-label">
                <span className="font-semibold">顺序 order</span>
                <span className="mt-0.5 block text-caption text-muted">
                  只决定执行先后，不传递新状态：{pendingPair.target} 仍读取上一提交的
                  previous 视图，看不到 {pendingPair.source} 的暂存贡献。
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 rounded-ui border border-border px-3 py-2">
              <input
                type="radio"
                name="pair-kind"
                className="mt-1"
                checked={pairKind === "product"}
                onChange={() => {
                  setPairKind("product")
                  setPairError(null)
                }}
              />
              <span className="text-label">
                <span className="font-semibold">中间产物 product</span>
                <span className="mt-0.5 block text-caption text-muted">
                  要求执行器把一个 System 的输出直接交给另一个 System。
                </span>
              </span>
            </label>
            {pairError ? (
              <p role="alert" className="text-label leading-5 text-danger">
                {pairError}
              </p>
            ) : null}
          </div>
        </Modal>
      ) : null}
    </ScheduleEditorContext.Provider>
  )
}
