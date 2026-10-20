import { z } from 'zod'
import {
  PORT_PRIMITIVES,
  VALUE_PRIMITIVES,
  refKey,
  type Binding,
  type DomainDiagnostic,
  type EditorLayout,
  type LogicGraphDocument,
  type LogicNode,
  type ObjectRef,
  type PrototypeModel,
} from './model'
import { resolveSceneWorld, valuesEqual } from './values'

/**
 * prototype_seed.v05.json → PrototypeModel。
 * 1) Zod 解析形状（含 `id@version` → ObjectRef）；2) 交叉引用完整性检查。
 * 解析失败抛出 PrototypeParseError；引用问题以诊断返回，不静默修补。
 */
const objectRef = z.union([
  z
    .string()
    .regex(/^[^@\s]+@[^@\s]+$/, '应为 id@version')
    .transform((s): ObjectRef => {
      const at = s.lastIndexOf('@')
      return { id: s.slice(0, at), version: s.slice(at + 1) }
    }),
  z.object({ id: z.string().min(1), version: z.string().min(1) }),
])

const vec3 = z.tuple([z.number(), z.number(), z.number()])
const rawValue = z.union([z.number(), z.boolean(), z.string(), z.null(), vec3])
const typeRef = z.object({
  primitive: z.enum(PORT_PRIMITIVES),
  shape: z.enum(['scalar', 'vector3', 'matrixRef']),
  quantityKind: z.string().optional(),
  unitId: z.string().optional(),
  frameId: z.string().optional(),
  nullable: z.boolean(),
})

const valueTypeRef = typeRef.extend({ primitive: z.enum(VALUE_PRIMITIVES) })

const binding = z.union([
  z.object({ root: z.literal('self'), propertyId: z.string(), view: z.enum(['previous', 'selfPreview']).optional() }),
  z.object({ root: z.literal('parameter'), parameterId: z.string() }),
  z.object({ root: z.literal('upstream'), nodeId: z.string(), portId: z.string() }),
  z.object({ root: z.literal('relation'), relationId: z.string(), propertyId: z.string(), view: z.literal('previous') }),
])

const port = z.object({ nodeId: z.string(), portId: z.string() })

const seedSchema = z.object({
  schemaVersion: z.literal('figma-prototype/0.5'),
  scope: z.string(),
  units: z.array(z.object({ id: z.string(), symbol: z.string(), quantityKind: z.string() })),
  entityTypes: z.array(
    z.object({ id: z.string(), label: z.string(), requiredComponentIds: z.array(z.string()), optionalComponentIds: z.array(z.string()) }),
  ),
  componentSchemas: z.array(z.object({ id: z.string(), label: z.string(), version: z.string(), propertyIds: z.array(z.string()) })),
  attributeSchemas: z.array(
    z.object({
      id: z.string(),
      componentId: z.string(),
      label: z.string(),
      type: valueTypeRef,
      default: rawValue,
      writeMode: z.enum(['configuration', 'exclusive', 'contribution', 'contract']),
      reducerRef: objectRef.optional(),
    }),
  ),
  entityTemplates: z.array(
    z.object({
      id: z.string(),
      version: z.string(),
      label: z.string(),
      typeId: z.string(),
      componentSchemaRefs: z.array(objectRef),
      overrides: z.record(z.string(), rawValue),
    }),
  ),
  sceneDraft: z.object({
    id: z.string(),
    entities: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
        typeId: z.string(),
        templateRef: objectRef.nullable(),
        componentInstances: z.array(z.object({ schemaRef: objectRef })),
        initialOverrides: z.record(z.string(), rawValue),
      }),
    ),
  }),
  queries: z.array(
    z.object({
      id: z.string(),
      version: z.string(),
      typeId: z.string(),
      condition: z.object({ propertyId: z.string(), op: z.literal('eq'), value: rawValue }),
      readView: z.literal('previous'),
      sort: z.literal('id'),
    }),
  ),
  logicPrograms: z.array(
    z.object({
      id: z.string(),
      version: z.string(),
      kind: z.literal('entity-program'),
      scopeType: z.string(),
      parameters: z.array(z.object({ id: z.string(), type: valueTypeRef, default: rawValue })),
      nodes: z.array(
        z.object({
          id: z.string(),
          type: z.string(),
          inputs: z.record(z.string(), typeRef),
          outputs: z.record(z.string(), typeRef),
          bindings: z.record(z.string(), binding),
          params: z.record(z.string(), rawValue),
        }),
      ),
      edges: z.array(z.object({ id: z.string(), kind: z.enum(['data', 'control']), source: port, target: port })),
    }),
  ),
  systems: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      queryRef: objectRef,
      programRef: objectRef,
      enabled: z.boolean(),
      parameters: z.record(z.string(), rawValue),
      access: z.object({ readPrevious: z.array(z.string()), contribute: z.array(z.string()), exclusive: z.array(z.string()) }),
    }),
  ),
  schedules: z.array(
    z.object({
      id: z.string(),
      version: z.string(),
      nodes: z.array(
        z.discriminatedUnion('type', [
          z.object({ id: z.string(), type: z.literal('SystemNode'), systemRef: z.string() }),
          z.object({ id: z.string(), type: z.literal('ReducerNode'), constraintRef: objectRef }),
          z.object({ id: z.string(), type: z.literal('ContractNode'), constraintRef: objectRef }),
          z.object({ id: z.string(), type: z.literal('CommitNode') }),
        ]),
      ),
      edges: z.array(z.object({ id: z.string(), source: z.string(), target: z.string(), kind: z.enum(['order', 'effect', 'product']) })),
      readView: z.literal('previous'),
      outputMode: z.literal('atomicCommit'),
    }),
  ),
  constraints: z.array(
    z.object({
      id: z.string(),
      version: z.string(),
      strategy: z.literal('proportional'),
      floorC: z.number(),
      domain: z.string(),
      unsupported: z.string(),
    }),
  ),
  baseWorld: z.object({ commitId: z.string(), simTime: z.number(), values: z.record(z.string(), z.record(z.string(), rawValue)) }),
  layout: z.record(z.string(), z.record(z.string(), z.object({ x: z.number(), y: z.number() }))),
})

