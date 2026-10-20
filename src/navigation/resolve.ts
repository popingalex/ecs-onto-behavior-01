import type { Route } from '@/core/types'
import type { WorkbenchIndex } from '@/data/index'
import type { BranchDef, CommitDef } from '@/core/types'
import { lineage } from '@/stores/history'
import { PAGE_SPECS } from './pages'
import type { Transition } from './transitions'

/** 执行上下文参数：跳转到执行页时若未显式给出，从来源路由显式携带（不取最新）。 */
export const EXECUTION_PARAMS = ['runId', 'branchId', 'viewCommit'] as const

export function buildTransitionRoute(source: Route, transition: Transition): Route | null {
  if (transition.to === 'return') return null
  const params = { ...transition.params }
  const target = PAGE_SPECS[transition.to]
  if (target.context === 'execution') {
    for (const key of EXECUTION_PARAMS) {
      if (!(key in params) && source.params[key]) params[key] = source.params[key]
    }
  }
  return { pageId: transition.to, params }
}

export interface HistoryView {
  branches: Record<string, BranchDef>
  commits: Record<string, CommitDef>
}

interface ParamType {
  label: string
  exists: (id: string, index: WorkbenchIndex, history: HistoryView) => boolean
}

const commitParam: ParamType = { label: '提交', exists: (id, _i, h) => id in h.commits }

/** 参数 → 对象类型。未登记的参数（mode、returnPage 等）不做存在性校验。 */
export const PARAM_TYPES: Record<string, ParamType> = {
  runId: { label: '运行', exists: (id, i) => i.runs.has(id) },
  branchId: { label: '分支', exists: (id, _i, h) => id in h.branches },
  viewCommit: commitParam,
  leftCommit: commitParam,
  rightCommit: commitParam,
  baseCommit: commitParam,
  entityId: { label: '实体', exists: (id, i) => i.entities.has(id) },
  classId: { label: '类型', exists: (id, i) => i.classes.has(id) },
  componentId: { label: '组件', exists: (id, i) => i.components.has(id) },
  propertyId: { label: '属性', exists: (id, i) => i.properties.has(id) },
  templateId: { label: '实体模板', exists: (id, i) => i.templates.has(id) },
  sceneTemplateId: { label: '场景模板', exists: (id, i) => i.sceneTemplates.has(id) },
  sceneVersion: { label: '场景', exists: (id, i) => i.scenes.has(id) },
  assetId: { label: '资产', exists: (id, i) => i.assets.has(id) },
  queryId: { label: '实体查询', exists: (id, i) => i.queries.has(id) },
  systemId: { label: 'System', exists: (id, i) => i.systems.has(id) },
  graphId: { label: '逻辑图', exists: (id, i) => i.graphs.has(id) },
  scheduleId: { label: '调度', exists: (id, i) => i.schedules.has(id) },
  constraintId: { label: '约束', exists: (id, i) => i.constraints.has(id) },
  policyId: { label: '策略', exists: (id, i) => i.policies.has(id) },
  taskId: { label: '任务', exists: (id, i) => i.tasks.has(id) },
  eventId: { label: '事件', exists: (id, i) => i.events.has(id) },
  bundleId: { label: '发布包', exists: (id, i) => i.bundles.has(id) },
}

export interface MissingTargetItem {
  param: string
  typeLabel: string
  id: string
}

export type RouteCheck =
  | { status: 'ok' }
  | { status: 'missingContext'; missing: string[] }
  | { status: 'missingTarget'; items: MissingTargetItem[]; commit?: string }

export function checkRoute(route: Route, index: WorkbenchIndex, history: HistoryView): RouteCheck {
  const spec = PAGE_SPECS[route.pageId]
  const items: MissingTargetItem[] = []
  for (const [param, id] of Object.entries(route.params)) {
    const type = PARAM_TYPES[param]
    if (type && id && !type.exists(id, index, history)) items.push({ param, typeLabel: type.label, id })
  }
  // 分支与提交必须属于同一条历史线。
  const { branchId, viewCommit } = route.params
  if (branchId && viewCommit && history.branches[branchId] && history.commits[viewCommit]) {
    const line = lineage(history.commits, history.branches[branchId].headCommit)
    if (!line.some((c) => c.id === viewCommit)) {
      items.push({ param: 'viewCommit', typeLabel: `分支 ${branchId} 上的提交`, id: viewCommit })
    }
  }
  if (items.length > 0) return { status: 'missingTarget', items, commit: route.params.viewCommit }

  const missing = spec.requires.filter((key) => !route.params[key])
  if (missing.length > 0) return { status: 'missingContext', missing }
  return { status: 'ok' }
}
