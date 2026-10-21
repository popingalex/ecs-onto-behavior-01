import type { BranchDef, CommitDef } from "@/core/types"
import { createStore, useStore } from "@/lib/store"

/**
 * HistoryStore：分支与提交。提交不可变；只有分支 head 会前移。
 * 选择历史提交只改路由中的 viewCommit，不覆盖分支 head。
 */
interface HistoryState {
  branches: Record<string, BranchDef>
  commits: Record<string, CommitDef>
}

export const historyStore = createStore<HistoryState>({
  branches: {},
  commits: {},
})

export function initHistory(branches: BranchDef[], commits: CommitDef[]) {
  historyStore.setState({
    branches: Object.fromEntries(branches.map((b) => [b.id, b])),
    commits: Object.fromEntries(commits.map((c) => [c.id, c])),
  })
}

export function appendCommit(commit: CommitDef) {
  historyStore.setState((s) => {
    const branch = s.branches[commit.branchId]
    if (!branch) return {}
    return {
      commits: { ...s.commits, [commit.id]: commit },
      branches: {
        ...s.branches,
        [branch.id]: { ...branch, headCommit: commit.id },
      },
    }
  })
}

/** 建立新分支：head 固定为 fromCommit；同 id 忽略。不影响任何现有分支头。 */
export function appendBranch(branch: BranchDef) {
  historyStore.setState((s) =>
    s.branches[branch.id]
      ? {}
      : { branches: { ...s.branches, [branch.id]: branch } },
  )
}

export function useBranches() {
  return useStore(historyStore, (s) => s.branches)
}

export function useCommits() {
  return useStore(historyStore, (s) => s.commits)
}

/** 从 head 沿 parent 回溯；跨分支的祖先也包含在内（分叉点之前的共同历史）。 */
export function lineage(
  commits: Record<string, CommitDef>,
  headId: string,
): CommitDef[] {
  const out: CommitDef[] = []
  let cursor: string | null = headId
  const seen = new Set<string>()
  while (cursor && commits[cursor] && !seen.has(cursor)) {
    seen.add(cursor)
    out.push(commits[cursor])
    cursor = commits[cursor].parentId
  }
  return out
}
