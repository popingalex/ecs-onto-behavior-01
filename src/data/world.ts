import type { DisplayValue, PropertyDef, RawValue, WorldSnapshot } from '@/core/types'
import type { WorkbenchIndex } from './index'

/** 原始值 → DisplayValue（模式层默认值、世界快照值）。0 / false / [0,0,0] 都是有效值。 */
export function toDisplay(value: RawValue | undefined, commitId?: string): DisplayValue {
  if (value === undefined) return { state: 'unrecorded' }
  if (value === null) return { state: 'null' }
  return { state: 'value', value, commitId }
}

export function entityHasProperty(index: WorkbenchIndex, entityId: string, property: PropertyDef): boolean {
  // 只看实体装配的组件实例；不能用类型声明或世界快照里有没有该字段来推断。
  return Boolean(index.entities.get(entityId)?.components.includes(property.componentId))
}

/** 某提交下实体属性的显示值：实体未装配该组件 → 不适用；快照缺字段 → 未记录（不补 0）。 */
export function worldValue(index: WorkbenchIndex, world: WorldSnapshot | undefined, entityId: string, property: PropertyDef): DisplayValue {
  if (!entityHasProperty(index, entityId, property)) return { state: 'notApplicable' }
  const row = world?.values[entityId]
  if (!world || !row || !(property.id in row)) return { state: 'unrecorded' }
  return toDisplay(row[property.id], world.commitId)
}

export function rawWorldValue(world: WorldSnapshot | undefined, entityId: string, propertyId: string): RawValue | undefined {
  return world?.values[entityId]?.[propertyId]
}
