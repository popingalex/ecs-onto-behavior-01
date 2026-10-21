import { ArrowDown, ArrowUpRight, GitFork } from "lucide-react"
import type { WorkbenchContext } from "@/app/useWorkbenchContext"
import Button from "@/components/ui/Button"
import { KeyValue, Notice, SectionLabel } from "@/components/ui/Card"
import { Tag } from "@/components/ui/StatusTag"
import TypedValueCell from "@/components/domain/TypedValueCell"
import { useIndex } from "@/data/store"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/cn"
import { navigate } from "@/router/router"
import { useRecordByCommit } from "@/stores/trace"

/**
 * P24 属性演化链与输入来源：属性版本 + executionId/decisionId 来源；
 * 依赖边指向输入版本；点击结果跳回 P22 对应节点与其固定图版本。
 */
export default function P24Provenance({ ctx }: { ctx: WorkbenchContext }) {
  const index = useIndex()
  const { viewCommit, route } = ctx
  const entityId = route.params.entityId
  const record = useRecordByCommit(viewCommit?.id)

  if (!viewCommit || !entityId) return null
  const entity = index.entities.get(entityId)

  if (!record) {
    return (
      <div className="mx-auto w-full max-w-[960px] px-6 py-6">
        <Notice tone="info">
          提交 <span className="font-mono">{viewCommit.id}</span>{" "}
          没有计算过程记录：无法构造 {entityId} 的属性演化链（缺值显示“未记录”，不当作 0）。
        </Notice>
      </div>
    )
  }

  const changes = record.changes.filter((c) => c.entityId === entityId)
  const propertyId =
    route.params.propertyId ?? changes[0]?.propertyId ?? "thermal.temperature"
  const change = changes.find((c) => c.propertyId === propertyId)
  const decision = change
    ? record.decisions.find((d) => d.id === change.decisionId)
    : undefined
  const baseVersion = `${entityId}.${propertyId}@${record.record.baseCommit}`
  const usedBy = record.dependencyEdges.filter(
    (e) => e.kind === "used" && e.source === baseVersion,
  )
  const proposed = record.dependencyEdges.filter(
    (e) => e.kind === "proposed" && decision && e.target === decision.id,
  )
  const generated = record.dependencyEdges.filter(
    (e) => e.kind === "generated" && change && e.target === change.versionId,
  )

  const gotoExecution = (executionId: string) => {
    const e = record.systemExecutions.find((x) => x.id === executionId)
    if (!e) return
    const firstNode = record.nodeExecutions.find(
      (n) => n.executionId === e.id,
    )?.nodeId
    navigate({
      pageId: "P22",
      params: {
        runId: record.record.runId,
        branchId: record.record.branchId,
        viewCommit: record.record.resultCommit,
        systemId: e.systemId,
        entityId: e.entityId,
        ...(firstNode ? { nodeId: firstNode } : {}),
      },
    })
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] px-6 py-6">
      <div className="mb-4 flex items-center gap-3">
        <GitFork size={18} className="text-muted" aria-hidden />
        <h1 className="text-body-lg font-semibold">
          属性演化链 · {entity?.label ?? entityId}
        </h1>
        <span className="font-mono text-label text-muted">{entityId}</span>
        <Tag
          size="sm"
          tone={record.origin === "computed" ? "success" : "warning"}
        >
          {record.origin === "computed" ? "当前图求值" : "参考样例"}
        </Tag>
      </div>

      {changes.length > 1 ? (
        <div className="mb-4 flex items-center gap-2">
          <SectionLabel>属性</SectionLabel>
          {changes.map((c) => (
            <Button
              key={c.propertyId}
              size="sm"
              intent={c.propertyId === propertyId ? "primary" : "secondary"}
              onClick={() =>
                navigate(
                  {
                    pageId: "P24",
                    params: { ...route.params, propertyId: c.propertyId },
                  },
                  { replace: true },
                )
              }
            >
              {c.propertyId}
            </Button>
          ))}
        </div>
      ) : null}

      {!change ? (
        <Notice tone="info">
          {entityId}.{propertyId} 在本回合（{record.record.id}
          ）没有变化；只有发生变化的属性才有新版本与裁决来源。
        </Notice>
      ) : (
        <div className="rounded-ui border border-border bg-surface shadow-card">
          {/* 输入版本 */}
          <ChainBlock
            title="输入版本（previous 视图）"
            mono={baseVersion}
            tone="neutral"
          >
            <KeyValue label="旧值">
              <TypedValueCell
                align="left"
                value={{
                  state: "value",
                  value: change.old,
                  commitId: record.record.baseCommit,
                }}
                unit={change.unitId ? (index.units.get(change.unitId) ?? null) : null}
                showCommit
              />
            </KeyValue>
            <KeyValue label="被读取">
              <span className="flex flex-wrap gap-1.5">
                {usedBy.map((e) => (
                  <button
                    key={e.target}
                    type="button"
                    onClick={() => gotoExecution(e.target)}
                    className="rounded bg-neutral-soft px-1.5 font-mono text-caption text-primary hover:bg-primary-soft"
                    title="跳回 P22 对应执行与其固定图版本"
                  >
                    {e.target}
                  </button>
                ))}
              </span>
            </KeyValue>
          </ChainBlock>

          <ChainArrow label={`${usedBy.length} 个执行读取了该版本`} />

          {/* 裁决 */}
          {decision ? (
            <ChainBlock
              title="联合裁决来源"
              mono={decision.id}
              tone="warning"
              actions={
                <Button
                  size="sm"
                  intent="ghost"
                  icon={ArrowUpRight}
                  onClick={() =>
                    navigate({
                      pageId: "P23",
                      params: {
                        runId: record.record.runId,
                        branchId: record.record.branchId,
                        viewCommit: record.record.resultCommit,
                        decisionId: decision.id,
                      },
                    })
                  }
                >
                  裁决明细
                </Button>
              }
            >
              <KeyValue label="约束" mono>
                {decision.constraintRef}
              </KeyValue>
              <KeyValue label="额度 / 比例">
                <span className="tabular">
                  {formatNumber(decision.budget)} K · ×
                  {formatNumber(decision.scale)}
                </span>
              </KeyValue>
              <KeyValue label="提议来自">
                <span className="flex flex-wrap gap-1.5">
                  {proposed.map((e) => (
                    <button
                      key={e.source}
                      type="button"
                      onClick={() => gotoExecution(e.source)}
                      className="rounded bg-neutral-soft px-1.5 font-mono text-caption text-primary hover:bg-primary-soft"
                    >
                      {e.source}
                    </button>
                  ))}
                </span>
              </KeyValue>
            </ChainBlock>
          ) : null}

          <ChainArrow
            label={generated.length > 0 ? "裁决生成新版本" : "无变更"}
          />

          {/* 输出版本 */}
          <ChainBlock
            title="输出版本（本回合生成）"
            mono={change.versionId}
            tone="success"
          >
            <KeyValue label="新值">
              <TypedValueCell
                align="left"
                value={{
                  state: "value",
                  value: change.new,
                  commitId: record.record.resultCommit,
                }}
                unit={change.unitId ? (index.units.get(change.unitId) ?? null) : null}
                showCommit
              />
            </KeyValue>
            <KeyValue label="变化" mono>
              {formatNumber(change.old)} → {formatNumber(change.new)}
            </KeyValue>
          </ChainBlock>
        </div>
      )}

      <p className="mt-4 text-caption text-muted">
        依赖边指向输入版本：执行只读取 {record.record.baseCommit} 的 previous
        值；新值 {record.record.resultCommit} 只在原子提交后可见。记录绑定执行时的固定图版本（
        {record.record.programRefs.join("、")}），不随当前草稿变化。
      </p>
    </div>
  )
}

function ChainBlock({
  title,
  mono,
  tone,
  actions,
  children,
}: {
  title: string
  mono: string
  tone: "neutral" | "warning" | "success"
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="px-4 py-3">
      <div className="mb-1 flex items-center gap-2">
        <SectionLabel>{title}</SectionLabel>
        <Tag size="sm" tone={tone}>
          {mono}
        </Tag>
        <span className="ml-auto">{actions}</span>
      </div>
      <dl>{children}</dl>
    </div>
  )
}

function ChainArrow({ label }: { label: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 border-y border-line bg-subtle px-4 py-1.5",
        "text-caption text-muted",
      )}
    >
      <ArrowDown size={13} aria-hidden />
      {label}
    </div>
  )
}
