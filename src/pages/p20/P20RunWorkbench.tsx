import { useEffect, useMemo, type ReactNode } from "react"
import {
  Boxes,
  Bug,
  Eye,
  GitBranch,
  ListOrdered,
  PanelRight,
  Pin,
  Plus,
  Table2,
  X,
} from "lucide-react"
import type { WorkbenchContext } from "@/app/useWorkbenchContext"
import Button, { IconButton } from "@/components/ui/Button"
import { Notice } from "@/components/ui/Card"
import { Tag } from "@/components/ui/StatusTag"
import EntityTable from "@/components/domain/EntityTable"
import MapViewport from "@/components/domain/MapViewport"
import RunControls from "@/components/domain/RunControls"
import { useIndex } from "@/data/store"
import { cn } from "@/lib/cn"
import { formatSimTime } from "@/lib/format"
import { isEditableTarget } from "@/lib/keyboard"
import { navigate, useOverlay, useViewState } from "@/router/router"
import {
  hasPrecomputedRound,
  referenceAdapter,
} from "@/services/executionAdapter"
import Inspector from "@/shell/Inspector"
import ResourceTree from "@/shell/ResourceTree"
import RouteGate from "@/shell/RouteGate"
import {
  dismissRunError,
  settleRound,
  useExecutionAdapterLabel,
  useRunSession,
} from "@/stores/session"
import { useRecordByCommit } from "@/stores/trace"
import OrchestrationPanel from "./OrchestrationPanel"
import P20Inspector from "./P20Inspector"
import {
  MAP_LAYOUT_DEFAULT,
  reduceMapLayout,
  type MapLayoutAction,
  type MapLayoutState,
  type MapPanelId,
} from "./mapLayout"
import { runColumns, spatialItems } from "./runView"

const COMMIT_SOURCE = {
  base: { tone: "neutral" as const, label: "基础世界" },
  "reference-sample": {
    tone: "warning" as const,
    label: "参考样例 · 非当前图计算",
  },
  computed: { tone: "success" as const, label: "当前图求值" },
}

