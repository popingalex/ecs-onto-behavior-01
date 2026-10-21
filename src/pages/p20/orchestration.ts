import type { RoundResult } from "@/services/mock-executor"

/**
 * P20 编排层 ViewModel：trace record → 执行批次 / 并行组 / system 合计。
 * 第一层（system 编排：哪些 system、并行分组、读旧值/写裁决）的只读推导；
 * 节点级细节是第二层（P22 下钻），这里不复制。
 */
export interface OrchestrationSystem {
  systemId: string
  /** 本回合实际执行的实体（systemExecutions 去重，按 id 排序）。 */
  entities: string[]
  /** 本回合全部效果请求合计（requestedDelta 之和；未裁决不等于 0）。 */
  requestedTotal: number
  /** 裁决后获准合计（allocations.approvedDelta 之和）。 */
  approvedTotal: number
}

export interface OrchestrationBatch {
  index: number
  /** systems：System 逻辑并行组；stage：归约 / 原子提交等非 System 阶段。 */
  kind: "systems" | "stage"
  systems: OrchestrationSystem[]
  /** 非 System 阶段的节点成员（如 reduce-cooling、commit）。 */
  stage: string[]
}

export interface RoundOrchestration {
  recordId: string
  baseCommit: string
  resultCommit: string
  batches: OrchestrationBatch[]
}

export function orchestrateRound(record: RoundResult): RoundOrchestration {
  const effectSystem = new Map<string, string>()
  const requested = new Map<string, number>()
  for (const e of record.effectRequests) {
    effectSystem.set(e.id, e.systemId)
    requested.set(
      e.systemId,
      (requested.get(e.systemId) ?? 0) + e.requestedDelta,
    )
  }
  const approved = new Map<string, number>()
  for (const d of record.decisions)
    for (const a of d.allocations) {
      const systemId = effectSystem.get(a.effectId)
      if (systemId)
        approved.set(systemId, (approved.get(systemId) ?? 0) + a.approvedDelta)
    }
  const entitiesBySystem = new Map<string, string[]>()
  for (const e of record.systemExecutions) {
    const list = entitiesBySystem.get(e.systemId) ?? []
    if (!list.includes(e.entityId)) list.push(e.entityId)
    entitiesBySystem.set(e.systemId, list)
  }
  const systemIds = new Set(entitiesBySystem.keys())
  const summarize = (systemId: string): OrchestrationSystem => ({
    systemId,
    entities: (entitiesBySystem.get(systemId) ?? []).slice().sort(),
    requestedTotal: requested.get(systemId) ?? 0,
    approvedTotal: approved.get(systemId) ?? 0,
  })
  return {
    recordId: record.record.id,
    baseCommit: record.record.baseCommit,
    resultCommit: record.record.resultCommit,
    batches: record.record.logicalParallelGroups.map((members, i) => {
      const systems = members.filter((m) => systemIds.has(m))
      return {
        index: i + 1,
        kind: systems.length > 0 ? ("systems" as const) : ("stage" as const),
        systems: systems.map(summarize),
        stage: members.filter((m) => !systemIds.has(m)),
      }
    }),
  }
}

/** 单个 system 的实体行：暂存预览 / 请求 / 获准（下钻矩阵用）。 */
export interface OrchestrationEntityRow {
  entityId: string
  localPreview: number | null
  requested: number
  approved: number | null
}

export function orchestrationEntityRows(
  record: RoundResult,
  systemId: string,
): OrchestrationEntityRow[] {
  const effectIds = new Map<string, string>() // effectId → entityId
  const requested = new Map<string, number>()
  for (const e of record.effectRequests) {
    if (e.systemId !== systemId) continue
    effectIds.set(e.id, e.entityId)
    requested.set(
      e.entityId,
      (requested.get(e.entityId) ?? 0) + e.requestedDelta,
    )
  }
  const approved = new Map<string, number>()
  for (const d of record.decisions)
    for (const a of d.allocations) {
      const entityId = effectIds.get(a.effectId)
      if (entityId)
        approved.set(entityId, (approved.get(entityId) ?? 0) + a.approvedDelta)
    }
  return record.systemExecutions
    .filter((e) => e.systemId === systemId)
    .map((e) => ({
      entityId: e.entityId,
      localPreview: e.localPreview,
      requested: requested.get(e.entityId) ?? 0,
      approved: approved.has(e.entityId) ? approved.get(e.entityId)! : null,
    }))
    .sort((a, b) => a.entityId.localeCompare(b.entityId))
}
