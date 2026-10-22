/**
 * P20 地图主角布局：左（对象树）/ 右（检查器）/ 下（实体状态表）三个内容面板
 * 的互斥展开状态。纯函数，状态经 useViewState 持久化（ADR-v06-06）。
 *
 * 规则：
 * - 默认全部收起（地图占满主区）。
 * - 三个方向合计最多一个展开：展开另一个时当前展开项自动收回为图标。
 * - pin（固定展开）同样遵守三选一：pin 一个 = 其他两个只能图标态；
 *   展开其他面板时原 pin 自动解除。
 * - 不变式：pinned !== null 蕴含 open === pinned。
 */
export type MapPanelId = "left" | "right" | "bottom"

export interface MapLayoutState {
  open: MapPanelId | null
  pinned: MapPanelId | null
}

export const MAP_LAYOUT_DEFAULT: MapLayoutState = { open: null, pinned: null }

export type MapLayoutAction =
  | { type: "toggle"; panel: MapPanelId }
  | { type: "pin"; panel: MapPanelId }
  | { type: "close" }

export function reduceMapLayout(
  state: MapLayoutState,
  action: MapLayoutAction,
): MapLayoutState {
  switch (action.type) {
    case "toggle": {
      if (state.open === action.panel) {
        // 再次点击当前面板的图标 = 收回（连同其 pin）。
        return {
          open: null,
          pinned: state.pinned === action.panel ? null : state.pinned,
        }
      }
      return {
        open: action.panel,
        pinned: state.pinned === action.panel ? action.panel : null,
      }
    }
    case "pin": {
      if (state.pinned === action.panel) {
        return { open: state.open, pinned: null }
      }
      return { open: action.panel, pinned: action.panel }
    }
    case "close":
      return { open: null, pinned: null }
  }
}
