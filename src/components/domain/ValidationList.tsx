import {
  CircleAlert,
  CircleCheck,
  Crosshair,
  Info,
  RefreshCw,
  TriangleAlert,
} from "lucide-react"
import type { Diagnostic } from "@/core/types"
import Button from "@/components/ui/Button"
import Card, { PanelHeader } from "@/components/ui/Card"
import { Tag } from "@/components/ui/StatusTag"
import { cn } from "@/lib/cn"
import { navigate } from "@/router/router"

const SEVERITY = {
  error: { icon: CircleAlert, label: "错误", className: "text-danger" },
  warning: { icon: TriangleAlert, label: "警告", className: "text-warning" },
  info: { icon: Info, label: "提示", className: "text-primary" },
} as const

/** C10 ValidationList：跨对象诊断，可跳转定位；校验修订落后于当前修订时标记过期。 */
export default function ValidationList({
  diagnostics,
  validationRevision,
  currentRevision,
  validating,
  onRevalidate,
  className,
}: {
  diagnostics: Diagnostic[]
  validationRevision: number | null
  currentRevision: number
  validating?: boolean
  onRevalidate?: () => void
  className?: string
}) {
  const stale =
    validationRevision !== null && validationRevision !== currentRevision
  const errors = diagnostics.filter((d) => d.severity === "error").length
  const warnings = diagnostics.filter((d) => d.severity === "warning").length
  return (
    <Card className={className}>
      <PanelHeader
        title="校验诊断"
        meta={
          validationRevision === null ? (
            <span>尚未校验</span>
          ) : (
            <>
              <span className="font-mono">r{validationRevision}</span>
              {errors > 0 ? (
                <Tag tone="danger" size="sm" icon={CircleAlert}>
                  {errors} 错误
                </Tag>
              ) : null}
              {warnings > 0 ? (
                <Tag tone="warning" size="sm" icon={TriangleAlert}>
                  {warnings} 警告
                </Tag>
              ) : null}
            </>
          )
        }
        actions={
          onRevalidate ? (
            <Button
              size="sm"
              icon={RefreshCw}
              onClick={onRevalidate}
              busy={validating}
            >
              重新校验
            </Button>
          ) : null
        }
      />
      {stale ? (
        <div className="flex items-center gap-2 border-b border-warning-line bg-warning-soft px-4 py-2 text-label text-warning-ink">
          <TriangleAlert size={14} aria-hidden />
          结果基于 r{validationRevision}，当前草稿为 r{currentRevision}
          ，校验已过期。
        </div>
      ) : null}
      {diagnostics.length === 0 ? (
        <div className="flex items-center gap-2 px-4 py-4 text-body text-muted">
          {validationRevision === null ? (
            "保存后运行校验以查看跨对象诊断。"
          ) : (
            <>
              <CircleCheck size={16} className="text-success" aria-hidden />r
              {validationRevision} 没有诊断。
            </>
          )}
        </div>
      ) : (
        <ul className={cn("divide-y divide-line", stale && "opacity-70")}>
          {diagnostics.map((d) => {
            const sev = SEVERITY[d.severity]
            const Icon = sev.icon
            return (
              <li key={d.id} className="flex items-start gap-3 px-4 py-3">
                <Icon
                  size={16}
                  className={cn("mt-0.5 shrink-0", sev.className)}
                  aria-label={sev.label}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-body text-ink">{d.message}</p>
                  <p className="mt-0.5 flex flex-wrap gap-x-3 text-caption text-muted">
                    <span className="font-mono">{d.code}</span>
                    {d.objectLabel ? (
                      <span className="font-mono">{d.objectLabel}</span>
                    ) : null}
                  </p>
                </div>
                {d.target ? (
                  <Button
                    size="sm"
                    intent="ghost"
                    icon={Crosshair}
                    onClick={() => navigate(d.target!)}
                  >
                    定位
                  </Button>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
