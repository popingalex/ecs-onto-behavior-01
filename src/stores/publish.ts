import { createStore, useStore } from "@/lib/store"

/**
 * 发布存储（原型语义）：P18 用已校验的草稿组合创建不可变 bundle。
 * bundle 只固定定义版本与语义哈希，不产生任何模拟 commit；
 * 列表持久化在本浏览器 localStorage，不模拟服务器侧版本库。
 */
export interface BundleManifestEntry {
  documentId: string
  semanticHash: string
  revision: number
}

export interface PublishedBundle {
  id: string
  label: string
  revision: number
  createdAt: string
  actorId: string
  /** 发布时校验通过的组合模型哈希；草稿之后变化不影响已发布 bundle。 */
  modelHash: string
  manifest: BundleManifestEntry[]
  /** 发布时保留的警告数（错误必须为 0）。 */
  warnings: number
}

const STORAGE_KEY = "ecs-workbench.bundles.v1"

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage
  } catch {
    return null
  }
}

function load(): PublishedBundle[] {
  try {
    const raw = storage()?.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as { bundles?: PublishedBundle[] }
    return Array.isArray(parsed.bundles)
      ? parsed.bundles.filter(
          (b) => b && typeof b.id === "string" && Array.isArray(b.manifest),
        )
      : []
  } catch {
    return []
  }
}

export const publishStore = createStore<{ bundles: PublishedBundle[] }>({
  bundles: load(),
})

function persist(bundles: PublishedBundle[]) {
  try {
    storage()?.setItem(
      STORAGE_KEY,
      JSON.stringify({ format: "bundles/1", bundles }),
    )
  } catch {
    // 存储不可用时本次会话内仍可用。
  }
}

/** 追加不可变 bundle；同 id 忽略（幂等）。没有修改/删除入口。 */
export function publishBundle(bundle: PublishedBundle): PublishedBundle[] {
  const s = publishStore.getState()
  if (s.bundles.some((b) => b.id === bundle.id)) return s.bundles
  const bundles = [...s.bundles, bundle]
  publishStore.setState({ bundles })
  persist(bundles)
  return bundles
}

export function usePublishedBundles(): PublishedBundle[] {
  return useStore(publishStore, (s) => s.bundles)
}

/** 下一个 bundle id：bundle-04 是种子旧样例，本地发布从 bundle-local-1 递增。 */
export function nextBundleId(existing: string[]): string {
  let i = 1
  let id = `bundle-local-${i}`
  while (existing.includes(id)) id = `bundle-local-${++i}`
  return id
}
