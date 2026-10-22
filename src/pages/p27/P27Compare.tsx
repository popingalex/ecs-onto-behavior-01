import { useMemo } from "react"
import { ArrowUpRight, GitCompare, GitBranch } from "lucide-react"
import type { WorkbenchContext } from "@/app/useWorkbenchContext"
import Button from "@/components/ui/Button"
import Card, { KeyValue, Notice, PanelHeader, SectionLabel } from "@/components/ui/Card"
import { Tag } from "@/components/ui/StatusTag"
import Table, { Td, Th } from "@/components/ui/Table"
import TypedValueCell from "@/components/domain/TypedValueCell"
import { useIndex } from "@/data/store"
import { formatNumber, formatSigned, formatSimTime } from "@/lib/format"
import { navigate } from "@/router/router"
import { lineage, useCommits } from "@/stores/history"
import { useRecordByCommit } from "@/stores/trace"
import type { CommitDef } from "@/core/types"
import { commonAncestor, compareWorlds, type CompareRow } from "./compare"

const ORIGIN_TAG = {
  base: { tone: "neutral" as const, label: "基础世界" },
  "reference-sample": { tone: "warning" as const, label: "参考样例 · 非当前图计算" },
  computed: { tone: "success" as const, label: "当前图求值" },
  "native-import": { tone: "purple" as const, label: "原生导入 · 只读" },
} as const

function CommitPick({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (commitId: string) => void
}) {
  const commits = useCommits()
  const all = Object.values(commits).sort(
    (a, b) => a.simTime - b.simTime || a.id.localeCompare(b.id),
  )
  return (
    <label className="flex items-center gap-2 text-label">
      <span className="text-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded-ui border border-border bg-surface px-2 font-mono text-label"
      >
        {all.map((c) => (
          <option key={c.id} value={c.id}>
            {c.branchId}@{c.id} · {formatSimTime(c.simTime)}
          </option>
        ))}
      </select>
    </label>
  )
}

function SideSummary({ commit }: { commit: CommitDef }) {
  const record = useRecordByCommit(commit.id)
  const origin = ORIGIN_TAG[commit.source]
  return (
    <Card>
      <PanelHeader
        title={<span className="font-mono text-label">{commit.id}</span>}
        meta={<Tag size="sm" tone={origin.tone}>{origin.label}</Tag>}
      />
      <dl className="px-4 py-3">
        <KeyValue label="分支 / 回合" mono>
          {commit.branchId} · 第 {commit.round} 回合
        </KeyValue>
        <KeyValue label="时刻" mono>
          {formatSimTime(commit.simTime)}
        </KeyValue>
        <KeyValue label="摘要">{commit.summary}</KeyValue>
        <KeyValue label="输入版本" mono>
          {record
            ? Object.entries(record.record.inputVersions)
                .map(([k, v]) => `${k}=${String(v).slice(0, 12)}`)
                .join(" · ")
            : "无过程记录（基准提交）"}
        </KeyValue>
      </dl>
    </Card>
  )
}

/**
 * P27 分支对比与反事实：同一基准与时刻的两提交世界快照逐属性对比。
 * 缺值显示「未记录」；温差列单位 K（右−左）；同值但来源不同的行保留标注。
 */
