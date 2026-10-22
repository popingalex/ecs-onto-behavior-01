import { useMemo } from "react"
import { ArrowUpRight, History, ListFilter } from "lucide-react"
import type { WorkbenchContext } from "@/app/useWorkbenchContext"
import Button from "@/components/ui/Button"
import Card, { KeyValue, Notice, PanelHeader, SectionLabel } from "@/components/ui/Card"
import { Tag } from "@/components/ui/StatusTag"
import { useIndex } from "@/data/store"
import { formatSimTime } from "@/lib/format"
import { navigate, useViewState } from "@/router/router"
import { isNativeMode } from "@/stores/dataSource"
import { useCommits } from "@/stores/history"
import { useStore } from "@/lib/store"
import { traceStore } from "@/stores/trace"
import {
  CHAIN_KIND_LABEL,
  collectEvents,
  type ChainEvent,
  type ChainEventKind,
} from "./events"

const ORIGIN_TAG = {
  computed: { tone: "success" as const, label: "事实 · 当前图求值" },
  "reference-sample": {
    tone: "warning" as const,
    label: "参考样例 · 非当前图计算",
  },
  base: { tone: "neutral" as const, label: "基础世界" },
}

const KINDS: ChainEventKind[] = ["commit", "settle", "decision"]

/**
 * P25 业务事件链：结算 / 裁决 / 提交事件来自 trace 记录与提交目录（真实数据）；
 * 预测、派遣、到达、交接在 v0.5 没有事件来源，以空态说明。
 */
