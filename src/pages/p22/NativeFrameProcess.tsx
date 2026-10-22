import { CircleAlert, Layers, ListOrdered } from "lucide-react"
import type { WorkbenchContext } from "@/app/useWorkbenchContext"
import { KeyValue, Notice, SectionLabel } from "@/components/ui/Card"
import { Tag } from "@/components/ui/StatusTag"
import Table, { Td, Th, Tr } from "@/components/ui/Table"
import { navigate } from "@/router/router"
import {
  buildFrameProcess,
  findNativeFrame,
} from "@/services/nativeImport/processView"
import { getNativeImport } from "@/services/nativeImport/seedAdapter"
import { NATIVE_SYSTEM_CATALOG } from "@/services/nativeImport/catalog"

/**
 * REAL_IMPORT_READ_ONLY 的 P22 内容:按提交反查原生帧,展示事实可得的过程层级。
 * SYSTEM_EFFECT:delta 按 source_system_id 归并(PG ticks);PROPERTY_DELTA:仅属性变更(磁盘工件)。
 * 节点级输入版本在引擎中不存在——明示缺口,不伪造(REAL-09)。
 */
export default function NativeFrameProcess({ ctx }: { ctx: WorkbenchContext }) {
  const imported = getNativeImport()
  const { viewCommit, route } = ctx
  if (!viewCommit || !imported) return null
  const ref = findNativeFrame(imported.bundles, viewCommit.id)
  if (!ref) {
    return (
      <div className="mx-auto w-full max-w-[960px] px-6 py-6">
        <Notice tone="info">
          提交 <span className="font-mono">{viewCommit.id}</span>{" "}
          是场景基点或非帧提交:真实导入只有逐帧过程数据,基点提交没有过程记录。
        </Notice>
      </div>
    )
  }
  const process = buildFrameProcess(ref)
  const selectedSystem = route.params.systemId
  const selected = process.systemGroups.find((g) => g.systemId === selectedSystem)
  const deltas = selected
    ? process.propertyDeltas.filter((d) => d.sourceSystemId === selected.systemId)
    : process.propertyDeltas
  const catalog = new Map(NATIVE_SYSTEM_CATALOG.map((s) => [s.id, s]))
  const completenessTone =
    process.traceCompleteness === "SYSTEM_EFFECT" ? "primary" : "warning"

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
        <span className="font-semibold">原生帧过程</span>
        <span className="font-mono text-label">
          {process.runId.slice(0, 8)} · {process.branchId} · 帧 {process.frame}
        </span>
        <Tag size="sm" tone={completenessTone}>
          {process.traceCompleteness}
        </Tag>
        <Tag size="sm" tone="purple">原生导入 · 只读</Tag>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
        <Notice tone="warning">
          原引擎无节点级执行记录与输入版本引用:本页按引擎事实展示
          {process.traceCompleteness === "SYSTEM_EFFECT"
            ? "系统归因级(source_system_id)"
            : "属性变更级(磁盘工件无来源)"}{" "}
          过程;不可完整追溯到节点输入,不伪造 EffectRequest/inputVersionRefs。
        </Notice>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KeyValue label="运行"><span className="font-mono">{process.runId}</span></KeyValue>
          <KeyValue label="分支"><span className="font-mono">{process.branchLabel}</span></KeyValue>
          <KeyValue label="executionId"><span className="font-mono">{process.executionId ?? "(未随样例导出)"}</span></KeyValue>
          <KeyValue label="帧指标">
            {`delta ${process.propertyDeltas.length} · 块 ${process.blocks.length}${
              process.meta?.performance ? ` · ${String(process.meta.performance.total ?? "?")}ms` : ""
            }`}
          </KeyValue>
        </div>

        {process.systemGroups.length > 0 && (
          <section className="mt-6">
            <SectionLabel>系统归因组({process.systemGroups.length})</SectionLabel>
            <div className="mt-2 flex flex-wrap gap-2">
              {process.systemGroups.map((g) => (
                <button
                  key={g.systemId}
                  type="button"
                  onClick={() =>
                    navigate(
                      { pageId: "P22", params: { ...route.params, systemId: g.systemId } },
                      { replace: true },
                    )
                  }
                  className={`rounded border px-2 py-1 text-label ${
                    selectedSystem === g.systemId
                      ? "border-primary bg-primary/10 font-medium"
                      : "border-border hover:bg-surface-hover"
                  }`}
                >
                  <span className="font-mono">{g.systemId}</span>
                  <span className="ml-2 text-muted tabular">{g.count} 条</span>
                  {catalog.get(g.systemId) && (
                    <span className="ml-1 text-caption text-muted">
                      {catalog.get(g.systemId)!.sClass}
                    </span>
                  )}
                </button>
              ))}
              {selectedSystem && (
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      { pageId: "P22", params: { ...route.params, systemId: "" } },
                      { replace: true },
                    )
                  }
                  className="rounded border border-border px-2 py-1 text-label hover:bg-surface-hover"
                >
                  全部
                </button>
              )}
            </div>
            <p className="mt-2 text-caption text-muted">
              归因=引擎执行上下文(ActiveSystemContext),非显式声明;已知存在归因粘连,原样保留。
            </p>
          </section>
        )}

        <section className="mt-6">
          <SectionLabel>
            帧内变更({deltas.length}{selected ? ` · ${selected.systemId}` : ""})
          </SectionLabel>
          <Table className="mt-2 min-w-[720px]">
            <thead>
              <tr>
                <Th className="w-[220px]">实例</Th>
                <Th>属性</Th>
                <Th className="w-[90px]">层</Th>
                <Th className="w-[160px]">来源系统</Th>
                <Th>帧值(RawValue)</Th>
              </tr>
            </thead>
            <tbody>
              {deltas.slice(0, 400).map((d, i) => (
                <Tr key={`${d.instanceId}:${d.attribute}:${i}`}>
                  <Td className="font-mono text-label">{d.instanceId}</Td>
                  <Td className="font-mono text-label">{d.attribute}</Td>
                  <Td>{d.layer}</Td>
                  <Td>
                    {d.sourceSystemId ? (
                      <span className="font-mono text-label">{d.sourceSystemId}</span>
                    ) : (
                      <span className="text-caption text-muted">未知(工件无来源)</span>
                    )}
                  </Td>
                  <Td className="font-mono text-caption">
                    {d.value === null || d.value === undefined
                      ? "(块/复杂值,不入值域)"
                      : typeof d.value === "object"
                        ? JSON.stringify(d.value)
                        : String(d.value)}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          {deltas.length > 400 && (
            <p className="mt-1 text-caption text-muted">仅列前 400 条,共 {deltas.length} 条。</p>
          )}
        </section>

        {process.blocks.length > 0 && (
          <section className="mt-6">
            <SectionLabel>
              块引用({process.blocks.length};网格/等值线,不展开)
            </SectionLabel>
            <div className="mt-2 flex flex-wrap gap-2">
              {process.blocks.map((b) => (
                <span
                  key={`${b.instanceId}:${b.attribute}`}
                  className="rounded border border-border px-2 py-0.5 font-mono text-caption text-muted"
                >
                  {b.instanceId} · {b.attribute}
                </span>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
