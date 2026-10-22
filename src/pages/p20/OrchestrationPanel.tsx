import { useMemo } from "react"
import { ChevronDown, ChevronUp, Layers } from "lucide-react"
import { Notice, SectionLabel } from "@/components/ui/Card"
import { Tag } from "@/components/ui/StatusTag"
import { formatNumber, formatSigned } from "@/lib/format"
import { cn } from "@/lib/cn"
import { navigate, useViewState } from "@/router/router"
import type { RoundResult } from "@/services/mock-executor"
import { compileSchedule, type ScheduleModelView } from "@/services/scheduleCompiler"
import { useDraftModel } from "@/stores/modelDocuments"
import {
  orchestrateRound,
  orchestrationEntityRows,
  type OrchestrationSystem,
} from "./orchestration"

/**
 * P20 编排层（第一层 · system 编排）：有记录时按 record 批次渲染并行组与 system 合计；
 * 无记录时显示 compileSchedule 的计划预览并标注“尚未执行”。节点级细节下钻 P22。
 *
 * 地图主角布局（ADR-v06-06）：不固定遮挡地图，默认折叠为地图上方的一行摘要 chip，
 * 点击展开为悬浮卡片；定位与 pointer-events 由父级（P20 地图悬浮层）管理。
 */
export default function OrchestrationPanel({
  record,
  exec,
}: {
  record: RoundResult | undefined
  exec: { runId: string ;branchId: string ;viewCommit: string }
}) {
  const model = useDraftModel()
  const [open, setOpen] = useViewState<boolean>("p20.orch.open", false)
  const [selectedSystem, setSelectedSystem] = useViewState<string>(
    "p20.orch.system",
    "",
  )
  const orchestration = useMemo(
    () => (record ? orchestrateRound(record) : null),
    [record],
  )
  const plan = useMemo(() => {
    if (record) return null
    const schedule = model.schedules[0]
    if (!schedule) return null
    const view: ScheduleModelView = {
      systems: model.systems,
      constraints: model.constraints,
      attributes: model.attributes,
      baseCommit: model.baseWorld.commitId,
    }
    return { schedule, plan: compileSchedule(schedule, view) }
  }, [record, model])

  const summary = useMemo(() => {
    if (orchestration) {
      const systems = orchestration.batches.flatMap((b) =>
        b.kind === "systems" ? b.systems : [],
      )
      const approved = systems.reduce((sum, s) => sum + s.approvedTotal, 0)
      return `${orchestration.batches.length} 批次 · ${systems.length} system · 获准 ${formatSigned(approved)}`
    }
    if (plan) return `计划预览 · ${plan.plan.groups.length} 批次（未执行）`
    return "无调度可预览"
  }, [orchestration, plan])

  const header = (
    <button
      type="button"
      aria-expanded={open}
      onClick={() => setOpen((v) => !v)}
      className={cn(
        "pointer-events-auto flex items-center gap-2 border border-border bg-surface/95 px-3 text-left shadow-pop",
        open
          ? "h-9 w-full shrink-0 rounded-t-ui border-b border-b-line"
          : "h-8 rounded-ui hover:bg-hover",
      )}
    >
      <Layers size={14} className="shrink-0 text-muted" aria-hidden />
      <span className="shrink-0 text-label font-semibold">编排层</span>
      <Tag size="sm" tone="primary">
        第一层 · System 编排
      </Tag>
      <span className="truncate text-caption text-muted">{summary}</span>
      {open ? (
        <ChevronDown size={14} className="ml-auto shrink-0 text-muted" aria-hidden />
      ) : (
        <ChevronUp size={14} className="shrink-0 text-muted" aria-hidden />
      )}
    </button>
  )

  if (!open) return header

  return (
    <section
      aria-label="编排层"
      className="pointer-events-auto flex max-h-[60vh] w-[min(760px,100%)] flex-col rounded-ui border border-border bg-surface shadow-pop"
    >
      {header}
      <div className="flex h-8 shrink-0 items-center border-b border-line px-4 text-caption text-muted">
        并行分组 · 读 previous（{orchestration?.baseCommit ?? "旧值"}）·
        写裁决；节点级行为下钻 P22
      </div>
      <div
        key={orchestration?.recordId ?? "plan"}
        className="scroll-thin min-h-0 flex-1 overflow-auto px-4 py-3"
      >
        {orchestration && record ? (
          <RecordView
            record={record}
            orchestration={orchestration}
            exec={exec}
            selectedSystem={selectedSystem}
            onSelectSystem={setSelectedSystem}
          />
        ) : plan ? (
          <PlanPreview
            scheduleId={plan.schedule.id}
            groups={plan.plan.groups}
            executable={plan.plan.executable}
            diagnostics={plan.plan.diagnostics.length}
          />
        ) : (
          <Notice tone="info">当前模型没有调度，无法预览编排计划。</Notice>
        )}
      </div>
    </section>
  )
}

