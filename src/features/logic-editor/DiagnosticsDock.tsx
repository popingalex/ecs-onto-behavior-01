import { CircleAlert, CircleCheck, Crosshair, TriangleAlert } from "lucide-react"
import Button from "@/components/ui/Button"
import { Tag } from "@/components/ui/StatusTag"
import type { DomainDiagnostic } from "@/schema/model"
import { useLogicEditor } from "./editorContext"

/** 底部诊断：validateProgram 的实时结果，定位到节点 / 端口。 */
export default function DiagnosticsDock({
  diagnostics,
}: {
  diagnostics: DomainDiagnostic[]
}) {
  const api = useLogicEditor()
  const errors = diagnostics.filter((d) => d.severity === "error").length
  const warnings = diagnostics.length - errors
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-line px-3">
        <span className="text-label font-semibold text-ink">程序诊断</span>
        <span className="text-caption text-muted">实时 · validateProgram</span>
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
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-auto">
        {diagnostics.length === 0 ? (
          <div className="flex items-center gap-2 px-4 py-3 text-body text-muted">
            <CircleCheck size={15} className="text-success" aria-hidden />
            程序没有诊断。
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {diagnostics.map((d) => {
              const Icon = d.severity === "error" ? CircleAlert : TriangleAlert
              const where = [d.target?.nodeId, d.target?.portId]
                .filter(Boolean)
                .join(".")
              return (
                <li key={d.id} className="flex items-start gap-2.5 px-4 py-2">
                  <Icon
                    size={14}
                    aria-hidden
                    className={
                      d.severity === "error"
                        ? "mt-0.5 shrink-0 text-danger"
                        : "mt-0.5 shrink-0 text-warning"
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-label text-ink">{d.message}</p>
                    <p className="mt-0.5 flex gap-x-3 text-caption text-muted">
                      <span className="font-mono">{d.code}</span>
                      {where ? (
                        <span className="font-mono">{where}</span>
                      ) : null}
                    </p>
                  </div>
                  {d.target?.nodeId ? (
                    <Button
                      size="sm"
                      intent="ghost"
                      icon={Crosshair}
                      onClick={() => api.focusNode(d.target!.nodeId!)}
                    >
                      定位
                    </Button>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
