/**
 * 引擎侧 /cm/model-patch 客户端(P18 数据层)。
 * 目标:已合入 feature/202605 的 W1 事务化端点(engine @1ff58ba 或等价)。
 * 仅在 REAL_IMPORT_READ_ONLY 模式由用户显式触发;默认指向隔离实例(18081),
 * 绝不指向 18080 共享服务。
 */
import { modelPatchSchema, type ModelPatch } from "./protocol"

export interface NativePatchEndpoints {
  baseUrl: string
}

export const DEFAULT_PATCH_BASE = "http://localhost:18081"

export interface ValidateReplyDto {
  ok: boolean
  currentRevision: string
  changeset: Array<{
    instanceId: string
    attributePath: string
    before: unknown
    after: unknown
  }>
  diagnostics: Array<{ code: string; message: string; target?: unknown }>
}

export interface ApplyReplyDto {
  status:
    | "APPLIED"
    | "REJECTED"
    | "REVISION_CONFLICT"
    | "IDEMPOTENCY_CONFLICT"
    | "REPLAYED"
  nativeRevision: string | null
  diagnostics: Array<{ code: string; message: string; target?: unknown }>
  replayed: boolean
}

export interface StatusReplyDto {
  idempotencyKey: string
  known: boolean
  status: string | null
  nativeRevision: string | null
  diagnostics: unknown
}

/**
 * 工作台 DTO(entityId)→ 引擎 DTO(instanceId)的显式翻译。
 * 引擎侧 schema:model_patch.rs ReplaceAttribute{instanceId, attributePath, newValue}。
 */
export function toEnginePatchDto(patch: ModelPatch): unknown {
  const parsed = modelPatchSchema.parse(patch)
  return {
    patchId: parsed.patchId,
    sourceSystemId: parsed.sourceSystemId,
    targetSceneId: parsed.targetSceneId,
    expectedRevision: parsed.expectedRevision,
    idempotencyKey: parsed.idempotencyKey,
    operations: parsed.operations.map((op) =>
      op.op === "replaceAttribute"
        ? {
            op: "replaceAttribute",
            instanceId: op.entityId,
            attributePath: op.attributePath,
            newValue: op.newValue,
          }
        : op,
    ),
  }
}

export function patchRequestPath(patch: ModelPatch): { path: string; body: string } {
  return { path: "/cm/model-patch/apply", body: JSON.stringify(toEnginePatchDto(patch)) }
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`引擎 ${url} 返回 ${res.status}:${text.slice(0, 200)}`)
  return JSON.parse(text) as T
}

export const nativeModelPatchClient = {
  async revision(endpoints: NativePatchEndpoints, sceneId: string) {
    return jsonFetch<{ sceneId: string; revision: string }>(
      `${endpoints.baseUrl}/cm/model-patch/revision/${encodeURIComponent(sceneId)}`,
    )
  },
  async validate(endpoints: NativePatchEndpoints, patch: ModelPatch) {
    return jsonFetch<ValidateReplyDto>(`${endpoints.baseUrl}/cm/model-patch/validate`, {
      method: "POST",
      body: JSON.stringify(toEnginePatchDto(patch)),
    })
  },
  async apply(endpoints: NativePatchEndpoints, patch: ModelPatch) {
    return jsonFetch<ApplyReplyDto>(`${endpoints.baseUrl}/cm/model-patch/apply`, {
      method: "POST",
      body: JSON.stringify(toEnginePatchDto(patch)),
    })
  },
  async status(endpoints: NativePatchEndpoints, idempotencyKey: string) {
    return jsonFetch<StatusReplyDto>(
      `${endpoints.baseUrl}/cm/model-patch/status/${encodeURIComponent(idempotencyKey)}`,
    )
  },
}