function RecordView({
  record,
  orchestration,
  exec,
  selectedSystem,
  onSelectSystem,
}: {
  record: RoundResult
  orchestration: ReturnType<typeof orchestrateRound>
  exec: { runId: string ;branchId: string ;viewCommit: string }
  selectedSystem: string
  onSelectSystem: (systemId: string) => void
}) {
  const selected = orchestration.batches
    .flatMap((b) => b.systems)
    .find((s) => s.systemId === selectedSystem)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        {orchestration.batches.map((batch) => (
          <div key={batch.index} className="min-w-0">
            <SectionLabel className="py-1">
              批次 {batch.index}
              {batch.kind === "stage" ? " · 归约 / 提交" : " · 并行组"}
            </SectionLabel>
            {batch.kind === "stage" ? (
              <div className="flex gap-1.5">
                {batch.stage.map((name) => (
                  <Tag key={name} size="sm" tone="neutral">
                    <span className="font-mono">{name}</span>
                  </Tag>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {batch.systems.map((s) => (
                  <SystemCard
                    key={s.systemId}
                    system={s}
                    baseCommit={orchestration.baseCommit}
                    selected={selectedSystem === s.systemId}
                    onSelect={() =>
                      onSelectSystem(
                        selectedSystem === s.systemId ? "" : s.systemId,
                      )
                    }
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {selected ? (
        <EntityMatrix record={record} system={selected} exec={exec} />
      ) : (
        <p className="text-caption text-muted">
          点击 system 卡片展开「system × 实体」矩阵；点实体格下钻到 P22 节点级（第二层）。
        </p>
      )}
    </div>
  )
}

function SystemCard({
  system,
  baseCommit,
  selected,
  onSelect,
}: {
  system: OrchestrationSystem
  baseCommit: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "w-52 rounded-ui border bg-surface px-3 py-2 text-left shadow-card transition-colors",
        selected
          ? "border-primary ring-2 ring-primary-soft"
          : "border-border hover:border-primary-line",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-label font-semibold">
          {system.systemId}
        </span>
        <Tag size="sm" tone="neutral">
          读 previous
        </Tag>
      </div>
      <div className="mt-0.5 font-mono text-caption text-faint">
        previous = {baseCommit}
      </div>
      <dl className="mt-1.5 grid grid-cols-3 gap-1 text-caption">
        <div>
          <dt className="text-faint">实体</dt>
          <dd className="tabular font-medium">{system.entities.length}</dd>
        </div>
        <div>
          <dt className="text-faint">请求合计</dt>
          <dd className="tabular font-medium">
            {formatSigned(system.requestedTotal)}
          </dd>
        </div>
        <div>
          <dt className="text-faint">获准合计</dt>
          <dd className="tabular font-medium">
            {formatSigned(system.approvedTotal)}
          </dd>
        </div>
      </dl>
    </button>
  )
}

function EntityMatrix({
  record,
  system,
  exec,
}: {
  record: RoundResult
  system: OrchestrationSystem
  exec: { runId: string ;branchId: string ;viewCommit: string }
}) {
  const rows = useMemo(
    () => orchestrationEntityRows(record, system.systemId),
    [record, system.systemId],
  )
  return (
    <table className="w-full text-label">
      <thead>
        <tr className="border-b border-line text-left text-caption text-muted">
          <th className="py-1.5 pr-3 font-medium">
            {system.systemId} × 实体
          </th>
          <th className="px-3 py-1.5 text-right font-medium">暂存预览</th>
          <th className="px-3 py-1.5 text-right font-medium">请求</th>
          <th className="px-3 py-1.5 text-right font-medium">获准</th>
          <th className="py-1.5 pl-3 text-right font-medium">
            <span className="sr-only">下钻</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.entityId} className="border-b border-line last:border-0">
            <td className="py-1.5 pr-3 font-mono">{r.entityId}</td>
            <td className="px-3 py-1.5 text-right tabular">
              {r.localPreview === null ? "—" : `${formatNumber(r.localPreview)} °C`}
            </td>
            <td className="px-3 py-1.5 text-right tabular">
              {formatSigned(r.requested)} K
            </td>
            <td className="px-3 py-1.5 text-right tabular">
              {r.approved === null ? (
                <span className="text-faint">待裁决</span>
              ) : (
                `${formatSigned(r.approved)} K`
              )}
            </td>
            <td className="py-1.5 pl-3 text-right">
              <button
                type="button"
                className="text-primary-strong hover:underline"
                onClick={() =>
                  navigate({
                    pageId: "P22",
                    params: {
                      ...exec,
                      recordId: record.record.id,
                      systemId: system.systemId,
                      entityId: r.entityId,
                    },
                  })
                }
              >
                节点级（P22）→
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function PlanPreview({
  scheduleId,
  groups,
  executable,
  diagnostics,
}: {
  scheduleId: string
  groups: Array<{ index: number ;systems: Array<{ systemId: string ;label: string ;enabled: boolean ;after: string[] }> }>
  executable: boolean
  diagnostics: number
}) {
  return (
    <div className="flex flex-col gap-2">
      <Notice tone="info">
        提交尚无计算过程记录：以下为调度{" "}
        <span className="font-mono">{scheduleId}</span> 的计划预览，
        <span className="font-medium">尚未执行</span>；推算一回合后此处显示实际批次。
        {!executable ? ` 计划存在 ${diagnostics} 条诊断，见 P12 计划预览。` : ""}
      </Notice>
      <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
        {groups.map((g) => (
          <div key={g.index} className="min-w-0">
            <SectionLabel className="py-1">批次 {g.index} · 并行组</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {g.systems.map((s) => (
                <Tag
                  key={s.systemId}
                  size="sm"
                  tone={s.enabled ? "primary" : "neutral"}
                >
                  {s.systemId}
                  {s.after.length ? ` ← ${s.after.join("、")}` : ""}
                  {s.enabled ? "" : "（停用）"}
                </Tag>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
