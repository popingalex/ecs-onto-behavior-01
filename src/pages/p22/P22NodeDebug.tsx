import { useMemo } from "react"
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Crosshair,
  Layers,
  ListOrdered,
} from "lucide-react"
import type { WorkbenchContext } from "@/app/useWorkbenchContext"
import Button, { IconButton } from "@/components/ui/Button"
import { KeyValue, Notice, SectionLabel } from "@/components/ui/Card"
import { Tag } from "@/components/ui/StatusTag"
import TypedValueCell from "@/components/domain/TypedValueCell"
import { useIndex } from "@/data/store"
import { formatNumber, formatSigned } from "@/lib/format"
import { cn } from "@/lib/cn"
import { navigate } from "@/router/router"
import { isNativeMode } from "@/stores/dataSource"
import NativeFrameProcess from "./NativeFrameProcess"
import type { RoundResult } from "@/services/mock-executor"
import { useRecordByCommit } from "@/stores/trace"
import {
  accessLog,
  executionGroups,
  findExecution,
  layoutProgram,
  nodeLabel,
  nodeTrace,
  portUnit,
  programFor,
  traceabilityGaps,
} from "./traceView"

const ORIGIN_TAG = {
  computed: { tone: "success" as const, label: "当前图求值" },
  "reference-sample": { tone: "warning" as const, label: "参考样例 · 非当前图计算" },
}

