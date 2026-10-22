import { createStore, useStore } from "@/lib/store"
import { seedDataAdapter, type DataAdapter } from "./adapter"
import { buildIndex, type WorkbenchIndex } from "./index"
import { registerReferenceSamples } from "./referenceSamples"
import { historyStore, initHistory } from "@/stores/history"
import { ensureModelDocuments, setBaselineOverride } from "@/stores/modelDocuments"
import { CURRENT_MODE } from "@/stores/dataSource"
import { loadNativeImport, nativeImportDataAdapter } from "@/services/nativeImport/seedAdapter"
import {
  restoreHistory,
  type RestoreOutcome,
} from "@/stores/persistence/historyPersistence"
import { mergeCatalogRuns } from "@/stores/runCatalog"
import { putRecord } from "@/stores/trace"

interface DataState {
  status: "idle" | "loading" | "ready" | "error"
  index: WorkbenchIndex | null
  error: string | null
  adapter: DataAdapter
}

export const dataStore = createStore<DataState>({
  status: "idle",
  index: null,
  error: null,
  adapter: CURRENT_MODE === "REAL_IMPORT_READ_ONLY" ? nativeImportDataAdapter : seedDataAdapter,
})

export async function loadWorkbench(): Promise<void> {
  const { adapter } = dataStore.getState()
  dataStore.setState({ status: "loading", error: null })
  try {
    const raw = await adapter.load()
    // REAL_IMPORT_READ_ONLY：先就位原生草稿基线，再走统一的文档注册；
    // mock 专属的参考样例/目录运行/本地历史恢复一概跳过（REAL-07/12：不混入、不冒充）。
    if (adapter === nativeImportDataAdapter) {
      const imported = await loadNativeImport()
      setBaselineOverride(() => imported.prototype)
    }
    const index = buildIndex(raw)
    initHistory(raw.branches, raw.commits)
    // 数据就绪后登记 v0.5 草稿文档（并恢复本地存档），不在渲染期间写 store。
    ensureModelDocuments()
    if (adapter !== nativeImportDataAdapter) {
      // 参考样例（expected_runs）：注册为“查看样例”的预置回合与只读过程记录。
      registerReferenceSamples()
      // P19 在本浏览器创建的运行：重建其根提交与主分支（传入刚构建的 index）。
      mergeCatalogRuns(raw.worlds[0], index)
      // W4 本地历史恢复：读 meta 判空 → 首次初始化（种子）或恢复。
      // 恢复失败（版本不符 / 链校验不通过）时 outcome 为空并回退种子，不静默混用。
      const outcome = await restoreHistory({
        trustedCommitIds: new Set(Object.keys(historyStore.getState().commits)),
        trustedWorldIds: new Set(index.worlds.keys()),
        trustedBranchIds: new Set(Object.keys(historyStore.getState().branches)),
      })
      if (outcome.mode === "restored") applyRestoredHistory(index, outcome)
    }
    dataStore.setState({ status: "ready", index })
  } catch (error) {
    dataStore.setState({
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

export function useDataStatus() {
  return useStore(dataStore, (s) => s.status)
}

/** 把校验通过的持久化事实叠进已装配的种子/目录：世界、提交、分支头与过程记录。 */
function applyRestoredHistory(index: WorkbenchIndex, outcome: RestoreOutcome) {
  for (const world of outcome.worlds) index.worlds.set(world.commitId, world)
  historyStore.setState((s) => {
    const commits = { ...s.commits }
    for (const commit of outcome.commits) commits[commit.id] = commit
    const branches = { ...s.branches }
    for (const branch of outcome.branches) branches[branch.id] = branch
    for (const [branchId, head] of Object.entries(outcome.heads)) {
      const branch = branches[branchId]
      if (branch) branches[branchId] = { ...branch, headCommit: head }
    }
    return { commits, branches }
  })
  for (const record of outcome.records) putRecord(record)
  dataStore.setState({ index: { ...index } })
}

/** 仅在数据就绪后渲染的组件中调用（WorkspaceShell 负责门控）。 */
export function useIndex(): WorkbenchIndex {
  const index = useStore(dataStore, (s) => s.index)
  if (!index) throw new Error("WorkbenchIndex 尚未加载")
  return index
}

export function getIndex(): WorkbenchIndex {
  const index = dataStore.getState().index
  if (!index) throw new Error("WorkbenchIndex 尚未加载")
  return index
}
