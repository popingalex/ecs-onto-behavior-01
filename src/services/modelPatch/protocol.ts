import { z } from "zod"
import type { PrototypeModel, RawValue } from "@/schema/model"

/**
 * ModelPatch 事务化契约(W0 无写入部分,V7-3 闸门内):
 * 仅本地 validate/dryRun/冲突与幂等语义;不触碰引擎、不发布、不落库。
 * 真实 apply 必须由引擎侧原子事务协议承载(契约见 design/04/next/06_model_patch_protocol.md)。
 */

export const modelPatchOperationSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("replaceAttribute"),
    entityId: z.string().min(1),
    attributePath: z.string().min(1),
    newValue: z.union([z.number(), z.boolean(), z.string(), z.null(), z.tuple([z.number(), z.number(), z.number()])]),
  }),
  z.object({
    op: z.literal("addEntity"),
    entityId: z.string().min(1),
    typeId: z.string().min(1),
    label: z.string().min(1),
  }),
  z.object({
    op: z.literal("removeEntity"),
    entityId: z.string().min(1),
  }),
])

export const modelPatchSchema = z.object({
  patchId: z.string().min(1),
  sourceSystemId: z.literal("mas-rust"),
  targetSceneId: z.string().min(1),
  /** 乐观锁:基于编辑开始时的源侧 revision。 */
  expectedRevision: z.string().min(1),
  idempotencyKey: z.string().min(1),
  operations: z.array(modelPatchOperationSchema).min(1),
})

export type ModelPatch = z.infer<typeof modelPatchSchema>
export type ModelPatchOperation = z.infer<typeof modelPatchOperationSchema>

export interface PatchDiagnostic {
  code:
    | "SCENE_MISMATCH"
    | "ENTITY_MISSING"
    | "ENTITY_EXISTS"
    | "ATTRIBUTE_UNDECLARED"
    | "TYPE_MISMATCH"
    | "UNIT_MISMATCH"
    | "REMOVE_BLOCKED_BY_REFS"
    | "REVISION_CONFLICT"
    | "IDEMPOTENCY_CONFLICT"
    | "IDEMPOTENCY_REPLAY"
  severity: "error"
  message: string
  target?: { entityId?: string; attributePath?: string }
}

export type DryRunResult =
  | {
      ok: true
      /** 变更集预览(before/after;add/remove 给出实体级摘要)。 */
      changeset: Array<{
        kind: "attribute" | "entity-add" | "entity-remove"
        entityId: string
        attributePath?: string
        before?: RawValue | "(absent)" | "(entity)"
        after?: RawValue | "(entity)"
      }>
    }
  | { ok: false; diagnostics: PatchDiagnostic[] }

/**
 * 本地校验 + 干运行:结构/引用/类型/单位/删除引用阻止。
 * modelRevision 为当前(编辑后)源侧 revision;与 expectedRevision 不符即乐观锁冲突。
 */
