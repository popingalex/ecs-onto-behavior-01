import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { ChevronDown, CircleAlert } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Field/Type={text,number,select,quantity,entityRef}/State={default,error,readonly}；输入高 36。 */
export default function Field({
  label,
  hint,
  error,
  required,
  children,
  htmlFor,
}: {
  label: ReactNode
  hint?: ReactNode
  error?: string | null
  required?: boolean
  htmlFor?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="flex items-center gap-1 text-label font-medium text-ink-soft">
        {label}
        {required ? <span className="text-danger" aria-hidden>*</span> : null}
      </label>
      {children}
      {error ? (
        <p role="alert" className="flex items-start gap-1 text-caption text-danger">
          <CircleAlert size={13} className="mt-[2px] shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p className="text-caption text-muted">{hint}</p>
      ) : null}
    </div>
  )
}

const INPUT =
  'h-9 w-full min-w-0 rounded-ui border bg-surface px-3 text-body text-ink placeholder:text-faint outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 read-only:bg-subtle read-only:text-ink-soft disabled:bg-subtle disabled:text-faint'

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
  suffix?: ReactNode
  mono?: boolean
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { invalid, suffix, mono, className, ...rest },
  ref,
) {
  const input = (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(INPUT, invalid ? 'border-danger' : 'border-border', mono && 'font-mono text-label', suffix ? 'pr-12' : undefined, className)}
      {...rest}
    />
  )
  if (!suffix) return input
  return (
    <div className="relative">
      {input}
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-label text-muted">{suffix}</span>
    </div>
  )
})

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean
  options: Array<{ value: string; label: string; disabled?: boolean }>
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid, options, placeholder, className, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(INPUT, 'appearance-none pr-9', invalid ? 'border-danger' : 'border-border', className)}
        {...rest}
      >
        {placeholder !== undefined ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
    </div>
  )
})

export function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
  label: string
}) {
  const id = useId()
  return (
    <div className="flex h-9 items-center gap-2.5">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'bg-primary' : 'bg-[#c3cfdb]',
        )}
      >
        <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-[left]', checked ? 'left-[18px]' : 'left-0.5')} />
      </button>
      <span className="font-mono text-label text-ink-soft">{String(checked)}</span>
    </div>
  )
}
