import type {
  DomainDiagnostic,
  LogicGraphDocument,
  PrototypeModel,
  WorldSnapshot,
} from "@/schema/model"

/**
 * RoundResult：一回合的完整计算过程记录（design/02/contracts/domain.ts 的实现侧）。
 * 记录不可变：写入 trace store 后任何筛选 / 当前图修改都不会改变它。
 * elapsedMs 一律为 null——原型不做实测耗时，页面显示“未测量”，不编造数字。
 */
export interface RunRecord {
  id: string
  runId: string
  branchId: string
  baseCommit: string
  resultCommit: string
  modelVersion: string
  scheduleRef: string
  programRefs: string[]
  /** 冻结输入版本快照：schema/scene/systems 与每个程序、调度的语义哈希。 */
  inputVersions: Record<string, string>
  simTimeBefore: number
  simTimeAfter: number
  /** 执行批次：System 逻辑并行组 → 归约节点 → 原子提交。 */
  logicalParallelGroups: string[][]
  elapsedMs: null
  traceOrdering: string
}

export interface SystemExecution {
  id: string
  recordId: string
  systemId: string
  entityId: string
  programRef: string
  inputCommit: string
  nodeExecutionIds: string[]
  /** 本 System 私有暂存预览：previous + 自身已提交贡献；看不到其他 System 的暂存。 */
  localPreview: number | null
  elapsedMs: null
}

export interface NodeExecution {
  id: string
  recordId: string
  executionId: string
  systemId: string
  entityId: string
  nodeId: string
  graphRef: string
  seq: number
  status: "completed"
  /** 端口名 → 求值后的原始值（EffectRef 输出为效果 id）。 */
  inputs: Record<string, unknown>
  outputs: Record<string, unknown>
  outputUnitId: string | null
  /** 该节点（传递）依赖的输入属性版本。 */
  inputVersionRefs: string[]
  elapsedMs: null
}

export interface EffectRequest {
  id: string
  recordId: string
  executionId: string
  nodeId: string
  systemId: string
  entityId: string
  propertyId: string
  requestedDelta: number
  unitId: string | null
  selfPreview: number | null
  previewUnitId: string | null
  constraintRef: string | null
}

export interface EffectAllocation {
  effectId: string
  approvedDelta: number
  status: "approved" | "partial" | "rejected"
}

export interface ConstraintDecision {
  id: string
  recordId: string
  entityId: string
  propertyId: string
  constraintRef: string
  old: number
  /** 不受约束的候选结果：old + Σrequested（不含被拒绝的反向请求）。 */
  candidate: number
  budget: number
  budgetUnitId: string | null
  scale: number
  allocations: EffectAllocation[]
  final: number
  valueUnitId: string | null
}

export interface PropertyChange {
  entityId: string
  propertyId: string
  old: number
  new: number
  unitId: string | null
  versionId: string
  decisionId: string
}

export interface DependencyEdge {
  source: string
  target: string
  kind: "used" | "proposed" | "generated"
}

export interface RoundResult {
  record: RunRecord
  /** computed：浏览器执行器按当前图求值；reference-sample：expected_runs 样例。 */
  origin: "computed" | "reference-sample"
  nextWorld: WorldSnapshot
  /** 本次执行实际消费的程序快照：旧记录绑定旧图版本，不随当前草稿变化。 */
  programs: Record<string, LogicGraphDocument>
  systemExecutions: SystemExecution[]
  nodeExecutions: NodeExecution[]
  effectRequests: EffectRequest[]
  decisions: ConstraintDecision[]
  changes: PropertyChange[]
  dependencyEdges: DependencyEdge[]
  diagnostics: DomainDiagnostic[]
}

export interface ExecuteInput {
  /** 冻结的模型快照（saved 或明确指定的 draft 试算快照）；执行器不修改它。 */
  model: PrototypeModel
  /** previous 视图所在的世界快照；commitId 必须等于 baseCommit。 */
  world: WorldSnapshot
  runId: string
  branchId: string
  baseCommit: string
  stepSeconds: number
  recordId: string
  resultCommitId: string
  /** 缺省取模型的第一个调度。 */
  scheduleId?: string
}

export type ExecuteOutcome = { ok: true ;result: RoundResult } | {
  ok: false
  diagnostics: DomainDiagnostic[]
}
