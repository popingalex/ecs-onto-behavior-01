import { useMemo } from 'react'
import type { BranchDef, CommitDef, Route, RunDef, WorkbenchMode } from '@/core/types'
import { useIndex } from '@/data/store'
import { GROUP_BY_ID, type GroupSpec } from '@/navigation/groups'
import { PAGE_SPECS, type PageSpec } from '@/navigation/pages'
import { routeKey } from '@/router/route'
import { useRoute } from '@/router/router'
import { useBranches, useCommits } from '@/stores/history'

/**
 * 当前上下文（ContextStore 的路由派生部分）：模式、运行、分支、viewCommit、head。
 * 历史查看 = viewCommit 不是所在分支的 head；只有显式“回到最新”才改变。
 */
export interface WorkbenchContext {
  route: Route
  spec: PageSpec
  group: GroupSpec
  mode: WorkbenchMode
  run: RunDef | null
  branch: BranchDef | null
  viewCommit: CommitDef | null
  headCommit: CommitDef | null
  contextKey: string
}

export function resolveContext(
  route: Route,
  runs: Map<string, RunDef>,
  branches: Record<string, BranchDef>,
  commits: Record<string, CommitDef>,
): WorkbenchContext {
  const spec = PAGE_SPECS[route.pageId]
  const viewCommit = (route.params.viewCommit && commits[route.params.viewCommit]) || null
  const branch = (route.params.branchId && branches[route.params.branchId]) || (viewCommit ? branches[viewCommit.branchId] : null) || null
  const run = (route.params.runId && runs.get(route.params.runId)) || (branch ? runs.get(branch.runId) : null) || null
  const headCommit = branch ? (commits[branch.headCommit] ?? null) : null

  let mode: WorkbenchMode
  if (viewCommit && headCommit && viewCommit.id !== headCommit.id) mode = 'history'
  else if (spec.context === 'project') mode = 'overview'
  else if (spec.context === 'asset') mode = 'edit'
  else mode = 'run'

  return { route, spec, group: GROUP_BY_ID[spec.group], mode, run, branch, viewCommit, headCommit, contextKey: routeKey(route) }
}

export function useWorkbenchContext(): WorkbenchContext {
  const route = useRoute()
  const index = useIndex()
  const branches = useBranches()
  const commits = useCommits()
  return useMemo(() => resolveContext(route, index.runs, branches, commits), [route, index.runs, branches, commits])
}