/** 各部分的 schema：本地草稿恢复复用同一套校验，不另写一份宽松版本。 */
export const seedParts = seedSchema.shape
export const layoutSchema = z.object({
  documentId: z.string(),
  positions: z.record(z.string(), z.object({ x: z.number(), y: z.number() })),
  viewport: z.object({ x: z.number(), y: z.number(), zoom: z.number().positive() }),
})

type ParsedProgram = z.output<typeof seedSchema>['logicPrograms'][number]

export function normalizeProgram(p: ParsedProgram): LogicGraphDocument {
  return {
    ...p,
    nodes: p.nodes.map((n) => ({
      ...n,
      // 读取绑定必须写明视图；只有写入目标（Contribute.target）允许省略。
      bindings: Object.fromEntries(
        Object.entries(n.bindings).map(([k, b]): [string, LogicNode['bindings'][string]] => [k, b.root === 'self' && !b.view ? { root: 'self', propertyId: b.propertyId } : (b as Binding)]),
      ),
    })),
  }
}

export class PrototypeParseError extends Error {
  constructor(readonly issues: string[]) {
    super(`prototype_seed 解析失败：${issues.slice(0, 3).join('；')}${issues.length > 3 ? ` 等 ${issues.length} 项` : ''}`)
    this.name = 'PrototypeParseError'
  }
}

