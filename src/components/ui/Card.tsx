import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export default function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn('rounded-ui border border-border bg-surface shadow-card', className)}>{children}</section>
}

/** 面板标题 48 高。 */
export function PanelHeader({
  title,
  meta,
  actions,
  className,
}: {
  title: ReactNode
  meta?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('flex h-12 shrink-0 items-center gap-3 border-b border-line px-4', className)}>
      <h2 className="text-body font-semibold text-ink">{title}</h2>
      {meta ? <div className="flex min-w-0 items-center gap-2 text-label text-muted">{meta}</div> : null}
      {actions ? <div className="ml-auto flex items-center gap-2">{actions}</div> : null}
    </header>
  )
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('text-caption font-semibold tracking-wide text-muted', className)}>{children}</div>
}

/** 键值行：检查器、上下文信息使用。 */
export function KeyValue({ label, children, mono }: { label: ReactNode; children: ReactNode; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] items-start gap-3 py-1.5">
      <dt className="text-label text-muted">{label}</dt>
      <dd className={cn('min-w-0 break-words text-body text-ink', mono && 'font-mono text-label')}>{children}</dd>
    </div>
  )
}

export function Notice({
  tone = 'info',
  icon,
  children,
  actions,
  className,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success'
  icon?: ReactNode
  children: ReactNode
  actions?: ReactNode
  className?: string
}) {
  const toneClass = {
    info: 'border-primary-line bg-primary-soft text-primary-strong',
    warning: 'border-warning-line bg-warning-soft text-warning-ink',
    danger: 'border-danger-line bg-danger-soft text-danger',
    success: 'border-[#b4dccd] bg-success-soft text-success',
  }[tone]
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex items-start gap-2.5 rounded-ui border px-3 py-2.5 text-body', toneClass, className)}>
      {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
      <div className="min-w-0 flex-1">{children}</div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  )
}
