import { useMemo, type ReactNode } from 'react'
import { ArrowLeft, GitBranch, House, Link2Off } from 'lucide-react'
import type { WorkbenchContext } from '@/app/useWorkbenchContext'
import Button from '@/components/ui/Button'
import Card, { PanelHeader } from '@/components/ui/Card'
import { useIndex } from '@/data/store'
import { formatSimTime } from '@/lib/format'
import { checkRoute } from '@/navigation/resolve'
import { back, navigate, usePreviousEntry } from '@/router/router'
import { lineage, useBranches, useCommits } from '@/stores/history'

const PARAM_LABEL: Record<string, string> = {
  runId: '运行',
  branchId: '分支',
  viewCommit: '查看提交',
  entityId: '实体',
  leftCommit: '左侧提交',
  rightCommit: '右侧提交',
}

/**
 * 深链接门控：缺少必需上下文 → ContextRequired（让用户显式选择，不补“最新”）；
 * 对象不存在 → MissingTarget（不跳到同名最新对象）。
 */
export default function RouteGate({ ctx, children }: { ctx: WorkbenchContext; children: ReactNode }) {
  const index = useIndex()
  const branches = useBranches()
  const commits = useCommits()
  const check = useMemo(() => checkRoute(ctx.route, index, { branches, commits }), [ctx.route, index, branches, commits])
  if (check.status === 'ok') return <>{children}</>
  if (check.status === 'missingContext') return <ContextRequired ctx={ctx} missing={check.missing} />
  return <MissingTarget ctx={ctx} items={check.items} />
}

function GateFrame({ icon, title, description, children }: { icon: ReactNode; title: string; description: ReactNode; children?: ReactNode }) {
  const previous = usePreviousEntry()
  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4 px-6 py-12">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-warning-soft text-warning">{icon}</span>
        <div className="min-w-0">
          <h2 className="text-title font-semibold text-ink">{title}</h2>
          <div className="mt-1 text-body text-muted">{description}</div>
        </div>
      </div>
      {children}
      <div className="flex gap-2">
        {previous ? (
          <Button icon={ArrowLeft} onClick={back}>
            返回上一页
          </Button>
        ) : null}
        <Button intent="ghost" icon={House} onClick={() => navigate({ pageId: 'P01', params: {} })}>
          项目总览
        </Button>
      </div>
    </div>
  )
}

function ContextRequired({ ctx, missing }: { ctx: WorkbenchContext; missing: string[] }) {
  const index = useIndex()
  const branches = useBranches()
  const commits = useCommits()
  const { route, spec } = ctx
  const needsCommit = missing.some((m) => m === 'viewCommit' || m === 'branchId' || m === 'runId')
  const needsEntity = missing.includes('entityId')
  const needsPair = missing.includes('leftCommit') || missing.includes('rightCommit')

  const choose = (params: Record<string, string>) => navigate({ ...route, params: { ...route.params, ...params } }, { replace: true })

  return (
    <GateFrame
      icon={<GitBranch size={20} aria-hidden />}
      title="需要选择上下文"
      description={
        <>
          {spec.id} {spec.title}缺少 <span className="font-mono text-ink-soft">{missing.map((m) => PARAM_LABEL[m] ?? m).join('、')}</span>。
          执行页不会默认取“最新”，请显式选择。
        </>
      }
    >
      {needsCommit && !needsPair ? (
        <Card>
          <PanelHeader title="选择分支与提交" meta={<span>选中后写入路由；分支 head 不受影响</span>} />
          <ul className="divide-y divide-line">
            {Object.values(branches).map((b) => (
              <li key={b.id} className="px-4 py-3">
                <div className="mb-2 flex items-center gap-2 text-body">
                  <GitBranch size={14} className="text-muted" aria-hidden />
                  <span className="font-medium">{b.label}</span>
                  <span className="font-mono text-caption text-muted">{b.id}</span>
                  <span className="text-caption text-muted">· {index.runs.get(b.runId)?.label}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {lineage(commits, b.headCommit).map((c) => (
                    <Button key={c.id} size="sm" intent={c.id === b.headCommit ? 'primary' : 'secondary'} onClick={() => choose({ runId: b.runId, branchId: b.id, viewCommit: c.id })}>
                      <span className="font-mono">{c.id}</span>
                      <span className="text-caption opacity-80">{c.id === b.headCommit ? 'head' : formatSimTime(c.simTime)}</span>
                    </Button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      {needsEntity ? (
        <Card>
          <PanelHeader title="选择实体" />
          <div className="flex flex-wrap gap-1.5 p-4">
            {[...index.entities.values()].map((e) => (
              <Button key={e.id} size="sm" onClick={() => choose({ entityId: e.id })}>
                <span className="font-mono">{e.id}</span> {e.label}
              </Button>
            ))}
          </div>
        </Card>
      ) : null}
      {needsPair ? (
        <Card>
          <PanelHeader title="选择对比提交" meta={<span>需同一基准与时刻</span>} />
          <div className="p-4">
            <Button intent="primary" size="sm" onClick={() => choose({ leftCommit: 'c043', rightCommit: 'c043-one-cooler' })}>
              <span className="font-mono">main@c043 ↔ branch-one-cooler@c043-one-cooler</span>
            </Button>
          </div>
        </Card>
      ) : null}
    </GateFrame>
  )
}

function MissingTarget({ ctx, items }: { ctx: WorkbenchContext; items: Array<{ param: string; typeLabel: string; id: string }> }) {
  return (
    <GateFrame
      icon={<Link2Off size={20} aria-hidden />}
      title="目标对象不存在"
      description={<>链接中的对象在当前项目或指定提交中找不到。不会自动跳到同名的最新对象。</>}
    >
      <Card>
        <ul className="divide-y divide-line">
          {items.map((item) => (
            <li key={`${item.param}:${item.id}`} className="flex items-center gap-3 px-4 py-3 text-body">
              <span className="w-28 shrink-0 text-muted">{item.typeLabel}</span>
              <span className="min-w-0 break-all font-mono text-danger line-through">{item.id}</span>
              <span className="ml-auto shrink-0 font-mono text-caption text-faint">{item.param}</span>
            </li>
          ))}
        </ul>
      </Card>
      <p className="min-w-0 text-label text-muted">
        请求：<span className="break-all font-mono">{ctx.contextKey}</span>
      </p>
    </GateFrame>
  )
}
