import type {
  AttributeSchema,
  ComponentSchema,
  EntityTemplate,
  EntityTypeDef,
  ObjectRef,
  PrototypeModel,
  RawValue,
  SceneDraft,
  SceneEntity,
  ValueTypeRef,
  WriteMode,
} from "@/schema/model"
import { isAssembled } from "@/schema/values"
import type { SchemaContent } from "@/stores/modelDocuments"
import {
  attributeRefs,
  componentRefs,
  entityRefs,
  entityTypeRefs,
  templateRefs,
  type RefHit,
} from "./refs"
import { validId } from "./ids"

/**
 * ECS 草稿操作：全部是纯函数，输入当前文档内容（与组装模型），返回新内容；
 * 删除前做引用扫描，有引用则拒绝并带回引用位置。页面经 applyEdit 写入草稿文档。
 */
export type OpResult<T,> = { ok: true ;content: T } | {
  ok: false
  message: string
  refs?: RefHit[]
}

const ok = <T>(content: T): OpResult<T> => ({ ok: true, content })
const fail = <T>(message: string, refs?: RefHit[]): OpResult<T> => ({
  ok: false,
  message,
  refs,
})

/** 恢复继承（删除覆盖键）与显式设为 null（写入 null 值）是两个不同操作。 */
export const INHERIT = Symbol("inherit")

function checkId(id: string, taken: boolean): string | null {
  if (!id.trim()) return "ID 不能为空"
  if (!validId(id))
    return "ID 只能包含字母、数字、点、下划线与连字符，并以字母开头"
  if (taken) return `ID ${id} 已存在`
  return null
}

/** 值与属性类型的契合检查；null 只在可空时合法，[0,0,0] 是合法向量。 */
export function checkRawValue(
  type: ValueTypeRef,
  value: RawValue,
): string | null {
  if (value === null)
    return type.nullable ? null : "该属性不可空，不能设为 null"
  if (type.shape === "vector3")
    return Array.isArray(value) &&
      value.length === 3 &&
      value.every((n) => typeof n === "number")
      ? null
      : "需要三个数值的向量"
  if (Array.isArray(value)) return "标量属性不能取向量值"
  switch (type.primitive) {
    case "f64":
      return typeof value === "number" ? null : "需要数值"
    case "i64":
      return typeof value === "number" && Number.isInteger(value)
        ? null
        : "需要整数"
    case "bool":
      return typeof value === "boolean" ? null : "需要布尔值"
    case "string":
    case "EntityRef":
      return typeof value === "string" ? null : "需要文本"
  }
}

/** 类型变化时的占位默认值：可空给 null（不是 0），不可空给该类型的中性值。 */
export function neutralDefault(type: ValueTypeRef): RawValue {
  if (type.nullable) return null
  if (type.shape === "vector3") return [0, 0, 0]
  switch (type.primitive) {
    case "f64":
    case "i64":
      return 0
    case "bool":
      return false
    case "string":
    case "EntityRef":
      return ""
  }
}

// ---------- 实体类型 ----------

export function createEntityType(
  s: SchemaContent,
  input: { id: string ;label: string },
): OpResult<SchemaContent> {
  const err = checkId(
    input.id,
    s.entityTypes.some((t) => t.id === input.id),
  )
  if (err) return fail(err)
  const type: EntityTypeDef = {
    id: input.id,
    label: input.label.trim() || input.id,
    requiredComponentIds: [],
    optionalComponentIds: [],
  }
  return ok({ ...s, entityTypes: [...s.entityTypes, type] })
}

export function renameEntityType(
  s: SchemaContent,
  id: string,
  label: string,
): OpResult<SchemaContent> {
  if (!label.trim()) return fail("显示名不能为空")
  return ok({
    ...s,
    entityTypes: s.entityTypes.map((t) =>
      t.id === id ? { ...t, label: label.trim() } : t,
    ),
  })
}

