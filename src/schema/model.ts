/**
 * v0.5 规范化领域模型（design/02/contracts/domain.ts 的实现侧）。
 * 输入 JSON 里的 `id@version` 简写由 parse.ts 转为 ObjectRef；本文件只描述规范化之后的形状。
 * 属性定义、组件定义、模板覆盖、场景实体与世界值分库存放，互不推断。
 */
export type ObjectRef = { id: string ;version: string }
export type Vec3 = [number, number, number]
export type RawValue = number | boolean | string | null | Vec3

export type ValueShape = "scalar" | "vector3" | "matrixRef"
/** 可存进世界的值类型。 */
export const VALUE_PRIMITIVES = [
  "f64",
  "i64",
  "bool",
  "string",
  "EntityRef",
] as const
/** 端口还可以传递效果句柄（Contribute.effect），它不能成为属性或参数类型。 */
export const PORT_PRIMITIVES = [...VALUE_PRIMITIVES, "EffectRef"] as const
export type Primitive = typeof VALUE_PRIMITIVES[number]
export type PortPrimitive = typeof PORT_PRIMITIVES[number]
export interface TypeRef {
  primitive: PortPrimitive
  shape: ValueShape
  quantityKind?: string
  unitId?: string
  frameId?: string
  nullable: boolean
}
/** 属性与程序参数的类型：只能是值类型。 */
export interface ValueTypeRef extends TypeRef {
  primitive: Primitive
}

export type WriteMode = "configuration" | "exclusive" | "contribution" | "contract"

export interface UnitDef {
  id: string
  symbol: string
  quantityKind: string
}

export interface EntityTypeDef {
  id: string
  label: string
  requiredComponentIds: string[]
  optionalComponentIds: string[]
}

export interface ComponentSchema {
  id: string
  label: string
  version: string
  propertyIds: string[]
}

export interface AttributeSchema {
  id: string
  componentId: string
  label: string
  type: ValueTypeRef
  default: RawValue
  writeMode: WriteMode
  reducerRef?: ObjectRef
}

export interface EntityTemplate {
  id: string
  version: string
  label: string
  typeId: string
  componentSchemaRefs: ObjectRef[]
  overrides: Record<string, RawValue>
}

export interface SceneEntity {
  id: string
  label: string
  typeId: string
  templateRef: ObjectRef | null
  componentInstances: { schemaRef: ObjectRef }[]
  initialOverrides: Record<string, RawValue>
}

export interface SceneDraft {
  id: string
  entities: SceneEntity[]
}

export interface EntityQuery {
  id: string
  version: string
  typeId: string
  condition: { propertyId: string ;op: "eq" ;value: RawValue }
  readView: "previous"
  sort: "id"
}

export type Binding = {
  root: "self"
  propertyId: string
  view: "previous" | "selfPreview"
} | { root: "parameter" ;parameterId: string } | {
  root: "upstream"
  nodeId: string
  portId: string
} | { root: "relation" ;relationId: string ;propertyId: string ;view: "previous" }
/** 写入目标：只能指向自身属性，没有读取视图。 */
export type TargetBinding = { root: "self" ;propertyId: string ;view?: never }

export interface LogicNode {
  id: string
  type: string
  inputs: Record<string, TypeRef>
  outputs: Record<string, TypeRef>
  bindings: Record<string, Binding | TargetBinding>
  params: Record<string, RawValue>
}

export interface LogicEdge {
  id: string
  kind: "data" | "control"
  source: { nodeId: string ;portId: string }
  target: { nodeId: string ;portId: string }
}

export interface ProgramParameter {
  id: string
  type: ValueTypeRef
  default: RawValue
}

export interface LogicGraphDocument {
  id: string
  version: string
  kind: "entity-program"
  scopeType: string
  parameters: ProgramParameter[]
  nodes: LogicNode[]
  edges: LogicEdge[]
}

export interface SystemDefinition {
  id: string
  label: string
  queryRef: ObjectRef
  programRef: ObjectRef
  parameters: Record<string, RawValue>
  enabled: boolean
  access: { readPrevious: string[] ;contribute: string[] ;exclusive: string[] }
}

export type ScheduleNode = {
  id: string
  type: "SystemNode"
  systemRef: string
} | {
  id: string
  type: "ReducerNode" | "ContractNode"
  constraintRef: ObjectRef
} | { id: string ;type: "CommitNode" }

export interface ScheduleEdge {
  id: string
  source: string
  target: string
  kind: "order" | "effect" | "product"
}

export interface ScheduleDocument {
  id: string
  version: string
  nodes: ScheduleNode[]
  edges: ScheduleEdge[]
  readView: "previous"
  outputMode: "atomicCommit"
}

export interface ConstraintDef {
  id: string
  version: string
  strategy: "proportional"
  floorC: number
  domain: string
  unsupported: string
}

export interface WorldSnapshot {
  commitId: string
  simTime: number
  values: Record<string, Record<string, RawValue>>
}

/** 画布布局独立于语义文档：移动节点不改变 ScheduleDocument / LogicGraphDocument 的语义。 */
export interface EditorLayout {
  documentId: string
  positions: Record<string, { x: number ;y: number }>
  viewport: { x: number ;y: number ;zoom: number }
}

export interface DomainDiagnostic {
  id: string
  severity: "error" | "warning"
  code: string
  message: string
  target?: {
    documentId: string
    nodeId?: string
    portId?: string
    propertyId?: string
  }
}

export interface PrototypeModel {
  schemaVersion: string
  scope: string
  units: UnitDef[]
  entityTypes: EntityTypeDef[]
  components: ComponentSchema[]
  attributes: AttributeSchema[]
  templates: EntityTemplate[]
  scene: SceneDraft
  queries: EntityQuery[]
  programs: LogicGraphDocument[]
  systems: SystemDefinition[]
  schedules: ScheduleDocument[]
  constraints: ConstraintDef[]
  baseWorld: WorldSnapshot
  layouts: Record<string, EditorLayout>
}

export function refKey(ref: ObjectRef): string {
  return `${ref.id}@${ref.version}`
}

export function sameRef(
  a: ObjectRef | null | undefined,
  b: ObjectRef | null | undefined,
): boolean {
  return Boolean(a && b && a.id === b.id && a.version === b.version)
}
