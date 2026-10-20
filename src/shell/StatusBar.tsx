import { Cpu, Wifi, WifiOff } from 'lucide-react'
import type { WorkbenchContext } from '@/app/useWorkbenchContext'
import { useIndex } from '@/data/store'
import { cn } from '@/lib/cn'
import type { ViewportTier } from '@/lib/useViewport'
import { toLogicalUri } from '@/router/route'
import { useRunCommands } from '@/stores/commandQueue'
import { ROLE_LABELS, useConnection, useRole } from '@/stores/context'
import { useExecutionAdapterLabel } from '@/stores/session'

const TIER_LABEL: Record<ViewportTier, string> = { standard: '标准布局', compact: '紧凑布局', narrow: '窄屏浮层' }

export default function StatusBar({ ctx, tier, width }: { ctx: WorkbenchContext; tier: ViewportTier; width: number }) {
  const index = useIndex()
  const connection = useConnection()
  const role = useRole()
  const adapter = useExecutionAdapterLabel()
  const commands = useRunCommands()
  const pending = commands.filter((c) => c.status === 'pending' || c.status === 'accepted').length
  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-border bg-surface px-3 text-caption text-muted">
      <span className={cn('flex items-center gap-1.5', connection === 'offline' && 'font-medium text-danger')}>
        {connection === 'online' ? <Wifi size={12} aria-hidden /> : <WifiOff size={12} aria-hidden />}
        {connection === 'online' ? '核心服务已连接' : '离线 · 草稿仅保存在本地'}
      </span>
      <span className="flex items-center gap-1.5">
        <Cpu size={12} aria-hidden />
        {adapter}
      </span>
      <span>
        命令队列 <span className="tabular text-ink-soft">{pending}</span> 待处理 / {commands.length}
      </span>
      <span>{ROLE_LABELS[role]}</span>
      <span className="ml-auto hidden truncate font-mono lg:inline">{toLogicalUri(index.project.id, ctx.route)}</span>
      <span className="tabular shrink-0">
        {TIER_LABEL[tier]} · {width}px
      </span>
      <span className="shrink-0">React 原型 · 生产实现 Rust / egui</span>
    </footer>
  )
}
