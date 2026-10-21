import { createStore, useStore } from "@/lib/store"
import { seedDataAdapter, type DataAdapter } from "./adapter"
import { buildIndex, type WorkbenchIndex } from "./index"
import { registerReferenceSamples } from "./referenceSamples"
import { initHistory } from "@/stores/history"
import { ensureModelDocuments } from "@/stores/modelDocuments"
import { mergeCatalogRuns } from "@/stores/runCatalog"

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
  adapter: seedDataAdapter,
})

export async function loadWorkbench(): Promise<void> {
  const { adapter } = dataStore.getState()
  dataStore.setState({ status: "loading", error: null })
  try {
    const raw = await adapter.load()
    const index = buildIndex(raw)
    initHistory(raw.branches, raw.commits)
    // 数据就绪后登记 v0.5 草稿文档（并恢复本地存档），不在渲染期间写 store。
    ensureModelDocuments()
    // 参考样例（expected_runs）：注册为“查看样例”的预置回合与只读过程记录。
    registerReferenceSamples()
    // P19 在本浏览器创建的运行：重建其根提交与主分支。
    mergeCatalogRuns(raw.worlds[0])
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
