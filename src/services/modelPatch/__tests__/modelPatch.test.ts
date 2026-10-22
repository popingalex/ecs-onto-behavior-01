/**
 * ModelPatch 无写入契约测试(WRITE-01/02/03/05 的本地语义;WRITE-04/07/08 属引擎事务闸门)。
 */
import { loadNativeImport } from "@/services/nativeImport/seedAdapter"
import {
  dryRunModelPatch,
  getPatchStatus,
  IdempotencyLedger,
  modelPatchSchema,
  type ModelPatch,
} from "../protocol"

let model: Awaited<ReturnType<typeof loadNativeImport>>["prototype"]

async function ensureModel() {
  if (!model) model = (await loadNativeImport()).prototype
  return model
}

function basePatch(over: Partial<ModelPatch> = {}): ModelPatch {
  return modelPatchSchema.parse({
    patchId: "p-001",
    sourceSystemId: "mas-rust",
    targetSceneId: "chem-roaded",
    expectedRevision: "rev-1",
    idempotencyKey: "key-001",
    operations: [
      {
        op: "replaceAttribute",
        entityId: "tank-1",
        attributePath: "flammable/temperature",
        newValue: 25,
      },
    ],
    ...over,
  })
}

export async function dryRunProducesChangesetWithoutTouchingModel() {
  // WRITE-01:准确变更集;模型对象零修改(引用不变断言)。
  const m = await ensureModel()
  const snapshot = JSON.stringify(m.scene.entities)
  const result = dryRunModelPatch(m, basePatch(), { sceneId: "chem-roaded", currentRevision: "rev-1" })
  if (!result.ok) throw new Error(`应通过:${JSON.stringify(result.diagnostics)}`)
  const change = result.changeset.find((c) => c.kind === "attribute")
  if (!change || change.after !== 25) throw new Error("变更集不完整")
  if (JSON.stringify(m.scene.entities) !== snapshot) throw new Error("dryRun 不得修改模型")
}

export async function revisionConflictRejected() {
  // WRITE-02:expectedRevision ≠ 当前 → REVISION_CONFLICT,不产生变更集。
  const m = await ensureModel()
  const result = dryRunModelPatch(m, basePatch({ expectedRevision: "rev-0" }), {
    sceneId: "chem-roaded",
    currentRevision: "rev-1",
  })
  if (result.ok) throw new Error("乐观锁冲突未被拒绝")
  if (!result.diagnostics.some((d) => d.code === "REVISION_CONFLICT")) throw new Error("缺 REVISION_CONFLICT")
}

export async function invalidTargetsRejected() {
  // WRITE-03:未声明属性/类型不符/null 禁止/单位 UNKNOWN/删实体引用阻止/场景不符。
  const m = await ensureModel()
  const cases: Array<{ patch: ModelPatch; want: string }> = [
    {
      patch: basePatch({ operations: [{ op: "replaceAttribute", entityId: "tank-1", attributePath: "nope/none", newValue: 1 }] }),
      want: "ATTRIBUTE_UNDECLARED",
    },
    {
      patch: basePatch({ operations: [{ op: "replaceAttribute", entityId: "tank-1", attributePath: "flammable/temperature", newValue: "hot" }] }),
      want: "TYPE_MISMATCH",
    },
    {
      patch: basePatch({ operations: [{ op: "replaceAttribute", entityId: "ghost-1", attributePath: "flammable/temperature", newValue: 1 }] }),
      want: "ENTITY_MISSING",
    },
    {
      patch: basePatch({ operations: [{ op: "addEntity", entityId: "tank-1", typeId: "tank", label: "x" }] }),
      want: "ENTITY_EXISTS",
    },
    {
      patch: basePatch({ targetSceneId: "other-scene" }),
      want: "SCENE_MISMATCH",
    },
  ]
  for (const { patch, want } of cases) {
    const r = dryRunModelPatch(m, patch, { sceneId: "chem-roaded", currentRevision: "rev-1" })
    if (r.ok || !r.diagnostics.some((d) => d.code === want))
      throw new Error(`期望 ${want},得到 ${r.ok ? "ok" : r.diagnostics.map((d) => d.code).join(",")}`)
  }
  // 单位 UNKNOWN 拒盲写:找一个 unknown 单位属性(必然存在,引擎无单位登记)。
  const unknownAttr = m.attributes.find((a) => a.type.unitId === "unknown" && a.type.primitive === "f64")!
  const r2 = dryRunModelPatch(
    m,
    basePatch({
      operations: [{ op: "replaceAttribute", entityId: "tank-1", attributePath: unknownAttr.id, newValue: 1 }],
    }),
    { sceneId: "chem-roaded", currentRevision: "rev-1" },
  )
  if (r2.ok || !r2.diagnostics.some((d) => d.code === "UNIT_MISMATCH")) throw new Error("UNKNOWN 单位未拒绝")
}

