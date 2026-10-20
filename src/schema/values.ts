import type { PrototypeModel, RawValue, SceneEntity } from './model'

/** 初值来源：显式实例覆盖（含显式 null） > 模板覆盖 > 属性默认值。 */
export type ValueSource = 'instance' | 'template' | 'default'

export type ResolvedValue = { state: 'notApplicable' } | { state: 'value'; value: RawValue; source: ValueSource }

const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)

/** 组件是否装配只看实体的 componentInstances，不能从世界值里有没有该属性来推断。 */
export function isAssembled(entity: SceneEntity, componentId: string): boolean {
  return entity.componentInstances.some((ci) => ci.schemaRef.id === componentId)
}

export function resolveInitialValue(model: PrototypeModel, entity: SceneEntity, propertyId: string): ResolvedValue {
  const attr = model.attributes.find((a) => a.id === propertyId)
  if (!attr || !isAssembled(entity, attr.componentId)) return { state: 'notApplicable' }
  if (own(entity.initialOverrides, propertyId)) return { state: 'value', value: entity.initialOverrides[propertyId], source: 'instance' }
  const template = entity.templateRef ? model.templates.find((t) => t.id === entity.templateRef!.id && t.version === entity.templateRef!.version) : undefined
  if (template && own(template.overrides, propertyId)) return { state: 'value', value: template.overrides[propertyId], source: 'template' }
  return { state: 'value', value: attr.default, source: 'default' }
}

/** 按装配组件展开每个实体的初值，得到场景初始世界。 */
export function resolveSceneWorld(model: PrototypeModel): Record<string, Record<string, RawValue>> {
  const out: Record<string, Record<string, RawValue>> = {}
  for (const entity of model.scene.entities) {
    const row: Record<string, RawValue> = {}
    for (const ci of entity.componentInstances) {
      const component = model.components.find((c) => c.id === ci.schemaRef.id)
      for (const pid of component?.propertyIds ?? []) {
        const v = resolveInitialValue(model, entity, pid)
        if (v.state === 'value') row[pid] = v.value
      }
    }
    out[entity.id] = row
  }
  return out
}

export function valuesEqual(a: RawValue, b: RawValue): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => x === b[i])
  return a === b
}
