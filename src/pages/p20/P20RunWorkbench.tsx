import { useMemo } from 'react'
import { Bug, GitBranch, ListOrdered, X } from 'lucide-react'
import type { WorkbenchContext } from '@/app/useWorkbenchContext'
import Button, { IconButton } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Card'
import EntityTable from '@/components/domain/EntityTable'
import RunControls from '@/components/domain/RunControls'
import SpatialViewport from '@/components/domain/SpatialViewport'
import { useIndex } from '@/data/store'
import { formatSimTime } from '@/lib/format'
import { navigate, useViewState } from '@/router/router'
import { useLayout } from '@/stores/layout'
import { dismissRunError, useRunSession } from '@/stores/session'
import { runColumns, spatialItems } from './runView'

/** P20 演练运行工作台：冻结 → 计算 → 提交 → 播放；所有读数来自 viewCommit 的不可变快照。 */
export default function P20RunWorkbench({ ctx }: { ctx: WorkbenchContext }) {
  const index = useIndex()
  const { run, branch, viewCommit, mode } = ctx
  const session = useRunSession(run?.id)
  const [selected, setSelected] = useViewState<string>('selectedEntity', 'F01')
  const dockOpen = useLayout((s) => s.dockOpen)
  const dockHeight = useLayout((s) => s.dockHeight)
  const fullscreen = useLayout((s) => s.fullscreen)

  const world = viewCommit ? index.worlds.get(viewCommit.id) : undefined
  const previous = viewCommit?.parentId ? index.worlds.get(viewCommit.parentId) : undefined
  const items = useMemo(() => spatialItems(index, world), [index, world])
  const columns = useMemo(() => runColumns(index), [index])

  if (!run || !branch || !viewCommit) return null
  const exec = { runId: run.id, branchId: branch.id, viewCommit: viewCommit.id }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-body">
            <span className="font-semibold">世界快照</span>
            <span className="font-mono text-label">{viewCommit.id}</span>
            <span className="tabular text-label text-muted">
              第 {viewCommit.round} 回合 · {formatSimTime(viewCommit.simTime)}
            </span>
          </div>
        </div>
        <span className="hidden min-w-0 truncate text-label text-muted xl:inline">{viewCommit.summary}</span>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" intent="ghost" icon={ListOrdered} onClick={() => navigate({ pageId: 'P21', params: { baseCommit: viewCommit.id } })}>
            命令队列
          </Button>
          <Button size="sm" intent="ghost" icon={Bug} onClick={() => navigate({ pageId: 'P22', params: { ...exec, entityId: selected } })}>
            节点调试
          </Button>
          <Button size="sm" intent="ghost" icon={GitBranch} onClick={() => navigate({ pageId: 'P26', params: exec })}>
            提交历史
          </Button>
          <span className="h-5 w-px bg-border" aria-hidden />
          <RunControls run={run} branch={branch} isHistory={mode === 'history'} />
        </div>
      </div>

      {session.lastError ? (
        <div className="shrink-0 border-b border-border bg-surface px-4 py-2">
          <Notice
            tone="danger"
            actions={<IconButton icon={X} size="sm" label="关闭诊断" onClick={() => dismissRunError(run.id)} />}
          >
            <span className="font-mono text-label">{session.lastError.code}</span>
            <span className="ml-2">{session.lastError.message}</span>
          </Notice>
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1">
        <SpatialViewport
          items={items}
          selectedId={selected}
          onSelect={setSelected}
          caption={`${branch.id}@${viewCommit.id}${mode === 'history' ? ' · 历史只读' : ''}`}
        />
      </div>

      {dockOpen && !fullscreen ? (
        <div className="flex shrink-0 flex-col border-t border-border bg-surface" style={{ height: dockHeight }}>
          <div className="flex h-10 shrink-0 items-center gap-3 border-b border-line px-4">
            <span className="text-body font-semibold">实体状态</span>
            <span className="text-caption text-muted">
              只读 · {viewCommit.id}
              {previous ? ` · 括号内为相对父提交 ${previous.commitId} 的变化` : ''}
            </span>
          </div>
          <div className="scroll-thin min-h-0 flex-1 overflow-auto">
            <EntityTable world={world} previous={previous} columns={columns} selectedId={selected} onSelect={setSelected} />
          </div>
        </div>
      ) : null}
    </div>
  )
}
