import {
  HISTORY_STORES,
  type HistoryStorage,
  type HistoryStoreName,
  type StoreEntry,
} from "./storage"

/**
 * 内存实现：node 测试环境与 IndexedDB 不可用时的回退。
 * transact 先在克隆表上暂存、beforeCommit 钩子通过后再整体换入，
 * 忠实模拟“事务中途失败则全部回滚”的原子语义；测试可覆盖 beforeCommit 注入故障。
 * tables 公开给测试做故障注入（直接写入无 marker 的孤儿事实等）。
 */
export class MemoryHistoryStorage implements HistoryStorage {
  readonly kind = "memory"
  readonly tables: Record<HistoryStoreName, Map<string, unknown>> =
    Object.fromEntries(
      HISTORY_STORES.map((name) => [name, new Map<string, unknown>()]),
    ) as Record<HistoryStoreName, Map<string, unknown>>

  open(): Promise<void> {
    return Promise.resolve()
  }

  /** 事务提交前的钩子；测试覆盖它抛错即可模拟中途失败（暂存被丢弃）。 */
  protected beforeCommit(): void {}

  get(store: HistoryStoreName, key: string): Promise<unknown> {
    return Promise.resolve(this.tables[store].get(key) ?? null)
  }

  getAll(store: HistoryStoreName): Promise<StoreEntry[]> {
    return Promise.resolve(
      [...this.tables[store].entries()].map(([key, value]) => ({
        store,
        key,
        value,
      })),
    )
  }

  put(store: HistoryStoreName, key: string, value: unknown): Promise<void> {
    return this.transact([{ store, key, value }])
  }

  transact(ops: StoreEntry[]): Promise<void> {
    const touched = [...new Set(ops.map((op) => op.store))]
    const staged = new Map(
      touched.map((name) => [name, new Map(this.tables[name])]),
    )
    for (const op of ops) staged.get(op.store)!.set(op.key, op.value)
    this.beforeCommit()
    for (const [name, table] of staged) this.tables[name] = table
    return Promise.resolve()
  }

  clear(): Promise<void> {
    for (const name of HISTORY_STORES) this.tables[name].clear()
    return Promise.resolve()
  }

  ensureHead(branchId: string, commitId: string): Promise<void> {
    if (!this.tables.heads.has(branchId))
      this.tables.heads.set(branchId, commitId)
    return Promise.resolve()
  }
}
