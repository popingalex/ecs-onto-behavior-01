import assert from "node:assert/strict"
import type { BranchDef, CommitDef } from "@/core/types"
import { dataStore, loadWorkbench } from "@/data/store"
import { createAttribute, deleteAttribute } from "@/features/ecs/operations"
import { mockExecutorAdapter } from "@/services/executionAdapter"
import type { RoundResult } from "@/services/mock-executor"
import { applyEdit } from "@/stores/draftRegistry"
import { appendBranch, historyStore, lineage } from "@/stores/history"
import { composeModel, SCHEMA_DOC, type SchemaContent } from "@/stores/modelDocuments"
import {
  HISTORY_SCHEMA_VERSION,
  persistNewBranch,
  persistenceStore,
  restoreHistory,
  setHistoryStorageForTests,
} from "@/stores/persistence/historyPersistence"
import { MemoryHistoryStorage } from "@/stores/persistence/memory"
import { nextBundleId, publishBundle, publishStore } from "@/stores/publish"
import { createRun, runCatalogStore } from "@/stores/runCatalog"
import { applySettleFacts } from "@/stores/settleFacts"
import { getRecordByCommit, traceStore } from "@/stores/trace"

/**
 * W4 本地运行历史持久化测试。zz 前缀是加载顺序约束（scripts/test.mjs 按路径排序）：
 * composeModel("saved") 依赖 draftRegistry / zzExecutionAdapter 用例先行注册文档。
 * 持久层用内存实现注入（node 无 IndexedDB）；“刷新”= 清空内存 store 后重走 loadWorkbench。
 */
function freshStorage(): MemoryHistoryStorage {
  const storage = new MemoryHistoryStorage()
  setHistoryStorageForTests(storage)
  return storage
}

/** 模拟刷新：内存 store 归零；持久层（注入的 storage）保留。
 *  默认同时清空运行目录（等价 localStorage 丢失）；keepCatalog 模拟目录幸存。 */
function resetInMemory(options: { keepCatalog?: boolean } = {}) {
  historyStore.setState({ branches: {}, commits: {} })
  traceStore.setState({ records: {}, byCommit: {}, byBranch: {}, order: [] })
  dataStore.setState({ status: "idle", index: null, error: null })
  if (!options.keepCatalog) runCatalogStore.setState({ runs: [] })
}

let settleSeq = 0

async function settleOn(branchId: string, baseCommit: string, runId = "run-main") {
  const out = await mockExecutorAdapter.settle({
    runId,
    branchId,
    baseCommit,
    idempotencyKey: `t:persist:${++settleSeq}`,
  })
  assert.ok(out.ok, `settle 失败：${out.ok ? "" : out.diagnostic.message}`)
  const applied = await applySettleFacts(out)
  assert.ok(applied.ok, `applySettleFacts 失败：${applied.ok ? "" : applied.message}`)
  return out
}

/** 首次初始化：meta 判空 → 写版本标记；种子正常装配，不覆盖任何东西。 */
export async function firstInitWritesSchemaVersion() {
  const storage = freshStorage()
  resetInMemory()
  await loadWorkbench()
  assert.equal(persistenceStore.getState().mode, "first-init")
  assert.equal(
    await storage.get("meta", "historySchemaVersion"),
    HISTORY_SCHEMA_VERSION,
  )
  assert.equal(historyStore.getState().branches.main.headCommit, "c042")
}

/** 提交后“刷新”：commits / trace / branches / head / world 全恢复。 */
export async function commitSurvivesReload() {
  freshStorage()
  resetInMemory()
  await loadWorkbench()
  const out = await settleOn("main", "c042")
  const head = out.commit.id

  resetInMemory()
  await loadWorkbench()
  const status = persistenceStore.getState()
  assert.equal(status.mode, "restored")
  assert.equal(status.restoredCommits, 1)
  const history = historyStore.getState()
  assert.equal(history.branches.main.headCommit, head)
  assert.equal(history.commits[head]?.parentId, "c042")
  assert.equal(getRecordByCommit(head)?.record.id, out.record.record.id)
  assert.deepEqual(
    dataStore.getState().index!.worlds.get(head)?.values,
    out.world.values,
  )
}

