import { cn } from '@/lib/cn'

export interface TabItem {
  id: string
  label: string
  count?: number
  disabled?: boolean
}

export default function Tabs({
  items,
  value,
  onChange,
  className,
  ariaLabel,
}: {
  items: TabItem[]
  value: string
  onChange: (id: string) => void
  className?: string
  ariaLabel: string
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn('flex h-10 items-end gap-5 border-b border-line', className)}>
      {items.map((item) => {
        const selected = item.id === value
        return (
          <button
            key={item.id}
            role="tab"
            type="button"
            aria-selected={selected}
            disabled={item.disabled}
            onClick={() => onChange(item.id)}
            className={cn(
              '-mb-px flex h-10 items-center gap-1.5 border-b-2 text-body transition-colors disabled:cursor-not-allowed disabled:text-faint',
              selected ? 'border-primary font-semibold text-primary-strong' : 'border-transparent text-muted hover:text-ink',
            )}
          >
            {item.label}
            {item.count !== undefined ? <span className="tabular rounded bg-neutral-soft px-1.5 text-caption text-muted">{item.count}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
