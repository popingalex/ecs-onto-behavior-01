import type { BranchDef, CommitDef, WorldSnapshot } from "@/core/types"
import { createStore, useStore } from "@/lib/store"
import type { RoundResult } from "@/services/mock-executor"
import { IdbHistoryStorage } from "./idb"
import { MemoryHistoryStorage } from "./memory"
import type { HistoryStorage } from "./storage"

/**
 * 本地运行历史持久化（W4）。事实包 = record + commit + world + branch head，
 * 在单个存储事务内按 facts → commit marker → head 指针的顺序写入：
 * - 事务失败（含配额不足）→ 全部回滚，head 保持旧值，内存层也不移动；
 * - 恢复时只暴露「有 marker 且在某个 head 谱系内」的提交，其余是孤儿，计数为诊断；
 * - head→parent 链断、缺 marker、缺世界快照 → 拒绝整份恢复并回退种子，不静默混用。
 * historySchemaVersion 不符走拒绝路径（本轮无迁移表），用户可显式清空后重新初始化。
 */
export const HISTORY_SCHEMA_VERSION = 1
export const HISTORY_PACKAGE_FORMAT = "history-package/1"

export type RestoreMode =
  | "pending"
  | "first-init"
  | "restored"
  | "fallback-seed"
  | "rejected-version"

export interface FailedSettleRef {
  runId: string
  branchId: string
  baseCommit: string
}

interface PersistenceState {
  /** indexeddb = 真持久化；memory = 本会话内存（IndexedDB 不可用或测试注入）。 */
  storageKind: "indexeddb" | "memory" | null
  mode: RestoreMode
  restoredCommits: number
  orphanFacts: number
  diagnostics: string[]
  /** 最近一次提交持久化失败；settle 记录可重试的推算参数。 */
  failure: { message: string; settle: FailedSettleRef | null } | null
}

export const persistenceStore = createStore<PersistenceState>({
  storageKind: null,
  mode: "pending",
  restoredCommits: 0,
  orphanFacts: 0,
  diagnostics: [],
  failure: null,
})

export function usePersistenceStatus(): PersistenceState {
  return useStore(persistenceStore, (s) => s)
}

let storage: HistoryStorage | null = null
let storageReady: Promise<HistoryStorage> | null = null

/** 测试注入/重置存储；同时复位状态面。 */
export function setHistoryStorageForTests(next: HistoryStorage | null) {
  storage = next
  storageReady = null
  persistenceStore.setState({
    storageKind: null,
    mode: "pending",
    restoredCommits: 0,
    orphanFacts: 0,
    diagnostics: [],
    failure: null,
  })
}

async function ensureStorage(): Promise<HistoryStorage> {
  storage ??=
    typeof indexedDB !== "undefined"
      ? new IdbHistoryStorage()
      : new MemoryHistoryStorage()
  storageReady ??= (async () => {
    try {
      await storage!.open()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (storage!.kind === "memory") throw error
      storage = new MemoryHistoryStorage()
      await storage.open()
      persistenceStore.setState((s) => ({
        diagnostics: [
          ...s.diagnostics,
          `IndexedDB 不可用：${message}；本会话历史仅保存在内存`,
        ],
      }))
    }
    persistenceStore.setState({
      storageKind: storage!.kind as "indexeddb" | "memory",
    })
    return storage!
  })()
  return storageReady
}

export interface RestoreInput {
  /** 种子 + 目录合并后已装配的可信提交/世界：head 链走到它们即可终止。 */
  trustedCommitIds: Set<string>
  trustedWorldIds: Set<string>
  /** 种子 + 目录合并后已知的分支 id；heads 指向除此之外的分支按“定义不可考”隔离。 */
  trustedBranchIds: Set<string>
}

export interface RestoreOutcome {
  mode: Exclude<RestoreMode, "pending">
  commits: CommitDef[]
  worlds: WorldSnapshot[]
  records: RoundResult[]
  /** 持久化的新分支（head 已按 heads 存取覆盖）。 */
  branches: BranchDef[]
  /** branchId → headCommitId（覆盖种子/目录分支头）。 */
  heads: Record<string, string>
  restoredCommits: number
  orphanFacts: number
  diagnostics: string[]
}