export default function P25EventChain({ ctx: _ctx }: { ctx: WorkbenchContext }) {
  const index = useIndex()
  const commits = useCommits()
  const recordOrder = useStore(traceStore, (s) => s.order)
  const recordMap = useStore(traceStore, (s) => s.records)
  const records = useMemo(
    () =>
      recordOrder
        .map((id) => recordMap[id])
        .filter((r): r is NonNullable<typeof r> => Boolean(r)),
    [recordOrder, recordMap],
  )
  const [branchFilter, setBranchFilter] = useViewState<string>("branch", "")
  const [hiddenKinds, setHiddenKinds] = useViewState<ChainEventKind[]>(
    "kinds",
    [],
  )
  const [selectedId, setSelectedId] = useViewState<string | null>(
    "event",
    null,
  )

  const events = useMemo(
    () => collectEvents(commits, records),
    [commits, records],
  )
  // REAL_IMPORT_READ_ONLY:真实导入只含逐帧属性变更,无带 ID/因果字段的业务事件;
  // 时间先后不自动连成因果(REAL-09:不伪造事件链)。
  if (isNativeMode()) {
    return (
      <div className="mx-auto w-full max-w-[960px] px-6 py-6">
        <Notice tone="warning">
          真实导入样例未包含带 ID / 因果字段的业务事件记录:引擎侧事件
          (CommandLog / 事件流)未随离线工件导出,本页在 REAL_IMPORT_READ_ONLY
          模式下无可展示事实。帧序(时间先后)不自动连成因果链。
        </Notice>
      </div>
    )
  }
  const branchIds = [...new Set(events.map((e) => e.branchId))]
  const visible = events.filter(
    (e) =>
      (!branchFilter || e.branchId === branchFilter) &&
      !hiddenKinds.includes(e.kind),
  )
  const selected = visible.find((e) => e.id === selectedId) ?? null

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-6 py-6">
      <section>
        <div className="flex items-center gap-2">
          <History size={18} className="text-muted" aria-hidden />
          <h2 className="text-title font-semibold">业务事件链</h2>
        </div>
        <p className="mt-1 max-w-[860px] text-body text-muted">
          事件按模拟时刻排序展示；时间先后不等于因果，筛选只隐藏节点、不改变记录。
          事实与参考样例分开标记。
        </p>
      </section>

      <Card>
        <PanelHeader
          title="筛选"
          meta={
            <span>
              分支 {branchFilter || "全部"} · 显示 {visible.length} /{" "}
              {events.length} 条
            </span>
          }
        />
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <ListFilter size={14} className="text-muted" aria-hidden />
          <Button
            size="sm"
            intent={branchFilter === "" ? "primary" : "secondary"}
            onClick={() => setBranchFilter("")}
          >
            全部分支
          </Button>
          {branchIds.map((id) => (
            <Button
              key={id}
              size="sm"
              intent={branchFilter === id ? "primary" : "secondary"}
              onClick={() => setBranchFilter(id)}
            >
              <span className="font-mono">{id}</span>
            </Button>
          ))}
          <span className="mx-2 h-5 w-px bg-border" aria-hidden />
          {KINDS.map((k) => {
            const hidden = hiddenKinds.includes(k)
            return (
              <Button
                key={k}
                size="sm"
                intent={hidden ? "ghost" : "secondary"}
                aria-pressed={!hidden}
                onClick={() =>
                  setHiddenKinds(
                    hidden
                      ? hiddenKinds.filter((x) => x !== k)
                      : [...hiddenKinds, k],
                  )
                }
              >
                {CHAIN_KIND_LABEL[k]}
              </Button>
            )
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <PanelHeader
            title="事件时间线"
            meta={<span>按 simTime 升序 · 同刻按写入序号</span>}
          />
          {visible.length === 0 ? (
            <p className="px-4 py-6 text-label text-muted">
              没有匹配的事件。结算回合后，这里会出现真实的事实事件。
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {visible.map((e) => {
                const origin = ORIGIN_TAG[e.origin]
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(e.id)}
                      className={`flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-subtle ${
                        selectedId === e.id ? "bg-primary-soft/60" : ""
                      }`}
                    >
                      <span className="w-16 shrink-0 tabular text-label text-muted">
                        {formatSimTime(e.simTime)}
                      </span>
                      <Tag size="sm" tone="primary">
                        {CHAIN_KIND_LABEL[e.kind]}
                      </Tag>
                      <Tag size="sm" tone={origin.tone}>
                        {origin.label}
                      </Tag>
                      <span className="min-w-0 flex-1">
                        <span className="block text-body">{e.title}</span>
                        <span className="block truncate text-caption text-muted">
                          {e.detail}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-caption text-muted">
                        {e.branchId}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          {selected ? (
            <EventDetail event={selected} />
          ) : (
            <Card>
              <p className="px-4 py-6 text-label text-muted">
                选择左侧事件查看载荷与关联。
              </p>
            </Card>
          )}

          <Card>
            <PanelHeader title="预测与任务事件" />
            <div className="flex flex-col gap-2 px-4 py-3 text-label text-muted">
              <p>
                预测（如“420 秒将触及水量阈值”）、派遣、到达、交接事件在 v0.5
                模型中没有记录来源——执行器不产生这类事件，本页不补造。
              </p>
              <p>
                旧样例事件{" "}
                <span className="font-mono">{[...index.events.keys()].join("、") || "（无）"}</span>
                {" "}保留在资产索引中，不属于任何回合记录，不参与上面的时间线。
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function EventDetail({ event }: { event: ChainEvent }) {
  const origin = ORIGIN_TAG[event.origin]
  return (
    <Card>
      <PanelHeader
        title="事件载荷"
        meta={<Tag size="sm" tone={origin.tone}>{origin.label}</Tag>}
      />
      <dl className="px-4 py-3">
        <KeyValue label="事件" mono>
          {event.id}
        </KeyValue>
        <KeyValue label="时刻" mono>
          {formatSimTime(event.simTime)}
        </KeyValue>
        <KeyValue label="分支 / 提交" mono>
          {event.branchId} · {event.commitId}
        </KeyValue>
        <KeyValue label="说明">{event.detail}</KeyValue>
        <KeyValue label="关联记录" mono>
          {event.recordId ?? "关联未记录"}
        </KeyValue>
      </dl>
      <div className="flex flex-wrap gap-2 border-t border-line px-4 py-3">
        {event.decisionId ? (
          <Button
            size="sm"
            intent="ghost"
            icon={ArrowUpRight}
            onClick={() =>
              navigate({
                pageId: "P23",
                params: {
                  branchId: event.branchId,
                  viewCommit: event.commitId,
                  ...(event.decisionId ? { decisionId: event.decisionId } : {}),
                },
              })
            }
          >
            裁决明细（P23）
          </Button>
        ) : null}
        <Button
          size="sm"
          intent="ghost"
          icon={ArrowUpRight}
          onClick={() =>
            navigate({
              pageId: "P26",
              params: { branchId: event.branchId, viewCommit: event.commitId },
            })
          }
        >
          提交历史（P26）
        </Button>
      </div>
    </Card>
  )
}
