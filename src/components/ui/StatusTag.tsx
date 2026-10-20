import type { ReactNode } from 'react'
import {
  Ban,
  CircleCheck,
  CircleDashed,
  CircleDot,
  CircleX,
  Clock,
  Eye,
  FileClock,
  GitCommitHorizontal,
  Hourglass,
  LoaderCircle,
  Lock,
  MapPinOff,
  Pause,
  PencilLine,
  Play,
  Send,
  Snowflake,
  TriangleAlert,
  WifiOff,
  type LucideIcon,
} from 'lucide-react'
import { STATUS, type StatusKey, type Tone } from '@/core/status'
import { cn } from '@/lib/cn'

const TONE: Record<Tone, string> = {
  neutral: 'bg-neutral-soft text-ink-soft',
  primary: 'bg-primary-soft text-primary-strong',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning-ink',
  danger: 'bg-danger-soft text-danger',
  purple: 'bg-purple-soft text-purple',
}

const ICON: Partial<Record<StatusKey, LucideIcon>> = {
  draft: PencilLine,
  dirty: PencilLine,
  saving: LoaderCircle,
  saved: CircleCheck,
  saveFailed: CircleX,
  unvalidated: CircleDashed,
  validating: LoaderCircle,
  valid: CircleCheck,
  validationStale: TriangleAlert,
  validationFailed: CircleX,
  published: Send,
  publishing: LoaderCircle,
  queued: Hourglass,
  waitingInputs: Clock,
  frozen: Snowflake,
  computing: LoaderCircle,
  committing: LoaderCircle,
  committed: GitCommitHorizontal,
  playing: Play,
  playbackPaused: Pause,
  failed: CircleX,
  history: Eye,
  head: CircleDot,
  offline: WifiOff,
  readonly: Lock,
  pendingDecision: Clock,
  rejected: Ban,
  approved: CircleCheck,
  draftChange: PencilLine,
  stub: FileClock,
  checkpoint: GitCommitHorizontal,
  noPosition: MapPinOff,
}

const SPINNING = new Set<StatusKey>(['saving', 'validating', 'publishing', 'computing', 'committing'])

export interface TagProps {
  tone?: Tone
  icon?: LucideIcon
  size?: 'md' | 'sm'
  spin?: boolean
  className?: string
  title?: string
  children: ReactNode
}

export function Tag({ tone = 'neutral', icon: Icon, size = 'md', spin, className, title, children }: TagProps) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-ui font-medium',
        size === 'md' ? 'h-7 px-2 text-label' : 'h-6 px-1.5 text-caption',
        TONE[tone],
        className,
      )}
    >
      {Icon ? <Icon size={size === 'md' ? 14 : 12} aria-hidden className={spin ? 'animate-spin' : undefined} /> : null}
      {children}
    </span>
  )
}

/** 语义状态标签：图标与文字并存，不只靠颜色。 */
export default function StatusTag({ status, size, label, className }: { status: StatusKey; size?: 'md' | 'sm'; label?: string; className?: string }) {
  const meta = STATUS[status]
  return (
    <Tag tone={meta.tone} icon={ICON[status]} spin={SPINNING.has(status)} size={size} className={className}>
      {label ?? meta.label}
    </Tag>
  )
}
