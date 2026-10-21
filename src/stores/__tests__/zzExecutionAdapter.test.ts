import assert from "node:assert/strict"
import { buildIndex } from "@/data/index"
import { loadSeed } from "@/mock/seed"
import { dataStore } from "@/data/store"
import { initHistory } from "@/stores/history"
import {
  hasPrecomputedRound,
  mockExecutorAdapter,
  referenceAdapter,
} from "@/services/executionAdapter"
import { registerReferenceSamples } from "@/data/referenceSamples"
import { applyEdit, getDocument } from "@/stores/draftRegistry"
import {
  programDocId,
  type ProgramContent,
} from "@/stores/modelDocuments"
import { getRecordByCommit } from "@/stores/trace"

/**
 * M4 适配器接线测试。文件名 zz 前缀是有意的：composeModel("saved") 依赖
 * ensureModelDocuments 的首次注册发生在 draftRegistry.test.ts 的内存 localStorage
 * 用例之后（scripts/test.mjs 按路径排序），本文件排在其后运行。
 */
function seedStores() {
  const seed = loadSeed()
  dataStore.setState({ index: buildIndex(seed) })
  initHistory(seed.branches, seed.commits)
  registerReferenceSamples()
}

/** 成功路径：mock 执行器对当前已保存模型真实求值，commit.source = computed。 */
export async function mockExecutorAdapterComputesBaseline() {
  seedStores()
  const out = await mockExecutorAdapter.settle({
    runId: "run-main",
    branchId: "main",
    baseCommit: "c042",
    idempotencyKey: "t:baseline",
  })
  assert.ok(out.ok, `settle 失败：${out.ok === false ? out.diagnostic.message : ""}`)
  assert.equal(out.commit.source, "computed")
  assert.equal(out.commit.parentId, "c042")
  assert.equal(out.world.values.F01["thermal.temperature"], 20)
  assert.equal(out.record.origin, "computed")
  assert.equal(out.record.record.baseCommit, "c042")
  assert.equal(out.record.record.resultCommit, out.commit.id)
  assert.equal(out.record.record.elapsedMs, null)
  assert.ok(out.record.record.inputVersions["program:g-cool"])
  assert.equal(out.record.decisions.length, 3)
}

/** 失败路径：草稿试算断开必需连接后 settle 返回诊断，不产生提交/世界/记录。 */
export async function mockExecutorAdapterDraftFailureKeepsBase() {
  seedStores()
  // 断掉 n-neg→n-emit（error_cases missing-input）：草稿试算必须报诊断而不是播放预置成功
  const pid = programDocId("g-cool")
  const before = getDocument<ProgramContent>(pid)!
  applyEdit<ProgramContent>(pid, "断开必需连线（试验）", (c) => ({
    ...c,
    program: {
      ...c.program,
      edges: c.program.edges.filter((e) => e.target.nodeId !== "n-emit"),
    },
  }))
  const out = await mockExecutorAdapter.settle({
    runId: "run-main",
    branchId: "main",
    baseCommit: "c042",
    idempotencyKey: "t:broken",
    modelView: "draft",
  })
  assert.equal(out.ok, false)
  if (!out.ok) {
    assert.equal(out.diagnostic.severity, "error")
    assert.ok(
      out.diagnostic.message.includes("分支头保持 c042"),
      out.diagnostic.message,
    )
  }
  // 恢复草稿，避免影响同进程后续用例
  applyEdit<ProgramContent>(pid, "恢复（试验）", () => before.content)
  const restored = getDocument<ProgramContent>(pid)!
  assert.equal(restored.content.program.edges.length, 4)
}

/** 参考样例路径：referenceAdapter 只查预置样例并明确标注来源。 */
export async function referenceAdapterServesSampleOnly() {
  seedStores()
  assert.equal(hasPrecomputedRound("main", "c042"), true)
  const out = await referenceAdapter.settle({
    runId: "run-main",
    branchId: "main",
    baseCommit: "c042",
    idempotencyKey: "t:sample",
  })
  assert.ok(out.ok)
  assert.equal(out.commit.source, "reference-sample")
  assert.equal(out.commit.id, "c043")
  assert.equal(out.record.origin, "reference-sample")
  assert.equal(out.world.values.F01["thermal.temperature"], 20)
  // 样例记录已登记，可按提交查阅
  assert.equal(getRecordByCommit("c043")?.record.id, "record-baseline")

  const miss = await referenceAdapter.settle({
    runId: "run-main",
    branchId: "main",
    baseCommit: "c999",
    idempotencyKey: "t:miss",
  })
  assert.equal(miss.ok, false)
  if (!miss.ok) assert.equal(miss.diagnostic.code, "REFERENCE_RESULT_MISSING")
}