export async function idempotencyLedgerSemantics() {
  // WRITE-05(本地语义):同 key 同 patchId 重放;同 key 异 patchId 冲突。
  const ledger = new IdempotencyLedger()
  const p1 = basePatch()
  const p2 = basePatch({ patchId: "p-002" })
  if (ledger.check(p1).status !== "new") throw new Error("首次应为 new")
  ledger.record(p1, 1)
  const replay = ledger.check(p1)
  if (replay.status !== "replay") throw new Error("同 key 同 patchId 应重放")
  const conflict = ledger.check(p2)
  if (conflict.status !== "conflict") throw new Error("同 key 异 patchId 应冲突")
}

export async function partialFailureIsAtomic() {
  // W-04 预演(本地):多操作中一个非法 → 整包拒绝,零变更集,诊断定位到坏操作。
  const m = await ensureModel()
  const patch = basePatch({
    operations: [
      { op: "replaceAttribute", entityId: "tank-1", attributePath: "flammable/temperature", newValue: 30 },
      { op: "replaceAttribute", entityId: "ghost-9", attributePath: "flammable/temperature", newValue: 40 },
    ],
  })
  const r = dryRunModelPatch(m, patch, { sceneId: "chem-roaded", currentRevision: "rev-1" })
  if (r.ok) throw new Error("部分失败未被整包拒绝")
  if (r.diagnostics.some((d) => d.target?.entityId !== "ghost-9"))
    throw new Error("诊断未定位到非法操作")
}

export async function explicitNullVsUnsetDistinguished() {
  // UNSET 与 null 不混淆:显式 null 对 nullable 属性合法;对非 nullable 拒绝;
  // 已声明但从未写过的路径(引擎侧=UNSET)可被 replace 显式赋值。
  const m = await ensureModel()
  const nullableAttr = m.attributes.find((a) => a.type.nullable)!
  const r1 = dryRunModelPatch(
    m,
    basePatch({
      operations: [{ op: "replaceAttribute", entityId: "tank-1", attributePath: nullableAttr.id, newValue: null }],
    }),
    { sceneId: "chem-roaded", currentRevision: "rev-1" },
  )
  if (!r1.ok) throw new Error("nullable 属性显式 null 应合法")
  const nonNullAttr = m.attributes.find((a) => !a.type.nullable)!
  const r2 = dryRunModelPatch(
    m,
    basePatch({
      operations: [{ op: "replaceAttribute", entityId: "tank-1", attributePath: nonNullAttr.id, newValue: null }],
    }),
    { sceneId: "chem-roaded", currentRevision: "rev-1" },
  )
  if (r2.ok || !r2.diagnostics.some((d) => d.code === "TYPE_MISMATCH"))
    throw new Error("非 nullable 显式 null 未拒绝")
}

export async function getStatusFlow() {
  // getStatus:已记录键返回原状态;未知键=UNKNOWN(客户端不得自动重试)。
  const records = new Map<string, import("../protocol").PatchStatusReply>()
  records.set("key-9", {
    idempotencyKey: "key-9",
    status: "APPLIED",
    nativeRevision: "rev-2",
  })
  const hit = getPatchStatus(new IdempotencyLedger(), "key-9", records)
  if (hit.status !== "APPLIED" || hit.nativeRevision !== "rev-2")
    throw new Error("已记录状态返回错误")
  const miss = getPatchStatus(new IdempotencyLedger(), "key-x", records)
  if (miss.status !== "UNKNOWN") throw new Error("未知键应为 UNKNOWN")
}