/** R1→改参 R2：各自世界快照与过程记录在恢复后独立保持。 */
export async function twoRoundsKeepIndependentSnapshots() {
  freshStorage()
  resetInMemory()
  await loadWorkbench()
  const r1 = await settleOn("main", "c042")
  const r2 = await settleOn("main", r1.commit.id)
  assert.notEqual(r1.commit.id, r2.commit.id)

  resetInMemory()
  await loadWorkbench()
  const index = dataStore.getState().index!
  assert.deepEqual(index.worlds.get(r1.commit.id)?.values, r1.world.values)
  assert.deepEqual(index.worlds.get(r2.commit.id)?.values, r2.world.values)
  // 两个回合的模拟时刻各自保持（值可能已收敛到目标，时刻必然不同）。
  assert.notEqual(r1.world.simTime, r2.world.simTime)
  assert.equal(
    index.worlds.get(r1.commit.id)?.simTime,
    r1.world.simTime,
  )
  assert.equal(
    index.worlds.get(r2.commit.id)?.simTime,
    r2.world.simTime,
  )
  assert.equal(getRecordByCommit(r1.commit.id)?.record.id, r1.record.record.id)
  assert.equal(getRecordByCommit(r2.commit.id)?.record.id, r2.record.record.id)
  assert.notEqual(
    getRecordByCommit(r1.commit.id)?.record.id,
    getRecordByCommit(r2.commit.id)?.record.id,
  )
  assert.equal(persistenceStore.getState().restoredCommits, 2)
}

/** R1 建分支 B 续算 R3：恢复后 A/B head 与共同祖先正确。 */
export async function branchContinuationSurvivesReload() {
  freshStorage()
  resetInMemory()
  await loadWorkbench()
  const r1 = await settleOn("main", "c042")
  const branch: BranchDef = {
    id: "branch-persist-test",
    runId: "run-main",
    label: "持久化测试分支",
    baseCommit: "c042",
    headCommit: r1.commit.id,
    visibility: "private",
  }
  appendBranch(branch)
  const persisted = await persistNewBranch(branch)
  assert.ok(persisted.ok)
  const r3 = await settleOn("branch-persist-test", r1.commit.id)

  resetInMemory()
  await loadWorkbench()
  const history = historyStore.getState()
  assert.equal(history.branches.main.headCommit, r1.commit.id)
  assert.equal(history.branches["branch-persist-test"]?.headCommit, r3.commit.id)
  assert.equal(history.commits[r3.commit.id]?.parentId, r1.commit.id)
  // 共同祖先：两条谱系都含 r1 与 c042；main 谱系不含 R3。
  const mainLine = lineage(history.commits, r1.commit.id).map((c) => c.id)
  const branchLine = lineage(history.commits, r3.commit.id).map((c) => c.id)
  assert.ok(branchLine.includes(r1.commit.id) && branchLine.includes("c042"))
  assert.ok(!mainLine.includes(r3.commit.id))
  assert.ok(getRecordByCommit(r3.commit.id))
}

/** 历史查看不移动 head：谱系回溯后内存与持久层 head 都不变。 */
export async function viewingHistoryDoesNotMoveHead() {
  const storage = freshStorage()
  resetInMemory()
  await loadWorkbench()
  const r1 = await settleOn("main", "c042")
  resetInMemory()
  await loadWorkbench()
  const before = historyStore.getState().branches.main.headCommit
  assert.equal(before, r1.commit.id)
  // “查看”旧提交：只读回溯，不产生任何写入。
  const viewed = lineage(historyStore.getState().commits, "c042")
  assert.ok(viewed.length > 0)
  assert.equal(historyStore.getState().branches.main.headCommit, before)
  assert.equal(await storage.get("heads", "main"), before)
}

