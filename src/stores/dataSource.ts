import type { DataSourceMode } from "@/services/nativeImport/types"

/**
 * 数据源模式（V7-1）：
 * - MOCK_SANDBOX：v0.5/v0.6 既有种子 + 浏览器 mock 执行器（回归保护，默认）；
 * - REAL_IMPORT_READ_ONLY：mas-rust 离线工件只读导入（不可执行、不可编辑、不可保存）。
 * 模式存 sessionStorage（会话级），切换触发整页重载：避免 mock 历史与真实导入在
 * store / IndexedDB / localStorage 草稿间串味（REAL-11/12）。
 */

const KEY = "ecs-workbench.dataSource.v1"

export function getCurrentMode(): DataSourceMode {
  try {
    const raw = typeof window === "undefined" ? null : window.sessionStorage.getItem(KEY)
    return raw === "REAL_IMPORT_READ_ONLY" ? "REAL_IMPORT_READ_ONLY" : "MOCK_SANDBOX"
  } catch {
    return "MOCK_SANDBOX"
  }
}

export function isNativeMode(): boolean {
  return getCurrentMode() === "REAL_IMPORT_READ_ONLY"
}

export function switchDataSource(mode: DataSourceMode): never {
  try {
    window.sessionStorage.setItem(KEY, mode)
  } catch {
    // 存储不可用时无法切换；提示由调用方给出。
  }
  window.location.reload()
  throw new Error("reloading")
}

export const CURRENT_MODE: DataSourceMode = getCurrentMode()

export function modeLabel(mode: DataSourceMode): string {
  return mode === "REAL_IMPORT_READ_ONLY"
    ? "真实只读导入 REAL_IMPORT_READ_ONLY"
    : "沙盒种子 MOCK_SANDBOX"
}