export default function P27Compare({ ctx }: { ctx: WorkbenchContext }) {
  const index = useIndex()
  const commits = useCommits()
  const left = commits[ctx.route.params.leftCommit ?? ""]
  const right = commits[ctx.route.params.rightCommit ?? ""]

  const leftWorld = left ? index.worlds.get(left.id) : undefined
  const rightWorld = right ? index.worlds.get(right.id) : undefined
  const rows = useMemo(
    () => compareWorlds(index, leftWorld, rightWorld),
    [index, leftWorld, rightWorld],
  )
  const leftRecord = useRecordByCommit(left?.id)
  const rightRecord = useRecordByCommit(right?.id)
  if (!left || !right) return null

  const lineageOf = (headId: string) =>
    lineage(commits, headId).map((c) => c.id)
  const ancestor = commonAncestor(lineageOf, left.id, right.id)
  const aligned = left.simTime === right.simTime

  const pick = (key: "leftCommit" | "rightCommit") => (commitId: string) =>
    navigate(
      { pageId: "P27", params: { ...ctx.route.params, [key]: commitId } },
      { replace: true },
    )

  const unitSymbol = (unitId: string | null) =>
    unitId ? (index.units.get(unitId)?.symbol ?? unitId) : ""

  /** 同值但来源不同：两侧记录对该属性的裁决 inputs 不一致。 */
  const sourceDiffers = (row: CompareRow): boolean => {
    if (!row.sameValue || !leftRecord || !rightRecord) return false
    const sig = (r: NonNullable<typeof leftRecord>) =>
      r.decisions
        .filter(
          (d) => d.entityId === row.entityId && d.propertyId === row.propertyId,
        )
        .map((d) =>
          d.allocations.map((a) => `${a.effectId}:${a.approvedDelta}`).join(","),
        )
        .join("|")
    return sig(leftRecord) !== sig(rightRecord)
  }

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-6 py-6">
      <section>
        <div className="flex items-center gap-2">
          <GitCompare size={18} className="text-muted" aria-hidden />
          <h2 className="text-title font-semibold">分支对比与反事实</h2>
        </div>
        <p className="mt-1 max-w-[860px] text-body text-muted">
          左 / 右两列是绝对值，差值列是右−左；温度的差是温差（K），不是 °C
          绝对温度。缺值显示「未记录」，不当 0 参与差值。
        </p>
      </section>

      <Card>
        <div className="flex flex-wrap items-center gap-4 px-4 py-3">
          <CommitPick label="左侧" value={left.id} onChange={pick("leftCommit")} />
          <CommitPick
            label="右侧"
            value={right.id}
            onChange={pick("rightCommit")}
          />
          <span className="text-caption text-muted">
            对齐方式：按模拟时刻；依据为两侧提交的 simTime
          </span>
          {aligned ? (
            <Tag size="sm" tone="success">
              时刻对齐 {formatSimTime(left.simTime)}
            </Tag>
          ) : (
            <Tag size="sm" tone="danger">
              不可对齐：{formatSimTime(left.simTime)} vs{" "}
              {formatSimTime(right.simTime)}
            </Tag>
          )}
          <span className="text-caption text-muted">
            共同祖先：{ancestor ? <span className="font-mono">{ancestor}</span> : "无"}
          </span>
        </div>
      </Card>

      {!aligned ? (
        <Notice tone="warning">
          两侧提交不在同一模拟时刻，以下逐属性并排仅供参考，差值列已按原始值计算但不代表同一时刻的对比。
        </Notice>
      ) : null}
      {!leftWorld || !rightWorld ? (
        <Notice tone="warning">
          {!leftWorld ? `左侧 ${left.id}` : `右侧 ${right.id}`}{" "}
          没有世界快照：该侧全部显示「未记录」。
        </Notice>
      ) : null}

      <Card>
        <PanelHeader
          title="指标差异"
          meta={<span className="tabular">{rows.length} 行</span>}
        />
        <Table className="min-w-[960px]">
          <thead>
            <tr>
              <Th>实体.属性</Th>
              <Th align="right">左（{left.id}）</Th>
              <Th align="right">右（{right.id}）</Th>
              <Th align="right">右−左</Th>
              <Th>备注</Th>
              <Th align="right">来源</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const differs = sourceDiffers(row)
              return (
                <tr key={`${row.entityId}.${row.propertyId}`}>
                  <Td>
                    <span className="font-mono text-label">
                      {row.entityId}.{row.propertyId}
                    </span>
                    <span className="ml-2 text-caption text-muted">
                      {row.label}
                    </span>
                  </Td>
                  <Td numeric>
                    <TypedValueCell
                      value={row.left}
                      unit={
                        row.unitId ? (index.units.get(row.unitId) ?? null) : null
                      }
                      showCommit
                    />
                  </Td>
                  <Td numeric>
                    <TypedValueCell
                      value={row.right}
                      unit={
                        row.unitId ? (index.units.get(row.unitId) ?? null) : null
                      }
                      showCommit
                    />
                  </Td>
                  <Td numeric>
                    {row.delta === null ? (
                      <span className="text-faint" aria-label="不适用">
                        —
                      </span>
                    ) : (
                      <span className="tabular">
                        {formatSigned(row.delta)} {unitSymbol(row.deltaUnitId)}
                      </span>
                    )}
                  </Td>
                  <Td>
                    {row.sameValue ? (
                      differs ? (
                        <Tag size="sm" tone="warning">
                          同值 · 来源不同
                        </Tag>
                      ) : (
                        <span className="text-caption text-faint">同值</span>
                      )
                    ) : row.delta === null ? (
                      <span className="text-caption text-muted">
                        非数值或单侧缺失
                      </span>
                    ) : null}
                  </Td>
                  <Td numeric>
                    <span className="inline-flex gap-1">
                      <Button
                        size="sm"
                        intent="ghost"
                        icon={ArrowUpRight}
                        title="左侧属性来源（P24）"
                        onClick={() =>
                          navigate({
                            pageId: "P24",
                            params: {
                              branchId: left.branchId,
                              viewCommit: left.id,
                              entityId: row.entityId,
                              propertyId: row.propertyId,
                            },
                          })
                        }
                      >
                        左
                      </Button>
                      <Button
                        size="sm"
                        intent="ghost"
                        icon={ArrowUpRight}
                        title="右侧属性来源（P24）"
                        onClick={() =>
                          navigate({
                            pageId: "P24",
                            params: {
                              branchId: right.branchId,
                              viewCommit: right.id,
                              entityId: row.entityId,
                              propertyId: row.propertyId,
                            },
                          })
                        }
                      >
                        右
                      </Button>
                    </span>
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SideSummary commit={left} />
        <SideSummary commit={right} />
      </div>

      <Card>
        <PanelHeader title="结果解释与操作" />
        <div className="px-4 py-3 text-label leading-6 text-muted">
          <SectionLabel className="mb-1">反事实操作</SectionLabel>
          <p>
            对比结果不能直接合并：想把某一侧作为新起点，请「复制到新分支后重算」，
            由执行器在新分支上产生新的提交，而不是搬运最终温度。
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              size="sm"
              intent="ghost"
              icon={GitBranch}
              onClick={() =>
                navigate({
                  pageId: "P26",
                  params: {
                    branchId: right.branchId,
                    viewCommit: right.id,
                  },
                })
              }
            >
              从右侧 {right.id} 建立分支（P26）
            </Button>
            <Button
              size="sm"
              intent="ghost"
              icon={GitCompare}
              onClick={() =>
                navigate(
                  {
                    pageId: "P27",
                    params: {
                      leftCommit: right.id,
                      rightCommit: left.id,
                    },
                  },
                  { replace: true },
                )
              }
            >
              交换左右
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
