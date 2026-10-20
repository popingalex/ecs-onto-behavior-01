import type { PageId } from '@/core/types'

/**
 * 跳转表（03_navigation.md，逐条照录）。to = 'return' 表示关闭弹层并回到触发点。
 * 热点只能指向此表中的真实目标。
 */
export interface Transition {
  from: PageId
  action: string
  to: PageId | 'return'
  params: Record<string, string>
}

const T = (from: PageId, action: string, to: PageId | 'return', params: Record<string, string> = {}): Transition => ({
  from,
  action,
  to,
  params,
})

export const TRANSITIONS: Transition[] = [
  T('P01', 'open-model', 'P02', { classId: 'Fire' }),
  T('P01', 'edit-scene', 'P07', { sceneVersion: 'scene-04' }),
  T('P01', 'open-run', 'P20', { runId: 'run-main', branchId: 'main', viewCommit: 'c043' }),
  T('P01', 'create-run', 'P19', { bundle: 'model-04' }),
  T('P02', 'edit-component', 'P03', { componentId: 'Thermal' }),
  T('P02', 'open-instance', 'P08', { classId: 'Fire' }),
  T('P03', 'unit-settings', 'P04', { propertyId: 'thermal.temperature' }),
  T('P03', 'locate-reference', 'P14', { graphId: 'g-cool', nodeId: 'n-old' }),
  T('P04', 'try-constraint', 'P23', { mode: 'sandbox', constraintId: 'cooling-floor' }),
  T('P05', 'instantiate', 'P07', { templateId: 'tpl-foam', version: 't3' }),
  T('P05', 'component', 'P03', { componentId: 'Water' }),
  T('P06', 'instantiate', 'P07', { sceneTemplateId: 'tpl-park' }),
  T('P06', 'schedule', 'P12', { scheduleId: 'schedule-main' }),
  T('P07', 'entity-list', 'P08', { entityId: 'F01' }),
  T('P07', 'asset', 'P09', { assetId: 'asset-truck', version: 'a2' }),
  T('P07', 'schedule', 'P12', { scheduleId: 'schedule-main' }),
  T('P07', 'validate', 'P18', { draftId: 'scene-draft' }),
  T('P08', 'trace-property', 'P24', { entityId: 'F01', propertyId: 'thermal.temperature', viewCommit: 'c043' }),
  T('P08', 'task', 'P28', { taskId: 'task-replace-V02' }),
  T('P09', 'place-asset', 'P07', { assetId: 'asset-truck', version: 'a2' }),
  T('P10', 'bind-property', 'P15', { expectedType: 'bool', returnPage: 'P10' }),
  T('P10', 'bind-system', 'P11', { queryId: 'q-fire' }),
  T('P10', 'open-result', 'P08', { queryId: 'q-fire', viewCommit: 'c042' }),
  T('P11', 'edit-graph', 'P14', { systemId: 'cool-A', graphId: 'g-cool' }),
  T('P11', 'query', 'P10', { queryId: 'q-fire' }),
  T('P11', 'schedule', 'P12', { systemId: 'cool-A' }),
  T('P11', 'access', 'P13', { systemId: 'cool-A' }),
  T('P12', 'open-system', 'P14', { systemId: 'cool-A', graphId: 'g-cool' }),
  T('P12', 'open-reducer', 'P16', { constraintId: 'cooling-floor' }),
  T('P12', 'diagnostics', 'P13', { scheduleId: 'schedule-main' }),
  T('P12', 'publish', 'P18', { draftId: 'schedule-draft' }),
  T('P13', 'locate-node', 'P14', { nodeId: 'n-emit', systemId: 'cool-A' }),
  T('P13', 'locate-edge', 'P12', { edgeId: 'conflict-edge' }),
  T('P14', 'bind', 'P15', { nodeId: 'n-emit', portId: 'delta', expectedType: 'deltaK', returnPage: 'P14' }),
  T('P14', 'try-run', 'P22', { mode: 'sandbox', systemId: 'cool-A', entityId: 'F01' }),
  T('P14', 'publish', 'P18', { draftId: 'graph-draft' }),
  T('P15', 'confirm', 'return', { returnToken: '', structuredBinding: '' }),
  T('P15', 'cancel', 'return', { returnToken: '', unchanged: 'true' }),
  T('P16', 'try', 'P23', { mode: 'sandbox', constraintId: 'refill' }),
  T('P16', 'system', 'P11', { systemId: 'cool-A' }),
  T('P17', 'target-query', 'P10', { queryId: 'q-fire' }),
  T('P17', 'bind', 'P15', { expectedType: 'ratio', returnPage: 'P17' }),
  T('P17', 'install', 'P21', { commandType: 'InstallPolicy', policyVersion: 'p2' }),
  T('P17', 'monitor', 'P28', { instanceKey: 'policy-cover@p2:F01' }),
  T('P18', 'fix-unit', 'P14', { nodeId: 'n-emit', portId: 'delta' }),
  T('P18', 'published', 'P19', { bundleId: 'bundle-04' }),
  T('P19', 'start', 'P20', { runId: 'run-main', branchId: 'main', viewCommit: 'c042' }),
  T('P20', 'queue', 'P21', { baseCommit: 'c043' }),
  T('P20', 'debug', 'P22', { runId: 'run-main', branchId: 'main', viewCommit: 'c043' }),
  T('P20', 'trace', 'P24', { entityId: 'F01', propertyId: 'thermal.temperature', viewCommit: 'c043' }),
  T('P20', 'history', 'P26', { branchId: 'main', viewCommit: 'c043' }),
  T('P20', 'policy', 'P28', { instanceKey: 'policy-cover@p2:F01' }),
  T('P21', 'close', 'return', { returnToken: '' }),
  T('P22', 'decision', 'P23', { entityId: 'F01', constraintId: 'cooling-floor', viewCommit: 'c043' }),
  T('P22', 'trace', 'P24', { entityId: 'F01', propertyId: 'thermal.temperature', viewCommit: 'c043' }),
  T('P23', 'execution', 'P22', { entityId: 'F01', executionId: 'exec-F01-cool-A', systemId: 'cool-A' }),
  T('P23', 'value', 'P24', { entityId: 'F01', propertyId: 'thermal.temperature', viewCommit: 'c043' }),
  T('P23', 'compare', 'P27', { leftCommit: 'c043', rightCommit: 'c043-one-cooler' }),
  T('P24', 'execution', 'P22', { executionId: 'exec-F01-cool-A', entityId: 'F01' }),
  T('P24', 'decision', 'P23', { constraintId: 'cooling-floor', entityId: 'F01' }),
  T('P24', 'event-link', 'P25', { entityId: 'F01' }),
  T('P25', 'task', 'P28', { taskId: 'task-replace-V02' }),
  T('P25', 'value', 'P24', { entityId: 'V01', propertyId: 'water.remaining', viewCommit: 'c043' }),
  T('P25', 'branch', 'P26', { branchId: 'main' }),
  T('P26', 'compare', 'P27', { leftCommit: 'c043', rightCommit: 'c043-one-cooler' }),
  T('P26', 'return-head', 'P20', { branchId: 'main', viewCommit: 'c043' }),
  T('P27', 'left-trace', 'P24', { branchId: 'main', viewCommit: 'c043', entityId: 'F01' }),
  T('P27', 'right-trace', 'P24', { branchId: 'branch-one-cooler', viewCommit: 'c043-one-cooler', entityId: 'F01' }),
  T('P28', 'definition', 'P17', { policyId: 'policy-cover', version: 'p2' }),
  T('P28', 'event', 'P25', { eventId: 'evt-handoff' }),
  T('P28', 'remedy', 'P21', { commandType: 'DispatchReplacement' }),
]

