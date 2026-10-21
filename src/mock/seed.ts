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
} from "@/core/types"
import {
  refKey,
  type AttributeSchema,
  type PrototypeModel,
} from "@/schema/model"
import type { ReferenceRun } from "@/schema/referenceRuns"
import { LEGACY_FIXTURE } from "./legacy"
import { loadPrototype } from "@/data/mockLoader"

/**
 * 旧页面读取的 SeedData 形状 —— 现在是 v0.5 规范模型（design/02/mock/prototype_seed.v05.json）的派生桥接，
 * 不再手写业务数值。v0.5 范围外的旧对象见 ./legacy.ts 的迁移表。
 */
export interface SeedData {
  project: { id: string ;label: string ;description: string }
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

/** v0.5 输入没有给出名称的对象，沿用旧工作台的展示名（只影响显示）。 */
const DISPLAY_LABELS: Record<string, string> = {
  temperatureAbsolute: "温度",
  temperatureDifference: "温差",
  length: "长度",
  volume: "体积",
  degC: "摄氏度",
  deltaK: "开尔文温差",
  m: "米",
  L: "升",
  "g-cool": "冷却程序",
  "schedule-main": "主回合调度",
  "cooling-floor": "冷却下限额度",
  "scene-05": "园区初始场景",
  main: "主分支",
  "branch-one-cooler": "单路冷却试算",
  "branch-lower-power": "A 降为 20 K 试算",
}
const labelOf = (id: string) => DISPLAY_LABELS[id] ?? id

const RUN: RunDef = {
  id: "run-main",
  label: "主演练",
  bundleId: "bundle-04",
  stepSeconds: 10,
  playbackSeconds: 1,
  runtime: "server",
}

function describeAttribute(a: AttributeSchema, m: PrototypeModel): string {
  const parts: string[] = []
  if (a.writeMode === "contribution")
    parts.push(
      `贡献写入：多个 system 只提交请求，经 ${
        a.reducerRef ? refKey(a.reducerRef) : "（未配置归约）"
      } 裁决后整回合原子生效。`,
    )
  if (a.writeMode === "exclusive")
    parts.push("独占写入：同一回合只能有一个 system 写。")
  if (a.writeMode === "configuration")
    parts.push("配置值：运行中不由 system 写入。")
  if (a.writeMode === "contract") parts.push("契约写入：由契约节点统一结算。")
  if (a.type.frameId) parts.push(`坐标系 ${a.type.frameId}。`)
  parts.push(a.type.nullable ? "null 是有效值，表示未设置。" : "不可为 null。")
  const owners = m.components
    .filter((c) => c.propertyIds.includes(a.id))
    .map((c) => c.id)
  if (owners.length > 1) parts.push(`同时列在 ${owners.join("、")} 中。`)
  return parts.join("")
}

function referenceCommit(r: ReferenceRun): CommitDef {
  return {
    id: r.resultCommit,
    runId: RUN.id,
    branchId: r.branchId,
    parentId: r.baseCommit,
    round: Math.round(r.simTimeAfter / RUN.stepSeconds),
    simTime: r.simTimeAfter,
    summary: `参考样例 ${r.caseId}（expected_runs，非当前图计算）`,
    checkpoint: r.branchId === "main",
    source: "reference-sample",
  }
}

/** 参考样例的提交定义与世界快照（供 registerReferenceSamples 注册，不走执行器）。 */
export function referenceRound(r: ReferenceRun): {
  commit: CommitDef
  world: WorldSnapshot
} {
  return { commit: referenceCommit(r), world: r.nextWorld }
}

export function seedFromModel(
  m: PrototypeModel,
  referenceRuns: ReferenceRun[],
): SeedData {
  const attrLabel = (id: string) =>
    m.attributes.find((a) => a.id === id)?.label ?? id
  const typeLabel = (id: string) =>
    m.entityTypes.find((t) => t.id === id)?.label ?? id
  const base = m.baseWorld
  return {
    project: { id: "park", label: "园区消防推演", description: m.scope },
    quantities: [...new Set(m.units.map((u) => u.quantityKind))].map((id) => ({
      id,
      label: labelOf(id),
    })),
    units: m.units.map((u) => ({
      id: u.id,
      symbol: u.symbol,
      label: labelOf(u.id),
      quantityId: u.quantityKind,
    })),
    components: m.components.map((c) => ({
      id: c.id,
      label: c.label,
      description: `版本 ${c.version}；包含 ${c.propertyIds.map(attrLabel).join("、") || "（无属性）"}。`,
    })),
    properties: m.attributes.map((a) => ({
      id: a.id,
      componentId: a.componentId,
      label: a.label,
      shape: a.type.shape,
      primitive: a.type.primitive,
      unitId: a.type.unitId ?? null,
      nullable: a.type.nullable,
      default: a.default,
      writeMode: a.writeMode,
      reducer: a.reducerRef?.id,
      description: describeAttribute(a, m),
    })),
    classes: m.entityTypes.map((t) => ({
      id: t.id,
      label: t.label,
      parent: null,
      components: [...t.requiredComponentIds, ...t.optionalComponentIds],
      requiredComponents: t.requiredComponentIds,
      optionalComponents: t.optionalComponentIds,
    })),
    templates: m.templates.map((t) => ({
      id: t.id,
      version: t.version,
      label: t.label,
      classId: t.typeId,
    })),
    sceneTemplates: LEGACY_FIXTURE.sceneTemplates,
    scenes: [
      { id: m.scene.id, version: m.scene.id, label: labelOf(m.scene.id) },
    ],
    assets: LEGACY_FIXTURE.assets,
    entities: m.scene.entities.map((e) => ({
      id: e.id,
      label: e.label,
      classId: e.typeId,
      templateRef: e.templateRef ? refKey(e.templateRef) : null,
      components: e.componentInstances.map((ci) => ci.schemaRef.id),
    })),
    queries: m.queries.map((q) => ({
      id: q.id,
      label: `${typeLabel(q.typeId)}（${attrLabel(q.condition.propertyId)} = ${String(q.condition.value)}）`,
      classId: q.typeId,
    })),
    graphs: m.programs.map((p) => ({
      id: p.id,
      version: p.version,
      label: labelOf(p.id),
    })),
    systems: m.systems.map((s) => ({
      id: s.id,
      label: s.label,
      graphRef: refKey(s.programRef),
      queryId: s.queryRef.id,
      enabled: s.enabled,
    })),
    schedules: m.schedules.map((s) => ({ id: s.id, label: labelOf(s.id) })),
    constraints: m.constraints.map((c) => ({ id: c.id, label: labelOf(c.id) })),
    policies: LEGACY_FIXTURE.policies,
    tasks: LEGACY_FIXTURE.tasks,
    events: LEGACY_FIXTURE.events,
    bundles: LEGACY_FIXTURE.bundles,
    runs: [RUN],
    branches: [
      ...new Set(["main", ...referenceRuns.map((r) => r.branchId)]),
    ].map((id) => ({
      // 所有分支头都从基础提交开始：样例提交保留在 commits/worlds 供查看与对比，
      // 但不占位分支头——“推算下一回合”始终从 baseWorld 由当前图真实求值。
      id,
      runId: RUN.id,
      label: labelOf(id),
      baseCommit: id === "main" ? null : base.commitId,
      headCommit: base.commitId,
      visibility: id === "main" ? "shared" : "private",
    })),
    commits: [
      {
        id: base.commitId,
        runId: RUN.id,
        branchId: "main",
        parentId: null,
        round: Math.round(base.simTime / RUN.stepSeconds),
        simTime: base.simTime,
        summary: `基础世界 · ${m.scene.id} 初值`,
        checkpoint: true,
        source: "base",
      },
      ...referenceRuns.map(referenceCommit),
    ],
    worlds: [base, ...referenceRuns.map((r) => r.nextWorld)],
  }
}

/** 惰性解析：解析失败在 adapter.load() 内抛出，由 loadWorkbench 收进 error 状态，而不是让模块导入崩溃。 */
export function loadSeed(): SeedData {
  const loaded = loadPrototype()
  return seedFromModel(structuredClone(loaded.model), loaded.referenceRuns)
}
