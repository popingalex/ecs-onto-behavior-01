/**
 * 领域契约（UI 侧镜像）。正式定义归 Rust core；此处只描述 UI 需要读取的形状。
 * 稳定 ID 一律为字符串，不使用第三方组件内部序号。
 */

export type PageId = "P01" | "P02" | "P03" | "P04" | "P05" | "P06" | "P07" | "P08" | "P09" | "P10" | "P11" | "P12" | "P13" | "P14" | "P15" | "P16" | "P17" | "P18" | "P19" | "P20" | "P21" | "P22" | "P23" | "P24" | "P25" | "P26" | "P27" | "P28" | "P29" | "P30" | "P31"

export type GroupId = "project" | "modeling" | "logic" | "simulation"

/** project：总览；asset：模型/场景/程序资产；execution：运行/分支/提交。两组不混排。 */
export type ContextKind = "project" | "asset" | "execution"

export type WorkbenchMode = "overview" | "edit" | "run" | "history"

export type Role = "modeler" | "director" | "observer"

export type ComponentId = "C01" | "C02" | "C03" | "C04" | "C05" | "C06" | "C07" | "C08" | "C09" | "C10" | "C11" | "C12" | "C13" | "C14" | "C15" | "C16" | "C17" | "C18" | "C19" | "C20"

export interface Route {
  pageId: PageId
  params: Record<string, string>
}

export type Severity = "error" | "warning" | "info"

export interface Diagnostic {
  id: string
  severity: Severity
  code: string
  message: string
  objectLabel?: string
  target?: Route
}

// ---------- 模式层 ----------

export type ValueShape = "scalar" | "vector3" | "matrixRef"
export type Primitive = "f64" | "i64" | "bool" | "string" | "EntityRef"
export type WriteMode = "configuration" | "exclusive" | "contribution" | "contract"
export type Vector3 = [number, number, number]
export type RawValue = number | boolean | string | Vector3 | null

export interface QuantityKind {
  id: string
  label: string
}

export interface UnitDef {
  id: string
  symbol: string
  label: string
  quantityId: string
}

export interface ComponentDef {
  id: string
  label: string
  description: string
}

export interface PropertyDef {
  id: string
  componentId: string
  label: string
  shape: ValueShape
  primitive: Primitive
  unitId: string | null
  nullable: boolean
  default: RawValue
  writeMode: WriteMode
  reducer?: string
  description: string
}

export interface ClassDef {
  id: string
  label: string
  parent: string | null
  /** 必需 + 可选组件（展示用）。实体实际装配哪些组件看 EntityDef.components。 */
  components: string[]
  requiredComponents: string[]
  optionalComponents: string[]
}

export interface VersionedAsset {
  id: string
  version: string
  label: string
}

export interface TemplateDef extends VersionedAsset {
  classId: string
}

export interface AssetDef extends VersionedAsset {
  kind: "model3d" | "map" | "icon"
}

export interface EntityDef {
  id: string
  label: string
  classId: string
  templateRef: string | null
  /** 已装配的组件实例（来自 v0.5 componentInstances）；属性是否适用只看这里。 */
  components: string[]
}

export interface QueryDef {
  id: string
  label: string
  classId: string
}

export interface SystemDef {
  id: string
  label: string
  graphRef: string
  queryId: string
  enabled: boolean
}

export interface NamedDef {
  id: string
  label: string
}

// ---------- 执行对象 ----------

export interface BundleDef {
  id: string
  label: string
  revision: number
}

export interface RunDef {
  id: string
  label: string
  bundleId: string
  stepSeconds: number
  playbackSeconds: number
  runtime: "server" | "local-worker"
}

export interface BranchDef {
  id: string
  runId: string
  label: string
  baseCommit: string | null
  headCommit: string
  visibility: "shared" | "private" | "team"
}

export interface CommitDef {
  id: string
  runId: string
  branchId: string
  parentId: string | null
  round: number
  simTime: number
  summary: string
  checkpoint: boolean
  /**
   * base：v0.5 基础世界；reference-sample：expected_runs 的预期样例（不是当前图计算结果）；
   * computed：浏览器端执行器按当前图计算得到。
   */
  source: "base" | "reference-sample" | "computed"
}

/** 某个不可变提交的世界快照：entityId → propertyId → 原始值。 */
export interface WorldSnapshot {
  commitId: string
  simTime?: number
  values: Record<string, Record<string, RawValue>>
}

// ---------- 值展示 ----------

/**
 * 值状态（01_layout「值与状态表达」）。不同状态来自不同记录，
 * 不能用一个标签在同一值上随意切换，也不能用 0 占位。
 */
export type DisplayValue = {
  state: "value"
  value: Exclude<RawValue, null>
  commitId?: string
} | { state: "null" } | { state: "notApplicable" } | {
  state: "requested"
  value: number
} | { state: "selfPreview" ;value: Exclude<RawValue, null> } | {
  state: "pending"
} | { state: "unknownSource" } | { state: "unrecorded" } | {
  state: "invalid"
  reason: string
}

// ---------- 命令 ----------

/** 草稿命令：{commandId, baseRevision, targetId, patch}。prev 用于撤销。 */
export interface DraftCommand {
  commandId: string
  type: string
  label: string
  baseRevision: number
  targetId: string
  patch: Record<string, unknown>
  prev: Record<string, { present: boolean ;value: unknown }>
}

export type RunCommandStatus = "pending" | "accepted" | "applied" | "rejected"

/** 运行命令：{commandId, idempotencyKey, baseCommit, actorId, type, args}。 */
export interface RunCommand {
  commandId: string
  idempotencyKey: string
  baseCommit: string
  actorId: string
  type: string
  args: Record<string, unknown>
  status: RunCommandStatus
  createdAt: number
  message?: string
}

export type RunPhase = "waitingInputs" | "frozen" | "computing" | "committing" | "committed" | "playing"
