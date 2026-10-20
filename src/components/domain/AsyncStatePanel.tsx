import type { ReactNode } from 'react'
import { CircleAlert, Inbox, LoaderCircle, RefreshCw, TriangleAlert, WifiOff } from 'lucide-react'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/cn'

/** C20 AsyncStatePanel：所有读组件共用的 loading / empty / error / stale / disconnected。 */
export type AsyncStatus = 'loading' | 'empty' | 'error' | 'stale' | 'disconnected'

const META: Record<AsyncStatus, { icon: typeof Inbox; tone: string; title: string }> = {
  loading: { icon: LoaderCircle, tone: 'text-primary', title: '正在加载' },
  empty: { icon: Inbox, tone: 'text-faint', title: '暂无内容' },
  error: { icon: CircleAlert, tone: 'text-danger', title: '加载失败' },
  stale: { icon: TriangleAlert, tone: 'text-warning', title: '数据已过期' },
  disconnected: { icon: WifiOff, tone: 'text-danger', title: '连接已断开' },
}

export default function AsyncStatePanel({
  status,
  title,
  description,
  onRetry,
  actions,
  className,
  compact,
}: {
  status: AsyncStatus
  title?: string
  description?: ReactNode
  onRetry?: () => void
  actions?: ReactNode
  className?: string
  compact?: boolean
}) {
  const meta = META[status]
  const Icon = meta.icon
  return (
    <div
      role={status === 'error' || status === 'disconnected' ? 'alert' : 'status'}
      className={cn('flex flex-col items-center justify-center text-center', compact ? 'gap-2 py-6' : 'gap-3 py-16', className)}
    >
      <span className={cn('flex items-center justify-center rounded-full bg-subtle', compact ? 'h-10 w-10' : 'h-12 w-12', meta.tone)}>
        <Icon size={compact ? 18 : 22} className={status === 'loading' ? 'animate-spin' : undefined} aria-hidden />
      </span>
      <div className="max-w-[420px]">
        <p className="text-body font-semibold text-ink">{title ?? meta.title}</p>
        {description ? <div className="mt-1 text-label text-muted">{description}</div> : null}
      </div>
      {onRetry || actions ? (
        <div className="flex items-center gap-2">
          {onRetry ? (
            <Button size="sm" icon={RefreshCw} onClick={onRetry}>
              重试
            </Button>
          ) : null}
          {actions}
        </div>
      ) : null}
    </div>
  )
}
