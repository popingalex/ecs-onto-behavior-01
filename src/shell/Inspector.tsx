import { useState, type ReactNode } from 'react'
import { ArrowRight, Check, Copy } from 'lucide-react'
import type { WorkbenchContext } from '@/app/useWorkbenchContext'
import { KeyValue, SectionLabel } from '@/components/ui/Card'
import { useIndex } from '@/data/store'
import { COMPONENT_SPECS } from '@/navigation/components'
import { PAGE_SPECS } from '@/navigation/pages'
import { buildTransitionRoute } from '@/navigation/resolve'
import { ACTION_LABELS, outgoing } from '@/navigation/transitions'
import { toLogicalUri } from '@/router/route'
import { navigate } from '@/router/router'

const CONTEXT_LABEL = { project: '项目', asset: '资产（模型 / 场景 / 程序）', execution: '执行（运行 / 分支 / 提交）' } as const
const KIND_LABEL = { page: '页面', modal: '模态', drawer: '抽屉' } as const

/** 检查器外框：页面可提供专属内容；底部始终保留页面契约，便于核对注册表。 */
export default function Inspector({ ctx, children }: { ctx: WorkbenchContext; children?: ReactNode }) {
  return (
    <aside aria-label="检查器" className="flex h-full flex-col">
      <div className="scroll-thin min-h-0 flex-1 overflow-auto">
        {children}
        <PageContract ctx={ctx} collapsedByDefault={Boolean(children)} />
      </div>
    </aside>
  )
}

function PageContract({ ctx, collapsedByDefault }: { ctx: WorkbenchContext; collapsedByDefault: boolean }) {
  const index = useIndex()
  const [open, setOpen] = useState(!collapsedByDefault)
  const [copied, setCopied] = useState(false)
  const { spec, route } = ctx
  const uri = toLogicalUri(index.project.id, route)
  const exits = outgoing(spec.id)

  return (
    <section className="border-t border-line first:border-t-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-full items-center justify-between px-4 text-left hover:bg-subtle"
      >
        <SectionLabel>页面契约 · {spec.id}</SectionLabel>
        <span className="text-caption text-muted">{open ? '收起' : '展开'}</span>
      </button>
      {open ? (
        <div className="px-4 pb-4">
          <dl>
            <KeyValue label="类型">{KIND_LABEL[spec.kind]}</KeyValue>
            <KeyValue label="上下文">{CONTEXT_LABEL[spec.context]}</KeyValue>
            <KeyValue label="必需参数">{spec.requires.length ? <span className="font-mono text-label">{spec.requires.join(', ')}</span> : '无'}</KeyValue>
            <KeyValue label="逻辑路由">
              <span className="flex items-start gap-1">
                <span className="min-w-0 break-all font-mono text-caption text-ink-soft">{uri}</span>
                <button
                  type="button"
                  aria-label="复制逻辑路由"
                  onClick={() => {
                    void navigator.clipboard?.writeText(uri).then(() => {
                      setCopied(true)
                      setTimeout(() => setCopied(false), 1200)
                    })
                  }}
                  className="shrink-0 rounded p-0.5 text-muted hover:bg-hover hover:text-ink"
                >
                  {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
                </button>
              </span>
            </KeyValue>
          </dl>
          <SectionLabel className="mb-1.5 mt-3">规划组件</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {spec.components.map((id) => (
              <span key={id} title={`${COMPONENT_SPECS[id].label} · ${COMPONENT_SPECS[id].owner}`} className="rounded border border-border bg-subtle px-1.5 py-0.5 text-caption text-ink-soft">
                <span className="font-mono text-muted">{id}</span> {COMPONENT_SPECS[id].name}
              </span>
            ))}
          </div>
          {exits.length ? (
            <>
              <SectionLabel className="mb-1 mt-4">出口跳转（跳转表）</SectionLabel>
              <ul className="-mx-2">
                {exits.map((t) => {
                  const target = buildTransitionRoute(route, t)
                  return (
                    <li key={t.action}>
                      <button
                        type="button"
                        disabled={!target}
                        onClick={() => target && navigate(target)}
                        className="group flex w-full items-center gap-2 rounded-ui px-2 py-1.5 text-left hover:bg-hover disabled:cursor-default disabled:hover:bg-transparent"
                      >
                        <span className="min-w-0 flex-1 truncate text-label text-ink">{ACTION_LABELS[t.action] ?? t.action}</span>
                        <span className="shrink-0 font-mono text-caption text-muted">{t.to === 'return' ? '返回' : `${t.to} ${PAGE_SPECS[t.to].title}`}</span>
                        <ArrowRight size={13} className="shrink-0 text-faint group-hover:text-primary" aria-hidden />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

/** 检查器内常用的分节。 */
export function InspectorSection({ title, actions, children }: { title: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-t border-line px-4 py-3 first:border-t-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <SectionLabel>{title}</SectionLabel>
        {actions}
      </div>
      {children}
    </section>
  )
}
