import { ArrowUpRight, Ban, Lock } from "lucide-react"
import type { Route } from "@/core/types"
import { cn } from "@/lib/cn"
import { navigate } from "@/router/router"

/** C06 ObjectLink：统一通过路由解析打开对象。missing 时不跳到同名最新对象。 */
export default function ObjectLink({
  label,
  id,
  version,
  route,
  state = "valid",
  className,
}: {
  label?: string
  id: string
  version?: string
  route: Route
  state?: "valid" | "missing" | "forbidden" | "readonly"
  className?: string
}) {
  const disabled = state === "missing" || state === "forbidden"
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => navigate(route)}
      title={`${id}${version ? `@${version}` : ""}`}
      className={cn(
        "group inline-flex max-w-full items-center gap-1.5 rounded px-1 -mx-1 text-left transition-colors",
        disabled
          ? "cursor-not-allowed text-faint"
          : "text-primary-strong hover:bg-primary-soft",
        state === "missing" && "line-through decoration-danger",
        className,
      )}
    >
      {label ? <span className="truncate font-medium">{label}</span> : null}
      <span
        className={cn(
          "shrink-0 font-mono text-caption",
          label ? "text-muted" : "text-label",
        )}
      >
        {id}
        {version ? `@${version}` : ""}
      </span>
      {state === "forbidden" ? (
        <Ban size={12} aria-label="无权限" />
      ) : state === "readonly" ? (
        <Lock size={12} aria-label="只读" />
      ) : null}
      {!disabled ? (
        <ArrowUpRight
          size={13}
          className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden
        />
      ) : null}
    </button>
  )
}
