import type { BranchDef, CommitDef, RunDef, WorldSnapshot } from "@/core/types"
import { dataStore } from "@/data/store"
import { createStore, useStore } from "@/lib/store"
import { historyStore } from "@/stores/history"

/**
 * 运行目录（原型语义）：P19 新建的运行持久化在本浏览器 localStorage。
 * 每个运行带一条私有主分支与一个根提交（基础世界快照的克隆，commitId 独立，
 * 不与其他运行共享 c042）。刷新后按目录重建根提交；会话内的推算提交不持久化
 * （与既有“提交历史在会话内存”语义一致）。
 */
export interface CatalogRun {
  run: RunDef
  branchId: string
  /** 根提交 id（基础世界的独立克隆）。 */
  rootCommit: string
  createdAt: string
}

const STORAGE_KEY = "ecs-workbench.run-catalog.v1"

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage
  } catch {
    return null
  }
}

function load(): CatalogRun[] {
  try {
    const raw = storage()?.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as { runs?: CatalogRun[] }
    return Array.isArray(parsed.runs)
      ? parsed.runs.filter((r) => r && r.run && typeof r.run.id === "string")
      : []
  } catch {
    return []
  }
}

export const runCatalogStore = createStore<{ runs: CatalogRun[] }>({
  runs: load(),
})

function persist(runs: CatalogRun[]) {
  try {
    storage()?.setItem(
      STORAGE_KEY,
      JSON.stringify({ format: "run-catalog/1", runs }),
    )
  } catch {
    // 存储不可用时本次会话内仍可用。
  }
}

export function useCatalogRuns(): CatalogRun[] {
  return useStore(runCatalogStore, (s) => s.runs)
}

function nextCommitId(taken: Iterable<string>): string {
  let max = 0
  for (const id of taken) {
    const m = /^c(\d+)$/.exec(id)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `c${String(max + 1).padStart(3, "0")}`
}

function nextRunId(taken: Iterable<string>): string {
  let i = 1
  let id = `run-local-${i}`
  for (const t of taken) if (t === id) id = `run-local-${++i}`
  return id
}

function rootCommitFor(
  entry: CatalogRun,
  baseWorld: WorldSnapshot,
  stepSeconds: number,
): { commit: CommitDef ;world: WorldSnapshot } {
  const simTime = baseWorld.simTime ?? 0
  return {
    commit: {
      id: entry.rootCommit,
      runId: entry.run.id,
      branchId: entry.branchId,
      parentId: null,
      round: Math.round(simTime / stepSeconds),
      simTime,
      summary: `基础世界克隆 · 运行 ${entry.run.id} 的起点`,
      checkpoint: true,
      source: "base",
    },
    world: {
      commitId: entry.rootCommit,
      simTime: baseWorld.simTime,
      values: structuredClone(baseWorld.values),
    },
  }
}

/**
 * 把目录中的运行合并进刚加载的工作台：index.runs、history（分支 + 根提交）与世界快照。
 * 幂等；在 initHistory 之后调用。
 */
export function mergeCatalogRuns(baseWorld: WorldSnapshot) {
  const index = dataStore.getState().index
  if (!index) return
  const entries = runCatalogStore.getState().runs
  if (entries.length === 0) return
  for (const entry of entries) {
    index.runs.set(entry.run.id, entry.run)
    const { commit, world } = rootCommitFor(entry, baseWorld, entry.run.stepSeconds)
    if (!index.worlds.has(commit.id)) index.worlds.set(commit.id, world)
    const history = historyStore.getState()
    const commits = history.commits[commit.id]
      ? history.commits
      : { ...history.commits, [commit.id]: commit }
    const branches = history.branches[entry.branchId]
      ? history.branches
      : {
          ...history.branches,
          [entry.branchId]: {
            id: entry.branchId,
            runId: entry.run.id,
            label: `${entry.run.label} · 主分支`,
            baseCommit: null,
            headCommit: commit.id,
            visibility: "private" as const,
          } satisfies BranchDef,
        }
    historyStore.setState({ commits, branches })
  }
  dataStore.setState({ index: { ...index } })
}

export interface CreateRunInput {
  label: string
  bundleId: string
  stepSeconds: number
  playbackSeconds: number
  runtime: RunDef["runtime"]
}

/** 新建运行：登记目录、立即并入当前会话的 index/history；不触发任何结算。 */
export function createRun(
  input: CreateRunInput,
  baseWorld: WorldSnapshot,
): CatalogRun {
  const index = dataStore.getState().index
  const takenRuns = new Set<string>([
    ...(index ? [...index.runs.keys()] : []),
    ...runCatalogStore.getState().runs.map((r) => r.run.id),
  ])
  const runId = nextRunId(takenRuns)
  const takenCommits = new Set<string>([
    ...Object.keys(historyStore.getState().commits),
    ...(index ? [...index.worlds.keys()] : []),
  ])
  const entry: CatalogRun = {
    run: {
      id: runId,
      label: input.label.trim() || runId,
      bundleId: input.bundleId,
      stepSeconds: input.stepSeconds,
      playbackSeconds: input.playbackSeconds,
      runtime: input.runtime,
    },
    branchId: `${runId}-main`,
    rootCommit: nextCommitId(takenCommits),
    createdAt: new Date().toISOString(),
  }
  const runs = [...runCatalogStore.getState().runs, entry]
  runCatalogStore.setState({ runs })
  persist(runs)
  mergeCatalogRuns(baseWorld)
  return entry
}
