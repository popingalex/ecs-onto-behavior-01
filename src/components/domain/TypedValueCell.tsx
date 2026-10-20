import { CircleQuestionMark, TriangleAlert } from 'lucide-react'
import type { DisplayValue, RawValue, UnitDef } from '@/core/types'
import { cn } from '@/lib/cn'
import { formatNumber, formatSigned, formatVector } from '@/lib/format'

/**
 * C04 TypedValueCell：只格式化，不直接写 world。
 * 0 / false / [0, 0, 0] 显示原值；null 显示“未设置”；不适用显示“—”；待裁决不补 0。
 */
function renderRaw(value: Exclude<RawValue, null>, unit: UnitDef | null | undefined) {
  if (typeof value === 'number') {
    return (
      <>
        <span className="tabular">{formatNumber(value)}</span>
        {unit ? <span className="ml-1 text-muted">{unit.symbol}</span> : null}
      </>
    )
  }
  if (typeof value === 'boolean') return <span className="font-mono text-label">{String(value)}</span>
  if (Array.isArray(value)) {
    return (
      <>
        <span className="tabular font-mono text-label">{formatVector(value)}</span>
        {unit ? <span className="ml-1 text-muted">{unit.symbol}</span> : null}
      </>
    )
  }
  return <span className="font-mono text-label">{value}</span>
}

export default function TypedValueCell({
  value,
  unit,
  align = 'right',
  showCommit,
  className,
}: {
  value: DisplayValue
  unit?: UnitDef | null
  align?: 'left' | 'right'
  showCommit?: boolean
  className?: string
}) {
  const base = cn('inline-flex items-baseline gap-1 whitespace-nowrap', align === 'right' ? 'justify-end' : 'justify-start', className)
  switch (value.state) {
    case 'value':
      return (
        <span className={base}>
          <span>{renderRaw(value.value, unit)}</span>
          {showCommit && value.commitId ? <span className="font-mono text-caption text-faint">@{value.commitId}</span> : null}
        </span>
      )
    case 'null':
      return <span className={cn(base, 'text-muted')}>未设置</span>
    case 'notApplicable':
      return (
        <span className={cn(base, 'text-faint')} aria-label="不适用">
          —
        </span>
      )
    case 'requested':
      return (
        <span className={base}>
          <span className="text-caption text-purple">请求</span>
          <span className="tabular">{formatSigned(value.value)}</span>
          {unit ? <span className="text-muted">{unit.symbol}</span> : null}
        </span>
      )
    case 'selfPreview':
      return (
        <span className={base}>
          <span className="border-b border-dashed border-purple">{renderRaw(value.value, unit)}</span>
          <span className="rounded bg-purple-soft px-1 text-caption text-purple">暂存预览</span>
        </span>
      )
    case 'pending':
      return <span className={cn(base, 'text-muted')}>待裁决</span>
    case 'unknownSource':
      return (
        <span className={cn(base, 'items-center text-muted')}>
          <CircleQuestionMark size={13} aria-hidden />
          未记录来源
        </span>
      )
    case 'unrecorded':
      return <span className={cn(base, 'text-muted')}>未记录</span>
    case 'invalid':
      return (
        <span className={cn(base, 'items-center text-danger')} title={value.reason}>
          <TriangleAlert size={13} aria-hidden />
          无效
        </span>
      )
  }
}
