import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react"
import { CircleAlert } from "lucide-react"
import { Input } from "@/components/shadcn/input"
import { Label } from "@/components/shadcn/label"
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/shadcn/native-select"
import { Switch as ShadSwitch } from "@/components/shadcn/switch"
import { cn } from "@/lib/utils"

/** Field/Type={text,number,select,quantity,entityRef}/State={default,error,readonly}；输入高 36。基于 shadcn/ui Label、Input、NativeSelect、Switch。 */
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
    <div
      data-slot="field"
      data-invalid={error ? true : undefined}
      className="flex flex-col gap-1.5"
    >
      <Label
        htmlFor={htmlFor}
        className="gap-1 text-label font-medium leading-5 text-ink-soft"
      >
        {label}
        {required ? (
          <span className="text-danger" aria-hidden>
            *
          </span>
        ) : null}
      </Label>
      {children}
      {error ? (
        <p
          role="alert"
          className="flex items-start gap-1 text-caption text-danger"
        >
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
  "h-9 w-full min-w-0 rounded-ui border bg-surface px-3 py-0 text-body text-ink shadow-none placeholder:text-faint outline-none transition-colors md:text-body focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15 read-only:bg-subtle read-only:text-ink-soft disabled:bg-subtle disabled:text-faint disabled:opacity-100 aria-invalid:ring-0"

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
  suffix?: ReactNode
  mono?: boolean
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  function TextInput({ invalid, suffix, mono, className, ...rest }, ref) {
    const input = (
      <Input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          INPUT,
          invalid ? "border-danger" : "border-border",
          mono && "font-mono text-label md:text-label",
          suffix ? "pr-12" : undefined,
          className,
        )}
        {...rest}
      />
    )
    if (!suffix) return input
    return (
      <div className="relative">
        {input}
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-label text-muted">
          {suffix}
        </span>
      </div>
    )
  },
)

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean
  options: Array<{ value: string ;label: string ;disabled?: boolean }>
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    { invalid, options, placeholder, className, size: _size, ...rest },
    ref,
  ) {
    return (
      <NativeSelect
        ref={ref}
        aria-invalid={invalid || undefined}
        wrapperClassName="w-full"
        className={cn(
          INPUT,
          "appearance-none pr-9",
          invalid ? "border-danger" : "border-border",
          className,
        )}
        {...rest}
      >
        {placeholder !== undefined ? (
          <NativeSelectOption value="" disabled>
            {placeholder}
          </NativeSelectOption>
        ) : null}
        {options.map((o) => (
          <NativeSelectOption
            key={o.value}
            value={o.value}
            disabled={o.disabled}
          >
            {o.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    )
  },
)

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
  return (
    <div className="flex h-9 items-center gap-2.5">
      <ShadSwitch
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        aria-label={label}
        className="h-5 w-9 data-[size=default]:h-5 data-[size=default]:w-9 data-[state=unchecked]:bg-[#c3cfdb] [&>span]:size-4 [&>span]:data-[state=checked]:translate-x-[17px] [&>span]:data-[state=unchecked]:translate-x-0.5"
      />
      <span className="font-mono text-label text-ink-soft">
        {String(checked)}
      </span>
    </div>
  )
}
