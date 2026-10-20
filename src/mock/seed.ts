import type {
  AssetDef,
  BranchDef,
  BundleDef,
  ClassDef,
  CommitDef,
  ComponentDef,
  EntityDef,
  NamedDef,
  PropertyDef,
  QuantityKind,
  QueryDef,
  RunDef,
  SystemDef,
  TemplateDef,
  UnitDef,
  VersionedAsset,
  WorldSnapshot,
} from '@/core/types'

/**
 * 占位种子数据。
 * 只用于搭建架构与验证数据流；数值取自 docs/spec 的业务示例。
 * 后续由 mock/01_model.json、02_world.json、03_programs.json、07_history.json 与 runs/*.json 替换，
 * 页面不得把这些数字复制为静态文本。
 */
export interface SeedData {
  project: { id: string; label: string; description: string }
  quantities: QuantityKind[]
  units: UnitDef[]
  components: ComponentDef[]
  properties: PropertyDef[]
  classes: ClassDef[]
  templates: TemplateDef[]
  sceneTemplates: VersionedAsset[]
  scenes: VersionedAsset[]
  assets: AssetDef[]
  entities: EntityDef[]
  queries: QueryDef[]
  graphs: VersionedAsset[]
  systems: SystemDef[]
  schedules: NamedDef[]
  constraints: NamedDef[]
  policies: VersionedAsset[]
  tasks: NamedDef[]
  events: NamedDef[]
  bundles: BundleDef[]
  runs: RunDef[]
  branches: BranchDef[]
  commits: CommitDef[]
  worlds: WorldSnapshot[]
}

