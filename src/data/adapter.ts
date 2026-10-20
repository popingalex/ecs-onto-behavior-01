import { delay } from '@/lib/id'
import { seed, type SeedData } from '@/mock/seed'

/**
 * 数据适配器边界。当前实现读取内置种子；
 * 之后替换为 mock/*.json 加载器，或 Rust mock adapter（WASM / 本地服务）。
 */
export interface DataAdapter {
  name: string
  label: string
  load(): Promise<SeedData>
}

export const seedDataAdapter: DataAdapter = {
  name: 'seed',
  label: '内置种子（占位）',
  async load() {
    await delay(260)
    return structuredClone(seed)
  },
}