/** 调整类型与组件的装配关系：必需 / 可选 / 不关联。 */
export function setEntityTypeComponent(
  s: SchemaContent,
  typeId: string,
  componentId: string,
  mode: "required" | "optional" | "none",
): OpResult<SchemaContent> {
  if (!s.components.some((c) => c.id === componentId))
    return fail(`组件 ${componentId} 不存在`)
  const type = s.entityTypes.find((t) => t.id === typeId)
  if (!type) return fail(`实体类型 ${typeId} 不存在`)
  const required = type.requiredComponentIds.filter((c) => c !== componentId)
  const optional = type.optionalComponentIds.filter((c) => c !== componentId)
  if (mode === "required") required.push(componentId)
  if (mode === "optional") optional.push(componentId)
  const next: EntityTypeDef = {
    ...type,
    requiredComponentIds: required,
    optionalComponentIds: optional,
  }
  return ok({
    ...s,
    entityTypes: s.entityTypes.map((t) => (t.id === typeId ? next : t)),
  })
}

export function deleteEntityType(
  model: PrototypeModel,
  s: SchemaContent,
  id: string,
): OpResult<SchemaContent> {
  const refs = entityTypeRefs(model, id)
  if (refs.length)
    return fail(`实体类型 ${id} 仍被 ${refs.length} 处引用，不能删除`, refs)
  return ok({ ...s, entityTypes: s.entityTypes.filter((t) => t.id !== id) })
}

// ---------- 组件 ----------

export function createComponent(
  s: SchemaContent,
  input: { id: string ;label: string },
): OpResult<SchemaContent> {
  const err = checkId(
    input.id,
    s.components.some((c) => c.id === input.id),
  )
  if (err) return fail(err)
  const component: ComponentSchema = {
    id: input.id,
    label: input.label.trim() || input.id,
    version: "1",
    propertyIds: [],
  }
  return ok({ ...s, components: [...s.components, component] })
}

export function renameComponent(
  s: SchemaContent,
  id: string,
  label: string,
): OpResult<SchemaContent> {
  if (!label.trim()) return fail("显示名不能为空")
  return ok({
    ...s,
    components: s.components.map((c) =>
      c.id === id ? { ...c, label: label.trim() } : c,
    ),
  })
}

export function deleteComponent(
  model: PrototypeModel,
  s: SchemaContent,
  id: string,
): OpResult<SchemaContent> {
  const refs = componentRefs(model, id)
  if (refs.length)
    return fail(`组件 ${id} 仍被 ${refs.length} 处引用，不能删除`, refs)
  return ok({ ...s, components: s.components.filter((c) => c.id !== id) })
}

// ---------- 属性 ----------

export interface AttributeInput {
  componentId: string
  id: string
  label: string
  type: ValueTypeRef
  default: RawValue
  writeMode: WriteMode
  reducerRef?: ObjectRef
}

function checkAttribute(
  s: SchemaContent,
  input: AttributeInput,
): string | null {
  if (!s.components.some((c) => c.id === input.componentId))
    return `组件 ${input.componentId} 不存在`
  if (input.type.unitId) {
    const unit = s.units.find((u) => u.id === input.type.unitId)
    if (!unit) return `单位 ${input.type.unitId} 不存在`
    if (
      input.type.quantityKind &&
      unit.quantityKind !== input.type.quantityKind
    )
      return `量种 ${input.type.quantityKind} 与单位 ${unit.id}（${unit.quantityKind}）不符`
  }
  const valueErr = checkRawValue(input.type, input.default)
  if (valueErr) return `默认值：${valueErr}`
  if (input.writeMode === "contribution" && !input.reducerRef)
    return "贡献写入必须关联归约契约"
  return null
}

/** 新建属性并登记为所属组件的成员（组件成员增删的唯一入口）。 */
export function createAttribute(
  s: SchemaContent,
  input: AttributeInput,
): OpResult<SchemaContent> {
  const err =
    checkId(
      input.id,
      s.attributes.some((a) => a.id === input.id),
    ) ?? checkAttribute(s, input)
  if (err) return fail(err)
  const attr: AttributeSchema = {
    id: input.id,
    componentId: input.componentId,
    label: input.label.trim() || input.id,
    type: input.type,
    default: input.default,
    writeMode: input.writeMode,
    ...(input.reducerRef ? { reducerRef: input.reducerRef } : {}),
  }
  return ok({
    ...s,
    attributes: [...s.attributes, attr],
    components: s.components.map((c) =>
      c.id === input.componentId
        ? { ...c, propertyIds: [...c.propertyIds, attr.id] }
        : c,
    ),
  })
}