export function dryRunModelPatch(
  model: PrototypeModel,
  patch: ModelPatch,
  context: { sceneId: string; currentRevision: string },
): DryRunResult {
  const diagnostics: PatchDiagnostic[] = []
  if (patch.targetSceneId !== context.sceneId) {
    diagnostics.push({
      code: "SCENE_MISMATCH",
      severity: "error",
      message: `目标场景 ${patch.targetSceneId} 与当前上下文 ${context.sceneId} 不符。`,
    })
  }
  if (patch.expectedRevision !== context.currentRevision) {
    diagnostics.push({
      code: "REVISION_CONFLICT",
      severity: "error",
      message: `乐观锁冲突:补丁基于 ${patch.expectedRevision},当前源侧已到 ${context.currentRevision};拒绝以避免覆盖他人修改。`,
    })
  }
  const declared = new Map(model.attributes.map((a) => [a.id, a]))
  const entityIds = new Set(model.scene.entities.map((e) => e.id))
  const changeset: Extract<DryRunResult, { ok: true }>["changeset"] = []
  const seen = new Set<string>()
  for (const op of patch.operations) {
    const dupKey = `${op.op}:${op.entityId}:${"attributePath" in op ? op.attributePath : ""}`
    if (seen.has(dupKey)) {
      diagnostics.push({ code: "IDEMPOTENCY_CONFLICT", severity: "error", message: `同一目标重复操作:${dupKey}`, target: { entityId: op.entityId } })
      continue
    }
    seen.add(dupKey)
    if (op.op === "replaceAttribute") {
      const entity = model.scene.entities.find((e) => e.id === op.entityId)
      if (!entity) {
        diagnostics.push({ code: "ENTITY_MISSING", severity: "error", message: `实体 ${op.entityId} 不存在。`, target: { entityId: op.entityId } })
        continue
      }
      const attr = declared.get(op.attributePath)
      if (!attr) {
        diagnostics.push({ code: "ATTRIBUTE_UNDECLARED", severity: "error", message: `属性 ${op.attributePath} 未在 schema 声明(原生导入只允许改已声明属性)。`, target: { entityId: op.entityId, attributePath: op.attributePath } })
        continue
      }
      const t = attr.type
      const v = op.newValue
      const shapeOk = t.shape === "vector3" ? Array.isArray(v) && v.length === 3 : !Array.isArray(v)
      const primOk =
        t.primitive === "f64" ? typeof v === "number" || v === null :
        t.primitive === "bool" ? typeof v === "boolean" || v === null :
        t.primitive === "string" ? typeof v === "string" || v === null : true
      if (!shapeOk || !primOk) {
        diagnostics.push({ code: "TYPE_MISMATCH", severity: "error", message: `${op.attributePath} 期望 ${t.primitive}/${t.shape},得到 ${Array.isArray(v) ? "vec" : typeof v}。`, target: { entityId: op.entityId, attributePath: op.attributePath } })
        continue
      }
      if (v === null && t.nullable === false) {
        diagnostics.push({ code: "TYPE_MISMATCH", severity: "error", message: `${op.attributePath} 不可为 null。`, target: { entityId: op.entityId, attributePath: op.attributePath } })
        continue
      }
      if (v !== null && t.unitId === "unknown") {
        diagnostics.push({ code: "UNIT_MISMATCH", severity: "error", message: `${op.attributePath} 单位 UNKNOWN(引擎无单位登记):写值需先在契约层定单位,拒绝盲写。`, target: { entityId: op.entityId, attributePath: op.attributePath } })
        continue
      }
      const before = entity.initialOverrides[op.attributePath] ?? "(absent)"
      changeset.push({ kind: "attribute", entityId: op.entityId, attributePath: op.attributePath, before, after: op.newValue })
    } else if (op.op === "addEntity") {
      if (entityIds.has(op.entityId)) {
        diagnostics.push({ code: "ENTITY_EXISTS", severity: "error", message: `实体 ${op.entityId} 已存在。`, target: { entityId: op.entityId } })
        continue
      }
      if (!model.entityTypes.some((t) => t.id === op.typeId)) {
        diagnostics.push({ code: "ENTITY_MISSING", severity: "error", message: `类型 ${op.typeId} 不存在。`, target: { entityId: op.entityId } })
        continue
      }
      entityIds.add(op.entityId)
      changeset.push({ kind: "entity-add", entityId: op.entityId, before: "(absent)", after: "(entity)" })
    } else {
      if (!entityIds.has(op.entityId)) {
        diagnostics.push({ code: "ENTITY_MISSING", severity: "error", message: `实体 ${op.entityId} 不存在。`, target: { entityId: op.entityId } })
        continue
      }
      // 删除引用阻止:凡其他实体 overrides/世界值引用该 id(粗粒度:字符串值等于 id)即阻止。
      const referencedBy = model.scene.entities.filter(
        (e) => e.id !== op.entityId && Object.values(e.initialOverrides).includes(op.entityId),
      )
      if (referencedBy.length > 0) {
        diagnostics.push({ code: "REMOVE_BLOCKED_BY_REFS", severity: "error", message: `实体 ${op.entityId} 被 ${referencedBy.map((e) => e.id).join("、")} 引用,删除前须先解除。`, target: { entityId: op.entityId } })
        continue
      }
      entityIds.delete(op.entityId)
      changeset.push({ kind: "entity-remove", entityId: op.entityId, before: "(entity)", after: "(absent)" })
    }
  }
  if (diagnostics.length > 0) return { ok: false, diagnostics }
  return { ok: true, changeset }
}

/**
 * 幂等登记簿(本地语义):同 key 同 patchId 重放返回原结果摘要;
 * 同 key 不同 patchId 冲突。无任何持久化——真实幂等由引擎事务保证。
 */
export class IdempotencyLedger {
  private entries = new Map<string, { patchId: string; changesetCount: number }>()
  check(patch: ModelPatch): { status: "new" } | { status: "replay"; changesetCount: number } | { status: "conflict" } {
    const hit = this.entries.get(patch.idempotencyKey)
    if (!hit) return { status: "new" }
    if (hit.patchId === patch.patchId) return { status: "replay", changesetCount: hit.changesetCount }
    return { status: "conflict" }
  }
  record(patch: ModelPatch, changesetCount: number): void {
    this.entries.set(patch.idempotencyKey, { patchId: patch.patchId, changesetCount })
  }
}

/**
 * 原生事务候选协议的状态查询(W0:getStatus)。
 * 提交超时后客户端按 idempotencyKey 查询最终状态;引擎侧必须能在事务日志中
 * 回答以下状态之一,不允许"未知即重试"(重复写入风险)。
 */
export const patchSubmissionStatusSchema = z.enum([
  "PENDING", // 已受理未落盘
  "VALIDATED", // dryRun 通过,待 apply(两阶段模式)
  "APPLIED", // 已产生新原生 revision
  "REJECTED", // 校验失败(附 diagnostics)
  "REVISION_CONFLICT", // 乐观锁失败
  "IDEMPOTENCY_CONFLICT", // 同 key 异请求
  "UNKNOWN", // 引擎不可考(需人工/运维仲裁;客户端不得自动重试)
])

export type PatchSubmissionStatus = z.infer<typeof patchSubmissionStatusSchema>

export interface PatchStatusReply {
  idempotencyKey: string
  status: PatchSubmissionStatus
  /** 仅 APPLIED:引擎产生的原生新 revision(工作台草稿 id 不得冒充)。 */
  nativeRevision?: string
  /** 仅 REJECTED:诊断列表。 */
  diagnostics?: PatchDiagnostic[]
}

/** 本地getStatus(内存登记簿版):仅演示语义,真实实现属 W1 引擎事务。 */
export function getPatchStatus(
  ledger: IdempotencyLedger,
  idempotencyKey: string,
  records: Map<string, PatchStatusReply>,
): PatchStatusReply {
  const hit = records.get(idempotencyKey)
  if (hit) return hit
  return { idempotencyKey, status: "UNKNOWN" }
}
