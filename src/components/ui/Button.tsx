import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { LoaderCircle, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Button/Intent={primary,secondary,ghost,danger}/State={default,hover,focus,disabled,busy} */
export type ButtonIntent = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  intent?: ButtonIntent
  size?: 'md' | 'sm'
  icon?: LucideIcon
  iconRight?: LucideIcon
  busy?: boolean
}

const INTENT: Record<ButtonIntent, string> = {
  primary: 'bg-primary text-white hover:bg-primary-strong disabled:bg-[#9fcbd0] disabled:text-white',
  secondary: 'bg-surface text-ink border border-border hover:bg-hover hover:border-[#cbd6e1] disabled:text-faint',
  ghost: 'text-ink-soft hover:bg-hover hover:text-ink disabled:text-faint',
  danger: 'bg-danger text-white hover:bg-[#a83a49] disabled:opacity-50',
  'danger-ghost': 'text-danger hover:bg-danger-soft disabled:opacity-50',
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { intent = 'secondary', size = 'md', icon: Icon, iconRight: IconRight, busy, disabled, className, children, type = 'button', ...rest },
  ref,
) {
  const iconSize = size === 'md' ? 16 : 14
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-ui font-medium transition-colors disabled:cursor-not-allowed',
        size === 'md' ? 'h-9 px-3.5 text-body' : 'h-7 px-2.5 text-label',
        INTENT[intent],
        className,
      )}
      {...rest}
    >
      {busy ? <LoaderCircle size={iconSize} className="animate-spin" aria-hidden /> : Icon ? <Icon size={iconSize} aria-hidden /> : null}
      {children}
      {IconRight && !busy ? <IconRight size={iconSize} aria-hidden /> : null}
    </button>
  )
})

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon
  label: string
  size?: 'md' | 'sm'
  active?: boolean
  tone?: 'default' | 'chrome'
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Icon, label, size = 'md', active, tone = 'default', className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={active ?? undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-ui transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        size === 'md' ? 'h-9 w-9' : 'h-7 w-7',
        tone === 'chrome'
          ? 'text-[#b8c7d6] hover:bg-chrome-raised hover:text-white'
          : active
            ? 'bg-primary-soft text-primary'
            : 'text-muted hover:bg-hover hover:text-ink',
        className,
      )}
      {...rest}
    >
      <Icon size={size === 'md' ? 18 : 16} aria-hidden />
    </button>
  )
})

export default Button
