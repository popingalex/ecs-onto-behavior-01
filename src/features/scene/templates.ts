import { z } from "zod"
import {
  applyEdit,
  getDocument,
  registerDocument,
  useDraftDocument,
  type DraftDocument,
} from "@/stores/draftRegistry"
import type { OpResult } from "@/features/ecs/operations"
import type { SceneTemplateDef } from "./assembly"

/**
 * 场景模板的草稿文档（P06）。v0.5 契约没有场景模板对象：本原型把它存为
 * 独立的本地草稿文档（不参与 composeModel 与跨文档校验），页面照常获得
 * revision / 保存 / 撤销语义。
 */
export const SCENE_TEMPLATES_DOC = "scene-templates:local"

export interface SceneTemplatesContent {
  templates: SceneTemplateDef[]
}

const rawValue = z.union([
  z.number(),
  z.boolean(),
  z.string(),
  z.null(),
  z.tuple([z.number(), z.number(), z.number()]),
])

const contentSchema = z.object({
  templates: z.array(
    z.object({
      id: z.string().min(1),
      version: z.string().min(1),
      label: z.string(),
      sourceSceneId: z.string(),
      createdAt: z.string(),
      roles: z.array(
        z.object({
          roleId: z.string(),
          label: z.string(),
          typeId: z.string(),
          templateRef: z
            .object({ id: z.string().min(1), version: z.string().min(1) })
            .nullable(),
          componentIds: z.array(z.string()),
          overrides: z.record(z.string(), rawValue),
        }),
      ),
    }),
  ),
})

export function ensureSceneTemplatesDocument(): DraftDocument<SceneTemplatesContent> {
  const existing = getDocument<SceneTemplatesContent>(SCENE_TEMPLATES_DOC)
  if (existing) return existing
  return registerDocument<SceneTemplatesContent>(SCENE_TEMPLATES_DOC, {
    kind: "scene",
    label: "场景模板（本地扩展）",
    baseVersion: "prototype-local-1",
    baseline: () => ({ templates: [] }),
    restore: (raw) => contentSchema.parse(raw),
  })
}

// 与 stores/draft.ts 的 legacy 文档同一模式：模块加载即注册，避免渲染期写 store。
ensureSceneTemplatesDocument()

export function useSceneTemplatesDoc():
  | DraftDocument<SceneTemplatesContent>
  | undefined {
  ensureSceneTemplatesDocument()
  return useDraftDocument<SceneTemplatesContent>(SCENE_TEMPLATES_DOC)
}

/** 写场景模板文档；失败（校验不通过）不产生历史。 */
export function applySceneTemplatesOp(
  label: string,
  op: (c: SceneTemplatesContent) => OpResult<SceneTemplatesContent>,
): OpResult<SceneTemplatesContent> {
  const doc = ensureSceneTemplatesDocument()
  const result = op(doc.content)
  if (result.ok) applyEdit(SCENE_TEMPLATES_DOC, label, () => result.content)
  return result
}
