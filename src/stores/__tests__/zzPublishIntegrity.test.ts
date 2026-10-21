import assert from "node:assert/strict"
import { buildIndex } from "@/data/index"
import { dataStore } from "@/data/store"
import { loadSeed } from "@/mock/seed"
import { applyEdit, getDocument } from "@/stores/draftRegistry"
import { initHistory, historyStore } from "@/stores/history"
import {
  SYSTEMS_DOC,
  ensureModelDocuments,
  type SystemsContent,
} from "@/stores/modelDocuments"
import {
  currentModelHash,
  runIntegrityCheck,
} from "@/pages/p18/integrity"
import { nextBundleId, publishBundle, publishStore } from "@/stores/publish"
import { createRun, mergeCatalogRuns } from "@/stores/runCatalog"

/**
 * P18 校验与发布集成测试。zz 前缀是有意的：ensureModelDocuments 每个进程只注册一次，
 * 首次注册必须排在 draftRegistry.test.ts 的内存 localStorage 用例之后
 * （scripts/test.mjs 按路径排序，本文件在 stores/__tests__ 内按其名字排在 draftRegistry 之后）。
 */
export function integrityCheckTracksDraftHash() {
  ensureModelDocuments()
  const before = runIntegrityCheck()
  assert.equal(before.modelHash, currentModelHash(), "校验绑定当前组合哈希")
  const errorsBefore = before.diagnostics.filter((d) => d.severity === "error")

  // 篡改草稿：给 cool-A 加程序未声明的参数 → PARAMETER_UNKNOWN
  const doc = getDocument<SystemsContent>(SYSTEMS_DOC)!
  const original = doc.content
  applyEdit<SystemsContent>(SYSTEMS_DOC, "试验：未知参数", (c) => ({
    ...c,
    systems: c.systems.map((s) =>
      s.id === "cool-A"
        ? { ...s, parameters: { ...s.parameters, unknownParam: 1 } }
        : s,
    ),
  }))
  const tampered = runIntegrityCheck()
  assert.notEqual(
    tampered.modelHash,
    before.modelHash,
    "草稿变化必须使旧校验哈希过期",
  )
  assert.ok(
    tampered.diagnostics.some(
      (d) => d.severity === "error" && d.code === "PARAMETER_UNKNOWN",
    ),
    "篡改后校验必须报错，不能复用旧通过状态",
  )

  // 恢复草稿，避免影响同进程后续用例
  applyEdit<SystemsContent>(SYSTEMS_DOC, "试验恢复", () => original)
  const restored = runIntegrityCheck()
  assert.equal(restored.modelHash, before.modelHash)
  assert.equal(
    restored.diagnostics.filter((d) => d.severity === "error").length,
    errorsBefore.length,
  )
}

export function publishBundleIsImmutableAndIdempotent() {
  ensureModelDocuments()
  const run = runIntegrityCheck()
  const existing = publishStore.getState().bundles.map((b) => b.id)
  const id = nextBundleId([...existing, "bundle-04"])
  const bundle = {
    id,
    label: "测试发布",
    revision: existing.length + 1,
    createdAt: run.at,
    actorId: "test",
    modelHash: run.modelHash,
    manifest: [{ documentId: SYSTEMS_DOC, semanticHash: "x", revision: 0 }],
    warnings: 0,
  }
  const after = publishBundle(bundle)
  assert.ok(after.some((b) => b.id === id))
  const again = publishBundle({ ...bundle, label: "重复写入" })
  assert.equal(again.length, after.length, "同 id 重复发布被忽略")
  assert.equal(
    again.find((b) => b.id === id)?.label,
    "测试发布",
    "已发布 bundle 不可被覆盖",
  )
}

/** P19 新建运行闭环：登记后立即出现在运行索引与分支历史；根提交是基础世界克隆；不触发任何结算。 */
export function createRunIsListedAndDoesNotSettle() {
  const seed = loadSeed()
  dataStore.setState({ index: buildIndex(seed) })
  initHistory(seed.branches, seed.commits)
  const entry = createRun(
    {
      label: "试验运行",
      bundleId: "bundle-04",
      stepSeconds: 10,
      playbackSeconds: 1,
      runtime: "local-worker",
    },
    seed.worlds[0],
  )
  const index = dataStore.getState().index!
  assert.ok(index.runs.has(entry.run.id), "新运行应出现在运行列表")
  const branches = historyStore.getState().branches
  assert.ok(branches[entry.branchId], "主分支已建立")
  assert.equal(branches[entry.branchId].headCommit, entry.rootCommit)
  assert.equal(branches.main.headCommit, "c042", "不动既有分支头")
  // 根提交是基础世界的独立克隆，不产生任何新回合
  const world = index.worlds.get(entry.rootCommit)!
  assert.equal(world.values.F01["thermal.temperature"], 100)
  assert.notEqual(entry.rootCommit, "c042")
  // 刷新路径：重建后运行仍在（mergeCatalogRuns 幂等）
  initHistory(seed.branches, seed.commits)
  mergeCatalogRuns(seed.worlds[0])
  assert.ok(historyStore.getState().branches[entry.branchId])
}
