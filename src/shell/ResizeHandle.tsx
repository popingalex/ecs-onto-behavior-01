import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { cn } from '@/lib/cn'

/** 面板宽度拖拽 / 键盘调整（←→ 每次 16px）。 */
export default function ResizeHandle({
  side,
  value,
  onChange,
  label,
}: {
  /** 句柄位于面板的哪一侧 */
  side: 'left' | 'right'
  value: number
  onChange: (value: number) => void
  label: string
}) {
  const start = useRef<{ x: number; value: number } | null>(null)
  const sign = side === 'right' ? 1 : -1
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    start.current = { x: e.clientX, value }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return
    onChange(start.current.value + sign * (e.clientX - start.current.x))
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') onChange(value - sign * 16)
    if (e.key === 'ArrowRight') onChange(value + sign * 16)
  }
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={value}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => (start.current = null)}
      onKeyDown={onKeyDown}
      className={cn(
        'group absolute top-0 z-10 h-full w-2 cursor-col-resize outline-none',
        side === 'right' ? '-right-1' : '-left-1',
      )}
    >
      <span className="mx-auto block h-full w-px bg-transparent transition-colors group-hover:bg-primary group-focus-visible:bg-primary" />
    </div>
  )
}
