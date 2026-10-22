import { dataStore, loadWorkbench } from "@/data/store"
import { loadSeed } from "@/mock/seed"
import { mockExecutorAdapter } from "@/services/executionAdapter"
import { historyStore } from "@/stores/history"
import { applySettleFacts } from "@/stores/settleFacts"
import { traceStore } from "@/stores/trace"
import {
  persistenceStore,
  restoreHistory,
  setHistoryStorageForTests,
} from "./historyPersistence"
import { MemoryHistoryStorage } from "./memory"
import { HISTORY_STORES } from "./storage"

/**
 * W4 体积与恢复基线（design/03 §8 W4.4「可衡量的体积与响应基线」）。
 * 由 scripts/persistence-baseline.mjs 驱动；用内存存储量 JSON 序列化体积
 * （IndexedDB 实际另有少量记录开销，数量级一致），恢复耗时分
 * 「纯 restoreHistory 校验」与「完整 loadWorkbench 冷启动」两档。
 */
function resetStores() {
  historyStore.setState({ branches: {}, commits: {} })
  traceStore.setState({ records: {}, byCommit: {}, byBranch: {}, order: [] })
  dataStore.setState({ status: "idle", index: null, error: null })
}

function kb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KiB`
}

export async function runPersistenceBaseline(): Promise<string> {
  const lines: string[] = [
    `W4 持久化基线 · ${new Date().toISOString()} · 内存存储 + 真实 executeRound（main 分支连续推算）`,
    "",
  ]
  for (const target of [10, 100]) {
    const storage = new MemoryHistoryStorage()
    setHistoryStorageForTests(storage)
    resetStores()
    await loadWorkbench()

    let base = "c042"
    const writeStart = performance.now()
    for (let i = 0; i < target; i++) {
      const out = await mockExecutorAdapter.settle({
        runId: "run-main",
        branchId: "main",
        baseCommit: base,
        idempotencyKey: `baseline:${target}:${i}`,
      })
      if (!out.ok) throw new Error(out.diagnostic.message)
      const applied = await applySettleFacts(out)
      if (!applied.ok) throw new Error(applied.message)
      base = out.commit.id
    }
    const writeMs = performance.now() - writeStart

    const sizes = new Map<string, number>()
    let total = 0
    for (const name of HISTORY_STORES) {
      let bytes = 0
      for (const [key, value] of storage.tables[name])
        bytes += key.length + JSON.stringify(value).length
      sizes.set(name, bytes)
      total += bytes
    }

    // 纯恢复校验：可信集合只含种子/目录提交（与 loadWorkbench 内部一致），
    // 必须在 reload 之前测，否则恢复结果已进入 historyStore 而被当成可信终点。
    resetStores()
    const seed = loadSeed()
    const restoreStart = performance.now()
    const outcome = await restoreHistory({
      trustedCommitIds: new Set(seed.commits.map((c) => c.id)),
      trustedWorldIds: new Set(seed.worlds.map((w) => w.commitId)),
      trustedBranchIds: new Set(seed.branches.map((b) => b.id)),
    })
    const restoreMs = performance.now() - restoreStart

    resetStores()
    const reloadStart = performance.now()
    await loadWorkbench()
    const reloadMs = performance.now() - reloadStart

    lines.push(
      `== ${target} 次提交 ==`,
      `  写入：共 ${writeMs.toFixed(0)} ms（平均 ${(writeMs / target).toFixed(1)} ms/提交，含 executeRound 求值）`,
      `  体积：合计 ${kb(total)}（平均 ${(total / 1024 / target).toFixed(1)} KiB/提交）`,
      ...[...sizes.entries()].map(
        ([name, bytes]) => `    ${name.padEnd(9)} ${kb(bytes)}`,
      ),
      `  恢复：纯校验 ${restoreMs.toFixed(1)} ms；完整 loadWorkbench 冷启动 ${reloadMs.toFixed(0)} ms（含种子适配器 260ms 人工延迟）`,
      `  结果：mode=${persistenceStore.getState().mode}，恢复 ${outcome.restoredCommits} 提交，孤儿 ${outcome.orphanFacts}`,
      "",
    )
  }
  return lines.join("\n")
}
