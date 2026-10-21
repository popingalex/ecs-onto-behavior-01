import { createStore, useStore } from "@/lib/store"
import type { RoundResult } from "@/services/mock-executor"

/**
 * TraceStore：回合计算过程记录的不可变存储。
 * 记录按 recordId 写入一次，之后任何筛选、当前图参数修改都不会改变它
 * （记录自带冻结的 inputVersions 与程序快照）。索引只增不改。
 */
interface TraceState {
  records: Record<string, RoundResult>
  /** resultCommitId → recordId */
  byCommit: Record<string, string>
  /** branchId → recordId[]（写入顺序） */
  byBranch: Record<string, string[]>
  order: string[]
}

export const traceStore = createStore<TraceState>({
  records: {},
  byCommit: {},
  byBranch: {},
  order: [],
})

/** 写入一条完整记录；同 id 重复写入被忽略（幂等），已有记录永不被覆盖。 */
export function putRecord(record: RoundResult) {
  const id = record.record.id
  if (traceStore.getState().records[id]) return
  traceStore.setState((s) => ({
    records: { ...s.records, [id]: record },
    byCommit: { ...s.byCommit, [record.record.resultCommit]: id },
    byBranch: {
      ...s.byBranch,
      [record.record.branchId]: [...(s.byBranch[record.record.branchId] ?? []), id],
    },
    order: [...s.order, id],
  }))
}

export function getRecord(recordId: string): RoundResult | undefined {
  return traceStore.getState().records[recordId]
}

export function getRecordByCommit(commitId: string): RoundResult | undefined {
  const s = traceStore.getState()
  const id = s.byCommit[commitId]
  return id ? s.records[id] : undefined
}

export function useRecordByCommit(
  commitId: string | undefined,
): RoundResult | undefined {
  return useStore(traceStore, (s) => {
    if (!commitId) return undefined
    const id = s.byCommit[commitId]
    return id ? s.records[id] : undefined
  })
}

export function useRecord(recordId: string | undefined): RoundResult | undefined {
  return useStore(traceStore, (s) =>
    recordId ? s.records[recordId] : undefined,
  )
}

const branchListCache = new WeakMap<string[], RoundResult[]>()

/** 分支下的记录列表；筛选由调用方做，不改记录本身。 */
export function useBranchRecords(branchId: string | undefined): RoundResult[] {
  return useStore(traceStore, (s) => {
    if (!branchId) return EMPTY
    const ids = s.byBranch[branchId]
    if (!ids) return EMPTY
    let out = branchListCache.get(ids)
    if (!out) {
      out = ids
        .map((id) => s.records[id])
        .filter((r): r is RoundResult => Boolean(r))
      branchListCache.set(ids, out)
    }
    return out
  })
}

const EMPTY: RoundResult[] = []