export type AttributePatch = Partial<Pick<AttributeSchema, "label" | "default" | "writeMode">> & {
  type?: ValueTypeRef
  reducerRef?: ObjectRef | null
}

export function updateAttribute(
  s: SchemaContent,
  id: string,
  patch: AttributePatch,
): OpResult<SchemaContent> {
  const attr = s.attributes.find((a) => a.id === id)
  if (!attr) return fail(`属性 ${id} 不存在`)
  const next: AttributeSchema = {
    ...attr,
    ...patch,
    reducerRef:
      patch.reducerRef === null
        ? undefined
        : (patch.reducerRef ?? attr.reducerRef),
  }
  if (next.label !== undefined && !next.label.trim())
    return fail("显示名不能为空")
  const err = checkAttribute(s, {
    componentId: next.componentId,
    id: next.id,
    label: next.label,
    type: next.type,
    default: next.default,
    writeMode: next.writeMode,
    reducerRef: next.reducerRef,
  })
  if (err) return fail(err)
  return ok({
    ...s,
    attributes: s.attributes.map((a) => (a.id === id ? next : a)),
  })
}

export function deleteAttribute(
  model: PrototypeModel,
  s: SchemaContent,
  id: string,
): OpResult<SchemaContent> {
  const attr = s.attributes.find((a) => a.id === id)
  if (!attr) return fail(`属性 ${id} 不存在`)
  const refs = attributeRefs(model, id)
  if (refs.length)
    return fail(`属性 ${id} 仍被 ${refs.length} 处引用，不能删除`, refs)
  return ok({
    ...s,
    attributes: s.attributes.filter((a) => a.id !== id),
    components: s.components.map((c) =>
      c.id === attr.componentId
        ? { ...c, propertyIds: c.propertyIds.filter((p) => p !== id) }
        : c,
    ),
  })
}

// ---------- 模板 ----------

export function createTemplate(
  s: SchemaContent,
  input: { id: string ;version: string ;label: string ;typeId: string },
): OpResult<SchemaContent> {
  const err = checkId(
    input.id,
    s.templates.some((t) => t.id === input.id),
  )
  if (err) return fail(err)
  const type = s.entityTypes.find((t) => t.id === input.typeId)
  if (!type) return fail(`实体类型 ${input.typeId} 不存在`)
  const componentSchemaRefs: ObjectRef[] = type.requiredComponentIds.map(
    (cid) => ({
      id: cid,
      version: s.components.find((c) => c.id === cid)?.version ?? "1",
    }),
  )
  const template: EntityTemplate = {
    id: input.id,
    version: input.version,
    label: input.label.trim() || input.id,
    typeId: input.typeId,
    componentSchemaRefs,
    overrides: {},
  }
  return ok({ ...s, templates: [...s.templates, template] })
}

export function renameTemplate(
  s: SchemaContent,
  id: string,
  label: string,
): OpResult<SchemaContent> {
  if (!label.trim()) return fail("显示名不能为空")
  return ok({
    ...s,
    templates: s.templates.map((t) =>
      t.id === id ? { ...t, label: label.trim() } : t,
    ),
  })
}