export function parsePrototypeSeed(raw: unknown): { model: PrototypeModel; diagnostics: DomainDiagnostic[] } {
  const parsed = seedSchema.safeParse(raw)
  if (!parsed.success) {
    throw new PrototypeParseError(parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`))
  }
  const s = parsed.data
  const layouts: Record<string, EditorLayout> = {}
  // 种子只给出节点坐标；视口没有记录时取 1:1 原点，这是规范化默认值而不是业务数据。
  for (const [documentId, positions] of Object.entries(s.layout)) layouts[documentId] = { documentId, positions, viewport: { x: 0, y: 0, zoom: 1 } }

  const model: PrototypeModel = {
    schemaVersion: s.schemaVersion,
    scope: s.scope,
    units: s.units,
    entityTypes: s.entityTypes,
    components: s.componentSchemas,
    attributes: s.attributeSchemas,
    templates: s.entityTemplates,
    scene: s.sceneDraft,
    queries: s.queries,
    programs: s.logicPrograms.map(normalizeProgram),
    systems: s.systems,
    schedules: s.schedules,
    constraints: s.constraints,
    baseWorld: s.baseWorld,
    layouts,
  }
  return { model, diagnostics: checkIntegrity(model) }
}

/** 交叉引用：每一处 id / id@version 都必须能解析到唯一对象。 */
export function checkIntegrity(m: PrototypeModel): DomainDiagnostic[] {
  const out: DomainDiagnostic[] = []
  const add = (severity: DomainDiagnostic['severity'], code: string, message: string, target?: DomainDiagnostic['target']) =>
    out.push({ id: `integrity-${out.length + 1}`, severity, code, message, target })

  const units = new Map(m.units.map((u) => [u.id, u]))
  const components = new Map(m.components.map((c) => [c.id, c]))
  const componentRefs = new Set(m.components.map((c) => `${c.id}@${c.version}`))
  const attributes = new Map(m.attributes.map((a) => [a.id, a]))
  const types = new Map(m.entityTypes.map((t) => [t.id, t]))
  const constraints = new Set(m.constraints.map((c) => `${c.id}@${c.version}`))
  const templates = new Map(m.templates.map((t) => [`${t.id}@${t.version}`, t]))
  const queries = new Set(m.queries.map((q) => `${q.id}@${q.version}`))
  const programs = new Map(m.programs.map((p) => [`${p.id}@${p.version}`, p]))
  const systems = new Set(m.systems.map((s) => s.id))

  for (const c of m.components)
    for (const pid of c.propertyIds) {
      const a = attributes.get(pid)
      if (!a) add('error', 'SCHEMA_REF_MISSING', `组件 ${c.id} 引用了不存在的属性 ${pid}`, { documentId: c.id, propertyId: pid })
      else if (a.componentId !== c.id) add('error', 'SCHEMA_OWNER_MISMATCH', `属性 ${pid} 声明属于 ${a.componentId}，却列在组件 ${c.id} 中`, { documentId: c.id, propertyId: pid })
    }
  for (const a of m.attributes) {
    if (!components.get(a.componentId)?.propertyIds.includes(a.id)) add('error', 'SCHEMA_OWNER_MISMATCH', `属性 ${a.id} 未登记在组件 ${a.componentId} 中`, { documentId: a.componentId, propertyId: a.id })
    if (a.type.unitId) {
      const unit = units.get(a.type.unitId)
      if (!unit) add('error', 'UNIT_MISSING', `属性 ${a.id} 的单位 ${a.type.unitId} 不存在`, { documentId: a.componentId, propertyId: a.id })
      else if (a.type.quantityKind && unit.quantityKind !== a.type.quantityKind)
        add('error', 'UNIT_KIND_MISMATCH', `属性 ${a.id} 量种 ${a.type.quantityKind} 与单位 ${unit.id}（${unit.quantityKind}）不符`, { documentId: a.componentId, propertyId: a.id })
    }
    if (a.default === null && !a.type.nullable) add('error', 'NULL_NOT_ALLOWED', `属性 ${a.id} 不可空，但默认值为 null`, { documentId: a.componentId, propertyId: a.id })
    if (a.writeMode === 'contribution' && !a.reducerRef) add('error', 'REDUCER_MISSING', `贡献写入属性 ${a.id} 缺少归约规则`, { documentId: a.componentId, propertyId: a.id })
    if (a.reducerRef && !constraints.has(refKey(a.reducerRef))) add('error', 'CONSTRAINT_REF_MISSING', `属性 ${a.id} 的归约规则 ${refKey(a.reducerRef)} 不存在`, { documentId: a.componentId, propertyId: a.id })
  }
  for (const t of m.entityTypes)
    for (const cid of [...t.requiredComponentIds, ...t.optionalComponentIds])
      if (!components.has(cid)) add('error', 'SCHEMA_REF_MISSING', `实体类型 ${t.id} 引用了不存在的组件 ${cid}`, { documentId: t.id })
  for (const t of m.templates) {
    if (!types.has(t.typeId)) add('error', 'TYPE_REF_MISSING', `模板 ${t.id}@${t.version} 的类型 ${t.typeId} 不存在`, { documentId: t.id })
    for (const r of t.componentSchemaRefs) if (!componentRefs.has(refKey(r))) add('error', 'SCHEMA_REF_MISSING', `模板 ${t.id} 引用了不存在的组件版本 ${refKey(r)}`, { documentId: t.id })
    for (const pid of Object.keys(t.overrides)) {
      const a = attributes.get(pid)
      if (!a || !t.componentSchemaRefs.some((r) => r.id === a.componentId))
        add('error', 'PROPERTY_NOT_ASSEMBLED', `模板 ${t.id} 覆盖了未装配组件的属性 ${pid}`, { documentId: t.id, propertyId: pid })
    }
  }
  for (const e of m.scene.entities) {
    const type = types.get(e.typeId)
    if (!type) add('error', 'TYPE_REF_MISSING', `实体 ${e.id} 的类型 ${e.typeId} 不存在`, { documentId: m.scene.id, nodeId: e.id })
    if (e.templateRef && !templates.has(refKey(e.templateRef))) add('error', 'TEMPLATE_REF_MISSING', `实体 ${e.id} 的模板 ${refKey(e.templateRef)} 不存在`, { documentId: m.scene.id, nodeId: e.id })
    const assembled = new Set(e.componentInstances.map((ci) => ci.schemaRef.id))
    for (const ci of e.componentInstances)
      if (!componentRefs.has(refKey(ci.schemaRef))) add('error', 'SCHEMA_REF_MISSING', `实体 ${e.id} 装配了不存在的组件版本 ${refKey(ci.schemaRef)}`, { documentId: m.scene.id, nodeId: e.id })
    for (const cid of type?.requiredComponentIds ?? [])
      if (!assembled.has(cid)) add('error', 'REQUIRED_COMPONENT_MISSING', `实体 ${e.id}（${e.typeId}）缺少必需组件 ${cid}`, { documentId: m.scene.id, nodeId: e.id })
    for (const pid of Object.keys(e.initialOverrides)) {
      const a = attributes.get(pid)
      if (!a || !assembled.has(a.componentId))
        add('error', 'PROPERTY_NOT_ASSEMBLED', `实体 ${e.id} 覆盖了未装配组件的属性 ${pid}`, { documentId: m.scene.id, nodeId: e.id, propertyId: pid })
    }
  }
  for (const q of m.queries) {
    if (!types.has(q.typeId)) add('error', 'TYPE_REF_MISSING', `查询 ${q.id} 的类型 ${q.typeId} 不存在`, { documentId: q.id })
    if (!attributes.has(q.condition.propertyId)) add('error', 'SCHEMA_REF_MISSING', `查询 ${q.id} 的条件属性 ${q.condition.propertyId} 不存在`, { documentId: q.id })
  }
  for (const p of m.programs) {
    const nodes = new Map(p.nodes.map((n) => [n.id, n]))
    for (const e of p.edges) {
      const src = nodes.get(e.source.nodeId)
      const dst = nodes.get(e.target.nodeId)
      if (!src?.outputs[e.source.portId] || !dst?.inputs[e.target.portId])
        add('error', 'PORT_REF_MISSING', `连线 ${e.id} 指向不存在的端口`, { documentId: p.id, nodeId: e.target.nodeId, portId: e.target.portId })
    }
  }
  for (const s of m.systems) {
    if (!queries.has(refKey(s.queryRef))) add('error', 'QUERY_REF_MISSING', `System ${s.id} 的查询 ${refKey(s.queryRef)} 不存在`, { documentId: s.id })
    const program = programs.get(refKey(s.programRef))
    if (!program) add('error', 'PROGRAM_REF_MISSING', `System ${s.id} 的程序 ${refKey(s.programRef)} 不存在`, { documentId: s.id })
    else
      for (const key of Object.keys(s.parameters))
        if (!program.parameters.some((pp) => pp.id === key)) add('error', 'PARAMETER_UNKNOWN', `System ${s.id} 设置了程序未声明的参数 ${key}`, { documentId: s.id })
  }
  for (const sch of m.schedules) {
    const ids = new Set(sch.nodes.map((n) => n.id))
    for (const n of sch.nodes) {
      if (n.type === 'SystemNode' && !systems.has(n.systemRef)) add('error', 'SYSTEM_REF_MISSING', `调度节点 ${n.id} 引用了不存在的 System ${n.systemRef}`, { documentId: sch.id, nodeId: n.id })
      if ((n.type === 'ReducerNode' || n.type === 'ContractNode') && !constraints.has(refKey(n.constraintRef)))
        add('error', 'CONSTRAINT_REF_MISSING', `调度节点 ${n.id} 的约束 ${refKey(n.constraintRef)} 不存在`, { documentId: sch.id, nodeId: n.id })
    }
    for (const e of sch.edges)
      if (!ids.has(e.source) || !ids.has(e.target)) add('error', 'SCHEDULE_EDGE_DANGLING', `调度边 ${e.id} 指向不存在的节点`, { documentId: sch.id, nodeId: e.target })
  }

  // 场景初值（实例覆盖 > 模板覆盖 > 属性默认）必须与基础世界一致，否则说明两者之一被手改。
  const derived = resolveSceneWorld(m)
  for (const e of m.scene.entities) {
    const base = m.baseWorld.values[e.id] ?? {}
    const keys = new Set([...Object.keys(base), ...Object.keys(derived[e.id] ?? {})])
    for (const pid of keys) {
      const want = derived[e.id]?.[pid]
      if (!(pid in base) || want === undefined || !valuesEqual(base[pid], want))
        add('warning', 'BASE_WORLD_MISMATCH', `基础世界 ${m.baseWorld.commitId} 中 ${e.id}.${pid} 与场景初值推导结果不一致`, { documentId: m.scene.id, nodeId: e.id, propertyId: pid })
    }
  }
  return out
}
