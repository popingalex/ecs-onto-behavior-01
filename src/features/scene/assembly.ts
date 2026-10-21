import type { SpatialItem } from "@/components/domain/SpatialViewport"
import type {
  ObjectRef,
  PrototypeModel,
  RawValue,
  SceneDraft,
  Vec3,
} from "@/schema/model"
import { isAssembled, resolveInitialValue } from "@/schema/values"
import { effectiveComponents } from "@/schema/inheritance"
import { validId, suggestEntityId } from "@/features/ecs/ids"
import {
  addEntityComponent,
  createSceneEntity,
  setEntityOverride,
  type OpResult,
} from "@/features/ecs/operations"

/**
 * 场景构建（P07）与场景模板（P06）的纯函数层。
 * 位置就是 position.local 的实例初值覆盖：null = 未放置（逻辑保留，视图不绘制）；
 * [0,0,0] 是合法位置。所有写入经 OpResult 返回，由页面走 applySceneOp 进 SCENE_DOC。
 */

/** 类型 → 视口符号。契约只有三类实体类型；未知类型回落为 station 图形。 */
export function spatialKind(typeId: string): SpatialItem["kind"] {
  switch (typeId) {
    case "Fire":
      return "fire"
    case "FoamTruck":
      return "vehicle"
    case "Command":
      return "command"
    default:
      return "station"
  }
}

/** 场景实体 → 空间视口条目；position 解析自初值覆盖链（实例 > 模板 > 默认）。 */
export function sceneSpatialItems(model: PrototypeModel): SpatialItem[] {
  return model.scene.entities.map((e) => {
    const resolved = resolveInitialValue(model, e, "position.local")
    const position =
      resolved.state === "value" && Array.isArray(resolved.value)
        ? ([...resolved.value] as Vec3)
        : null
    const type = model.entityTypes.find((t) => t.id === e.typeId)
    return {
      id: e.id,
      label: e.label,
      kind: spatialKind(e.typeId),
      position,
      caption: type?.label,
    }
  })
}

/** 「逻辑 N / 空间 M」计数：空间 = position.local 非 null 的实体数。 */
export function spatialCounts(model: PrototypeModel): {
  logical: number
  placed: number
} {
  const items = sceneSpatialItems(model)
  return {
    logical: items.length,
    placed: items.filter((i) => i.position !== null).length,
  }
}

const POSITION_PROPERTY = "position.local"

/**
 * 设置 / 移动 / 清空实体位置。position 为 null 表示清空空间表现（显式 null 覆盖，
 * 实体保留）；坐标必须是有限数值（NaN / Infinity 阻止提交）。
 */
export function setEntityPosition(
  model: PrototypeModel,
  scene: SceneDraft,
  entityId: string,
  position: Vec3 | null,
): OpResult<SceneDraft> {
  const entity = scene.entities.find((e) => e.id === entityId)
  if (!entity) return { ok: false, message: `实体 ${entityId} 不存在` }
  if (!isAssembled(entity, "Position"))
    return {
      ok: false,
      message: `实体 ${entityId} 未装配 Position 组件，请先装配再放置`,
    }
  if (position !== null && position.some((n) => !Number.isFinite(n)))
    return { ok: false, message: "坐标必须是有限数值，NaN / Infinity 不能入库" }
  return setEntityOverride(model, scene, entityId, POSITION_PROPERTY, position)
}

/**
 * 放置新实体（P07 视口落点）：创建实体并按类型有效装配补上 Position（可选组件也装），
 * 再把落点写入 position.local。类型没有 Position（必需 / 可选 / 继承）时整体失败，
 * 不留半成品实体。单条 OpResult，页面一次 applySceneOp = 一条撤销记录。
 */
export function placeNewEntity(
  model: PrototypeModel,
  scene: SceneDraft,
  input: {
    id: string
    label: string
    typeId: string
    templateId?: string
    position: Vec3
  },
): OpResult<SceneDraft> {
  const origins = effectiveComponents(model.entityTypes, input.typeId)
  if (!origins.some((o) => o.componentId === "Position"))
    return {
      ok: false,
      message: `类型 ${input.typeId} 没有 Position 组件（必需 / 可选 / 继承），不能放置到空间视口`,
    }
  const created = createSceneEntity(model, scene, {
    id: input.id,
    label: input.label,
    typeId: input.typeId,
    templateId: input.templateId,
  })
  if (!created.ok) return created
  let next = created.content
  const entity = next.entities.find((e) => e.id === input.id)!
  if (!isAssembled(entity, "Position")) {
    const added = addEntityComponent(model, next, input.id, "Position")
    if (!added.ok) return added
    next = added.content
  }
  return setEntityPosition(model, next, input.id, input.position)
}