function withTemplateOverride(
  s: SchemaContent,
  templateId: string,
  propertyId: string,
  value: RawValue | typeof INHERIT,
): OpResult<SchemaContent> {
  const template = s.templates.find((t) => t.id === templateId)
  if (!template) return fail(`模板 ${templateId} 不存在`)
  if (value === INHERIT) {
    const overrides = { ...template.overrides }
    delete overrides[propertyId]
    return ok({
      ...s,
      templates: s.templates.map((t) =>
        t.id === templateId ? { ...t, overrides } : t,
      ),
    })
  }
  const attr = s.attributes.find((a) => a.id === propertyId)
  if (!attr) return fail(`属性 ${propertyId} 不存在`)
  if (!template.componentSchemaRefs.some((r) => r.id === attr.componentId))
    return fail(`模板未装配组件 ${attr.componentId}，不能覆盖 ${propertyId}`)
  const err = checkRawValue(attr.type, value)
  if (err) return fail(err)
  return ok({
    ...s,
    templates: s.templates.map((t) =>
      t.id === templateId
        ? { ...t, overrides: { ...t.overrides, [propertyId]: value } }
        : t,
    ),
  })
}

/** 模板覆盖：写入显式值（null 也是显式值）。 */
export function setTemplateOverride(
  s: SchemaContent,
  templateId: string,
  propertyId: string,
  value: RawValue,
): OpResult<SchemaContent> {
  return withTemplateOverride(s, templateId, propertyId, value)
}

/** 恢复继承：删除覆盖键，回到属性默认值。 */
export function clearTemplateOverride(
  s: SchemaContent,
  templateId: string,
  propertyId: string,
): OpResult<SchemaContent> {
  return withTemplateOverride(s, templateId, propertyId, INHERIT)
}

export function deleteTemplate(
  model: PrototypeModel,
  s: SchemaContent,
  id: string,
): OpResult<SchemaContent> {
  const refs = templateRefs(model, id)
  if (refs.length)
    return fail(`模板 ${id} 仍被 ${refs.length} 个实体使用，不能删除`, refs)
  return ok({ ...s, templates: s.templates.filter((t) => t.id !== id) })
}

// ---------- 场景实体 ----------

export function createSceneEntity(
  model: PrototypeModel,
  scene: SceneDraft,
  input: { id: string ;label: string ;typeId: string ;templateId?: string },
): OpResult<SceneDraft> {
  const err = checkId(
    input.id,
    scene.entities.some((e) => e.id === input.id),
  )
  if (err) return fail(err)
  const type = model.entityTypes.find((t) => t.id === input.typeId)
  if (!type) return fail(`实体类型 ${input.typeId} 不存在`)
  const template = input.templateId
    ? model.templates.find((t) => t.id === input.templateId)
    : undefined
  if (input.templateId && !template)
    return fail(`模板 ${input.templateId} 不存在`)
  if (template && template.typeId !== input.typeId)
    return fail(
      `模板 ${template.id} 的类型是 ${template.typeId}，不能用于 ${input.typeId}`,
    )
  const refs: ObjectRef[] = template
    ? template.componentSchemaRefs.map((r) => ({ ...r }))
    : type.requiredComponentIds.map((cid) => ({
        id: cid,
        version: model.components.find((c) => c.id === cid)?.version ?? "1",
      }))
  const entity: SceneEntity = {
    id: input.id,
    label: input.label.trim() || input.id,
    typeId: input.typeId,
    templateRef: template
      ? { id: template.id, version: template.version }
      : null,
    componentInstances: refs.map((schemaRef) => ({ schemaRef })),
    initialOverrides: {},
  }
  return ok({ ...scene, entities: [...scene.entities, entity] })
}

export function renameSceneEntity(
  scene: SceneDraft,
  id: string,
  label: string,
): OpResult<SceneDraft> {
  if (!label.trim()) return fail("显示名不能为空")
  return ok({
    ...scene,
    entities: scene.entities.map((e) =>
      e.id === id ? { ...e, label: label.trim() } : e,
    ),
  })
}

export function deleteSceneEntity(
  model: PrototypeModel,
  scene: SceneDraft,
  id: string,
): OpResult<SceneDraft> {
  const refs = entityRefs(model, id)
  if (refs.length)
    return fail(`实体 ${id} 仍被 ${refs.length} 处引用，不能删除`, refs)
  return ok({ ...scene, entities: scene.entities.filter((e) => e.id !== id) })
}

