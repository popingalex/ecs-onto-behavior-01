import { delay } from "@/lib/id"
import { loadSeed, type SeedData } from "@/mock/seed"

/**
 * 数据适配器边界。当前实现解析 design/02/mock/prototype_seed.v05.json（见 mock/prototype.ts），
 * 之后可替换为 Rust mock adapter（WASM / 本地服务）。
 */
export interface DataAdapter {
  name: string
  label: string
  load(): Promise<SeedData>
}

export const seedDataAdapter: DataAdapter = {
  name: "seed",
  label: "v0.5 设计包种子",
  async load() {
    await delay(260)
    return loadSeed()
  },
}
