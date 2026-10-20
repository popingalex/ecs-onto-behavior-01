import { ChevronRight, Maximize2, Minimize2, PanelLeft, PanelRight, Redo2, Save, ShieldCheck, Undo2 } from 'lucide-react'
import type { WorkbenchContext } from '@/app/useWorkbenchContext'
import Button, { IconButton } from '@/components/ui/Button'
import StatusTag, { Tag } from '@/components/ui/StatusTag'
import CommitSelector from '@/components/domain/CommitSelector'
import { cn } from '@/lib/cn'
import { formatLocalStamp } from '@/lib/format'
import type { ViewportTier } from '@/lib/useViewport'
import { navigate } from '@/router/router'
import { canEdit, useRole } from '@/stores/context'
import { redoDraft, saveDraft, saveStatusOf, undoDraft, useDraft, validateDraft, validationStatusOf } from '@/stores/draft'
import { useBranches } from '@/stores/history'
import { useRunSession } from '@/stores/session'

const MODE_LABEL = { overview: '总览', edit: '编辑', run: '运行', history: '历史查看' } as const
const MODE_TONE = { overview: 'neutral', edit: 'primary', run: 'success', history: 'warning' } as const

/** C02 ContextBar：页面位置 + 当前上下文（资产草稿 / 运行·分支·提交）+ 模式。 */
export default function ContextBar({
  ctx,
  tier,
  treeOpen,
  inspectorOpen,
  fullscreen,
  onToggleTree,
  onToggleInspector,
  onToggleFullscreen,
}: {
  ctx: WorkbenchContext
  tier: ViewportTier
  treeOpen: boolean
  inspectorOpen: boolean
  fullscreen: boolean
  onToggleTree: () => void
  onToggleInspector: () => void
  onToggleFullscreen: () => void
}) {
  const { spec, group, mode } = ctx
  return (
    <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface px-3">
      {spec.layout.tree ? (
        <IconButton icon={PanelLeft} label={treeOpen ? '收起资源树' : '展开资源树'} active={treeOpen && tier === 'narrow'} size="sm" onClick={onToggleTree} />
      ) : null}
      <nav aria-label="位置" className="flex min-w-0 items-center gap-1.5 text-body">
        <span className="shrink-0 text-muted">{group.label}</span>
        <ChevronRight size={14} className="shrink-0 text-faint" aria-hidden />
        <span className="shrink-0 font-mono text-label text-muted">{spec.id}</span>
        <h1 className="truncate font-semibold text-ink">{spec.title}</h1>
      </nav>
      <Tag tone={MODE_TONE[mode]} size="sm">
        {MODE_LABEL[mode]}
      </Tag>
      <span className="h-5 w-px shrink-0 bg-border" aria-hidden />

      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
        {spec.context === 'asset' ? <AssetContext compact={tier !== 'standard'} /> : null}
        {spec.context === 'execution' ? <ExecutionContext ctx={ctx} compact={tier !== 'standard'} /> : null}
        {spec.context === 'project' ? <span className="truncate text-label text-muted">项目级入口 · 不在此结算或编辑</span> : null}
      </div>

      {spec.context === 'asset' ? <DraftActions /> : null}
      {spec.layout.canvas ? (
        <IconButton icon={fullscreen ? Minimize2 : Maximize2} label={fullscreen ? '退出全屏画布（Esc）' : '全屏画布'} size="sm" onClick={onToggleFullscreen} />
      ) : null}
      {spec.layout.inspector ? (
        <IconButton icon={PanelRight} label={inspectorOpen ? '收起检查器' : '展开检查器'} active={inspectorOpen && tier === 'narrow'} size="sm" onClick={onToggleInspector} />
      ) : null}
    </div>
  )
}