export function addEntityComponent(
  model: PrototypeModel,
  scene: SceneDraft,
  entityId: string,
  componentId: string,
): OpResult<SceneDraft> {
  const entity = scene.entities.find((e) => e.id === entityId)
  if (!entity) return fail(`实体 ${entityId} 不存在`)
  const component = model.components.find((c) => c.id === componentId)
  if (!component) return fail(`组件 ${componentId} 不存在`)
  if (isAssembled(entity, componentId))
    return fail(`实体已装配组件 ${componentId}`)
  const next: SceneEntity = {
    ...entity,
    componentInstances: [
      ...entity.componentInstances,
      { schemaRef: { id: component.id, version: component.version } },
    ],
  }
  return ok({
    ...scene,
    entities: scene.entities.map((e) => (e.id === entityId ? next : e)),
  })
}

/** 移除组件实例；类型声明为必需组件时报错，同时清理该组件属性的实例覆盖。 */
export function removeEntityComponent(
  model: PrototypeModel,
  scene: SceneDraft,
  entityId: string,
  componentId: string,
): OpResult<SceneDraft> {
  const entity = scene.entities.find((e) => e.id === entityId)
  if (!entity) return fail(`实体 ${entityId} 不存在`)
  if (!isAssembled(entity, componentId))
    return fail(`实体未装配组件 ${componentId}`)
  const type = model.entityTypes.find((t) => t.id === entity.typeId)
  if (type?.requiredComponentIds.includes(componentId))
    return fail(
      `${componentId} 是 ${entity.typeId} 的必需组件，不能从实体 ${entityId} 移除`,
    )
  const memberProps = new Set(
    model.components.find((c) => c.id === componentId)?.propertyIds ?? [],
  )
  const initialOverrides = Object.fromEntries(
    Object.entries(entity.initialOverrides).filter(
      ([pid]) => !memberProps.has(pid),
    ),
  )
  const next: SceneEntity = {
    ...entity,
    componentInstances: entity.componentInstances.filter(
      (ci) => ci.schemaRef.id !== componentId,
    ),
    initialOverrides,
  }
  return ok({
    ...scene,
    entities: scene.entities.map((e) => (e.id === entityId ? next : e)),
  })
}

function withEntityOverride(
  model: PrototypeModel,
  scene: SceneDraft,
  entityId: string,
  propertyId: string,
  value: RawValue | typeof INHERIT,
): OpResult<SceneDraft> {
  const entity = scene.entities.find((e) => e.id === entityId)
  if (!entity) return fail(`实体 ${entityId} 不存在`)
  if (value === INHERIT) {
    const initialOverrides = { ...entity.initialOverrides }
    delete initialOverrides[propertyId]
    return ok({
      ...scene,
      entities: scene.entities.map((e) =>
        e.id === entityId ? { ...e, initialOverrides } : e,
      ),
    })
  }
  const attr = model.attributes.find((a) => a.id === propertyId)
  if (!attr) return fail(`属性 ${propertyId} 不存在`)
  if (!isAssembled(entity, attr.componentId))
    return fail(`实体未装配组件 ${attr.componentId}，属性 ${propertyId} 不适用`)
  const err = checkRawValue(attr.type, value)
  if (err) return fail(err)
  const next: SceneEntity = {
    ...entity,
    initialOverrides: { ...entity.initialOverrides, [propertyId]: value },
  }
  return ok({
    ...scene,
    entities: scene.entities.map((e) => (e.id === entityId ? next : e)),
  })
}

/** 实例初值覆盖：写入显式值（含显式 null）；优先级高于模板覆盖与属性默认。 */
export function setEntityOverride(
  model: PrototypeModel,
  scene: SceneDraft,
  entityId: string,
  propertyId: string,
  value: RawValue,
): OpResult<SceneDraft> {
  return withEntityOverride(model, scene, entityId, propertyId, value)
}

/** 恢复继承：删除实例覆盖键，回到模板覆盖 / 属性默认。 */
export function clearEntityOverride(
  model: PrototypeModel,
  scene: SceneDraft,
  entityId: string,
  propertyId: string,
): OpResult<SceneDraft> {
  return withEntityOverride(model, scene, entityId, propertyId, INHERIT)
}
