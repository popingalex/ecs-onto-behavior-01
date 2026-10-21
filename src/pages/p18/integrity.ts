import type { Diagnostic, Route } from "@/core/types"
import { stableHash } from "@/lib/hash"
import type { DomainDiagnostic, PrototypeModel } from "@/schema/model"
import { checkIntegrity } from "@/schema/parse"
import { getDocument } from "@/stores/draftRegistry"
import {
  composeModel,
  modelDocumentIds,
} from "@/stores/modelDocuments"

/**
 * P18 的组合校验：以全部当前草稿组成的模型跑 checkIntegrity。
 * 校验结果绑定组合语义哈希——任何文档之后变化都会使结果过期，不能复用旧的通过状态。
 */
export interface IntegrityRun {
  /** 全部模型文档 [documentId, semanticHash] 对的稳定哈希。 */
  modelHash: string
  diagnostics: Diagnostic[]
  at: string
}

export function currentModelHash(): string {
  const pairs = modelDocumentIds().map((id) => {
    const doc = getDocument(id)
    return [id, doc?.semanticHash ?? "unregistered"]
  })
  return stableHash(pairs)
}

function toDiagnostic(d: DomainDiagnostic): Diagnostic {
  const where = [
    d.target?.documentId,
    d.target?.nodeId,
    d.target?.portId,
    d.target?.propertyId,
  ]
    .filter(Boolean)
    .join(" · ")
  return {
    id: d.id,
    severity: d.severity,
    code: d.code,
    message: d.message,
    objectLabel: where || undefined,
  }
}

export function runIntegrityCheck(): IntegrityRun {
  const model = composeModel("draft")
  return {
    modelHash: currentModelHash(),
    diagnostics: checkIntegrity(model).map(toDiagnostic),
    at: new Date().toISOString(),
  }
}

/** 诊断定位：target.documentId 是被引对象的 id，按当前模型判定它属于哪类对象。 */
export function diagnosticRoute(
  model: PrototypeModel,
  d: Diagnostic,
): Route | undefined {
  const docId = d.objectLabel?.split(" · ")[0]
  if (!docId) return undefined
  const nodeId = d.objectLabel?.split(" · ")[1]
  if (model.schedules.some((s) => s.id === docId))
    return { pageId: "P12", params: { scheduleId: docId } }
  if (model.programs.some((p) => p.id === docId))
    return {
      pageId: "P14",
      params: nodeId ? { programId: docId, nodeId } : { programId: docId },
    }
  if (model.systems.some((s) => s.id === docId))
    return { pageId: "P11", params: { systemId: docId } }
  if (model.queries.some((q) => q.id === docId))
    return { pageId: "P10", params: { queryId: docId } }
  if (model.components.some((c) => c.id === docId))
    return { pageId: "P03", params: { componentId: docId } }
  if (model.entityTypes.some((t) => t.id === docId))
    return { pageId: "P02", params: { classId: docId } }
  if (model.templates.some((t) => t.id === docId))
    return { pageId: "P05", params: { templateId: docId } }
  if (docId === model.scene.id && nodeId)
    return { pageId: "P08", params: { entityId: nodeId } }
  if (model.attributes.some((a) => a.id === docId))
    return { pageId: "P29", params: { attributeId: docId } }
  return undefined
}