function AssetContext({ compact }: { compact: boolean }) {
  const draft = useDraft((s) => s)
  return (
    <>
      <span className="shrink-0 text-label text-muted">
        草稿 <span className="font-mono text-ink-soft">{draft.draftId}</span> · <span className="font-mono text-ink-soft">r{draft.revision}</span>
      </span>
      <StatusTag status={saveStatusOf(draft)} size="sm" />
      <StatusTag status={validationStatusOf(draft)} size="sm" />
      {!compact ? (
        <span className="truncate text-label text-muted" title="原型阶段的保存只写入本浏览器 localStorage，不上传服务器。">
          {draft.savedAt ? <>本地保存于 {formatLocalStamp(draft.savedAt)}</> : '未本地保存'}
          {draft.published ? (
            <>
              {' '}· 已发布 <span className="font-mono text-ink-soft">{draft.published.modelVersion}</span>
            </>
          ) : null}
        </span>
      ) : null}
    </>
  )
}

function DraftActions() {
  const role = useRole()
  const canUndo = useDraft((s) => s.undo.length > 0)
  const canRedo = useDraft((s) => s.redo.length > 0)
  const saving = useDraft((s) => s.saving)
  const validating = useDraft((s) => s.validating)
  const dirty = useDraft((s) => s.dirty)
  const editable = canEdit(role)
  return (
    <div className="flex shrink-0 items-center gap-1">
      <IconButton icon={Undo2} label="撤销（Ctrl+Z）" size="sm" disabled={!canUndo || !editable} onClick={undoDraft} />
      <IconButton icon={Redo2} label="重做（Ctrl+Shift+Z）" size="sm" disabled={!canRedo || !editable} onClick={redoDraft} />
      <Button size="sm" icon={ShieldCheck} busy={validating} onClick={() => void validateDraft()} className="ml-1">
        校验
      </Button>
      <Button size="sm" intent="primary" icon={Save} busy={saving} disabled={!dirty || !editable} onClick={() => void saveDraft()} title="保存到本浏览器（Ctrl+S）">
        保存
      </Button>
    </div>
  )
}

function ExecutionContext({ ctx, compact }: { ctx: WorkbenchContext; compact: boolean }) {
  const { run, branch, viewCommit, route } = ctx
  const session = useRunSession(run?.id)
  const branches = useBranches()
  if (route.pageId === 'P27') {
    return (
      <span className="flex items-center gap-2 text-label text-muted">
        对比
        <span className="rounded bg-neutral-soft px-1.5 font-mono text-ink-soft">{route.params.leftCommit ?? '左侧未选'}</span>↔
        <span className="rounded bg-neutral-soft px-1.5 font-mono text-ink-soft">{route.params.rightCommit ?? '右侧未选'}</span>
      </span>
    )
  }
  if (!run) return <span className="text-label text-muted">未选择运行上下文</span>
  return (
    <>
      {!compact ? (
        <span className="shrink-0 text-label text-muted">
          运行 <span className="font-medium text-ink-soft">{run.label}</span> <span className="font-mono">{run.id}</span>
        </span>
      ) : null}
      {branch ? (
        <CommitSelector
          runId={run.id}
          branch={branch}
          viewCommit={viewCommit}
          onSelectCommit={(commitId) => navigate({ ...route, params: { ...route.params, runId: run.id, branchId: branch.id, viewCommit: commitId } }, { replace: true })}
          onSelectBranch={(branchId) => {
            const target = branches[branchId]
            if (!target) return
            // 切换分支是显式动作：查看点显式落在目标分支的 head。
            navigate({ ...route, params: { ...route.params, runId: run.id, branchId, viewCommit: target.headCommit } }, { replace: true })
          }}
        />
      ) : null}
      {session.phase !== 'waitingInputs' ? <StatusTag status={session.phase} size="sm" /> : null}
      <span className={cn('truncate text-label text-muted', compact && 'hidden')}>步长 {run.stepSeconds} s · {run.runtime === 'server' ? '服务端运行' : '本地 Worker'}</span>
    </>
  )
}
