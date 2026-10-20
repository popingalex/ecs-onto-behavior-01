import { createStore, useStore } from '@/lib/store'

/** 工作区布局（egui_dock 对应物）。宽高为用户值，断点规则在 WorkspaceShell 中套用。 */
export interface LayoutState {
  treeWidth: number
  inspectorWidth: number
  dockHeight: number
  treeOpen: boolean
  inspectorOpen: boolean
  dockOpen: boolean
  fullscreen: boolean
}

const STORAGE_KEY = 'workbench.layout.v1'

export const LAYOUT_DEFAULTS: LayoutState = {
  treeWidth: 256,
  inspectorWidth: 344,
  dockHeight: 264,
  treeOpen: true,
  inspectorOpen: true,
  dockOpen: true,
  fullscreen: false,
}

export const LAYOUT_LIMITS = {
  treeWidth: [200, 400],
  inspectorWidth: [280, 480],
  dockHeight: [160, 480],
} as const

function load(): LayoutState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return LAYOUT_DEFAULTS
    return { ...LAYOUT_DEFAULTS, ...JSON.parse(raw), fullscreen: false }
  } catch {
    return LAYOUT_DEFAULTS
  }
}

export const layoutStore = createStore<LayoutState>(load())

layoutStore.subscribe(() => {
  const { fullscreen: _ignored, ...persisted } = layoutStore.getState()
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted))
  } catch {
    // 存储不可用时布局只在本次会话有效
  }
})

function clamp(value: number, [min, max]: readonly [number, number]) {
  return Math.min(max, Math.max(min, Math.round(value)))
}

export function resizePanel(key: keyof typeof LAYOUT_LIMITS, value: number) {
  layoutStore.setState({ [key]: clamp(value, LAYOUT_LIMITS[key]) } as Partial<LayoutState>)
}

export function togglePanel(key: 'treeOpen' | 'inspectorOpen' | 'dockOpen') {
  layoutStore.setState((s) => ({ [key]: !s[key] }) as Partial<LayoutState>)
}

export function setFullscreen(fullscreen: boolean) {
  layoutStore.setState({ fullscreen })
}

export function resetLayout() {
  layoutStore.setState(LAYOUT_DEFAULTS)
}

export function useLayout<S>(selector: (s: LayoutState) => S): S {
  return useStore(layoutStore, selector)
}