/** P20 演练运行工作台：冻结 → 计算 → 提交 → 播放；所有读数来自 viewCommit 的不可变快照。 */
export default function P20RunWorkbench({ ctx }: { ctx: WorkbenchContext }) {
  const index = useIndex()
  const { run, branch, viewCommit, mode } = ctx
  const session = useRunSession(run?.id)
  const adapterLabel = useExecutionAdapterLabel()
  const record = useRecordByCommit(viewCommit?.id)
  const [selected, setSelected] = useViewState<string>("selectedEntity", "F01")
  const [modelView, setModelView] = useViewState<"saved" | "draft">(
    "modelView",
    "saved",
  )
  const [panel, setPanel] = useViewState<MapLayoutState>(
    "p20.mapPanel",
    MAP_LAYOUT_DEFAULT,
  )
  const overlay = useOverlay()
  const dispatch = (action: MapLayoutAction) =>
    setPanel((prev) => reduceMapLayout(prev, action))

  // Esc 收回悬浮面板（全局弹层打开时不抢占）。
  const panelOpen = panel.open
  useEffect(() => {
    if (!panelOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.isComposing) return
      if (overlay || isEditableTarget(e.target)) return
      dispatch({ type: "close" })
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelOpen, overlay])

  const world = viewCommit ? index.worlds.get(viewCommit.id) : undefined
  const previous = viewCommit?.parentId
    ? index.worlds.get(viewCommit.parentId)
    : undefined
  const items = useMemo(() => spatialItems(index, world), [index, world])
  const columns = useMemo(() => runColumns(index), [index])

  if (!run || !branch || !viewCommit) return null
  const exec = { runId: run.id, branchId: branch.id, viewCommit: viewCommit.id }
  const source = COMMIT_SOURCE[viewCommit.source]
  const sampleAvailable =
    mode !== "history" &&
    session.phase === "waitingInputs" &&
    hasPrecomputedRound(branch.id, branch.headCommit)

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/*
        头部允许换行：1280 紧凑布局 + 树/检查器同时展开时单行放不下全部操作；
        单行溢出会让主区（overflow-hidden）被焦点 reveal 横向拉动，整列错位。
      */}
      <div className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border bg-surface px-4 py-1.5">
        <div className="shrink-0">
          <div className="flex items-center gap-2 text-body">
            <span className="font-semibold">世界快照</span>
            <span className="font-mono text-label">{viewCommit.id}</span>
            <Tag size="sm" tone={source.tone}>
              {source.label}
            </Tag>
            <span className="tabular text-label text-muted">
              第 {viewCommit.round} 回合 · {formatSimTime(viewCommit.simTime)}
            </span>
          </div>
        </div>
        <span className="hidden min-w-0 truncate text-label text-muted xl:inline">
          {viewCommit.summary}
        </span>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
          <Button
            size="sm"
            intent="ghost"
            icon={Plus}
            title="新建运行（P19）"
            onClick={() => navigate({ pageId: "P19", params: {} })}
          >
            <span className="hidden 2xl:inline">新建运行</span>
          </Button>
          <span className="h-5 w-px bg-border" aria-hidden />
          <div
            className="flex shrink-0 items-center overflow-hidden rounded-ui border border-border"
            title="试算输入版本：推算消费的模型快照"
          >
            {(
              [
                ["saved", "已保存模型"],
                ["draft", "草稿试算"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={modelView === value}
                onClick={() => setModelView(value)}
                className={`h-7 shrink-0 whitespace-nowrap px-2.5 text-label ${
                  modelView === value
                    ? "bg-primary-soft text-primary-strong"
                    : "text-muted hover:bg-hover"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <span
            className="hidden max-w-56 truncate text-caption text-muted 2xl:inline"
            title={adapterLabel}
          >
            {adapterLabel}
          </span>
          <Button
            size="sm"
            intent="ghost"
            icon={ListOrdered}
            onClick={() =>
              navigate({ pageId: "P21", params: { baseCommit: viewCommit.id } })
            }
          >
            命令队列
          </Button>
          <Button
            size="sm"
            intent="ghost"
            icon={Bug}
            onClick={() =>
              navigate({
                pageId: "P22",
                params: { ...exec, entityId: selected },
              })
            }
          >
            节点调试
          </Button>
          <Button
            size="sm"
            intent="ghost"
            icon={GitBranch}
            onClick={() => navigate({ pageId: "P26", params: exec })}
          >
            提交历史
          </Button>
          <span className="h-5 w-px bg-border" aria-hidden />
          {sampleAvailable ? (
            <Button
              size="sm"
              intent="secondary"
              icon={Eye}
              title="用预置样例（expected_runs）填充一个参考回合，仅作对照查看；不代表当前图的计算结果"
              onClick={() =>
                void settleRound(run.id, branch.id, branch.headCommit, {
                  adapter: referenceAdapter,
                })
              }
            >
              查看样例
            </Button>
          ) : null}
          <RunControls
            run={run}
            branch={branch}
            isHistory={mode === "history"}
            modelView={modelView}
          />
        </div>
      </div>

      {session.lastError ? (
        <div className="shrink-0 border-b border-border bg-surface px-4 py-2">
          <Notice
            tone="danger"
            actions={
              <IconButton
                icon={X}
                size="sm"
                label="关闭诊断"
                onClick={() => dismissRunError(run.id)}
              />
            }
          >
            <span className="font-mono text-label">
              {session.lastError.code}
            </span>
            <span className="ml-2">{session.lastError.message}</span>
          </Notice>
        </div>
      ) : null}

      {/*
        地图主角布局（ADR-v06-06）：主区整幅 = MapViewport 宿主；内容面板只以
        悬浮层临时遮挡（左/右/下三选一互斥），长期悬浮物只有图标工具栏、
        图例与状态徽标。裁切溢出：SpatialViewport 内容有 min-h-[240px]。
      */}
      <div className="relative min-h-[160px] flex-1 overflow-clip">
        <MapViewport
          items={items}
          selectedId={selected}
          onSelect={setSelected}
          caption={`${branch.id}@${viewCommit.id}${
            mode === "history" ? " · 历史只读" : ""
          }`}
        />

        {/* 遮罩：点击收回当前悬浮面板 */}
        {panel.open ? (
          <div
            className="absolute inset-0 z-20 bg-[rgb(22_42_64/0.16)]"
            onClick={() => dispatch({ type: "close" })}
            aria-hidden
          />
        ) : null}

        {/* 编排层：地图上方的可折叠悬浮卡（默认折叠为一行摘要） */}
        <div className="pointer-events-none absolute inset-x-14 top-2 z-20 flex justify-center">
          <OrchestrationPanel record={record} exec={exec} />
        </div>

        {/* 左缘图标工具栏（长期悬浮，不占布局；左面板展开时贴其外缘） */}
        <div
          className={cn(
            "absolute top-1/2 z-40 flex -translate-y-1/2 flex-col items-center gap-1 rounded-ui border border-border bg-surface/95 p-1 shadow-pop transition-[left] duration-150",
            panel.open === "left" ? "left-[308px]" : "left-2",
          )}
        >
          <IconButton
            icon={Boxes}
            size="sm"
            label={panel.open === "left" ? "收起对象树" : "对象树（实体 / 分支 / 提交）"}
            active={panel.open === "left"}
            onClick={() => dispatch({ type: "toggle", panel: "left" })}
          />
          <IconButton
            icon={ListOrdered}
            size="sm"
            label="命令队列（P21 抽屉）"
            onClick={() =>
              navigate({ pageId: "P21", params: { baseCommit: viewCommit.id } })
            }
          />
        </div>

        {/* 右缘图标工具栏 */}
        <div
          className={cn(
            "absolute top-1/2 z-40 flex -translate-y-1/2 flex-col items-center gap-1 rounded-ui border border-border bg-surface/95 p-1 shadow-pop transition-[right] duration-150",
            panel.open === "right" ? "right-[348px]" : "right-2",
          )}
        >
          <IconButton
            icon={PanelRight}
            size="sm"
            label={panel.open === "right" ? "收起实体检查器" : "实体检查器"}
            active={panel.open === "right"}
            onClick={() => dispatch({ type: "toggle", panel: "right" })}
          />
        </div>

        {/* 底部拉手：实体状态表 */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center">
          <button
            type="button"
            aria-expanded={panel.open === "bottom"}
            onClick={() => dispatch({ type: "toggle", panel: "bottom" })}
            className={cn(
              "pointer-events-auto flex h-7 items-center gap-1.5 rounded-t-ui border border-b-0 border-border bg-surface/95 px-3 text-label text-ink-soft shadow-pop hover:bg-hover",
            )}
          >
            <Table2 size={14} className="text-muted" aria-hidden />
            实体状态
            <span className="text-caption text-muted">
              {panel.open === "bottom" ? "收起" : "展开"}
            </span>
          </button>
        </div>

        {/* 悬浮内容面板：左/右/下三选一互斥（mapLayout reducer） */}
        {panel.open === "left" ? (
          <FloatPanel
            className="bottom-0 left-0 top-0 w-[300px] border-r"
            title="对象树"
            pinned={panel.pinned === "left"}
            onPin={() => dispatch({ type: "pin", panel: "left" })}
            onClose={() => dispatch({ type: "close" })}
          >
            <div className="min-h-0 flex-1">
              <ResourceTree group={ctx.group.id} />
            </div>
          </FloatPanel>
        ) : null}
        {panel.open === "right" ? (
          <FloatPanel
            className="bottom-0 right-0 top-0 w-[340px] border-l"
            title="实体检查器"
            pinned={panel.pinned === "right"}
            onPin={() => dispatch({ type: "pin", panel: "right" })}
            onClose={() => dispatch({ type: "close" })}
          >
            <div className="min-h-0 flex-1">
              <Inspector ctx={ctx}>
                <RouteGate ctx={ctx}>
                  <P20Inspector ctx={ctx} />
                </RouteGate>
              </Inspector>
            </div>
          </FloatPanel>
        ) : null}
        {panel.open === "bottom" ? (
          <FloatPanel
            className="inset-x-0 bottom-0 h-[40%] border-t"
            title="实体状态"
            subtitle={`只读 · ${viewCommit.id}${
              previous ? ` · 括号内为相对父提交 ${previous.commitId} 的变化` : ""
            }`}
            pinned={panel.pinned === "bottom"}
            onPin={() => dispatch({ type: "pin", panel: "bottom" })}
            onClose={() => dispatch({ type: "close" })}
          >
            <div className="scroll-thin min-h-0 flex-1 overflow-auto">
              <EntityTable
                world={world}
                previous={previous}
                columns={columns}
                selectedId={selected}
                onSelect={setSelected}
              />
            </div>
          </FloatPanel>
        ) : null}
      </div>
    </div>
  )
}

/** P20 悬浮内容面板外框：覆盖在地图上方（absolute + shadow），可 pin（仍遵守三选一互斥）。 */
function FloatPanel({
  className,
  title,
  subtitle,
  pinned,
  onPin,
  onClose,
  children,
}: {
  className: string
  title: string
  subtitle?: string
  pinned: boolean
  onPin: () => void
  onClose: () => void
  children: ReactNode
}) {
  return (
    <section
      aria-label={title}
      className={cn(
        "absolute z-30 flex flex-col border-border bg-surface shadow-pop",
        className,
      )}
    >
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-3">
        <span className="text-body font-semibold">{title}</span>
        {subtitle ? (
          <span className="min-w-0 flex-1 truncate text-caption text-muted">
            {subtitle}
          </span>
        ) : (
          <span className="flex-1" />
        )}
        <IconButton
          icon={Pin}
          size="sm"
          label={pinned ? "取消固定（其他面板可临时展开）" : "固定展开（仍与其他面板互斥）"}
          active={pinned}
          onClick={onPin}
        />
        <IconButton icon={X} size="sm" label={`关闭${title}（Esc）`} onClick={onClose} />
      </div>
      {children}
    </section>
  )
}
