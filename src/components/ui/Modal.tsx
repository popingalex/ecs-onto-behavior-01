import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { focusableWithin } from '@/lib/keyboard'
import { cn } from '@/lib/cn'
import { IconButton } from './Button'

/** 焦点锁定在弹层内；关闭后返回触发控件。 */
function useFocusTrap(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null
    const node = ref.current
    if (node) {
      const first = focusableWithin(node)[0]
      ;(first ?? node).focus()
    }
    const onKey = (e: KeyboardEvent) => {
      if (!node) return
      if (e.key === 'Escape' && !e.isComposing) {
        e.stopPropagation()
        closeRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const items = focusableWithin(node)
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      if (trigger && document.contains(trigger)) trigger.focus()
    }
  }, [])
  return ref
}

export default function Modal({
  title,
  subtitle,
  width = 560,
  onClose,
  footer,
  children,
}: {
  title: ReactNode
  subtitle?: ReactNode
  width?: number
  onClose: () => void
  footer?: ReactNode
  children: ReactNode
}) {
  const ref = useFocusTrap(onClose)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgb(22_42_64/0.36)] p-6">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        style={{ width }}
        className="flex max-h-[calc(100vh-96px)] max-w-full flex-col overflow-hidden rounded-lg bg-surface shadow-pop outline-none"
      >
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line pl-5 pr-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-body-lg font-semibold">{title}</h2>
          </div>
          {subtitle ? <div className="text-label text-muted">{subtitle}</div> : null}
          <IconButton icon={X} label="关闭" size="sm" onClick={onClose} />
        </header>
        <div className="scroll-thin min-h-0 flex-1 overflow-auto">{children}</div>
        {footer ? <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line bg-subtle px-5 py-3">{footer}</footer> : null}
      </div>
    </div>
  )
}

export function Drawer({
  title,
  subtitle,
  width = 520,
  onClose,
  footer,
  children,
}: {
  title: ReactNode
  subtitle?: ReactNode
  width?: number
  onClose: () => void
  footer?: ReactNode
  children: ReactNode
}) {
  const ref = useFocusTrap(onClose)
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[rgb(22_42_64/0.24)]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        style={{ width }}
        className={cn('flex h-full max-w-full flex-col bg-surface shadow-pop outline-none')}
      >
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line pl-5 pr-3">
          <h2 className="min-w-0 flex-1 truncate text-body-lg font-semibold">{title}</h2>
          {subtitle ? <div className="text-label text-muted">{subtitle}</div> : null}
          <IconButton icon={X} label="关闭" size="sm" onClick={onClose} />
        </header>
        <div className="scroll-thin min-h-0 flex-1 overflow-auto">{children}</div>
        {footer ? <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line bg-subtle px-5 py-3">{footer}</footer> : null}
      </div>
    </div>
  )
}
