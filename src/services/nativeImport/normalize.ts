import type {
  AttributeSchema,
  ComponentSchema,
  EntityTypeDef,
  PrototypeModel,
  RawValue,
  SceneEntity,
  UnitDef,
} from "@/schema/model"
import {
  classifyAttrType,
  isRawValue,
  isVec3Value,
  nativeDiskDeltaSchema,
  nativeMetaSchema,
  nativeTickRowSchema,
  NATIVE_BASE_VERSION,
  type FixtureArchetype,
  type FixtureComponent,
  type FixtureInstance,
  type NativeBranch,
  type NativeFrame,
  type NativeRunBundle,
} from "./types"
import { NATIVE_UNKNOWN_UNIT, lookupNativeUnit } from "./catalog"
import type { NativeModelFixtures, RunBDiskFrame, RunCRaw } from "./fixtures"

/**
 * 归一化器：引擎工件 → 工作台模型/场景/运行结构。
 * 规则（design/04/resp/04_semantics_gap_analysis.md §2）：
 * - 键缺失 = UNSET（不进 overrides/世界值，不回填 0）；
 * - 显式 null = EXPLICIT_NULL（保留原值）；
 * - 组件存在性 = archetype 成员（不在成员内 → NOT_APPLICABLE，不猜）；
 * - 单位查表（catalog.NATIVE_UNIT_MAP），查无 = unknown，不猜；
 * - 非 RawValue 值（对象/元组数组/网格）入 blocks 清单，不展开实体、不进世界值。
 */

export type FrameValues = Map<string, Map<string, RawValue>>
export type FrameBlocks = Map<string, Map<string, number>>

export interface NormalizedSchema {
  units: UnitDef[]
  entityTypes: EntityTypeDef[]
  components: ComponentSchema[]
  attributes: AttributeSchema[]
  /** 复杂类型属性（元组数组/网格句柄等）——只登记不进值域。 */
  complexAttributes: Array<{ path: string; type: string; componentId: string }>
  archetypeComponents: Map<string, string[]>
}

export interface NormalizedScene {
  sceneId: string
  entities: SceneEntity[]
  /** 实例里出现但 schema 未声明的属性路径（去重）。 */
  undeclaredAttributes: string[]
  /** 实例里的非 RawValue 属性（网格/对象值 → blockRef 清单）。 */
  blockAttributes: Array<{ instanceId: string; path: string }>
}

export interface NormalizedModel {
  schema: NormalizedSchema
  scene: NormalizedScene
  /** fixture 实例目录与 PG 场景行的对账（清单用，不阻塞导入）。 */
  sceneDrift: {
    fixtureCount: number
    pgCount: number
    fixtureOnly: string[]
    pgOnly: string[]
  }
}

function primitiveFor(type: string): "f64" | "bool" | "string" {
  if (type === "b") return "bool"
  if (type === "s") return "string"
  return "f64"
}

/** 值分类：标量 / Vec3 可进世界；其余（含长度≠3 数组、对象）进 blocks。 */
function rawOrBlock(value: unknown): { raw: RawValue | null } {
  if (isRawValue(value)) return { raw: value }
  if (isVec3Value(value)) return { raw: value }
  return { raw: null }
}