// ---------- 场景模板（P06） ----------
/**
 * 场景模板是本原型的本地扩展：v0.5 契约没有场景模板对象。
 * 模板快照场景初值装配（类型、模板来源、初值覆盖），不含运行任务与历史。
 */
export interface SceneTemplateRole {
  roleId: string
  label: string
  typeId: string
  templateRef: ObjectRef | null
  /** 组件装配快照（schemaRef id）：无模板的角色靠它还原可选组件（如 C01 的 Position）。 */
  componentIds: string[]
  overrides: Record<string, RawValue>
}

export interface SceneTemplateDef {
  id: string
  version: string
  label: string
  /** 另存来源场景 id。 */
  sourceSceneId: string
  createdAt: string
  roles: SceneTemplateRole[]
}

export function createSceneTemplateFromScene(
  scene: SceneDraft,
  input: { id: string; label: string; version?: string },
  taken: (id: string) => boolean,
  createdAt: string,
): OpResult<SceneTemplateDef> {
  if (!input.id.trim()) return { ok: false, message: "模板 ID 不能为空" }
  if (!validId(input.id))
    return {
      ok: false,
      message: "ID 只能包含字母、数字、点、下划线与连字符，并以字母开头",
    }
  if (taken(input.id)) return { ok: false, message: `模板 ID ${input.id} 已存在` }
  const template: SceneTemplateDef = {
    id: input.id,
    version: input.version?.trim() || "s1",
    label: input.label.trim() || input.id,
    sourceSceneId: scene.id,
    createdAt,
    roles: scene.entities.map((e) => ({
      roleId: e.id,
      label: e.label,
      typeId: e.typeId,
      templateRef: e.templateRef ? { ...e.templateRef } : null,
      componentIds: e.componentInstances.map((ci) => ci.schemaRef.id),
      overrides: structuredClone(e.initialOverrides),
    })),
  }
  return { ok: true, content: template }
}

/**
 * 把模板实例化进场景草稿：每个角色生成一个新实体（新 entityId，不复用角色 id），
 * 初值覆盖按角色快照逐项写入；模板默认（如 tpl-foam 的 8000 L）经实体模板来源生效。
 */
export function instantiateSceneTemplate(
  model: PrototypeModel,
  scene: SceneDraft,
  template: SceneTemplateDef,
): OpResult<SceneDraft> {
  let next = scene
  const created: string[] = []
  for (const role of template.roles) {
    const id = suggestEntityId(role.typeId, (x) =>
      next.entities.some((e) => e.id === x),
    )
    const createdResult = createSceneEntity(model, next, {
      id,
      label: role.label,
      typeId: role.typeId,
      templateId: role.templateRef?.id,
    })
    if (!createdResult.ok)
      return {
        ok: false,
        message: `角色 ${role.roleId}（${role.typeId}）实例化失败：${createdResult.message}`,
      }
    next = createdResult.content
    // 还原角色快照里的组件装配（createSceneEntity 只装必需 / 模板组件）。
    for (const componentId of role.componentIds) {
      if (
        next.entities
          .find((e) => e.id === id)!
          .componentInstances.some((ci) => ci.schemaRef.id === componentId)
      )
        continue
      const added = addEntityComponent(model, next, id, componentId)
      if (!added.ok)
        return {
          ok: false,
          message: `角色 ${role.roleId} 的组件 ${componentId} 无法装配：${added.message}`,
        }
      next = added.content
    }
    for (const [propertyId, value] of Object.entries(role.overrides)) {
      const applied = setEntityOverride(model, next, id, propertyId, value)
      if (!applied.ok)
        return {
          ok: false,
          message: `角色 ${role.roleId} 的初值 ${propertyId} 无法写入：${applied.message}`,
        }
      next = applied.content
    }
    created.push(id)
  }
  if (created.length === 0)
    return { ok: false, message: `模板 ${template.id} 没有角色，无法实例化` }
  return { ok: true, content: next }
}
