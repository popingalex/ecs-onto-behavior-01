import { Database, ShieldAlert } from "lucide-react"
import { CURRENT_MODE } from "@/stores/dataSource"
import { getNativeImport } from "@/services/nativeImport/seedAdapter"
import { NATIVE_CAPABILITY } from "@/services/nativeImport/catalog"

/**
 * REAL_IMPORT_READ_ONLY 全局提示条（V7-1）。
 * 常驻于 TopBar 之下：当前数据源、来源 revision、可用/不可用能力与追溯完整度，
 * 防止把只读导入误当可执行/可编辑上下文（REAL-07/09 的 UI 侧防线）。
 */
export default function NativeModeStrip() {
  if (CURRENT_MODE !== "REAL_IMPORT_READ_ONLY") return null
  const imported = getNativeImport()
  const runs = imported
    ? imported.bundles.map((b) => {
        const frames = b.branches.reduce((n, br) => n + br.frames.length, 0)
        return `${b.runId.slice(0, 8)}(${b.branches.map((br) => br.id).join("+")}，${frames} 帧，${b.traceCompleteness})`
      })
    : []
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-warning/40 bg-warning/10 px-3 py-1 text-caption text-ink">
      <span className="flex items-center gap-1.5 font-medium">
        <Database size={12} aria-hidden />
        真实只读导入 · mas-rust@{NATIVE_CAPABILITY.sourceRevision}
      </span>
      {imported && (
        <span className="truncate">
          场景 chem-roaded {imported.model.scene.entities.length} 实例 · 运行{" "}
          {runs.join("；")}
          {imported.model.scene.undeclaredAttributes.length > 0 &&
            ` · 未声明属性 ${imported.model.scene.undeclaredAttributes.length} 类`}
        </span>
      )}
      <span className="ml-auto flex shrink-0 items-center gap-1.5 text-ink-soft">
        <ShieldAlert size={12} aria-hidden />
        不可执行 / 不可编辑 / 无请求→获准与节点输入版本记录（引擎未提供，不伪造）
      </span>
    </div>
  )
}