export function normalizeSchema(
  archetypes: FixtureArchetype[],
  components: FixtureComponent[],
): NormalizedSchema {
  const units: UnitDef[] = []
  const seenUnits = new Set<string>()
  const ensureUnit = (u: { unitId: string; symbol: string; quantityKind: string }) => {
    if (seenUnits.has(u.unitId)) return
    seenUnits.add(u.unitId)
    units.push({ id: u.unitId, symbol: u.symbol, quantityKind: u.quantityKind })
  }

  const componentById = new Map(components.map((c) => [c.id, c]))
  const attributes: AttributeSchema[] = []
  const complexAttributes: NormalizedSchema["complexAttributes"] = []
  for (const comp of components) {
    for (const attr of comp.attributes) {
      const prefix = attr.id.includes("/") ? attr.id.split("/")[0] : comp.id
      if (prefix !== comp.id) continue // 声明归属其他组件的属性不在此重复登记
      const cls = classifyAttrType(attr.type)
      const resolved = lookupNativeUnit(attr.id) ?? NATIVE_UNKNOWN_UNIT
      ensureUnit(resolved)
      if (cls === "complex") {
        complexAttributes.push({ path: attr.id, type: attr.type, componentId: comp.id })
        continue
      }
      const fallback: RawValue = isRawValue(attr.value) || isVec3Value(attr.value)
        ? attr.value
        : null
      attributes.push({
        id: attr.id,
        componentId: comp.id,
        label: attr.name?.trim() || attr.id,
        type: {
          primitive: cls === "scalar" ? primitiveFor(attr.type) : "f64",
          shape: cls === "vector3" ? "vector3" : "scalar",
          quantityKind: resolved.quantityKind,
          unitId: resolved.unitId,
          frameId:
            attr.id === "transform/position" ? "native-geodetic-lon-alt-lat" : undefined,
          nullable: attr.value === null,
        },
        default: fallback,
        writeMode: "configuration",
      })
    }
  }

  const entityTypes: EntityTypeDef[] = []
  const archetypeComponents = new Map<string, string[]>()
  for (const arch of archetypes) {
    const memberIds = new Set<string>()
    for (const attr of arch.attributes) {
      const prefix = attr.id.includes("/") ? attr.id.split("/")[0] : null
      if (prefix && componentById.has(prefix)) memberIds.add(prefix)
    }
    const members = [...memberIds].sort()
    archetypeComponents.set(arch.id, members)
    entityTypes.push({
      id: arch.id,
      label: arch.name?.trim() || arch.id,
      parent: null,
      requiredComponentIds: members,
      optionalComponentIds: [],
    })
  }

  return {
    units,
    entityTypes,
    components: components.map((c) => ({
      id: c.id,
      label: c.name?.trim() || c.id,
      version: "native-1",
      propertyIds: c.attributes
        .filter((a) => {
          const prefix = a.id.includes("/") ? a.id.split("/")[0] : c.id
          return prefix === c.id && classifyAttrType(a.type) !== "complex"
        })
        .map((a) => a.id),
    })),
    attributes,
    complexAttributes,
    archetypeComponents,
  }
}

export function normalizeScene(
  sceneId: string,
  instances: FixtureInstance[],
  fixtureInstances: FixtureInstance[],
  schema: NormalizedSchema,
): NormalizedScene {
  const declared = new Set([
    ...schema.attributes.map((a) => a.id),
    ...schema.complexAttributes.map((c) => c.path),
  ])
  const complexPaths = new Set(schema.complexAttributes.map((c) => c.path))
  const entities: SceneEntity[] = []
  const undeclared = new Set<string>()
  const blockAttributes: NormalizedScene["blockAttributes"] = []

  for (const inst of instances) {
    const overrides: Record<string, RawValue> = {}
    const members = schema.archetypeComponents.get(inst.entity) ?? []
    for (const attr of inst.attributes ?? []) {
      if (!declared.has(attr.id)) {
        undeclared.add(attr.id)
        continue
      }
      const { raw } = rawOrBlock(attr.value)
      if (raw === null || complexPaths.has(attr.id)) {
        blockAttributes.push({ instanceId: inst.id, path: attr.id })
        continue
      }
      overrides[attr.id] = raw
    }
    entities.push({
      id: inst.id,
      label: inst.name?.trim() || inst.id,
      typeId: inst.entity,
      templateRef: null,
      componentInstances: members.map((id) => ({ schemaRef: { id, version: "native-1" } })),
      initialOverrides: overrides,
    })
  }

  const pgIds = new Set(instances.map((i) => i.id))
  const fixtureIds = new Set(fixtureInstances.map((i) => i.id))
  return {
    sceneId,
    entities,
    undeclaredAttributes: [...undeclared],
    blockAttributes,
  }
}

export function normalizeModel(fixtures: NativeModelFixtures): NormalizedModel {
  const schema = normalizeSchema(fixtures.archetypes, fixtures.components)
  const scene = normalizeScene(
    "chem-roaded",
    fixtures.sceneInstances,
    fixtures.fixtureInstances,
    schema,
  )
  const pgIds = new Set(fixtures.sceneInstances.map((i) => i.id))
  const fixtureIds = new Set(fixtures.fixtureInstances.map((i) => i.id))
  return {
    schema,
    scene,
    sceneDrift: {
      fixtureCount: fixtures.fixtureInstances.length,
      pgCount: fixtures.sceneInstances.length,
      fixtureOnly: [...fixtureIds].filter((id) => !pgIds.has(id)),
      pgOnly: [...pgIds].filter((id) => !fixtureIds.has(id)),
    },
  }
}

// ---------- 运行样例 B：磁盘工件 → PROPERTY_DELTA 运行包 ----------