const EMPTY: Omit<RestoreOutcome, "mode" | "diagnostics"> = {
  commits: [],
  worlds: [],
  records: [],
  branches: [],
  heads: {},
  restoredCommits: 0,
  orphanFacts: 0,
}

function finish(outcome: RestoreOutcome): RestoreOutcome {
  persistenceStore.setState((s) => ({
    mode: outcome.mode,
    restoredCommits: outcome.restoredCommits,
    orphanFacts: outcome.orphanFacts,
    diagnostics: [...s.diagnostics, ...outcome.diagnostics],
  }))
  return outcome
}

async function recordLastRestore(mode: RestoreMode, problems: string[]) {
  try {
    const store = await ensureStorage()
    await store.put("meta", "lastRestore", {
      mode,
      at: new Date().toISOString(),
      problems,
    })
  } catch {
    // 诊断落盘失败不影响启动。
  }
}

export async function restoreHistory(
  input: RestoreInput,
): Promise<RestoreOutcome> {
  const store = await ensureStorage()
  const version = await store.get("meta", "historySchemaVersion")
  if (version == null) {
    // 首次初始化：种子由调用方装配，不复制进持久层；只写版本与初始化标记。
    await store.transact([
      { store: "meta", key: "historySchemaVersion", value: HISTORY_SCHEMA_VERSION },
      { store: "meta", key: "initializedAt", value: new Date().toISOString() },
    ])
    return finish({ mode: "first-init", ...EMPTY, diagnostics: [] })
  }
  if (version !== HISTORY_SCHEMA_VERSION) {
    const diagnostic = `本地历史 schema 版本 ${String(version)} 与当前 ${HISTORY_SCHEMA_VERSION} 不符：拒绝恢复并回退种子；可在状态栏清空本地历史后重新初始化。`
    await recordLastRestore("rejected-version", [diagnostic])
    return finish({
      mode: "rejected-version",
      ...EMPTY,
      diagnostics: [diagnostic],
    })
  }

  const [commits, worlds, records, branches, headsEntries, metaEntries] =
    await Promise.all([
      store.getAll("commits"),
      store.getAll("worlds"),
      store.getAll("records"),
      store.getAll("branches"),
      store.getAll("heads"),
      store.getAll("meta"),
    ])
  const heads = Object.fromEntries(
    headsEntries.map((e) => [e.key, String(e.value)]),
  )
  const markers = new Set(
    metaEntries
      .filter((e) => e.key.startsWith("marker:"))
      .map((e) => e.key.slice("marker:".length)),
  )
  const persistedCommits = new Map(
    commits.map((e) => [e.key, e.value as CommitDef]),
  )
  const persistedWorlds = new Map(
    worlds.map((e) => [e.key, e.value as WorldSnapshot]),
  )
  const persistedBranches = new Map(
    branches.map((e) => [e.key, e.value as BranchDef]),
  )

  // 一致性核对分两级：
  // - 完整性硬失败（已知分支的 head 链断、缺 marker、缺世界快照、持久化分支缺 head
  //   指针）→ 拒绝整份恢复并回退种子，不静默混用；
  // - 定义不可考的分支 head（如运行目录 localStorage 丢失留下的 head 指针）→ 只隔离
  //   该分支：不恢复其 head、其提交计为孤儿档案，其余分支照常恢复并给出响亮诊断。
  const problems: string[] = []
  const quarantined: string[] = []
  const droppedHeads = new Set<string>()
  const exposed = new Set<string>()
  for (const [branchId, headId] of Object.entries(heads)) {
    const known =
      input.trustedBranchIds.has(branchId) || persistedBranches.has(branchId)
    if (!known) {
      quarantined.push(
        `分支 ${branchId} 的定义已不可考（其运行目录记录可能已丢失）：head ${headId} 未恢复，相关提交保留为孤儿档案，可经「导出历史包」查阅`,
      )
      droppedHeads.add(branchId)
      continue
    }
    let cursor: string | null = headId
    const seen = new Set<string>()
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor)
      const commit = persistedCommits.get(cursor)
      if (!commit) {
        // 链走到从未持久化的提交：可信（种子/目录重建）终点即合法终止，否则断裂。
        if (!input.trustedCommitIds.has(cursor))
          problems.push(`分支 ${branchId} 的 head 链在 ${cursor} 断裂（提交缺失）`)
        break
      }
      if (!markers.has(cursor)) {
        problems.push(`提交 ${cursor} 缺少写入完整性 marker`)
        break
      }
      if (!persistedWorlds.has(cursor) && !input.trustedWorldIds.has(cursor)) {
        problems.push(`提交 ${cursor} 缺少世界快照`)
        break
      }
      // 同时是可信终点的持久化提交（如目录根提交）也计入暴露，不误判为孤儿。
      exposed.add(cursor)
      cursor = commit.parentId
    }
  }
  for (const branch of persistedBranches.values())
    if (!heads[branch.id]) problems.push(`分支 ${branch.id} 缺少 head 指针`)
  if (problems.length > 0) {
    await recordLastRestore("fallback-seed", [...problems, ...quarantined])
    return finish({
      mode: "fallback-seed",
      ...EMPTY,
      diagnostics: [...problems, ...quarantined],
    })
  }

  // 孤儿：有 marker 但不在任何 head 谱系内（例如 head 写入失败残留）→ 不暴露，计数为诊断。
  const keptCommits = [...exposed].map((id) => persistedCommits.get(id)!)
  const keptWorlds = keptCommits
    .map((c) => persistedWorlds.get(c.id))
    .filter((w): w is WorldSnapshot => Boolean(w))
  const keptRecords = records
    .map((e) => e.value as RoundResult)
    .filter((r) => exposed.has(r.record.resultCommit))
  const orphanFacts =
    [...persistedCommits.keys()].filter((id) => !exposed.has(id)).length +
    (records.length - keptRecords.length)
  const diagnostics = [...quarantined]
  if (orphanFacts > 0)
    diagnostics.push(
      `${orphanFacts} 条孤儿事实未暴露（写入中断残留或已隔离分支），不影响已恢复历史`,
    )
  const keptHeads = Object.fromEntries(
    Object.entries(heads).filter(([branchId]) => !droppedHeads.has(branchId)),
  )
  const outcome: RestoreOutcome = {
    mode: "restored",
    commits: keptCommits,
    worlds: keptWorlds,
    records: keptRecords,
    branches: [...persistedBranches.values()].map((b) => ({
      ...b,
      headCommit: keptHeads[b.id],
    })),
    heads: keptHeads,
    restoredCommits: keptCommits.length,
    orphanFacts,
    diagnostics,
  }
  await recordLastRestore("restored", diagnostics)
  return finish(outcome)
}

