import type { Route } from '@/core/types'

/**
 * 代表性路径（03_navigation「代表性路径」）：
 * P03 → P05 → P07 → P12 → P14 → P15 → P18 → P20 → P22 → P23 → P24 → P26 → P27。
 * 参数与跳转表一致；执行页显式携带 runId / branchId / viewCommit。
 */
const RUN = { runId: 'run-main', branchId: 'main', viewCommit: 'c043' }

export const REPRESENTATIVE_PATH: Array<{ route: Route; note: string }> = [
  { route: { pageId: 'P03', params: { componentId: 'Thermal', propertyId: 'thermal.temperature' } }, note: '温度属性：贡献写入 + cooling-floor' },
  { route: { pageId: 'P05', params: { templateId: 'tpl-foam' } }, note: '泡沫车模板与实例覆盖' },
  { route: { pageId: 'P07', params: { sceneVersion: 'scene-04' } }, note: '园区场景装配' },
  { route: { pageId: 'P12', params: { scheduleId: 'schedule-main' } }, note: 'cool-A / cool-B 并行组' },
  { route: { pageId: 'P14', params: { systemId: 'cool-A', graphId: 'g-cool' } }, note: '喷淋冷却内部图' },
  { route: { pageId: 'P15', params: { nodeId: 'n-emit', portId: 'delta', expectedType: 'deltaK', returnPage: 'P14' } }, note: '绑定降温量（模态）' },
  { route: { pageId: 'P18', params: { draftId: 'graph-draft' } }, note: '校验并发布 bundle' },
  { route: { pageId: 'P20', params: RUN }, note: '主演练 · c043' },
  { route: { pageId: 'P22', params: { ...RUN, entityId: 'F01' } }, note: 'F01 节点调试' },
  { route: { pageId: 'P23', params: { ...RUN, entityId: 'F01', constraintId: 'cooling-floor' } }, note: '80 K 额度按比例裁决' },
  { route: { pageId: 'P24', params: { ...RUN, entityId: 'F01', propertyId: 'thermal.temperature' } }, note: 'F01 温度来源' },
  { route: { pageId: 'P26', params: RUN }, note: '提交历史与分支' },
  { route: { pageId: 'P27', params: { leftCommit: 'c043', rightCommit: 'c043-one-cooler' } }, note: '双路 vs 单路冷却' },
]

export function pathPosition(pageId: Route['pageId']): number {
  return REPRESENTATIVE_PATH.findIndex((step) => step.route.pageId === pageId)
}