/** 故障注入：事务中途抛错 → 旧 head 保持、提交/世界不落地、诊断可见。 */
export async function failedTransactionKeepsOldHead() {
  class FailingStorage extends MemoryHistoryStorage {
    protected beforeCommit(): void {
      throw new Error("injected quota failure")
    }
  }
  freshStorage()
  resetInMemory()
  await loadWorkbench()
  const r1 = await settleOn("main", "c042")
  // 换上“写入即失败”的存储（持久层已有 r1；这里模拟磁盘开始拒绝写入）。
  setHistoryStorageForTests(new FailingStorage())
  const out = await mockExecutorAdapter.settle({
    runId: "run-main",
    branchId: "main",
    baseCommit: r1.commit.id,
    idempotencyKey: "t:persist:failure",
  })
  assert.ok(out.ok)
  const applied = await applySettleFacts(out)
  assert.equal(applied.ok, false)
  if (!applied.ok) assert.ok(applied.message.includes("injected quota failure"))
  // 内存层：head 与世界保持旧值，提交未落地。
  const history = historyStore.getState()
  assert.equal(history.branches.main.headCommit, r1.commit.id)
  assert.equal(history.commits[out.commit.id], undefined)
  assert.equal(
    dataStore.getState().index!.worlds.get(out.commit.id),
    undefined,
  )
  // 诊断可见：状态面记录失败，供 UI 警示与重试。
  assert.ok(persistenceStore.getState().failure?.message.includes("injected"))
}

/** 孤儿事实（无 marker、head 未指向）：恢复时不暴露，计数为诊断。 */
export async function orphanFactsWithoutMarkerNotExposed() {
  const storage = freshStorage()
  resetInMemory()
  await loadWorkbench()
  const r1 = await settleOn("main", "c042")
  // 直接写孤儿 facts：提交/世界/记录，但不写 marker、不移动 head（模拟中断残留）。
  const orphanCommit: CommitDef = {
    ...structuredClone(r1.commit),
    id: "c999",
    summary: "孤儿提交（测试注入）",
  }
  const orphanRecord = structuredClone(r1.record) as RoundResult
  orphanRecord.record = {
    ...orphanRecord.record,
    id: "record-c999",
    resultCommit: "c999",
  }
  await storage.put("commits", "c999", orphanCommit)
  await storage.put("worlds", "c999", { commitId: "c999", values: {} })
  await storage.put("records", "record-c999", orphanRecord)

  resetInMemory()
  await loadWorkbench()
  const status = persistenceStore.getState()
  assert.equal(status.mode, "restored")
  assert.equal(historyStore.getState().commits.c999, undefined)
  assert.equal(getRecordByCommit("c999"), undefined)
  assert.equal(status.orphanFacts, 2)
  assert.ok(status.diagnostics.some((d) => d.includes("孤儿")))
}

/** head 指向的提交缺 marker：一致性校验失败 → 拒绝恢复并回退种子，不静默混用。 */
export async function missingMarkerFallsBackToSeed() {
  const storage = freshStorage()
  resetInMemory()
  await loadWorkbench()
  const r1 = await settleOn("main", "c042")
  storage.tables.meta.delete(`marker:${r1.commit.id}`)

  resetInMemory()
  await loadWorkbench()
  const status = persistenceStore.getState()
  assert.equal(status.mode, "fallback-seed")
  assert.equal(historyStore.getState().branches.main.headCommit, "c042")
  assert.equal(historyStore.getState().commits[r1.commit.id], undefined)
  assert.ok(status.diagnostics.some((d) => d.includes("marker")))
}

