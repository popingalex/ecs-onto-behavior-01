import { Tabs as TabsRoot, TabsList, TabsTrigger } from '@/components/shadcn/tabs'
import { cn } from '@/lib/utils'

export interface TabItem {
  id: string
  label: string
  count?: number
  disabled?: boolean
}

/** 页签条：基于 shadcn/ui Tabs（Radix，方向键切换焦点）。面板由调用方按 value 渲染。 */
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
    <TabsRoot value={value} onValueChange={onChange} className="gap-0" activationMode="manual">
      <TabsList
        variant="line"
        aria-label={ariaLabel}
        className={cn('flex h-10 w-full items-end justify-start gap-5 rounded-none border-b border-line p-0 group-data-[orientation=horizontal]/tabs:h-10', className)}
      >
        {items.map((item) => (
          <TabsTrigger
            key={item.id}
            value={item.id}
            disabled={item.disabled}
            className={cn(
              '-mb-px h-10 flex-none gap-1.5 rounded-none border-0 border-b-2 border-transparent px-0 py-0 text-body font-normal text-muted shadow-none after:hidden hover:text-ink',
              'focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:outline-none disabled:pointer-events-auto disabled:cursor-not-allowed disabled:text-faint disabled:opacity-100',
              'data-[state=active]:border-primary data-[state=active]:font-semibold data-[state=active]:text-primary-strong',
            )}
          >
            {item.label}
            {item.count !== undefined ? <span className="tabular rounded bg-neutral-soft px-1.5 text-caption font-normal text-muted">{item.count}</span> : null}
          </TabsTrigger>
        ))}
      </TabsList>
    </TabsRoot>
  )
}
