import { ArrowLeft, ArrowRight, CornerDownLeft, FileClock } from 'lucide-react'
import type { WorkbenchContext } from '@/app/useWorkbenchContext'
import Button from '@/components/ui/Button'
import Card, { PanelHeader } from '@/components/ui/Card'
import StatusTag from '@/components/ui/StatusTag'
import Table, { Td, Th, Tr } from '@/components/ui/Table'
import { cn } from '@/lib/cn'
import { COMPONENT_SPECS } from '@/navigation/components'
import { PAGE_SPECS } from '@/navigation/pages'
import { REPRESENTATIVE_PATH, pathPosition } from '@/navigation/paths'
import { buildTransitionRoute } from '@/navigation/resolve'
import { ACTION_LABELS, incoming, outgoing } from '@/navigation/transitions'
import { navigate } from '@/router/router'

/**
 * 统一占位页：逐页规格（pages/Pxx.md）尚未提供。
 * 页面本身可导航、上下文与跳转完整，内容区明确标记“规格待接入”。
 */
export default function PagePlaceholder({ ctx }: { ctx: WorkbenchContext }) {
  const { spec, route, run, branch, viewCommit } = ctx
  const exits = outgoing(spec.id)
  const entries = incoming(spec.id)
  const step = pathPosition(spec.id)
  const prev = step > 0 ? REPRESENTATIVE_PATH[step - 1] : null
  const next = step >= 0 && step < REPRESENTATIVE_PATH.length - 1 ? REPRESENTATIVE_PATH[step + 1] : null
  const params = Object.entries(route.params)

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-6 py-6">
      <section className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded bg-neutral-soft px-1.5 font-mono text-label text-muted">{spec.id}</span>
            <h2 className="text-title font-semibold">{spec.title}</h2>
            <StatusTag status="stub" label="规格待接入" size="sm" />
          </div>
          <p className="mt-1.5 max-w-[760px] text-body text-muted">{spec.summary}</p>
        </div>
      </section>

      {step >= 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-ui border border-primary-line bg-primary-soft px-4 py-2.5">
          <span className="text-label font-medium text-primary-strong">
            代表性链路 · 第 {step + 1} / {REPRESENTATIVE_PATH.length} 步
          </span>
          <span className="text-label text-primary-strong/80">{REPRESENTATIVE_PATH[step].note}</span>
          <div className="ml-auto flex gap-2">
            {prev ? (
              <Button size="sm" icon={ArrowLeft} onClick={() => navigate(prev.route)}>
                {prev.route.pageId} {PAGE_SPECS[prev.route.pageId].title}
              </Button>
            ) : null}
            {next ? (
              <Button size="sm" intent="primary" iconRight={ArrowRight} onClick={() => navigate(next.route)}>
                {next.route.pageId} {PAGE_SPECS[next.route.pageId].title}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <PanelHeader title="当前上下文" meta={<span>来自路由，可深链接</span>} />
          <dl className="divide-y divide-line">
            {spec.requires.map((key) => (
              <div key={key} className="flex items-center gap-3 px-4 py-2">
                <dt className="w-28 shrink-0 font-mono text-label text-muted">{key}</dt>
                <dd className="font-mono text-label">{route.params[key]}</dd>
                <span className="ml-auto text-caption text-faint">必需</span>
              </div>
            ))}
            {params
              .filter(([k]) => !spec.requires.includes(k))
              .map(([k, v]) => (
                <div key={k} className="flex items-center gap-3 px-4 py-2">
                  <dt className="w-28 shrink-0 font-mono text-label text-muted">{k}</dt>
                  <dd className="min-w-0 truncate font-mono text-label">{v}</dd>
                </div>
              ))}
            {spec.context === 'execution' && run ? (
              <div className="px-4 py-2 text-label text-muted">
                {run.label} · {branch ? `${branch.label}（head ${branch.headCommit}）` : '未选分支'}
                {viewCommit ? ` · 查看 ${viewCommit.id}，第 ${viewCommit.round} 回合` : ''}
              </div>
            ) : null}
            {params.length === 0 && spec.requires.length === 0 ? <div className="px-4 py-3 text-label text-muted">无参数：从资源树选择对象可附加参数。</div> : null}
          </dl>
        </Card>

        <Card>
          <PanelHeader title="规划组件" meta={<span>02_components 稳定边界</span>} />
          <ul className="divide-y divide-line">
            {spec.components.map((id) => (
              <li key={id} className="flex items-center gap-3 px-4 py-2">
                <span className="w-9 shrink-0 font-mono text-caption text-muted">{id}</span>
                <span className="w-[150px] shrink-0 font-mono text-label text-ink">{COMPONENT_SPECS[id].name}</span>
                <span className="min-w-0 truncate text-label text-muted">{COMPONENT_SPECS[id].owner}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {spec.layout.canvas ? (
        <Card className="overflow-hidden">
          <PanelHeader title="布局预览" meta={<span>画布 + 底部面板；全屏画布可用 Esc 恢复</span>} />
          <div className="grid h-[220px] grid-rows-[1fr_64px]">
            <div className="canvas-grid flex items-center justify-center bg-[#f6f9fb] text-label text-muted">
              <span className="flex items-center gap-2 rounded-ui bg-surface/90 px-3 py-1.5 shadow-card">
                <FileClock size={15} aria-hidden />
                {spec.components.includes('C07') ? 'GraphCanvas（C07）' : 'SpatialViewport（C12）'} · 内容待接入
              </span>
            </div>
            <div className="border-t border-border bg-surface px-4 py-2 text-caption text-muted">底部面板：诊断 / 实体表 / 轨迹</div>
          </div>
        </Card>
      ) : null}

      <Card>
        <PanelHeader title="出口跳转" meta={<span>跳转表登记 {exits.length} 条；热点只指向真实目标</span>} />
        {exits.length ? (
          <div className="scroll-thin overflow-auto">
            <Table className="min-w-[640px]">
              <thead>
                <tr>
                  <Th>动作</Th>
                  <Th>目标</Th>
                  <Th>参数</Th>
                  <Th align="right">
                    <span className="sr-only">打开</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {exits.map((t) => {
                  const target = buildTransitionRoute(route, t)
                  return (
                    <Tr key={t.action} onSelect={target ? () => navigate(target) : undefined}>
                      <Td className="font-medium">{ACTION_LABELS[t.action] ?? t.action}</Td>
                      <Td>
                        {t.to === 'return' ? (
                          <span className="inline-flex items-center gap-1 text-muted">
                            <CornerDownLeft size={13} aria-hidden />
                            返回触发点
                          </span>
                        ) : (
                          <span>
                            <span className="font-mono text-label text-muted">{t.to}</span> {PAGE_SPECS[t.to].title}
                          </span>
                        )}
                      </Td>
                      <Td className="max-w-[360px]">
                        <span className="block truncate font-mono text-caption text-muted">
                          {Object.entries(target?.params ?? t.params)
                            .filter(([, v]) => v !== '')
                            .map(([k, v]) => `${k}=${v}`)
                            .join(' · ') || '—'}
                        </span>
                      </Td>
                      <Td align="right">{target ? <ArrowRight size={15} className="inline text-primary" aria-hidden /> : null}</Td>
                    </Tr>
                  )
                })}
              </tbody>
            </Table>
          </div>
        ) : (
          <p className="px-4 py-3 text-label text-muted">跳转表中没有从 {spec.id} 出发的条目。</p>
        )}
      </Card>

      {entries.length ? (
        <Card>
          <PanelHeader title="入口" meta={<span>可从以下页面到达</span>} />
          <div className="flex flex-wrap gap-2 px-4 py-3">
            {entries.map((t) => (
              <button
                key={`${t.from}:${t.action}`}
                type="button"
                onClick={() => navigate({ pageId: t.from, params: {} })}
                className={cn('flex items-center gap-1.5 rounded-ui border border-border px-2.5 py-1 text-label hover:border-primary-line hover:bg-primary-soft')}
              >
                <span className="font-mono text-caption text-muted">{t.from}</span>
                {PAGE_SPECS[t.from].title}
                <span className="text-caption text-faint">· {ACTION_LABELS[t.action] ?? t.action}</span>
              </button>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  )
}
