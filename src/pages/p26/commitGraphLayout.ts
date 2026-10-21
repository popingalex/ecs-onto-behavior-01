import type { BranchDef, CommitDef } from "@/core/types"

/** P26 提交 DAG 布局：泳道 = 分支，横轴 ≈ 模拟时刻。纯函数，供画布渲染与路由聚焦共用。 */
export interface CommitGraphLayout {
  laneH: number
  rows: Array<{ branch: BranchDef ;y: number ;commits: CommitDef[] }>
  pos: Map<string, { x: number ;y: number }>
  width: number
  height: number
}

export function commitGraphLayout(
  branches: BranchDef[],
  commits: Record<string, CommitDef>,
): CommitGraphLayout {
  const laneH = 72
  const rows = branches.map((b, i) => ({
    branch: b,
    y: 36 + i * laneH,
    // 画该分支名下的全部提交：谱系外的参考样例提交（如 c043）也保留在自己的泳道上。
    commits: Object.values(commits)
      .filter((c) => c.branchId === b.id)
      .sort((a, b2) => a.simTime - b2.simTime || a.id.localeCompare(b2.id)),
  }))
  const times = [
    ...new Set(rows.flatMap((r) => r.commits.map((c) => c.simTime))),
  ].sort((a, b) => a - b)
  const xOf = (t: number) => 90 + Math.max(0, times.indexOf(t)) * 130
  const pos = new Map<string, { x: number ;y: number }>()
  for (const r of rows)
    for (const c of r.commits) pos.set(c.id, { x: xOf(c.simTime), y: r.y })
  const width = xOf(times[times.length - 1] ?? 0) + 110
  const height = 36 + branches.length * laneH
  return { laneH, rows, pos, width, height }
}

/** viewCommit 路由参数 → 图上聚焦位置；提交不在图中（未画出的泳道）时为 null。 */
export function commitFocusPosition(
  layout: CommitGraphLayout,
  viewCommit: string | undefined,
): { x: number ;y: number } | null {
  if (!viewCommit) return null
  return layout.pos.get(viewCommit) ?? null
}
