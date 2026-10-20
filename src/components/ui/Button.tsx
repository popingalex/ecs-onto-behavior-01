import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { LoaderCircle, type LucideIcon } from 'lucide-react'
import { Button as ShadButton } from '@/components/shadcn/button'
import { cn } from '@/lib/utils'

/** Button/Intent={primary,secondary,ghost,danger}/State={default,hover,focus,disabled,busy}；基于 shadcn/ui Button。 */
export type ButtonIntent = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  intent?: ButtonIntent
  size?: 'md' | 'sm'
  icon?: LucideIcon
  iconRight?: LucideIcon
  busy?: boolean
}

const VARIANT = { primary: 'default', secondary: 'outline', ghost: 'ghost', danger: 'destructive', 'danger-ghost': 'ghost' } as const

const INTENT: Record<ButtonIntent, string> = {
  primary: 'bg-primary text-white hover:bg-primary-strong disabled:bg-[#9fcbd0] disabled:text-white disabled:opacity-100',
  secondary: 'bg-surface text-ink border border-border shadow-none hover:bg-hover hover:border-[#cbd6e1] hover:text-ink disabled:text-faint disabled:opacity-100',
  ghost: 'text-ink-soft hover:bg-hover hover:text-ink disabled:text-faint disabled:opacity-100',
  danger: 'bg-danger text-white hover:bg-[#a83a49] disabled:opacity-50',
  'danger-ghost': 'text-danger hover:bg-danger-soft hover:text-danger disabled:opacity-50',
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { intent = 'secondary', size = 'md', icon: Icon, iconRight: IconRight, busy, disabled, className, children, type = 'button', ...rest },
  ref,
) {
  const iconClass = size === 'md' ? 'size-4' : 'size-3.5'
  return (
    <ShadButton
      ref={ref}
      type={type}
      variant={VARIANT[intent]}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cn(
        'gap-1.5 rounded-ui font-medium shadow-none transition-colors disabled:pointer-events-auto disabled:cursor-not-allowed',
        size === 'md' ? 'h-9 px-3.5 text-body has-[>svg]:px-3.5' : 'h-7 px-2.5 text-label has-[>svg]:px-2.5',
        INTENT[intent],
        className,
      )}
      {...rest}
    >
      {busy ? <LoaderCircle className={cn(iconClass, 'animate-spin')} aria-hidden /> : Icon ? <Icon className={iconClass} aria-hidden /> : null}
      {children}
      {IconRight && !busy ? <IconRight className={iconClass} aria-hidden /> : null}
    </ShadButton>
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
    <ShadButton
      ref={ref}
      type={type}
      variant="ghost"
      size={size === 'md' ? 'icon' : 'icon-sm'}
      aria-label={label}
      title={label}
      aria-pressed={active ?? undefined}
      className={cn(
        'rounded-ui transition-colors disabled:pointer-events-auto disabled:cursor-not-allowed disabled:opacity-40',
        size === 'md' ? 'size-9' : 'size-7',
        tone === 'chrome'
          ? 'text-[#b8c7d6] hover:bg-chrome-raised hover:text-white'
          : active
            ? 'bg-primary-soft text-primary hover:bg-primary-soft hover:text-primary'
            : 'text-muted hover:bg-hover hover:text-ink',
        className,
      )}
      {...rest}
    >
      <Icon className={size === 'md' ? 'size-[18px]' : 'size-4'} aria-hidden />
    </ShadButton>
  )
})

export default Button
