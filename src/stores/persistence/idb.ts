import {
  HISTORY_STORES,
  type HistoryStorage,
  type HistoryStoreName,
  type StoreEntry,
} from "./storage"

/**
 * IndexedDB 原生封装（零依赖）。一个数据库、六个对象存取、显式键（无 keyPath）。
 * transact 用单个 readwrite 事务覆盖涉及的全部 store：浏览器提交事务是原子的，
 * 中途崩溃/中止会整体回滚，磁盘上不会出现半个事务。
 */
export class IdbHistoryStorage implements HistoryStorage {
  readonly kind = "indexeddb"
  private db: IDBDatabase | null = null
  private opening: Promise<void> | null = null

  constructor(private readonly dbName = "ecs-workbench.history") {}

  open(): Promise<void> {
    if (this.db) return Promise.resolve()
    this.opening ??= new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1)
      request.onupgradeneeded = () => {
        const db = request.result
        for (const name of HISTORY_STORES)
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name)
      }
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }
      request.onerror = () =>
        reject(request.error ?? new Error("IndexedDB 打开失败"))
      request.onblocked = () => reject(new Error("IndexedDB 被其他标签页阻塞"))
    })
    return this.opening
  }

  private requireDb(): IDBDatabase {
    if (!this.db) throw new Error("IndexedDB 尚未打开")
    return this.db
  }

  private request<T>(req: IDBRequest<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error ?? new Error("IndexedDB 请求失败"))
    })
  }

  async get(store: HistoryStoreName, key: string): Promise<unknown> {
    const db = this.requireDb()
    const tx = db.transaction(store, "readonly")
    const value = await this.request(tx.objectStore(store).get(key))
    return value ?? null
  }

  async getAll(store: HistoryStoreName): Promise<StoreEntry[]> {
    const db = this.requireDb()
    const tx = db.transaction(store, "readonly")
    const os = tx.objectStore(store)
    const [keys, values] = await Promise.all([
      this.request(os.getAllKeys()),
      this.request(os.getAll()),
    ])
    return keys.map((key, i) => ({
      store,
      key: String(key),
      value: values[i],
    }))
  }

  async put(store: HistoryStoreName, key: string, value: unknown): Promise<void> {
    await this.transact([{ store, key, value }])
  }

  transact(ops: StoreEntry[]): Promise<void> {
    const db = this.requireDb()
    const storeNames = [...new Set(ops.map((op) => op.store))]
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeNames, "readwrite")
      tx.oncomplete = () => resolve()
      tx.onerror = () =>
        reject(tx.error ?? new Error("IndexedDB 事务失败（可能配额不足）"))
      tx.onabort = () =>
        reject(tx.error ?? new Error("IndexedDB 事务中止，全部回滚"))
      for (const op of ops) tx.objectStore(op.store).put(op.value, op.key)
    })
  }

  async clear(): Promise<void> {
    const db = this.requireDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([...HISTORY_STORES], "readwrite")
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB 清空失败"))
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB 清空中止"))
      for (const name of HISTORY_STORES) tx.objectStore(name).clear()
    })
  }

  ensureHead(branchId: string, commitId: string): Promise<void> {
    const db = this.requireDb()
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("heads", "readwrite")
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB head 写入失败"))
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB head 写入中止"))
      const store = tx.objectStore("heads")
      const read = store.get(branchId)
      read.onsuccess = () => {
        if (read.result == null) store.put(commitId, branchId)
      }
    })
  }
}
