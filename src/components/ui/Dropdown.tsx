import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/cn"

export interface DropdownOption {
  value: string
  label: ReactNode
  meta?: ReactNode
  disabled?: boolean
}

/** 富内容下拉（提交选择器等）。键盘：↑↓ 选择，Enter 确认，Esc 关闭。 */
export default function Dropdown({
  value,
  options,
  onChange,
  renderValue,
  ariaLabel,
  disabled,
  width = 320,
  className,
}: {
  value: string
  options: DropdownOption[]
  onChange: (value: string) => void
  renderValue: ReactNode
  ariaLabel: string
  disabled?: boolean
  width?: number
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listId = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  const openList = () => {
    const idx = options.findIndex((o) => o.value === value)
    setActive(idx < 0 ? 0 : idx)
    setOpen(true)
  }

  const choose = (option: DropdownOption | undefined) => {
    if (!option || option.disabled) return
    setOpen(false)
    buttonRef.current?.focus()
    if (option.value !== value) onChange(option.value)
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return
          if (
            !open &&
            (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")
          ) {
            e.preventDefault()
            openList()
            return
          }
          if (!open) return
          if (e.key === "Escape") {
            e.preventDefault()
            e.stopPropagation()
            setOpen(false)
          } else if (e.key === "ArrowDown") {
            e.preventDefault()
            setActive((a) => Math.min(options.length - 1, a + 1))
          } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setActive((a) => Math.max(0, a - 1))
          } else if (e.key === "Enter") {
            e.preventDefault()
            choose(options[active])
          }
        }}
        className="flex h-9 items-center gap-2 rounded-ui border border-border bg-surface pl-2.5 pr-2 text-body transition-colors hover:border-[#c3cfdb] disabled:cursor-not-allowed disabled:bg-subtle"
      >
        {renderValue}
        <ChevronDown
          size={15}
          className={cn(
            "text-muted transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          style={{ width }}
          className="scroll-thin absolute left-0 top-[calc(100%+4px)] z-40 max-h-80 overflow-auto rounded-ui border border-border bg-surface py-1 shadow-pop"
        >
          {options.map((option, i) => (
            <li
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              aria-disabled={option.disabled || undefined}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(option)}
              className={cn(
                "flex cursor-pointer items-center gap-2 px-3 py-2",
                i === active && "bg-hover",
                option.disabled && "cursor-not-allowed opacity-50",
              )}
            >
              <span className="flex w-4 shrink-0 justify-center text-primary">
                {option.value === value ? (
                  <Check size={15} aria-hidden />
                ) : null}
              </span>
              <span className="min-w-0 flex-1">{option.label}</span>
              {option.meta ? (
                <span className="shrink-0 text-caption text-muted">
                  {option.meta}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
