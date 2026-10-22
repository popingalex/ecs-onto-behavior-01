import { ArrowUpRight, GitFork } from "lucide-react"
import type { WorkbenchContext } from "@/app/useWorkbenchContext"
import Button from "@/components/ui/Button"
import { KeyValue, Notice, SectionLabel } from "@/components/ui/Card"
import { Tag } from "@/components/ui/StatusTag"
import Table, { Td, Th, Tr } from "@/components/ui/Table"
import { navigate } from "@/router/router"
import {
  buildFrameProcess,
  findNativeFrame,
} from "@/services/nativeImport/processView"
import { getNativeImport } from "@/services/nativeImport/seedAdapter"

/**
 * REAL_IMPORT_READ_ONLY 的 P24 内容:属性演化链 = 该分支上此 (实例,属性) 的
 * 逐帧变更序列,来源列只有 SYSTEM_EFFECT 级有值;无 inputVersionRefs → 明示不可完整追溯。
 * 来源系统可跳 P11 原生目录(REAL-10:结果→原 System 有据可查)。
 */
export default function NativeProvenance({ ctx }: { ctx: WorkbenchContext }) {
  const imported = getNativeImport()
  const { viewCommit, route } = ctx
  if (!viewCommit || !imported) return null
  const ref = findNativeFrame(imported.bundles, viewCommit.id)
  if (!ref) {
    return (
      <div className="mx-auto w-full max-w-[960px] px-6 py-6">
        <Notice tone="info">
          提交 <span className="font-mono">{viewCommit.id}</span>{" "}
          是场景基点或非帧提交:请从 P20/P26 选择一个原生帧提交查看演化链。
        </Notice>
      </div>
    )
  }
  const branch = ref.bundle.branches.find((b) => b.id === ref.branchId)!
  const process = buildFrameProcess(ref)

  // 该实例在本分支变更过的属性(按首变顺序)。
  const attrSeen: string[] = []
  for (const f of branch.frames)
    for (const d of f.deltas)
      if (d.instanceId === route.params.entityId && !attrSeen.includes(d.attribute))
        attrSeen.push(d.attribute)

  const entityId = route.params.entityId
  if (!entityId) {
    return (
      <div className="mx-auto w-full max-w-[960px] px-6 py-6">
        <Notice tone="info">请先在 P20 选中实体后再进入属性演化链。</Notice>
      </div>
    )
  }
  const propertyId = route.params.propertyId ?? attrSeen[0]
  const chain = propertyId ? process.chainOf(entityId, propertyId) : []

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-6 py-6">
      <section>
        <div className="flex items-center gap-2">
          <GitFork size={18} className="text-muted" aria-hidden />
          <h2 className="text-title font-semibold">属性演化链(原生 · 只读)</h2>
          <Tag size="sm" tone={process.traceCompleteness === "SYSTEM_EFFECT" ? "primary" : "warning"}>
            {process.traceCompleteness}
          </Tag>
        </div>
        <p className="mt-1 text-body text-muted">
          {ref.bundle.runId.slice(0, 8)} · {ref.branchId}:该属性在本分支逐帧变更的事实序列。
        </p>
      </section>

      <Notice tone="warning">
        原引擎不记录节点输入版本(inputVersionRefs):本链不可完整追溯到计算输入;
        来源列仅 {process.traceCompleteness === "SYSTEM_EFFECT"
          ? "SYSTEM_EFFECT 级(source_system_id,执行上下文归因)"
          : "PROPERTY_DELTA 级(磁盘工件无来源,显示未知)"}。
        缺失即明示,不回填最新值伪装历史。
      </Notice>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KeyValue label="实例"><span className="font-mono">{entityId}</span></KeyValue>
        <KeyValue label="属性"><span className="font-mono">{propertyId ?? "(无变更)"}</span></KeyValue>
        <KeyValue label="变更帧数">{String(chain.length)}</KeyValue>
        <KeyValue label="链头/链尾"><span className="font-mono">{`${chain[0]?.frame ?? "—"} → ${chain[chain.length - 1]?.frame ?? "—"}`}</span></KeyValue>
      </div>

      {attrSeen.length > 0 && (
        <section>
          <SectionLabel>该实例的变更属性({attrSeen.length})</SectionLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            {attrSeen.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() =>
                  navigate(
                    { pageId: "P24", params: { ...route.params, propertyId: a } },
                    { replace: true },
                  )
                }
                className={`rounded border px-2 py-1 font-mono text-label ${
                  a === propertyId
                    ? "border-primary bg-primary/10 font-medium"
                    : "border-border hover:bg-surface-hover"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </section>
      )}

      {propertyId && (
        <section>
          <SectionLabel>变更链({chain.length} 帧)</SectionLabel>
          <Table className="mt-2 min-w-[760px]">
            <thead>
              <tr>
                <Th className="w-[90px]">帧</Th>
                <Th>提交</Th>
                <Th className="w-[90px]">层</Th>
                <Th className="w-[220px]">来源系统</Th>
                <Th>帧值(RawValue)</Th>
              </tr>
            </thead>
            <tbody>
              {chain.map((step) => {
                const frame = branch.frames.find((f) => f.frame === step.frame)!
                const value = frame.values.get(entityId)?.get(propertyId)
                return (
                  <Tr key={step.commitId}>
                    <Td className="tabular">{step.frame}</Td>
                    <Td className="font-mono text-label">{step.commitId}</Td>
                    <Td>{step.layer}</Td>
                    <Td>
                      {step.sourceSystemId ? (
                        <Button
                          size="sm"
                          intent="ghost"
                          className="px-1"
                          onClick={() => navigate({ pageId: "P11", params: {} })}
                        >
                          <span className="font-mono">{step.sourceSystemId}</span>
                        </Button>
                      ) : (
                        <span className="text-caption text-muted">未知(工件无来源)</span>
                      )}
                    </Td>
                    <Td className="font-mono text-caption">
                      {!step.present
                        ? "(块/复杂值,不入值域)"
                        : value === null || value === undefined
                          ? "null"
                          : typeof value === "object"
                            ? JSON.stringify(value)
                            : String(value)}
                    </Td>
                  </Tr>
                )
              })}
            </tbody>
          </Table>
        </section>
      )}
    </div>
  )
}
