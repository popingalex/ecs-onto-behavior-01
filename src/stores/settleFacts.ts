import { dataStore } from "@/data/store"
import type { SettleResult } from "@/services/executionAdapter"
import { appendCommit } from "./history"
import { persistCommitFacts } from "./persistence/historyPersistence"
import { putRecord } from "./trace"

/**
 * 成功提交的事实落地（W4）：先把完整 record 写入内存 trace store（幂等），
 * 再把 record + commit + world + branch head 作为单个原子事务写入本地持久层；
 * 只有持久化成功才更新世界快照并移动 commit/head——任何时刻都不暴露半提交。
 * 持久化失败时返回 ok:false，内存 head 与世界保持旧值（record 成为不可达的
 * 孤儿，不会经任何提交被查阅）。与 session.ts 分离以便无路由环境（测试）复用。
 */
export async function applySettleFacts(
  result: Extract<SettleResult, { ok: true }>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  putRecord(result.record)
  const persisted = await persistCommitFacts({
    commit: result.commit,
    world: result.world,
    record: result.record,
  })
  if (!persisted.ok) return { ok: false, message: persisted.message }
  const index = dataStore.getState().index
  if (index) {
    index.worlds.set(result.world.commitId, result.world)
    dataStore.setState({ index: { ...index } })
  }
  appendCommit(result.commit)
  return { ok: true }
}
