import { ListOrdered } from "lucide-react"
import type { WorkbenchContext } from "@/app/useWorkbenchContext"
import { Notice, SectionLabel } from "@/components/ui/Card"
import { Tag } from "@/components/ui/StatusTag"
import { navigate } from "@/router/router"
import { NATIVE_SYSTEM_CATALOG } from "@/services/nativeImport/catalog"

const PHASES = [
  "Input",
  "Structural",
  "Preprocess",
  "Simulation",
  "Coupling",
  "Decision",
  "Commit",
  "History",
  "Metrics",
] as const

/**
 * REAL_IMPORT_READ_ONLY 的 P12 内容:引擎真实执行计划的只读等效渲染
 * (system_registry 9 阶段 × 系统目录)。不可编辑/不可编译:引擎帧内写传播
 * 与工作台 order-only 调度语义不兼容(04 文档 §1),按 V7-4 闸门停在 S0 可见级。
 */
export default function NativeExecutionPlan(_ctx: { ctx: WorkbenchContext }) {
  const byPhase = new Map<string, typeof NATIVE_SYSTEM_CATALOG>()
  for (const s of NATIVE_SYSTEM_CATALOG) {
    const list = byPhase.get(s.phase) ?? []
    list.push(s)
    byPhase.set(s.phase, list)
  }
  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-6 py-6">
      <section>
        <div className="flex items-center gap-2">
          <ListOrdered size={18} className="text-muted" aria-hidden />
          <h2 className="text-title font-semibold">原生执行计划(等效 · 只读)</h2>
          <Tag size="sm" tone="purple">原生导入</Tag>
        </div>
        <p className="mt-1 text-body text-muted">
          mas-rust system_registry 的 9 阶段调度:阶段内按依赖图波次执行。
          这是引擎真实执行顺序的只读渲染,不是可编译的 ScheduleDocument。
        </p>
      </section>

      <Notice tone="warning">
        语义不兼容声明:引擎帧内后续系统可读前序写入(帧首 clear_trackers + 帧末提交),
        与工作台 order-only「全系统读 previous 视图」不同。因此本计划
        <b>不可编译、不可编辑</b>;图编译(V7-4 完整版)需逐系统声明 ReadMode 并经对拍闸门。
      </Notice>

      <div className="flex flex-col gap-2">
        {PHASES.map((phase, i) => {
          const systems = byPhase.get(phase) ?? []
          return (
            <div key={phase} className="flex items-stretch gap-3">
              <div className="flex w-28 shrink-0 flex-col justify-center rounded border border-border bg-surface px-2 py-1">
                <span className="text-caption text-muted">阶段 {i + 1}</span>
                <span className="text-label font-medium">{phase}</span>
              </div>
              <div className="flex flex-1 flex-wrap items-center gap-2 rounded border border-border px-3 py-2">
                {systems.length === 0 && (
                  <span className="text-caption text-muted">(本切片样例未观测到该阶段业务系统)</span>
                )}
                {systems.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => navigate({ pageId: "P11", params: {} })}
                    className="flex items-center gap-1.5 rounded border border-border px-2 py-1 text-label hover:bg-surface-hover"
                    title={`${s.reads.join(",")||"—"} → ${s.writes.join(",")||"—"}`}
                  >
                    <span className="font-medium">{s.label}</span>
                    <span className="font-mono text-caption text-muted">{s.id}</span>
                    <Tag
                      size="sm"
                      tone={s.sClass === "S1" ? "primary" : s.sClass === "S0" ? "neutral" : "purple"}
                    >
                      {s.sClass}
                    </Tag>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <SectionLabel>闸门说明</SectionLabel>
      <p className="text-caption text-muted">
        V7-4 完整版(图编译为原生 workflow 并对拍一致)的前置条件:①逐系统 ReadMode 声明;
        ②LogicGraphDocument ⇄ lc-* workflow JSON 双向编解码器;③同一 model/revision 输入下
        原生直接运行与工作台触发执行的结果对拍(J3 已建立对拍方法)。
      </p>
    </div>
  )
}
