import type { AssetDef, BundleDef, NamedDef, VersionedAsset } from '@/core/types'

/**
 * 迁移表：v0.4 手写种子中的对象在 v0.5 规范输入下的去向。
 * renamed → 在 v0.5 中有对应对象；removed → 不在六实体冷却主线内，已从核心模型移除；
 * legacy-fixture → 非核心资产类入口，保留为“旧样例”，不属于 v0.5 核心模型；alias → 同一对象的另一个 ID。
 */
export interface MigrationEntry {
  legacyId: string
  kind: string
  status: 'renamed' | 'removed' | 'legacy-fixture' | 'alias'
  replacement?: string
  note: string
}

export const MIGRATIONS: MigrationEntry[] = [
  { legacyId: 'Combustion', kind: '组件', status: 'renamed', replacement: 'FireState', note: '燃烧状态改由 v0.5 的 FireState@1 组件承载。' },
  { legacyId: 'combustion.active', kind: '属性', status: 'renamed', replacement: 'fire.active', note: '查询 q-fire@q1 的条件属性。' },
  { legacyId: 'combustion.discovered', kind: '属性', status: 'removed', note: 'v0.5 六实体主线没有“已发现”字段。' },
  { legacyId: 'thermal.coolingFloor', kind: '属性', status: 'removed', note: '冷源温度改为程序参数 sourceC，下限由约束 cooling-floor@c1 的 floorC 给出。' },
  { legacyId: 'water.flowRate', kind: '属性', status: 'removed', note: '耗水不在本轮冷却闭环内。' },
  { legacyId: 'task.assignment', kind: '属性', status: 'removed', note: '任务派遣不在本轮范围内。' },
  { legacyId: 'health.available', kind: '属性', status: 'removed', note: '车辆健康不在本轮范围内。' },
  { legacyId: 'Task', kind: '组件', status: 'removed', note: '随 task.assignment 一并移除。' },
  { legacyId: 'Health', kind: '组件', status: 'removed', note: '随 health.available 一并移除。' },
  { legacyId: 'SupplyStation', kind: '实体类型', status: 'removed', note: 'v0.5 只有 Fire / FoamTruck / Command 三种类型。' },
  { legacyId: 'CommandUnit', kind: '实体类型', status: 'renamed', replacement: 'Command', note: '指挥单元类型改名为 Command，只可选 Position。' },
  { legacyId: 'V03', kind: '实体', status: 'removed', note: 'v0.5 场景只有 F01–F03、V01、V02、C01 六个实体。' },
  { legacyId: 'S01', kind: '实体', status: 'removed', note: '补给站类型已移除。' },
  { legacyId: 'refill', kind: '约束', status: 'removed', note: 'v0.5 只有 cooling-floor@c1；water.remaining 改为 contract 写入。' },
  { legacyId: 'g-cool@g4', kind: '程序', status: 'renamed', replacement: 'g-cool@g5', note: 'cool-A / cool-B 都绑定 g-cool@g5。' },
  { legacyId: 'scene-04', kind: '场景', status: 'renamed', replacement: 'scene-05', note: 'v0.5 场景草稿为 scene-05。' },
  { legacyId: 'c041', kind: '提交', status: 'removed', note: 'v0.5 基础世界从 c042 开始，c041 没有对应快照。' },
  { legacyId: 'run-prototype', kind: '运行', status: 'alias', replacement: 'run-main', note: 'expected_runs 样例里的 runId；工作台与深链接沿用稳定 ID run-main。' },
  { legacyId: 'tpl-park', kind: '场景模板', status: 'legacy-fixture', note: '场景模板不在 v0.5 范围内，保留为旧样例入口。' },
  { legacyId: 'asset-truck', kind: '资产', status: 'legacy-fixture', note: '三维资产不在 v0.5 范围内，保留为旧样例入口。' },
  { legacyId: 'policy-cover', kind: '持续策略', status: 'legacy-fixture', note: '持续策略不在 v0.5 范围内，保留为旧样例入口。' },
  { legacyId: 'task-replace-V02', kind: '任务', status: 'legacy-fixture', note: '任务监控不在 v0.5 范围内，保留为旧样例入口。' },
  { legacyId: 'evt-handoff', kind: '业务事件', status: 'legacy-fixture', note: '业务事件链不在 v0.5 范围内，保留为旧样例入口。' },
  { legacyId: 'bundle-04', kind: '发布包', status: 'legacy-fixture', note: 'v0.5 没有发布包对象；run-main 仍挂在这个旧发布包上，直到 P18 发布流程接入。' },
]

export function migrationOf(id: string): MigrationEntry | undefined {
  return MIGRATIONS.find((m) => m.legacyId === id)
}

/** v0.5 范围外的资产类对象（原样保留旧标签）：只给旧入口使用，不参与 v0.5 模型校验与执行。 */
export const LEGACY_FIXTURE: {
  sceneTemplates: VersionedAsset[]
  assets: AssetDef[]
  policies: VersionedAsset[]
  tasks: NamedDef[]
  events: NamedDef[]
  bundles: BundleDef[]
} = {
  sceneTemplates: [{ id: 'tpl-park', version: 'st2', label: '园区标准场景' }],
  assets: [{ id: 'asset-truck', version: 'a2', label: '泡沫车三维资产', kind: 'model3d' }],
  policies: [{ id: 'policy-cover', version: 'p2', label: '消防覆盖持续策略' }],
  tasks: [{ id: 'task-replace-V02', label: 'V02 接替 V01 处置 F01' }],
  events: [{ id: 'evt-handoff', label: 'V01 → V02 交接' }],
  bundles: [{ id: 'bundle-04', label: '冷却与接替演练', revision: 12 }],
}
