/**
 * 历史持久化的存储接口（W4）。对象存取：commits / worlds / records / branches /
 * heads（branchId → headCommitId）/ meta（schema 版本、commit marker、恢复诊断）。
 * 浏览器用 IndexedDB 原生封装（idb.ts）；测试与 IndexedDB 不可用时用内存实现（memory.ts）。
 * 草稿持久化（draftRegistry 的 localStorage 键）与本键空间完全隔离，undo 不混。
 */
export const HISTORY_STORES = [
  "commits",
  "worlds",
  "records",
  "branches",
  "heads",
  "meta",
] as const

export type HistoryStoreName = (typeof HISTORY_STORES)[number]

export interface StoreEntry {
  store: HistoryStoreName
  key: string
  value: unknown
}

export interface HistoryStorage {
  readonly kind: string
  /** 幂等；重复调用不重复打开。 */
  open(): Promise<void>
  get(store: HistoryStoreName, key: string): Promise<unknown>
  getAll(store: HistoryStoreName): Promise<StoreEntry[]>
  put(store: HistoryStoreName, key: string, value: unknown): Promise<void>
  /**
   * 单个原子事务写入一批事实：任一失败全部回滚并抛错，不留半提交。
   * 提交事实包的调用顺序是 facts → commit marker → head 指针。
   */
  transact(ops: StoreEntry[]): Promise<void>
  /** 仅当 branchId 还没有 head 指针时写入（目录根提交回填用，绝不覆盖已结算的 head）。 */
  ensureHead(branchId: string, commitId: string): Promise<void>
  /** 清空全部对象存取（“清空本地历史”动作用）。 */
  clear(): Promise<void>
}
