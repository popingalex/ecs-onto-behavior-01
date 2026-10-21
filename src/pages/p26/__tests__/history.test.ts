import assert from "node:assert/strict"
import type { BranchDef, CommitDef } from "@/core/types"
import {
  appendBranch,
  appendCommit,
  historyStore,
  initHistory,
  lineage,
} from "@/stores/history"

/**
 * P26 提交历史与分支的谱系语义：选历史只动 viewCommit（store 不变）；
 * 建分支只新增分支，推算提交只前进所在分支头。纯 store 测试，不触碰模型文档。
 */
const commit = (partial: Partial<CommitDef> & { id: string }): CommitDef => ({
  runId: "run-t",
  branchId: "main",
  parentId: null,
  round: 0,
  simTime: 0,
  summary: "",
  checkpoint: false,
  source: "computed",
  ...partial,
})

const branch = (partial: Partial<BranchDef> & { id: string }): BranchDef => ({
  runId: "run-t",
  label: partial.id,
  baseCommit: null,
  headCommit: "c001",
  visibility: "private",
  ...partial,
})

export function branchCreationKeepsOtherHeads() {
  initHistory(
    [branch({ id: "main" })],
    [commit({ id: "c001", simTime: 420 })],
  )
  appendBranch(
    branch({ id: "b-trial", headCommit: "c001", baseCommit: null }),
  )
  // 子分支上的推算提交只前进 b-trial，不动 main
  appendCommit(
    commit({ id: "c002", branchId: "b-trial", parentId: "c001", simTime: 430 }),
  )
  const s = historyStore.getState()
  assert.equal(s.branches.main.headCommit, "c001", "主分支头不受影响")
  assert.equal(s.branches["b-trial"].headCommit, "c002")
  // 同 id 建分支被忽略
  appendBranch(branch({ id: "b-trial", headCommit: "c001" }))
  assert.equal(historyStore.getState().branches["b-trial"].headCommit, "c002")
}

export function lineageCrossesForkPoint() {
  initHistory(
    [branch({ id: "main" }), branch({ id: "b-one", headCommit: "c001" })],
    [
      commit({ id: "c001", simTime: 420 }),
      commit({ id: "c002", branchId: "main", parentId: "c001", simTime: 430 }),
      commit({ id: "c101", branchId: "b-one", parentId: "c001", simTime: 430 }),
    ],
  )
  const commits = historyStore.getState().commits
  // 两条谱系共享分叉点之前的历史，但绝不包含对方的提交
  assert.deepEqual(
    lineage(commits, "c002").map((c) => c.id),
    ["c002", "c001"],
  )
  assert.deepEqual(
    lineage(commits, "c101").map((c) => c.id),
    ["c101", "c001"],
    "不同分支的同刻提交是两个 commit，不合并",
  )
  // 断链防御：parent 缺失时谱系截断而不是死循环
  assert.deepEqual(lineage(commits, "c999"), [])
}

export function appendCommitToUnknownBranchIgnored() {
  initHistory([branch({ id: "main" })], [commit({ id: "c001" })])
  appendCommit(commit({ id: "c777", branchId: "ghost", parentId: "c001" }))
  const s = historyStore.getState()
  assert.equal(s.commits.c777, undefined, "不存在分支的提交不入库")
  assert.equal(s.branches.main.headCommit, "c001")
}
