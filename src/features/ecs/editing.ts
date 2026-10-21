import type { SceneDraft } from "@/schema/model"
import {
  applyEdit,
  getDocument,
  useDraftDocument,
  type DraftDocument,
} from "@/stores/draftRegistry"
import {
  SCHEMA_DOC,
  SCENE_DOC,
  SYSTEMS_DOC,
  ensureModelDocuments,
  type SchemaContent,
  type SystemsContent,
} from "@/stores/modelDocuments"
import { canEdit, useRole } from "@/stores/context"
import type { OpResult } from "./operations"

/** 把一次纯操作写进 SCHEMA_DOC 草稿；失败（引用阻止 / 校验不通过）不产生历史，交给 UI 展示。 */
export function applySchemaOp(
  label: string,
  op: (s: SchemaContent) => OpResult<SchemaContent>,
): OpResult<SchemaContent> {
  ensureModelDocuments()
  const doc = getDocument<SchemaContent>(SCHEMA_DOC)
  if (!doc) return { ok: false, message: "实体模式草稿文档未注册" }
  const result = op(doc.content)
  if (result.ok) applyEdit(SCHEMA_DOC, label, () => result.content)
  return result
}

export function applySceneOp(
  label: string,
  op: (s: SceneDraft) => OpResult<SceneDraft>,
): OpResult<SceneDraft> {
  ensureModelDocuments()
  const doc = getDocument<SceneDraft>(SCENE_DOC)
  if (!doc) return { ok: false, message: "场景草稿文档未注册" }
  const result = op(doc.content)
  if (result.ok) applyEdit(SCENE_DOC, label, () => result.content)
  return result
}

export function applySystemsOp(
  label: string,
  op: (c: SystemsContent) => OpResult<SystemsContent>,
): OpResult<SystemsContent> {
  ensureModelDocuments()
  const doc = getDocument<SystemsContent>(SYSTEMS_DOC)
  if (!doc) return { ok: false, message: "System 草稿文档未注册" }
  const result = op(doc.content)
  if (result.ok) applyEdit(SYSTEMS_DOC, label, () => result.content)
  return result
}

export function useSchemaDoc(): DraftDocument<SchemaContent> | undefined {
  ensureModelDocuments()
  return useDraftDocument<SchemaContent>(SCHEMA_DOC)
}
export function useSceneDoc(): DraftDocument<SceneDraft> | undefined {
  ensureModelDocuments()
  return useDraftDocument<SceneDraft>(SCENE_DOC)
}

/** 观察者只读：控件禁用并提示，写入路径一律走 applySchemaOp / applySceneOp。 */
export function useReadOnly(): boolean {
  return !canEdit(useRole())
}
