import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import { TableCell, TableHead, TableRow } from '@/components/shadcn/table'
import { cn } from '@/lib/utils'

/**
 * Table/Header、Row、Cell：表头 40、行 40；数值列右对齐、等宽数字。
 * 单元格与行基于 shadcn/ui Table。<table> 自身不套 shadcn 的 overflow 容器：
 * 该容器会成为 sticky 表头的滚动祖先，导致表头不再随页面滚动吸顶。
 */
export default function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <table data-slot="table" className={cn('w-full caption-bottom border-separate border-spacing-0 text-body', className)}>
      {children}
    </table>
  )
}

export function Th({ align = 'left', className, children, ...rest }: ThHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' | 'center' }) {
  return (
    <TableHead
      scope="col"
      className={cn(
        'sticky top-0 z-[1] h-10 whitespace-nowrap border-b border-border bg-subtle px-3 text-label font-medium text-muted',
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left',
        className,
      )}
      {...rest}
    >
      {children}
    </TableHead>
  )
}

export function Td({ align = 'left', numeric, className, children, ...rest }: TdHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' | 'center'; numeric?: boolean }) {
  return (
    <TableCell
      className={cn(
        'h-10 whitespace-normal border-b border-line px-3 py-0 align-middle',
        numeric || align === 'right' ? 'tabular text-right' : align === 'center' ? 'text-center' : 'text-left',
        className,
      )}
      {...rest}
    >
      {children}
    </TableCell>
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
    <TableRow
      data-state={selected ? 'selected' : undefined}
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
        'border-b-0 outline-none transition-colors hover:bg-transparent',
        onSelect && 'cursor-pointer hover:bg-subtle focus-visible:bg-primary-soft/60',
        selected && 'bg-primary-soft/70 hover:bg-primary-soft/70 data-[state=selected]:bg-primary-soft/70 [&>td:first-child]:shadow-[inset_3px_0_0_var(--color-primary)]',
        className,
      )}
    >
      {children}
    </TableRow>
  )
}