export function buildRunB(disk: {
  runId: string
  frames: RunBDiskFrame[]
  branchIds: string[]
}): NativeRunBundle {
  const framesByBranch = new Map<string, RunBDiskFrame[]>()
  for (const f of disk.frames) {
    const branch =
      f.attributeDeltas[0]?.branch ??
      (f.meta as { branchId?: string } | null)?.branchId ??
      "main"
    const list = framesByBranch.get(branch) ?? []
    list.push(f)
    framesByBranch.set(branch, list)
  }
  const branches: NativeBranch[] = []
  const heads: Record<string, number> = {}
  for (const [branchId, frames] of framesByBranch) {
    frames.sort((a, b) => a.frame - b.frame)
    const nativeFrames: NativeFrame[] = frames.map((f) => {
      const values: FrameValues = new Map()
      const blocks: FrameBlocks = new Map()
      for (const [instId, attrs] of Object.entries(f.frameData)) {
        const row = new Map<string, RawValue>()
        const blockRow = new Map<string, number>()
        for (const [path, value] of Object.entries(attrs)) {
          const { raw } = rawOrBlock(value)
          if (raw !== null) row.set(path, raw)
          else blockRow.set(path, (blockRow.get(path) ?? 0) + 1)
        }
        if (row.size || blockRow.size) {
          // 空标量行也保留实例身份（如 environment 帧 0 全部为网格块）——REAL-03 身份不丢。
          values.set(instId, row)
        }
        if (blockRow.size) blocks.set(instId, blockRow)
      }
      const deltas = f.attributeDeltas.map((d) => {
        const parsed = nativeDiskDeltaSchema.parse(d)
        return {
          instanceId: parsed.instanceId,
          attribute: parsed.id,
          layer: "post" as const,
          // 磁盘 attribute_deltas 无 source_system_id：PROPERTY_DELTA 级，缺即不造。
        }
      })
      const metaParsed = nativeMetaSchema.safeParse(f.meta)
      return {
        frame: f.frame,
        values,
        blocks,
        deltas,
        meta: metaParsed.success ? metaParsed.data : undefined,
      }
    })
    branches.push({ id: branchId, forkedFrom: null, frames: nativeFrames })
    heads[branchId] = nativeFrames[nativeFrames.length - 1]?.frame ?? 0
  }
  return {
    runId: disk.runId,
    executionId: null,
    sceneId: "chem-roaded",
    traceCompleteness: "PROPERTY_DELTA",
    branches,
    heads,
    undeclaredAttributes: [],
  }
}

// ---------- 运行样例 C：bundle + PG ticks → SYSTEM_EFFECT 运行包 ----------

function shimComponent(raw: unknown): FixtureComponent {
  const c = raw as { id: string; name?: string; attributes?: unknown[] }
  return {
    id: String(c.id),
    name: c.name,
    attributes: (c.attributes ?? []).map((a) => {
      const x = a as { id: string; name?: string; value?: unknown; type?: string; config?: unknown }
      return {
        id: String(x.id),
        name: x.name,
        value: (x.value ?? null) as unknown,
        type: x.type ?? "u",
        config: x.config as FixtureComponent["attributes"][number]["config"],
      }
    }),
  }
}

function shimArchetype(raw: unknown): FixtureArchetype {
  const a = raw as { id: string; name?: string; description?: string; attributes?: unknown[] }
  return {
    id: String(a.id),
    name: a.name,
    description: a.description,
    attributes: (a.attributes ?? []).map((x) => {
      const t = x as { id: string; name?: string; value?: unknown; type?: string; config?: unknown }
      return {
        id: String(t.id),
        name: t.name,
        value: (t.value ?? null) as unknown,
        type: t.type ?? "u",
        config: t.config as FixtureArchetype["attributes"][number]["config"],
      }
    }),
  }
}

function cloneState(src: FrameValues): FrameValues {
  const out: FrameValues = new Map()
  for (const [k, v] of src) out.set(k, new Map(v))
  return out
}

function cloneBlocks(src: FrameBlocks): FrameBlocks {
  const out: FrameBlocks = new Map()
  for (const [k, v] of src) out.set(k, new Map(v))
  return out
}