export interface CommitFacts {
  commit: CommitDef
  world: WorldSnapshot
  record: RoundResult
}

/**
 * 原子写入一次成功提交的事实包：facts → marker → head 在同一事务。
 * 失败时持久层与内存层的 head 都保持旧值；调用方负责提示与重试。
 */
export async function persistCommitFacts(
  facts: CommitFacts,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const store = await ensureStorage()
    await store.transact([
      { store: "commits", key: facts.commit.id, value: facts.commit },
      { store: "worlds", key: facts.world.commitId, value: facts.world },
      { store: "records", key: facts.record.record.id, value: facts.record },
      {
        store: "meta",
        key: `marker:${facts.commit.id}`,
        value: { commitId: facts.commit.id, at: new Date().toISOString() },
      },
      { store: "heads", key: facts.commit.branchId, value: facts.commit.id },
    ])
    persistenceStore.setState({ failure: null })
    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    persistenceStore.setState((s) => ({
      failure: { message, settle: s.failure?.settle ?? null },
    }))
    return { ok: false, message }
  }
}

/** 持久化新建分支（定义 + head 指针同事务）；失败只影响刷新后的恢复。 */
export async function persistNewBranch(
  branch: BranchDef,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const store = await ensureStorage()
    await store.transact([
      { store: "branches", key: branch.id, value: branch },
      { store: "heads", key: branch.id, value: branch.headCommit },
    ])
    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    persistenceStore.setState((s) => ({
      failure: { message, settle: s.failure?.settle ?? null },
    }))
    return { ok: false, message }
  }
}

