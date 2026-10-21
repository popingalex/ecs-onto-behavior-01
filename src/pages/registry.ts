import type { ComponentType } from "react"
import type { WorkbenchContext } from "@/app/useWorkbenchContext"
import type { PageId, Route } from "@/core/types"
import P01ProjectOverview from "./P01ProjectOverview"
import P02EntityTypes from "./p02/P02EntityTypes"
import P03ComponentSchema from "./p03/P03ComponentSchema"
import P03Inspector from "./p03/P03Inspector"
import P04Units from "./p04/P04Units"
import P05Templates from "./p05/P05Templates"
import P06SceneTemplates from "./p06/P06SceneTemplates"
import P07SceneBuilder from "./p07/P07SceneBuilder"
import P07Inspector from "./p07/P07Inspector"
import P08Entities from "./p08/P08Entities"
import P09Assets from "./p09/P09Assets"
import P10EntityQueries from "./p10/P10EntityQueries"
import P11Systems from "./p11/P11Systems"
import P12Schedule from "./p12/P12Schedule"
import P13AccessDiagnostics from "./p13/P13AccessDiagnostics"
import P14LogicEditor from "./p14/P14LogicEditor"
import P16Contracts from "./p16/P16Contracts"
import P17Policies from "./p17/P17Policies"
import P18Publish from "./p18/P18Publish"
import P19NewRun from "./p19/P19NewRun"
import P20RunWorkbench from "./p20/P20RunWorkbench"
import P20Inspector from "./p20/P20Inspector"
import P22NodeDebug from "./p22/P22NodeDebug"
import P23ConstraintDecisions from "./p23/P23ConstraintDecisions"
import P24Provenance from "./p24/P24Provenance"
import P25EventChain from "./p25/P25EventChain"
import P26History from "./p26/P26History"
import P27Compare from "./p27/P27Compare"
import P28PolicyMonitor from "./p28/P28PolicyMonitor"
import P29Attributes from "./p29/P29Attributes"
import P30ProgramLibrary from "./p30/P30ProgramLibrary"
import P15BindingPicker from "./overlays/P15BindingPicker"
import P21CommandQueue from "./overlays/P21CommandQueue"
import PagePlaceholder from "./PagePlaceholder"

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
  P02: { Main: P02EntityTypes },
  P03: { Main: P03ComponentSchema, Inspector: P03Inspector },
  P04: { Main: P04Units },
  P05: { Main: P05Templates },
  P06: { Main: P06SceneTemplates },
  P07: { Main: P07SceneBuilder, Inspector: P07Inspector, fill: true },
  P08: { Main: P08Entities },
  P09: { Main: P09Assets },
  P10: { Main: P10EntityQueries },
  P11: { Main: P11Systems },
  P12: { Main: P12Schedule, fill: true },
  P13: { Main: P13AccessDiagnostics },
  P14: { Main: P14LogicEditor, fill: true },
  P16: { Main: P16Contracts },
  P17: { Main: P17Policies },
  P18: { Main: P18Publish },
  P19: { Main: P19NewRun },
  P20: { Main: P20RunWorkbench, Inspector: P20Inspector, fill: true },
  P22: { Main: P22NodeDebug, fill: true },
  P23: { Main: P23ConstraintDecisions },
  P24: { Main: P24Provenance },
  P25: { Main: P25EventChain },
  P26: { Main: P26History, fill: true },
  P27: { Main: P27Compare },
  P28: { Main: P28PolicyMonitor },
  P29: { Main: P29Attributes },
  P30: { Main: P30ProgramLibrary },
}

export const OVERLAY_VIEWS: Partial<Record<PageId, ComponentType<{
  route: Route
}>>> = {
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
