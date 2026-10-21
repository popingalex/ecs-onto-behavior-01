import type { UnitDef as CoreUnitDef, PropertyDef } from "@/core/types"
import type { AttributeSchema, UnitDef } from "@/schema/model"

/** v0.5 schema 形状 → 旧展示组件（PropertyGrid / TypedValueCell）消费的形状；只改字段名，不改语义。 */
export function toUnitDef(u: UnitDef): CoreUnitDef {
  return {
    id: u.id,
    symbol: u.symbol,
    label: u.quantityKind,
    quantityId: u.quantityKind,
  }
}

export function toPropertyDef(a: AttributeSchema): PropertyDef {
  return {
    id: a.id,
    componentId: a.componentId,
    label: a.label,
    shape: a.type.shape,
    primitive: a.type.primitive,
    unitId: a.type.unitId ?? null,
    nullable: a.type.nullable,
    default: a.default,
    writeMode: a.writeMode,
    reducer: a.reducerRef?.id,
    description: "",
  }
}