/** historySchemaVersion 不符：拒绝恢复、回退种子、诊断明示（本轮无迁移表）。 */
export async function schemaVersionMismatchRejectsRestore() {
  const storage = freshStorage()
  resetInMemory()
  await loadWorkbench()
  const r1 = await settleOn("main", "c042")
  await storage.put("meta", "historySchemaVersion", 999)

  resetInMemory()
  await loadWorkbench()
  const status = persistenceStore.getState()
  assert.equal(status.mode, "rejected-version")
  assert.equal(historyStore.getState().branches.main.headCommit, "c042")
  assert.equal(historyStore.getState().commits[r1.commit.id], undefined)
  assert.ok(status.diagnostics.some((d) => d.includes("999")))
}

/** 种子不覆盖已有本地世界：二次启动仍走恢复路径，数据不重复、不回退。 */
export async function seedDoesNotOverwriteExistingWorld() {
  freshStorage()
  resetInMemory()
  await loadWorkbench()
  const r1 = await settleOn("main", "c042")

  resetInMemory()
  await loadWorkbench()
  assert.equal(persistenceStore.getState().mode, "restored")
  assert.deepEqual(
    dataStore.getState().index!.worlds.get(r1.commit.id)?.values,
    r1.world.values,
  )
  // 再次“刷新”：恢复结果稳定，种子不会盖掉已恢复的世界与 head。
  resetInMemory()
  await loadWorkbench()
  const status = persistenceStore.getState()
  assert.equal(status.mode, "restored")
  assert.equal(status.restoredCommits, 1)
  assert.equal(
    historyStore.getState().branches.main.headCommit,
    r1.commit.id,
  )
  assert.deepEqual(
    dataStore.getState().index!.worlds.get(r1.commit.id)?.values,
    r1.world.values,
  )
}

/** 恢复接口本身：可信集合（种子/目录提交）之外的断链会被拒绝而不是半截混入。 */
export async function restoreRejectsBrokenChain() {
  const storage = freshStorage()
  resetInMemory()
  await loadWorkbench()
  const r1 = await settleOn("main", "c042")
  storage.tables.commits.delete(r1.commit.id) // head 指向一个已丢失的提交
  const outcome = await restoreHistory({
    trustedCommitIds: new Set(["c042"]),
    trustedWorldIds: new Set(["c042"]),
    trustedBranchIds: new Set(["main"]),
  })
  assert.equal(outcome.mode, "fallback-seed")
  assert.ok(outcome.diagnostics.some((d) => d.includes("断裂")))
  assert.equal(outcome.commits.length, 0)
}

/** W2 回归 Bug1 复现路径：计算提交 → 发布 bundle → 新建运行 → 新建并删除属性 →
 *  刷新必须正常恢复（计算提交保留），不得触发回退种子。 */
export async function publishRunAttributeEditFlowRestores() {
  freshStorage()
  resetInMemory()
  await loadWorkbench()
  const r1 = await settleOn("main", "c042")

  // P18 发布 bundle（本地发布列表与种子 bundles 分离，不影响恢复）。
  publishBundle({
    id: nextBundleId(publishStore.getState().bundles.map((b) => b.id)),
    label: "W2 回归包",
    revision: 1,
    createdAt: new Date().toISOString(),
    actorId: "u-test",
    modelHash: "hash-test",
    manifest: [],
    warnings: 0,
  })
  // P19 新建运行：登记目录、重建根提交并持久化根事实。
  const entry = createRun(
    {
      label: "W2 回归运行",
      bundleId: publishStore.getState().bundles.at(-1)!.id,
      stepSeconds: 10,
      playbackSeconds: 1,
      runtime: "server",
    },
    dataStore.getState().index!.seed.worlds[0],
  )
  // P29/P03：新建属性再删除（草稿操作，不触碰历史）。
  applyEdit<SchemaContent>(SCHEMA_DOC, "新建属性（回归）", (c) => {
    const r = createAttribute(c, {
      id: "thermal.w2regression",
      componentId: c.components[0].id,
      label: "回归属性",
      type: {
        shape: "scalar",
        primitive: "f64",
        unitId: undefined,
        nullable: true,
      },
      default: null,
      writeMode: "configuration",
    })
    if (!r.ok) throw new Error(r.message)
    return r.content
  })
  applyEdit<SchemaContent>(SCHEMA_DOC, "删除属性（回归）", (c) => {
    const r = deleteAttribute(composeModel("saved"), c, "thermal.w2regression")
    if (!r.ok) throw new Error(r.message)
    return r.content
  })

  resetInMemory({ keepCatalog: true })
  await loadWorkbench()
  const status = persistenceStore.getState()
  assert.equal(status.mode, "restored", status.diagnostics.join("；"))
  const history = historyStore.getState()
  assert.equal(history.branches.main.headCommit, r1.commit.id)
  assert.ok(history.commits[r1.commit.id], "计算提交必须保留")
  assert.ok(getRecordByCommit(r1.commit.id))
  // 目录运行与其根提交一并恢复。
  assert.ok(history.branches[entry.branchId], "目录分支必须恢复")
  assert.equal(
    history.branches[entry.branchId].headCommit,
    entry.rootCommit,
  )
}