/** 标记一次因持久化失败而未落地的推算，供状态栏“重试”。 */
export function noteFailedSettle(settle: FailedSettleRef) {
  persistenceStore.setState((s) => ({
    failure: { message: s.failure?.message ?? "未知错误", settle },
  }))
}

/**
 * 持久化目录运行的根提交事实（commit + world + marker，无 record；幂等）。
 * 根提交此前只在启动时由运行目录（localStorage）重建：目录一旦丢失，建在其上的
 * 结算链就在持久层断链、拖垮整份恢复。根提交落 IDB 后，链校验不再依赖目录是否幸存。
 * head 指针只在缺失时写入（ensureHead），绝不覆盖已结算的 head。
 */
export async function persistRootCommit(facts: {
  commit: CommitDef
  world: WorldSnapshot
}): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const store = await ensureStorage()
    await store.transact([
      { store: "commits", key: facts.commit.id, value: facts.commit },
      { store: "worlds", key: facts.world.commitId, value: facts.world },
      {
        store: "meta",
        key: `marker:${facts.commit.id}`,
        value: { commitId: facts.commit.id, at: new Date().toISOString() },
      },
    ])
    await store.ensureHead(facts.commit.branchId, facts.commit.id)
    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    persistenceStore.setState((s) => ({
      failure: { message, settle: s.failure?.settle ?? null },
    }))
    return { ok: false, message }
  }
}

/** 清空本地历史并重写版本标记：下次启动按首次初始化（种子）处理。 */
export async function clearLocalHistory(): Promise<
  { ok: true } | { ok: false; message: string }
> {
  try {
    const store = await ensureStorage()
    await store.clear()
    await store.transact([
      { store: "meta", key: "historySchemaVersion", value: HISTORY_SCHEMA_VERSION },
      { store: "meta", key: "initializedAt", value: new Date().toISOString() },
    ])
    persistenceStore.setState((s) => ({
      mode: "first-init",
      restoredCommits: 0,
      orphanFacts: 0,
      failure: null,
      diagnostics: [
        ...s.diagnostics,
        "本地历史已清空；当前会话内存中的提交保留到刷新",
      ],
    }))
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

export interface HistoryPackage {
  format: typeof HISTORY_PACKAGE_FORMAT
  historySchemaVersion: number
  exportedAt: string
  commits: CommitDef[]
  worlds: WorldSnapshot[]
  records: RoundResult[]
  branches: BranchDef[]
  heads: Record<string, string>
}

/** 冷启动导出：把持久层事实打包为 JSON。导入本轮不实现（不可迁移设备）。 */
export async function exportHistoryPackage(): Promise<HistoryPackage> {
  const store = await ensureStorage()
  const [commits, worlds, records, branches, heads] = await Promise.all([
    store.getAll("commits"),
    store.getAll("worlds"),
    store.getAll("records"),
    store.getAll("branches"),
    store.getAll("heads"),
  ])
  return {
    format: HISTORY_PACKAGE_FORMAT,
    historySchemaVersion: HISTORY_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    commits: commits.map((e) => e.value as CommitDef),
    worlds: worlds.map((e) => e.value as WorldSnapshot),
    records: records.map((e) => e.value as RoundResult),
    branches: branches.map((e) => e.value as BranchDef),
    heads: Object.fromEntries(heads.map((e) => [e.key, String(e.value)])),
  }
}
