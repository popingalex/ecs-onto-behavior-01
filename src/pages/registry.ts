import type { ComponentType } from 'react'
import type { WorkbenchContext } from '@/app/useWorkbenchContext'
import type { PageId, Route } from '@/core/types'
import P01ProjectOverview from './P01ProjectOverview'
import P03ComponentSchema from './p03/P03ComponentSchema'
import P03Inspector from './p03/P03Inspector'
import P20RunWorkbench from './p20/P20RunWorkbench'
import P20Inspector from './p20/P20Inspector'
import P15BindingPicker from './overlays/P15BindingPicker'
import P21CommandQueue from './overlays/P21CommandQueue'
import PagePlaceholder from './PagePlaceholder'

/**
 * 页面实现注册：页面元数据在 navigation/pages，实现在此登记。
 * 未登记的页面使用统一占位页，导航与上下文仍完整可用。
 */
export interface PageView {
  Main: ComponentType<{ ctx: WorkbenchContext }>
  Inspector?: ComponentType<{ ctx: WorkbenchContext }>
  /** 主区自行管理滚动与全高布局（画布页）。 */
  fill?: boolean
}

const VIEWS: Partial<Record<PageId, PageView>> = {
  P01: { Main: P01ProjectOverview },
  P03: { Main: P03ComponentSchema, Inspector: P03Inspector },
  P20: { Main: P20RunWorkbench, Inspector: P20Inspector, fill: true },
}

export const OVERLAY_VIEWS: Partial<Record<PageId, ComponentType<{ route: Route }>>> = {
  P15: P15BindingPicker,
  P21: P21CommandQueue,
}

const PLACEHOLDER: PageView = { Main: PagePlaceholder }

export function pageView(pageId: PageId): PageView {
  return VIEWS[pageId] ?? PLACEHOLDER
}

export function isImplemented(pageId: PageId): boolean {
  return pageId in VIEWS || pageId in OVERLAY_VIEWS
}
