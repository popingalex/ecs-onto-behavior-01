import { useCallback } from 'react'
import type { Route } from '@/core/types'
import { createId } from '@/lib/id'
import { createStore, useStore } from '@/lib/store'
import { PAGE_SPECS } from '@/navigation/pages'
import { DEFAULT_ROUTE, parseHash, sameRoute, toHash } from './route'

/**
 * 导航栈。每次导航生成 returnToken（= 来源条目的 token），
 * 条目保存来源路由与视图状态（筛选、选中、滚动、缩放、相机），返回时恢复。
 */
export interface HistoryEntry {
  token: string
  route: Route
  viewState: Record<string, unknown>
  returnToken: string | null
}

export interface OverlayEntry {
  token: string
  route: Route
  returnToken: string
}

export type OverlayResult = { kind: 'confirm'; payload: Record<string, unknown> } | { kind: 'cancel' }

export interface LeaveGuardDecision {
  reason: string
  detail: string
  save: () => Promise<boolean>
  discard: () => void
}

export interface PendingNavigation extends LeaveGuardDecision {
  to: Route
  proceed: () => void
}

interface RouterState {
  entries: HistoryEntry[]
  index: number
  overlay: OverlayEntry | null
  pending: PendingNavigation | null
}

const initialRoute = parseHash(window.location.hash) ?? DEFAULT_ROUTE
const initialEntry: HistoryEntry = { token: createId('rt'), route: initialRoute, viewState: {}, returnToken: null }

export const routerStore = createStore<RouterState>({
  entries: [initialEntry],
  index: 0,
  overlay: null,
  pending: null,
})

window.history.replaceState({ wbToken: initialEntry.token }, '', toHash(initialRoute))

// ---------- 离开守卫 ----------

type LeaveGuard = (from: Route, to: Route) => LeaveGuardDecision | null
let leaveGuard: LeaveGuard | null = null

export function setLeaveGuard(guard: LeaveGuard | null) {
  leaveGuard = guard
}

// ---------- 导航 ----------

function currentEntry(): HistoryEntry {
  const s = routerStore.getState()
  return s.entries[s.index]
}

function commitNavigation(route: Route, replace: boolean) {
  const s = routerStore.getState()
  const current = s.entries[s.index]
  if (replace) {
    // 替换：同一页内切换上下文（如 viewCommit），保留选中与滚动。
    const entry: HistoryEntry = { ...current, route }
    const entries = s.entries.slice()
    entries[s.index] = entry
    routerStore.setState({ entries })
    window.history.replaceState({ wbToken: entry.token }, '', toHash(route))
    return
  }
  const entry: HistoryEntry = { token: createId('rt'), route, viewState: {}, returnToken: current.token }
  const entries = [...s.entries.slice(0, s.index + 1), entry]
  routerStore.setState({ entries, index: entries.length - 1 })
  window.history.pushState({ wbToken: entry.token }, '', toHash(route))
}

export function navigate(route: Route, options: { replace?: boolean; onResult?: (r: OverlayResult) => void } = {}) {
  const spec = PAGE_SPECS[route.pageId]
  if (spec.kind !== 'page') {
    openOverlay(route, options.onResult)
    return
  }
  const current = currentEntry().route
  if (sameRoute(current, route)) {
    closeOverlay({ kind: 'cancel' })
    return
  }
  const go = () => {
    routerStore.setState({ pending: null })
    closeOverlay({ kind: 'cancel' })
    commitNavigation(route, Boolean(options.replace))
  }
  const decision = leaveGuard?.(current, route)
  if (decision) {
    routerStore.setState({ pending: { ...decision, to: route, proceed: go } })
    return
  }
  go()
}

export function cancelPendingNavigation() {
  routerStore.setState({ pending: null })
}

export function back() {
  const s = routerStore.getState()
  if (s.overlay) {
    closeOverlay({ kind: 'cancel' })
    return
  }
  if (s.index > 0) window.history.back()
}

window.addEventListener('popstate', (event) => {
  const token = (event.state as { wbToken?: string } | null)?.wbToken
  const s = routerStore.getState()
  const found = token ? s.entries.findIndex((e) => e.token === token) : -1
  closeOverlay({ kind: 'cancel' })
  if (found >= 0) {
    routerStore.setState({ index: found, pending: null })
    return
  }
  // 手动修改 hash / 外部深链接：作为新条目进入。
  const route = parseHash(window.location.hash) ?? DEFAULT_ROUTE
  const entry: HistoryEntry = { token: createId('rt'), route, viewState: {}, returnToken: s.entries[s.index].token }
  const entries = [...s.entries.slice(0, s.index + 1), entry]
  routerStore.setState({ entries, index: entries.length - 1, pending: null })
  window.history.replaceState({ wbToken: entry.token }, '', toHash(route))
})

// ---------- 弹层（P15 模态 / P21 抽屉） ----------

const overlayCallbacks = new Map<string, (result: OverlayResult) => void>()

export function openOverlay(route: Route, onResult?: (result: OverlayResult) => void) {
  const token = createId('ov')
  if (onResult) overlayCallbacks.set(token, onResult)
  routerStore.setState({ overlay: { token, route, returnToken: currentEntry().token } })
}

/** 关闭弹层只销毁局部状态；结果回传给打开者。 */
export function closeOverlay(result: OverlayResult) {
  const overlay = routerStore.getState().overlay
  if (!overlay) return
  const callback = overlayCallbacks.get(overlay.token)
  overlayCallbacks.delete(overlay.token)
  routerStore.setState({ overlay: null })
  callback?.(result)
}

// ---------- 视图状态（随 returnToken 恢复） ----------

export function useViewState<T>(key: string, initial: T): [T, (next: T | ((prev: T) => T)) => void] {
  const token = useStore(routerStore, (s) => s.entries[s.index].token)
  const stored = useStore(routerStore, (s) => s.entries[s.index].viewState[key]) as T | undefined
  const value = stored === undefined ? initial : stored
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      routerStore.setState((s) => {
        const idx = s.entries.findIndex((e) => e.token === token)
        if (idx < 0) return {}
        const entry = s.entries[idx]
        const prev = (entry.viewState[key] ?? initial) as T
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
        const entries = s.entries.slice()
        entries[idx] = { ...entry, viewState: { ...entry.viewState, [key]: resolved } }
        return { entries }
      })
    },
    // initial 只作为缺省值使用
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, key],
  )
  return [value, set]
}

/** 高频视图量（滚动位置）不进入响应式 store，避免无谓渲染。 */
const scrollMemory = new Map<string, number>()

export function rememberScroll(token: string, key: string, top: number) {
  scrollMemory.set(`${token}:${key}`, top)
}

export function recallScroll(token: string, key: string): number {
  return scrollMemory.get(`${token}:${key}`) ?? 0
}

// ---------- hooks ----------

export function useRoute(): Route {
  return useStore(routerStore, (s) => s.entries[s.index].route)
}

export function useCurrentEntry(): HistoryEntry {
  return useStore(routerStore, (s) => s.entries[s.index])
}

export function usePreviousEntry(): HistoryEntry | null {
  return useStore(routerStore, (s) => (s.index > 0 ? s.entries[s.index - 1] : null))
}

export function useOverlay(): OverlayEntry | null {
  return useStore(routerStore, (s) => s.overlay)
}

export function usePendingNavigation(): PendingNavigation | null {
  return useStore(routerStore, (s) => s.pending)
}
