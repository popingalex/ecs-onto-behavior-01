import { ListOrdered } from "lucide-react"
import type { WorkbenchContext } from "@/app/useWorkbenchContext"
import { KeyValue, Notice, SectionLabel } from "@/components/ui/Card"
import { Tag } from "@/components/ui/StatusTag"
import { navigate } from "@/router/router"
import {
  mergeRuntimeCatalog,
  collectRuntimeObservations,
} from "@/services/nativeImport/catalog"
import { getNativeImport } from "@/services/nativeImport/seedAdapter"

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
export default function NativeExecutionPlan({ ctx }: { ctx: WorkbenchContext }) {
  const imported = getNativeImport()
  const catalog = imported
    ? mergeRuntimeCatalog(collectRuntimeObservations(imported.bundles))
    : mergeRuntimeCatalog([])
  const observed = catalog.filter((s) => s.source === "OBSERVED_RUNTIME")
  const byPhase = new Map<string, typeof catalog>()
  for (const s of catalog) {
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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KeyValue label="Plan Source"><span className="font-mono">Native Engine</span></KeyValue>
        <KeyValue label="Mode">Read-only(编辑/编译/发布已禁用)</KeyValue>
        <KeyValue label="Engine Build(目录转录)"><span className="font-mono">mas-rust@65c7f96</span></KeyValue>
        <KeyValue label="Read Visibility">Frame-propagated(帧内可见,≠order-only)</KeyValue>
        <KeyValue label="Stages / Systems"><span className="tabular">{PHASES.length} / {catalog.length - observed.length} 注册 + {observed.length} 运行期发现</span></KeyValue>
        <KeyValue label="Last Run(导入)"><span className="font-mono">{imported?.bundles.map((b) => b.runId.slice(0, 8)).join("、") ?? "—"}</span></KeyValue>
        <KeyValue label="可用 trace 层级">SYSTEM_EFFECT / PROPERTY_DELTA(无节点输入版本)</KeyValue>
        <KeyValue label="编辑入口状态">已禁用(语义不兼容)</KeyValue>
      </div>

      <Notice tone="warning">
        语义不兼容声明:引擎帧内后续系统可读前序写入(帧首 clear_trackers + 帧末提交),
        与工作台 order-only「全系统读 previous 视图」不同。因此本计划
        <b>不可编译、不可编辑、不可发布</b>;编辑/连边/编译/发布入口均未提供,不存在"可保存但无法执行"的假实现。
        图编译(V7-4 完整版)需逐系统声明 ReadMode 并经对拍闸门。
      </Notice>

      {observed.length > 0 && (
        <section>
          <SectionLabel>运行期发现的系统({observed.length};阶段 UNKNOWN,不推测)</SectionLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            {observed.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() =>
                  navigate({ pageId: "P11", params: { anchor: s.id } })
                }
                className="flex items-center gap-1.5 rounded border border-warning/60 bg-warning/10 px-2 py-1 text-label hover:bg-warning/20"
              >
                <span className="font-mono">{s.id}</span>
                <span className="text-caption text-muted">{s.observedCount ?? "?"} 条</span>
              </button>
            ))}
          </div>
        </section>
      )}

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
                    onClick={() =>
                      navigate({ pageId: "P11", params: { anchor: s.id } })
                    }
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
