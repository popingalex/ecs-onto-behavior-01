import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/** Table/Header、Row、Cell：表头 40、行 40；数值列右对齐、等宽数字。 */
export default function Table({ children, className }: { children: ReactNode; className?: string }) {
  return <table className={cn('w-full border-separate border-spacing-0 text-body', className)}>{children}</table>
}

export function Th({ align = 'left', className, children, ...rest }: ThHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' | 'center' }) {
  return (
    <th
      scope="col"
      className={cn(
        'sticky top-0 z-[1] h-10 whitespace-nowrap border-b border-border bg-subtle px-3 text-label font-medium text-muted',
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left',
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  )
}

export function Td({ align = 'left', numeric, className, children, ...rest }: TdHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' | 'center'; numeric?: boolean }) {
  return (
    <td
      className={cn(
        'h-10 border-b border-line px-3 align-middle',
        numeric || align === 'right' ? 'tabular text-right' : align === 'center' ? 'text-center' : 'text-left',
        className,
      )}
      {...rest}
    >
      {children}
    </td>
  )
}

export function Tr({
  selected,
  onSelect,
  children,
  className,
}: {
  selected?: boolean
  onSelect?: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <tr
      aria-selected={onSelect ? Boolean(selected) : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect}
      onKeyDown={
        onSelect
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect()
              }
            }
          : undefined
      }
      className={cn(
        'outline-none transition-colors',
        onSelect && 'cursor-pointer focus-visible:bg-primary-soft/60',
        selected ? 'bg-primary-soft/70 [&>td:first-child]:shadow-[inset_3px_0_0_var(--color-primary)]' : onSelect && 'hover:bg-subtle',
        className,
      )}
    >
      {children}
    </tr>
  )
}