/** 目录运行分支上续算后，目录完好时刷新：根提交与续算提交全恢复。 */
export async function catalogRunBranchFullyRestores() {
  freshStorage()
  resetInMemory()
  await loadWorkbench()
  const r1 = await settleOn("main", "c042")
  const entry = createRun(
    {
      label: "目录分支恢复测试",
      bundleId: "bundle-04",
      stepSeconds: 10,
      playbackSeconds: 1,
      runtime: "server",
    },
    dataStore.getState().index!.seed.worlds[0],
  )
  const r2 = await settleOn(entry.branchId, entry.rootCommit, entry.run.id)

  resetInMemory({ keepCatalog: true })
  await loadWorkbench()
  const status = persistenceStore.getState()
  assert.equal(status.mode, "restored", status.diagnostics.join("；"))
  const history = historyStore.getState()
  assert.equal(history.branches.main.headCommit, r1.commit.id)
  assert.equal(history.branches[entry.branchId]?.headCommit, r2.commit.id)
  assert.equal(history.commits[r2.commit.id]?.parentId, entry.rootCommit)
  assert.ok(history.commits[entry.rootCommit], "根提交必须恢复")
  assert.equal(status.restoredCommits, 3)
  assert.ok(getRecordByCommit(r2.commit.id))
}

/** 运行目录（localStorage）丢失而 IDB 事实还在：只隔离该分支（定义不可考），
 *  其余分支照常恢复——不得整库回退种子。 */
export async function catalogLossQuarantinesUnknownBranch() {
  freshStorage()
  resetInMemory()
  await loadWorkbench()
  const r1 = await settleOn("main", "c042")
  const entry = createRun(
    {
      label: "目录丢失隔离测试",
      bundleId: "bundle-04",
      stepSeconds: 10,
      playbackSeconds: 1,
      runtime: "server",
    },
    dataStore.getState().index!.seed.worlds[0],
  )
  const r2 = await settleOn(entry.branchId, entry.rootCommit, entry.run.id)

  // 目录丢失：resetInMemory 默认清空目录条目（等价 localStorage 被清），IDB 保留。
  resetInMemory()
  await loadWorkbench()
  const status = persistenceStore.getState()
  assert.equal(
    status.mode,
    "restored",
    `目录丢失不得触发回退：${status.diagnostics.join("；")}`,
  )
  const history = historyStore.getState()
  // 已知分支完好恢复。
  assert.equal(history.branches.main.headCommit, r1.commit.id)
  assert.ok(history.commits[r1.commit.id])
  // 定义不可考的分支：head 不恢复、提交保留为孤儿档案（不暴露），诊断响亮。
  assert.equal(history.branches[entry.branchId], undefined)
  assert.equal(history.commits[r2.commit.id], undefined)
  assert.ok(
    status.diagnostics.some(
      (d) => d.includes("定义已不可考") && d.includes(entry.branchId),
    ),
    status.diagnostics.join("；"),
  )
  assert.ok(status.orphanFacts >= 2)
}
