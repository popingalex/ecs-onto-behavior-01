import { useMemo } from "react"
import { Bug, Eye, GitBranch, ListOrdered, X } from "lucide-react"
import type { WorkbenchContext } from "@/app/useWorkbenchContext"
import Button, { IconButton } from "@/components/ui/Button"
import { Notice } from "@/components/ui/Card"
import { Tag } from "@/components/ui/StatusTag"
import EntityTable from "@/components/domain/EntityTable"
import RunControls from "@/components/domain/RunControls"
import SpatialViewport from "@/components/domain/SpatialViewport"
import { useIndex } from "@/data/store"
import { formatSimTime } from "@/lib/format"
import { navigate, useViewState } from "@/router/router"
import {
  hasPrecomputedRound,
  referenceAdapter,
} from "@/services/executionAdapter"
import { useLayout } from "@/stores/layout"
import {
  dismissRunError,
  settleRound,
  useExecutionAdapterLabel,
  useRunSession,
} from "@/stores/session"
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
  const [selected, setSelected] = useViewState<string>("selectedEntity", "F01")
  const [modelView, setModelView] = useViewState<"saved" | "draft">(
    "modelView",
    "saved",
  )
  const dockOpen = useLayout((s) => s.dockOpen)
  const dockHeight = useLayout((s) => s.dockHeight)
  const fullscreen = useLayout((s) => s.fullscreen)

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
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
        <div className="min-w-0">
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
        <div className="ml-auto flex items-center gap-2">
          <div
            className="flex items-center overflow-hidden rounded-ui border border-border"
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
                className={`h-7 px-2.5 text-label ${
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

      <div className="relative min-h-0 flex-1">
        <SpatialViewport
          items={items}
          selectedId={selected}
          onSelect={setSelected}
          caption={`${branch.id}@${viewCommit.id}${
            mode === "history" ? " · 历史只读" : ""
          }`}
        />
      </div>

      {dockOpen && !fullscreen ? (
        <div
          className="flex shrink-0 flex-col border-t border-border bg-surface"
          style={{ height: dockHeight }}
        >
          <div className="flex h-10 shrink-0 items-center gap-3 border-b border-line px-4">
            <span className="text-body font-semibold">实体状态</span>
            <span className="text-caption text-muted">
              只读 · {viewCommit.id}
              {previous
                ? ` · 括号内为相对父提交 ${previous.commitId} 的变化`
                : ""}
            </span>
          </div>
          <div className="scroll-thin min-h-0 flex-1 overflow-auto">
            <EntityTable
              world={world}
              previous={previous}
              columns={columns}
              selectedId={selected}
              onSelect={setSelected}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