export const ACTION_LABELS: Record<string, string> = {
  'open-model': '打开类型模型',
  'edit-scene': '编辑场景',
  'open-run': '打开运行',
  'create-run': '新建运行',
  'edit-component': '编辑组件',
  'open-instance': '查看实例',
  'unit-settings': '单位设置',
  'locate-reference': '定位引用',
  'try-constraint': '试算约束',
  instantiate: '实例化',
  component: '查看组件',
  schedule: '外层调度',
  'entity-list': '实体列表',
  asset: '资产详情',
  validate: '校验',
  'trace-property': '追溯属性',
  task: '查看任务',
  'place-asset': '放置资产',
  'bind-property': '绑定属性',
  'bind-system': '绑定 system',
  'open-result': '查看结果',
  'edit-graph': '编辑内部图',
  query: '实体查询',
  access: '访问诊断',
  'open-system': '打开 system',
  'open-reducer': '打开归约规则',
  diagnostics: '并发诊断',
  publish: '发布',
  'locate-node': '定位节点',
  'locate-edge': '定位调度边',
  bind: '绑定变量',
  'try-run': '沙盒试运行',
  confirm: '确认绑定',
  cancel: '取消',
  try: '试算',
  system: '查看 system',
  'target-query': '目标查询',
  install: '安装策略',
  monitor: '监控实例',
  'fix-unit': '修正单位',
  published: '发布完成',
  start: '开始运行',
  queue: '命令队列',
  debug: '节点调试',
  trace: '追溯来源',
  history: '提交历史',
  policy: '策略监控',
  close: '关闭',
  decision: '查看裁决',
  execution: '执行记录',
  value: '值来源',
  compare: '分支对比',
  'event-link': '事件链',
  branch: '查看分支',
  'return-head': '回到分支头',
  'left-trace': '左侧来源',
  'right-trace': '右侧来源',
  definition: '策略定义',
  event: '查看事件',
  remedy: '补救派遣',
}

export function outgoing(pageId: PageId): Transition[] {
  return TRANSITIONS.filter((t) => t.from === pageId)
}

export function incoming(pageId: PageId): Transition[] {
  return TRANSITIONS.filter((t) => t.to === pageId)
}

export function findTransition(from: PageId, action: string): Transition | undefined {
  return TRANSITIONS.find((t) => t.from === from && t.action === action)
}