/** P22 工作流批次与节点调试：recordId→system execution→entity→node 层级联动；轨迹步进是记录回看。 */
export default function P22NodeDebug({ ctx }: { ctx: WorkbenchContext }) {
  const index = useIndex()
  const { viewCommit, route } = ctx
  const record = useRecordByCommit(viewCommit?.id)

  const groups = useMemo(
    () => (record ? executionGroups(record) : []),
    [record],
  )
  const execution = record
    ? findExecution(record, route.params.systemId, route.params.entityId)
    : undefined
  const program = record ? programFor(record, execution) : undefined
  const trace = record ? nodeTrace(record, execution, route.params.nodeId) : undefined
  const layout = useMemo(
    () => (program ? layoutProgram(program) : new Map()),
    [program],
  )

  if (!viewCommit) return null
  // REAL_IMPORT_READ_ONLY:过程数据按引擎事实分级渲染(REAL-09),不走 mock record。
  if (isNativeMode()) return <NativeFrameProcess ctx={ctx} />
  if (!record) {
    return (
      <div className="mx-auto w-full max-w-[960px] px-6 py-6">
        <Notice
          tone="info"
          actions={
            <Button
              size="sm"
              onClick={() =>
                navigate({
                  pageId: "P20",
                  params: {
                    runId: route.params.runId ?? "run-main",
                    branchId: route.params.branchId ?? "main",
                    viewCommit: viewCommit.id,
                  },
                })
              }
            >
              去运行工作台
            </Button>
          }
        >
          提交 <span className="font-mono">{viewCommit.id}</span>{" "}
          没有关联的计算过程记录（基准提交或尚未结算的回合没有节点轨迹，不是
          0 值）。
        </Notice>
      </div>
    )
  }

  const select = (params: Record<string, string>) =>
    navigate(
      { pageId: "P22", params: { ...route.params, ...params } },
      { replace: true },
    )

  const traceSeqs = record.nodeExecutions.map((n) => n.seq)
  const totalSteps = traceSeqs.length
  const currentIdx = trace ? traceSeqs.indexOf(trace.seq) : -1
  const stepTo = (idx: number) => {
    const target = record.nodeExecutions[idx]
    if (target)
      select({
        systemId: target.systemId,
        entityId: target.entityId,
        nodeId: target.nodeId,
      })
  }

  const origin = ORIGIN_TAG[record.origin]
  const gaps = traceabilityGaps(record)
  const effectOfTrace = trace
    ? record.effectRequests.find(
        (e) => e.executionId === trace.executionId && e.nodeId === trace.nodeId,
      )
    : undefined
  const decisionOfTrace = effectOfTrace
    ? record.decisions.find((d) =>
        d.allocations.some((a) => a.effectId === effectOfTrace.id),
      )
    : undefined

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-body">
            <span className="font-semibold">节点过程</span>
            <span className="font-mono text-label">{record.record.id}</span>
            <Tag size="sm" tone={origin.tone}>
              {origin.label}
            </Tag>
            <Tag size="sm" tone="neutral">
              第二层 · system 内行为
            </Tag>
          </div>
        </div>
        <span className="hidden min-w-0 truncate text-label text-muted xl:inline">
          {record.record.baseCommit} → {record.record.resultCommit} ·{" "}
          {formatNumber(record.record.simTimeBefore)} s →{" "}
          {formatNumber(record.record.simTimeAfter)} s · 耗时未测量
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            intent="ghost"
            icon={Layers}
            onClick={() =>
              navigate({
                pageId: "P20",
                params: {
                  runId: record.record.runId,
                  branchId: record.record.branchId,
                  viewCommit: record.record.resultCommit,
                },
              })
            }
          >
            返回编排层
          </Button>
          <IconButton
            icon={ChevronLeft}
            label="上一条节点记录"
            size="sm"
            disabled={currentIdx <= 0}
            onClick={() => stepTo(currentIdx - 1)}
          />
          <span className="tabular text-label text-muted">
            记录回看 {currentIdx + 1}/{totalSteps} · 非断点续算
          </span>
          <IconButton
            icon={ChevronRight}
            label="下一条节点记录"
            size="sm"
            disabled={currentIdx < 0 || currentIdx >= totalSteps - 1}
            onClick={() => stepTo(currentIdx + 1)}
          />
          <Button
            size="sm"
            intent="ghost"
            icon={ListOrdered}
            onClick={() =>
              navigate({
                pageId: "P23",
                params: {
                  runId: route.params.runId ?? record.record.runId,
                  branchId: record.record.branchId,
                  viewCommit: record.record.resultCommit,
                },
              })
            }
          >
            联合裁决
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* 左：recordId → system execution → entity */}
        <div className="scroll-thin w-60 shrink-0 overflow-auto border-r border-line bg-surface">
          {groups.map((g) => (
            <div key={g.systemId} className="border-b border-line px-3 py-2">
              <SectionLabel className="px-1 py-1">
                {index.systems.get(g.systemId)?.label ?? g.systemId} ·{" "}
                <span className="font-mono">{g.systemId}</span>
              </SectionLabel>
              <ul className="mt-1 space-y-0.5">
                {g.executions.map((e) => {
                  const active = execution?.id === e.id
                  return (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() =>
                          select({ systemId: e.systemId, entityId: e.entityId })
                        }
                        className={cn(
                          "flex w-full items-center gap-2 rounded-ui px-2 py-1.5 text-left text-label",
                          active
                            ? "bg-primary-soft text-primary-strong"
                            : "text-ink hover:bg-hover",
                        )}
                      >
                        <span className="font-mono">{e.entityId}</span>
                        <span className="ml-auto tabular text-caption text-muted">
                          暂存预览{" "}
                          {e.localPreview === null
                            ? "—"
                            : `${formatNumber(e.localPreview)} °C`}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
          {record.diagnostics.length > 0 ? (
            <div className="px-3 py-2">
              <SectionLabel>执行诊断</SectionLabel>
              <ul className="mt-1 space-y-1">
                {record.diagnostics.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-start gap-1.5 text-caption text-warning-ink"
                  >
                    <CircleAlert size={12} className="mt-0.5 shrink-0" />
                    <span>
                      <span className="font-mono">{d.code}</span> {d.message}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {/* 中：只读节点图（记录里的固定图版本） */}
        <div className="scroll-thin min-w-0 flex-1 overflow-auto bg-bg">
          {program && execution ? (
            <div className="relative inline-block min-w-full">
              <div className="sticky left-0 top-0 z-10 flex items-center gap-2 bg-bg/90 px-4 py-2 text-caption text-muted backdrop-blur">
                <span className="font-mono">
                  {execution.programRef}
                </span>
                <span>只读 · 记录时的固定图版本（不随当前草稿变化）</span>
              </div>
              <svg className="pointer-events-none absolute inset-0" aria-hidden>
                {program.edges.map((e) => {
                  const a = layout.get(e.source.nodeId)
                  const b = layout.get(e.target.nodeId)
                  if (!a || !b) return null
                  return (
                    <line
                      key={e.id}
                      x1={a.x + a.w}
                      y1={a.y + 28}
                      x2={b.x}
                      y2={b.y + 28}
                      stroke="var(--color-border, #cbd5e1)"
                      strokeWidth={1.5}
                      strokeDasharray={e.kind === "control" ? "4 3" : undefined}
                    />
                  )
                })}
              </svg>
              {program.nodes.map((n) => {
                const pos = layout.get(n.id)!
                const t = record.nodeExecutions.find(
                  (x) => x.executionId === execution.id && x.nodeId === n.id,
                )
                const selected = trace?.nodeId === n.id
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() =>
                      select({
                        systemId: execution.systemId,
                        entityId: execution.entityId,
                        nodeId: n.id,
                      })
                    }
                    className={cn(
                      "absolute rounded-ui border bg-surface text-left shadow-card transition-colors",
                      selected
                        ? "border-primary ring-2 ring-primary-soft"
                        : "border-border hover:border-primary-line",
                    )}
                    style={{
                      left: pos.x,
                      top: pos.y,
                      width: pos.w,
                      minHeight: pos.h,
                    }}
                  >
                    <div className="flex items-center gap-1.5 border-b border-line px-2 py-1.5">
                      <span className="min-w-0 flex-1 truncate text-label font-medium text-ink">
                        {nodeLabel(n.id, program).label}
                      </span>
                      <span className="font-mono text-caption text-faint">
                        {n.id}
                      </span>
                      {t ? (
                        <span className="rounded bg-neutral-soft px-1 font-mono text-caption text-muted">
                          #{t.seq}
                        </span>
                      ) : null}
                    </div>
                    <div className="space-y-0.5 px-2 py-1.5">
                      {Object.keys(n.inputs).map((p) => (
                        <div
                          key={p}
                          className="flex items-center gap-1 text-caption text-muted"
                        >
                          <span className="size-1.5 rounded-full bg-primary-line" />
                          <span className="font-mono">{p}</span>
                          <span className="ml-auto tabular">
                            {t && p in t.inputs
                              ? formatNumber(Number(t.inputs[p]))
                              : "—"}
                          </span>
                        </div>
                      ))}
                      {Object.keys(n.outputs).map((p) => (
                        <div
                          key={p}
                          className="flex items-center gap-1 justify-end text-caption text-ink"
                        >
                          <span className="tabular">
                            {t && p in t.outputs
                              ? typeof t.outputs[p] === "number"
                                ? formatNumber(t.outputs[p] as number)
                                : String(t.outputs[p])
                              : "—"}
                          </span>
                          <span className="font-mono text-muted">{p}</span>
                          <span className="size-1.5 rounded-full bg-primary" />
                        </div>
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="p-6 text-body text-muted">
              该执行没有可展示的程序快照。
            </div>
          )}
        </div>

        {/* 右：节点轨迹详情 + 访问日志 */}
        <div className="scroll-thin w-80 shrink-0 overflow-auto border-l border-line bg-surface">
          {trace && execution ? (
            <div>
              <div className="border-b border-line px-4 py-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-body-lg font-semibold">
                    {program ? nodeLabel(trace.nodeId, program).label : trace.nodeId}
                  </h2>
                  <span className="rounded bg-neutral-soft px-1.5 font-mono text-caption text-muted">
                    seq {trace.seq}
                  </span>
                </div>
                <p className="mt-1 font-mono text-caption text-muted">
                  {trace.systemId} × {trace.entityId} · {trace.graphRef}
                </p>
              </div>

              <div className="border-b border-line px-4 py-3">
                <SectionLabel>端口值（记录）</SectionLabel>
                <dl className="mt-1">
                  {Object.entries(trace.inputs).map(([port, value]) => {
                    const u = portUnit(program, trace, "input", port)
                    return (
                      <KeyValue
                        key={port}
                        label={
                          <>
                            入 {port}
                            {u.source === "heuristic" ? (
                              <span
                                className="ml-1 text-faint"
                                title="端口不在记录的图快照中，单位为启发式回落"
                              >
                                ≈
                              </span>
                            ) : null}
                          </>
                        }
                      >
                        <TypedValueCell
                          align="left"
                          value={
                            typeof value === "number"
                              ? { state: "value", value }
                              : value === null
                                ? { state: "null" }
                                : { state: "value", value: String(value) }
                          }
                          unit={
                            u.unitId ? (index.units.get(u.unitId) ?? null) : null
                          }
                        />
                      </KeyValue>
                    )
                  })}
                  {Object.entries(trace.outputs).map(([port, value]) => {
                    const u = portUnit(program, trace, "output", port)
                    return (
                      <KeyValue
                        key={port}
                        label={
                          <>
                            出 {port}
                            {u.source === "heuristic" ? (
                              <span
                                className="ml-1 text-faint"
                                title="端口不在记录的图快照中，单位为启发式回落"
                              >
                                ≈
                              </span>
                            ) : null}
                          </>
                        }
                      >
                        <TypedValueCell
                          align="left"
                          value={
                            typeof value === "number"
                              ? { state: "value", value }
                              : { state: "value", value: String(value) }
                          }
                          unit={
                            u.unitId ? (index.units.get(u.unitId) ?? null) : null
                          }
                        />
                      </KeyValue>
                    )
                  })}
                </dl>
              </div>

              {effectOfTrace ? (
                <div className="border-b border-line px-4 py-3">
                  <SectionLabel>效果与裁决</SectionLabel>
                  <dl className="mt-1">
                    <KeyValue label="效果" mono>
                      {effectOfTrace.id}
                    </KeyValue>
                    <KeyValue label="请求">
                      <TypedValueCell
                        align="left"
                        value={{
                          state: "requested",
                          value: effectOfTrace.requestedDelta,
                        }}
                        unit={
                          effectOfTrace.unitId
                            ? (index.units.get(effectOfTrace.unitId) ?? null)
                            : null
                        }
                      />
                    </KeyValue>
                    <KeyValue label="暂存预览">
                      {effectOfTrace.selfPreview === null ? (
                        <TypedValueCell
                          align="left"
                          value={{ state: "unrecorded" }}
                        />
                      ) : (
                        <TypedValueCell
                          align="left"
                          value={{
                            state: "selfPreview",
                            value: effectOfTrace.selfPreview,
                          }}
                          unit={
                            effectOfTrace.previewUnitId
                              ? (index.units.get(effectOfTrace.previewUnitId) ??
                                null)
                              : null
                          }
                        />
                      )}
                    </KeyValue>
                    <KeyValue label="获准">
                      {decisionOfTrace ? (
                        <span className="tabular">
                          {formatSigned(
                            decisionOfTrace.allocations.find(
                              (a) => a.effectId === effectOfTrace.id,
                            )?.approvedDelta ?? 0,
                          )}{" "}
                          K · 比例 {formatNumber(decisionOfTrace.scale)}
                        </span>
                      ) : (
                        <TypedValueCell
                          align="left"
                          value={{ state: "pending" }}
                        />
                      )}
                    </KeyValue>
                    {decisionOfTrace ? (
                      <KeyValue label="最终">
                        <TypedValueCell
                          align="left"
                          value={{
                            state: "value",
                            value: decisionOfTrace.final,
                            commitId: record.record.resultCommit,
                          }}
                          unit={
                            decisionOfTrace.valueUnitId
                              ? (index.units.get(decisionOfTrace.valueUnitId) ??
                                null)
                              : null
                          }
                        />
                      </KeyValue>
                    ) : null}
                  </dl>
                </div>
              ) : null}

              <div className="px-4 py-3">
                <SectionLabel>访问日志</SectionLabel>
                {gaps.length > 0 ? (
                  <div className="mt-1 rounded-ui border border-warning-line bg-warning-soft px-2 py-1.5">
                    <p className="text-caption text-warning-ink">
                      该记录有 {gaps.length}{" "}
                      个节点缺失输入版本引用，不可完整追溯（未编造依赖边）：
                    </p>
                    <ul className="mt-0.5 space-y-0.5">
                      {gaps.map((g) => (
                        <li
                          key={`${g.executionId}:${g.nodeId}`}
                          className="font-mono text-caption text-warning-ink"
                        >
                          {g.executionId} · {g.nodeId}
                          {g.propertyId ? `（读 ${g.propertyId}）` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <ul className="mt-1 space-y-1">
                  {accessLog(record, execution.id).map((e, i) => (
                    <li key={i} className="font-mono text-caption text-muted">
                      <Tag size="sm" tone="neutral" className="mr-1">
                        {e.kind === "used"
                          ? "读取"
                          : e.kind === "proposed"
                            ? "提议"
                            : "生成"}
                      </Tag>
                      {e.source} → {e.target}
                    </li>
                  ))}
                  {trace.inputVersionRefs.map((r) => (
                    <li key={r} className="font-mono text-caption text-faint">
                      输入版本 {r}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="px-4 py-6 text-body text-muted">
              选择一个 System × 实体执行查看节点轨迹。
            </div>
          )}
        </div>
      </div>

      {/* 底：贡献矩阵（请求 × 获准 × 最终） */}
      <div className="max-h-44 shrink-0 overflow-auto border-t border-border bg-surface">
        <table className="w-full text-label">
          <thead className="sticky top-0 bg-surface">
            <tr className="border-b border-line text-left text-caption text-muted">
              <th className="px-4 py-2 font-medium">贡献矩阵</th>
              {groups.map((g) => (
                <th key={g.systemId} className="px-3 py-2 font-medium">
                  {g.systemId} 请求
                </th>
              ))}
              <th className="px-3 py-2 font-medium">额度</th>
              <th className="px-3 py-2 font-medium">比例</th>
              <th className="px-3 py-2 font-medium">获准合计</th>
              <th className="px-3 py-2 font-medium">最终</th>
            </tr>
          </thead>
          <tbody>
            {record.decisions.map((d) => (
              <tr key={d.id} className="border-b border-line last:border-0">
                <td className="px-4 py-1.5 font-mono">{d.entityId}</td>
                {groups.map((g) => {
                  const e = record.effectRequests.find(
                    (x) => x.entityId === d.entityId && x.systemId === g.systemId,
                  )
                  return (
                    <td key={g.systemId} className="px-3 py-1.5">
                      {e ? (
                        <button
                          type="button"
                          className="tabular hover:underline"
                          title={`定位 ${e.id} 的发出节点`}
                          onClick={() =>
                            select({
                              systemId: e.systemId,
                              entityId: e.entityId,
                              nodeId: e.nodeId,
                            })
                          }
                        >
                          {formatSigned(e.requestedDelta)} K
                        </button>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                  )
                })}
                <td className="px-3 py-1.5 tabular">{formatNumber(d.budget)} K</td>
                <td className="px-3 py-1.5 tabular">{formatNumber(d.scale)}</td>
                <td className="px-3 py-1.5 tabular">
                  {formatSigned(
                    d.allocations.reduce((s, a) => s + a.approvedDelta, 0),
                  )}{" "}
                  K
                </td>
                <td className="px-3 py-1.5 tabular font-medium">
                  {formatNumber(d.final)} °C
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
