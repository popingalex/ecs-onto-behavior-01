import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { dismissToast, useToasts } from '@/stores/toast'

const TONE = {
  success: { icon: CircleCheck, className: 'text-success' },
  info: { icon: Info, className: 'text-primary' },
  warning: { icon: TriangleAlert, className: 'text-warning' },
  danger: { icon: CircleAlert, className: 'text-danger' },
} as const

export default function Toaster() {
  const toasts = useToasts()
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-10 right-4 z-[60] flex w-[360px] flex-col gap-2">
      {toasts.map((t) => {
        const tone = TONE[t.tone] ?? TONE.info
        const Icon = tone.icon
        return (
          <div key={t.id} role="status" className="pointer-events-auto flex items-start gap-2.5 rounded-ui border border-border bg-surface px-3 py-2.5 shadow-pop">
            <Icon size={16} className={cn('mt-0.5 shrink-0', tone.className)} aria-hidden />
            <p className="min-w-0 flex-1 text-body text-ink">{t.message}</p>
            <button type="button" aria-label="关闭提示" onClick={() => dismissToast(t.id)} className="shrink-0 rounded p-0.5 text-muted hover:bg-hover">
              <X size={14} aria-hidden />
            </button>
          </div>
        )
      })}
    </div>
  )
}
