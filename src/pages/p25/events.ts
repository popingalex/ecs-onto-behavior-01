import type { CommitDef } from "@/core/types"
import { formatNumber } from "@/lib/format"
import type { RoundResult } from "@/services/mock-executor"

/**
 * P25 事件链提取：从不可变的提交目录与 trace 记录派生真实事件。
 * 只有结算 / 裁决 / 提交三类有数据来源；派遣、到达、交接等
 * 业务事件在 v0.5 没有记录来源，页面以空态说明，不编造。
 */
export type ChainEventKind = "commit" | "settle" | "decision"

export interface ChainEvent {
  id: string
  kind: ChainEventKind
  /** 事件所在模拟时刻（秒）。 */
  simTime: number
  branchId: string
  commitId: string
  /** computed = 事实记录；reference-sample = 参考样例（对照，非事实）；base = 基础世界。 */
  origin: "computed" | "reference-sample" | "base"
  title: string
  detail: string
  /** 同一时刻内的稳定序号（写入顺序），排序不改因果记录。 */
  seq: number
  recordId?: string
  decisionId?: string
}

export const CHAIN_KIND_LABEL: Record<ChainEventKind, string> = {
  commit: "提交",
  settle: "结算",
  decision: "裁决",
}

export function collectEvents(
  commits: Record<string, CommitDef>,
  records: RoundResult[],
): ChainEvent[] {
  const out: ChainEvent[] = []
  let seq = 0
  const byCommit = new Map(records.map((r) => [r.record.resultCommit, r]))
  for (const commit of Object.values(commits)) {
    const record = byCommit.get(commit.id)
    const origin =
      commit.source === "computed"
        ? "computed"
        : commit.source === "reference-sample"
          ? "reference-sample"
          : "base"
    out.push({
      id: `commit:${commit.id}`,
      kind: "commit",
      simTime: commit.simTime,
      branchId: commit.branchId,
      commitId: commit.id,
      origin,
      title: `提交 ${commit.id}`,
      detail: commit.summary,
      seq: seq++,
    })
    if (record) {
      out.push({
        id: `settle:${record.record.id}`,
        kind: "settle",
        simTime: record.record.simTimeAfter,
        branchId: record.record.branchId,
        commitId: commit.id,
        origin,
        title: `回合结算 ${record.record.baseCommit} → ${record.record.resultCommit}`,
        detail: `${record.record.programRefs.join("、")} · ${record.record.logicalParallelGroups.length} 个执行组`,
        seq: seq++,
        recordId: record.record.id,
      })
      for (const d of record.decisions) {
        out.push({
          id: `decision:${d.id}`,
          kind: "decision",
          simTime: record.record.simTimeAfter,
          branchId: record.record.branchId,
          commitId: commit.id,
          origin,
          title: `裁决 ${d.entityId}.${d.propertyId}`,
          detail: `额度 ${formatNumber(d.budget)} K · 比例 ${formatNumber(d.scale)} · ${formatNumber(d.old)} → ${formatNumber(d.final)} °C`,
          seq: seq++,
          recordId: record.record.id,
          decisionId: d.id,
        })
      }
    }
  }
  // 时间顺序展示；同时间按提取序号稳定排序——时间先后不等于因果。
  return out.sort((a, b) => a.simTime - b.simTime || a.seq - b.seq)
}