export const seed: SeedData = {
  project: {
    id: 'park',
    label: '园区消防推演',
    description: '虚构园区训练规则：双路冷却裁决、车辆提前接替与分支反事实复盘。',
  },
  quantities: [
    { id: 'temperature', label: '温度' },
    { id: 'temperatureDelta', label: '温差' },
    { id: 'volume', label: '体积' },
    { id: 'flow', label: '体积流量' },
    { id: 'length', label: '长度' },
    { id: 'time', label: '时间' },
  ],
  units: [
    { id: 'degC', symbol: '°C', label: '摄氏度', quantityId: 'temperature' },
    { id: 'deltaK', symbol: 'K', label: '开尔文温差', quantityId: 'temperatureDelta' },
    { id: 'L', symbol: 'L', label: '升', quantityId: 'volume' },
    { id: 'Lps', symbol: 'L/s', label: '升每秒', quantityId: 'flow' },
    { id: 'm', symbol: 'm', label: '米', quantityId: 'length' },
    { id: 's', symbol: 's', label: '秒', quantityId: 'time' },
  ],
  components: [
    { id: 'Thermal', label: '热状态', description: '温度与冷却额度；温度经贡献裁决写入。' },
    { id: 'Combustion', label: '燃烧', description: '火源活跃与发现状态，独立于温度。' },
    { id: 'Water', label: '水箱', description: '容量、余水与耗水速率。' },
    { id: 'Position', label: '空间位置', description: 'park-ENU 坐标；null 不显示但保留逻辑，原点有效。' },
    { id: 'Task', label: '任务', description: '派遣、处置与交接关系。' },
    { id: 'Health', label: '健康', description: '车辆可用性与故障状态。' },
  ],
  properties: [
    {
      id: 'thermal.temperature',
      componentId: 'Thermal',
      label: '温度',
      shape: 'scalar',
      primitive: 'f64',
      unitId: 'degC',
      nullable: false,
      default: 100,
      writeMode: 'contribution',
      reducer: 'cooling-floor',
      description: '多个 system 只提交降温请求，经 cooling-floor 裁决后整回合原子生效。',
    },
    {
      id: 'thermal.coolingFloor',
      componentId: 'Thermal',
      label: '冷源温度',
      shape: 'scalar',
      primitive: 'f64',
      unitId: 'degC',
      nullable: false,
      default: 20,
      writeMode: 'configuration',
      description: '同温恒温冷源的绝对温度，用于计算可降温额度。',
    },
    {
      id: 'combustion.active',
      componentId: 'Combustion',
      label: '活跃',
      shape: 'scalar',
      primitive: 'bool',
      unitId: null,
      nullable: false,
      default: true,
      writeMode: 'exclusive',
      description: '独立字段；温度降到 20 °C 不自动表示熄灭。',
    },
    {
      id: 'combustion.discovered',
      componentId: 'Combustion',
      label: '已发现',
      shape: 'scalar',
      primitive: 'bool',
      unitId: null,
      nullable: false,
      default: true,
      writeMode: 'exclusive',
      description: '未发现的火源仍可被查询选中。',
    },
    {
      id: 'water.capacity',
      componentId: 'Water',
      label: '水箱容量',
      shape: 'scalar',
      primitive: 'f64',
      unitId: 'L',
      nullable: false,
      default: 10000,
      writeMode: 'configuration',
      description: '模板默认值；实例可覆盖。',
    },
    {
      id: 'water.remaining',
      componentId: 'Water',
      label: '余水',
      shape: 'scalar',
      primitive: 'f64',
      unitId: 'L',
      nullable: false,
      default: 10000,
      writeMode: 'contribution',
      reducer: 'refill',
      description: '耗水与补给均以贡献写入。',
    },
    {
      id: 'water.flowRate',
      componentId: 'Water',
      label: '耗水速率',
      shape: 'scalar',
      primitive: 'f64',
      unitId: 'Lps',
      nullable: false,
      default: 100,
      writeMode: 'configuration',
      description: '处置状态下的恒定耗水速率。',
    },
    {
      id: 'position.local',
      componentId: 'Position',
      label: '局部坐标',
      shape: 'vector3',
      primitive: 'f64',
      unitId: 'm',
      nullable: true,
      default: null,
      writeMode: 'exclusive',
      description: 'park-ENU 东/北/高；[0, 0, 0] 为有效位置，null 为未设置。',
    },
    {
      id: 'task.assignment',
      componentId: 'Task',
      label: '当前任务目标',
      shape: 'scalar',
      primitive: 'EntityRef',
      unitId: null,
      nullable: true,
      default: null,
      writeMode: 'exclusive',
      description: '引用目标实体；EntityRef 不是位置快照。',
    },
    {
      id: 'health.available',
      componentId: 'Health',
      label: '可用',
      shape: 'scalar',
      primitive: 'bool',
      unitId: null,
      nullable: false,
      default: true,
      writeMode: 'exclusive',
      description: '故障车辆不可作为接替候选。',
    },
  ],
  classes: [
    { id: 'Fire', label: '火源', parent: null, components: ['Thermal', 'Combustion', 'Position'] },
    { id: 'FoamTruck', label: '泡沫消防车', parent: null, components: ['Water', 'Position', 'Task', 'Health'] },
    { id: 'SupplyStation', label: '补给站', parent: null, components: ['Water', 'Position'] },
    { id: 'CommandUnit', label: '指挥单元', parent: null, components: ['Position', 'Task'] },
  ],
  templates: [{ id: 'tpl-foam', version: 't3', label: '10 吨泡沫消防车', classId: 'FoamTruck' }],
  sceneTemplates: [{ id: 'tpl-park', version: 'st2', label: '园区标准场景' }],
  scenes: [{ id: 'scene-04', version: 'scene-04', label: '园区初始场景' }],
  assets: [{ id: 'asset-truck', version: 'a2', label: '泡沫车三维资产', kind: 'model3d' }],
  entities: [
    { id: 'F01', label: '东区仓库火点', classId: 'Fire', templateRef: null },
    { id: 'F02', label: '装卸平台火点', classId: 'Fire', templateRef: null },
    { id: 'F03', label: '配电间火点', classId: 'Fire', templateRef: null },
    { id: 'V01', label: '泡沫车 1 号', classId: 'FoamTruck', templateRef: 'tpl-foam@t3' },
    { id: 'V02', label: '泡沫车 2 号', classId: 'FoamTruck', templateRef: 'tpl-foam@t3' },
    { id: 'V03', label: '泡沫车 3 号', classId: 'FoamTruck', templateRef: 'tpl-foam@t3' },
    { id: 'S01', label: '北门补给站', classId: 'SupplyStation', templateRef: null },
    { id: 'C01', label: '现场指挥', classId: 'CommandUnit', templateRef: null },
  ],
  queries: [{ id: 'q-fire', label: '活跃火源', classId: 'Fire' }],
  graphs: [{ id: 'g-cool', version: 'g4', label: '喷淋冷却' }],
  systems: [
    { id: 'cool-A', label: '喷淋冷却 A', graphRef: 'g-cool@g4', queryId: 'q-fire', enabled: true },
    { id: 'cool-B', label: '喷淋冷却 B', graphRef: 'g-cool@g4', queryId: 'q-fire', enabled: true },
  ],
  schedules: [{ id: 'schedule-main', label: '主回合调度' }],
  constraints: [
    { id: 'cooling-floor', label: '冷却下限额度' },
    { id: 'refill', label: '补给分配' },
  ],
  policies: [{ id: 'policy-cover', version: 'p2', label: '消防覆盖持续策略' }],
  tasks: [{ id: 'task-replace-V02', label: 'V02 接替 V01 处置 F01' }],
  events: [{ id: 'evt-handoff', label: 'V01 → V02 交接' }],
  bundles: [{ id: 'bundle-04', label: '冷却与接替演练', revision: 12 }],
  runs: [
    {
      id: 'run-main',
      label: '主演练',
      bundleId: 'bundle-04',
      stepSeconds: 10,
      playbackSeconds: 1,
      runtime: 'server',
    },
  ],
  branches: [
    {
      id: 'main',
      runId: 'run-main',
      label: '主分支',
      baseCommit: null,
      headCommit: 'c043',
      visibility: 'shared',
    },
    {
      id: 'branch-one-cooler',
      runId: 'run-main',
      label: '单路冷却试算',
      baseCommit: 'c042',
      headCommit: 'c043-one-cooler',
      visibility: 'private',
    },
  ],
  commits: [
    { id: 'c041', runId: 'run-main', branchId: 'main', parentId: null, round: 41, simTime: 410, summary: '第 41 回合', checkpoint: true },
    { id: 'c042', runId: 'run-main', branchId: 'main', parentId: 'c041', round: 42, simTime: 420, summary: 'F01 100 °C，V01 处置中', checkpoint: true },
    { id: 'c043', runId: 'run-main', branchId: 'main', parentId: 'c042', round: 43, simTime: 430, summary: '双路冷却裁决，V02 提前交接', checkpoint: true },
    {
      id: 'c043-one-cooler',
      runId: 'run-main',
      branchId: 'branch-one-cooler',
      parentId: 'c042',
      round: 43,
      simTime: 430,
      summary: '停用 cool-B 后重算',
      checkpoint: false,
    },
  ],
  worlds: [
    {
      commitId: 'c042',
      values: {
        F01: { 'thermal.temperature': 100, 'combustion.active': true, 'position.local': [320, 180, 0] },
        F02: { 'thermal.temperature': 80, 'combustion.active': true, 'position.local': [360, 120, 0] },
        F03: { 'thermal.temperature': 60, 'combustion.active': true, 'combustion.discovered': false, 'position.local': [410, 220, 0] },
        V01: { 'water.remaining': 5500, 'position.local': [280, 180, 0] },
        V02: { 'water.remaining': 9000, 'position.local': [240, 180, 0] },
        V03: { 'water.remaining': 4000, 'position.local': [160, 90, 0] },
        S01: { 'water.remaining': 60000, 'position.local': [120, 260, 0] },
        C01: { 'position.local': null },
      },
    },
    {
      commitId: 'c043',
      values: {
        F01: { 'thermal.temperature': 20, 'combustion.active': true, 'position.local': [320, 180, 0] },
        F02: { 'thermal.temperature': 20, 'combustion.active': true, 'position.local': [360, 120, 0] },
        F03: { 'thermal.temperature': 20, 'combustion.active': true, 'combustion.discovered': false, 'position.local': [410, 220, 0] },
        V01: { 'water.remaining': 5100, 'position.local': [280, 180, 0] },
        V02: { 'water.remaining': 8400, 'position.local': [280, 180, 0] },
        V03: { 'water.remaining': 4000, 'position.local': [160, 90, 0] },
        S01: { 'water.remaining': 60000, 'position.local': [120, 260, 0] },
        C01: { 'position.local': null },
      },
    },
    {
      commitId: 'c043-one-cooler',
      values: {
        F01: { 'thermal.temperature': 50, 'combustion.active': true, 'position.local': [320, 180, 0] },
        F02: { 'thermal.temperature': 30, 'combustion.active': true, 'position.local': [360, 120, 0] },
        F03: { 'thermal.temperature': 20, 'combustion.active': true, 'combustion.discovered': false, 'position.local': [410, 220, 0] },
        V01: { 'water.remaining': 5100, 'position.local': [280, 180, 0] },
        V02: { 'water.remaining': 8400, 'position.local': [280, 180, 0] },
        V03: { 'water.remaining': 4000, 'position.local': [160, 90, 0] },
        S01: { 'water.remaining': 60000, 'position.local': [120, 260, 0] },
        C01: { 'position.local': null },
      },
    },
  ],
}