export function buildRunC(raw: RunCRaw): {
  bundle: NativeRunBundle
  scene: NormalizedScene
  schema: NormalizedSchema
} {
  const instances = (raw.bundle.scene.instances as FixtureInstance[]).map(
    (i) =>
      ({
        id: i.id,
        name: i.name,
        entity: i.entity,
        attributes: (i.attributes ?? []).map((a) => ({ id: a.id, value: a.value })),
      }) as FixtureInstance,
  )
  const components = (raw.bundle.components as unknown[]).map(shimComponent)
  const archetypes = (raw.bundle.entities as unknown[]).map(shimArchetype)
  const schema = normalizeSchema(archetypes, components)
  const scene = normalizeScene(raw.sceneId, instances, instances, schema)

  const declaredPaths = new Set([
    ...schema.attributes.map((a) => a.id),
    ...schema.complexAttributes.map((c) => c.path),
  ])
  const undeclared = new Set<string>()

  // 初始世界：bundle 实例属性（RawValue 过滤同场景规则）。
  const baseValues: FrameValues = new Map()
  const baseBlocks: FrameBlocks = new Map()
  for (const inst of instances) {
    const row = new Map<string, RawValue>()
    const blockRow = new Map<string, number>()
    for (const attr of inst.attributes ?? []) {
      if (!declaredPaths.has(attr.id)) undeclared.add(attr.id)
      const { raw: v } = rawOrBlock(attr.value)
      if (v !== null) row.set(attr.id, v)
      else blockRow.set(attr.id, 1)
    }
    if (row.size || blockRow.size) baseValues.set(inst.id, row)
    if (blockRow.size) baseBlocks.set(inst.id, blockRow)
  }

  const rows = raw.ticks
    .map((t) => nativeTickRowSchema.parse(t))
    .sort((a, b) =>
      a.branchId === b.branchId ? a.frame - b.frame : a.branchId.localeCompare(b.branchId),
    )

  const branches: NativeBranch[] = []
  const heads: Record<string, number> = {}
  const stateByBranch = new Map<string, FrameValues>()
  const blocksByBranch = new Map<string, FrameBlocks>()
  for (const row of rows) {
    if (!stateByBranch.has(row.branchId)) {
      // 分支起点：main 从 bundle 初值；fork 分支复制 main 最后已知状态。
      // 精确 fork tick 引擎未随样例导出（branches jsonb 缺口），保守自 main 当前状态。
      const mainState = stateByBranch.get("main")
      stateByBranch.set(row.branchId, mainState ? cloneState(mainState) : cloneState(baseValues))
      blocksByBranch.set(
        row.branchId,
        cloneBlocks(blocksByBranch.get("main") ?? baseBlocks),
      )
    }
    const state = stateByBranch.get(row.branchId)!
    const blocks = blocksByBranch.get(row.branchId)!
    for (const delta of row.deltas) {
      if (!declaredPaths.has(delta.attribute)) undeclared.add(delta.attribute)
      let instRow = state.get(delta.instance_id)
      if (!instRow) {
        instRow = new Map()
        state.set(delta.instance_id, instRow)
      }
      const { raw: v } = rawOrBlock(delta.value)
      if (v !== null) instRow.set(delta.attribute, v)
      else {
        instRow.delete(delta.attribute)
        let b = blocks.get(delta.instance_id)
        if (!b) {
          b = new Map()
          blocks.set(delta.instance_id, b)
        }
        b.set(delta.attribute, (b.get(delta.attribute) ?? 0) + 1)
      }
    }
    const frame: NativeFrame = {
      frame: row.frame,
      values: cloneState(state),
      blocks: cloneBlocks(blocks),
      deltas: row.deltas.map((d) => ({
        instanceId: d.instance_id,
        attribute: d.attribute,
        layer: d.frame_layer === "pre" ? "pre" : "post",
        sourceSystemId: d.source_system_id,
      })),
    }
    let branch = branches.find((b) => b.id === row.branchId)
    if (!branch) {
      branch =
        row.branchId === "main"
          ? { id: "main", forkedFrom: null, frames: [] }
          : { id: row.branchId, forkedFrom: { branch: "main", frame: 0 }, frames: [] }
      branches.push(branch)
    }
    branch.frames.push(frame)
    heads[row.branchId] = row.frame
  }

  return {
    bundle: {
      runId: raw.runId,
      executionId: raw.executionId,
      sceneId: raw.sceneId,
      traceCompleteness: "SYSTEM_EFFECT",
      branches,
      heads,
      undeclaredAttributes: [...undeclared],
    },
    scene,
    schema,
  }
}

/** 归一化结果 → 草稿/执行共用的 PrototypeModel（systems/queries/programs 留空：引擎无此层）。 */
export function toPrototypeModel(
  schema: NormalizedSchema,
  scene: NormalizedScene,
  worldsSeed: WorldSeed,
): PrototypeModel {
  return {
    schemaVersion: NATIVE_BASE_VERSION,
    scope: `真实只读导入 · mas-rust@${NATIVE_SOURCE_REVISION_SAFE} · ${scene.sceneId}`,
    units: schema.units,
    entityTypes: schema.entityTypes,
    components: schema.components,
    attributes: schema.attributes,
    templates: [],
    scene: { id: scene.sceneId, entities: scene.entities },
    queries: [],
    programs: [],
    systems: [],
    schedules: [],
    constraints: [],
    baseWorld: {
      commitId: worldsSeed.commitId,
      simTime: worldsSeed.simTime,
      values: worldsSeed.values,
    },
    layouts: {},
  }
}

const NATIVE_SOURCE_REVISION_SAFE = "65c7f96"

/** 世界种子：用于 PrototypeModel.baseWorld 与 SeedData.worlds[0]。 */
export interface WorldSeed {
  commitId: string
  simTime: number
  values: Record<string, Record<string, RawValue>>
}
