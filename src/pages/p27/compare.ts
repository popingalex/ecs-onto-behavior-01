import type { DisplayValue, WorldSnapshot } from "@/core/types"
import type { WorkbenchIndex } from "@/data/index"
import { worldValue } from "@/data/world"

/**
 * P27 分支对比：逐实体属性比较两个世界快照。
 * 缺值显示「未记录」，不当 0 参与差值；同值但来源不同的行单独标注（sameValue）。
 */
export interface CompareRow {
  entityId: string
  propertyId: string
  label: string
  unitId: string | null
  left: DisplayValue
  right: DisplayValue
  /** 右−左 的数值差；任一侧不是有限数值时为 null（差值列显示“—”而不是 0）。 */
  delta: number | null
  /** 两侧原始值完全一致（来源仍可能不同，由页面结合记录标注）。 */
  sameValue: boolean
  /** 差值的量纲：°C 的差是温差 K；其余沿用属性单位。 */
  deltaUnitId: string | null
}

export function compareWorlds(
  index: WorkbenchIndex,
  leftWorld: WorldSnapshot | undefined,
  rightWorld: WorldSnapshot | undefined,
): CompareRow[] {
  const entityIds = [
    ...new Set([
      ...Object.keys(leftWorld?.values ?? {}),
      ...Object.keys(rightWorld?.values ?? {}),
      ...index.entities.keys(),
    ]),
  ].sort()
  const rows: CompareRow[] = []
  for (const entityId of entityIds) {
    const entity = index.entities.get(entityId)
    if (!entity) continue
    const properties = entity.components.flatMap(
      (cid) => index.propertiesByComponent.get(cid) ?? [],
    )
    for (const property of properties) {
      const left = worldValue(index, leftWorld, entityId, property)
      const right = worldValue(index, rightWorld, entityId, property)
      const lv = left.state === "value" ? left.value : null
      const rv = right.state === "value" ? right.value : null
      const numeric =
        typeof lv === "number" &&
        Number.isFinite(lv) &&
        typeof rv === "number" &&
        Number.isFinite(rv)
      rows.push({
        entityId,
        propertyId: property.id,
        label: property.label,
        unitId: property.unitId,
        left,
        right,
        delta: numeric ? (rv as number) - (lv as number) : null,
        sameValue: JSON.stringify(lv) === JSON.stringify(rv),
        deltaUnitId: property.unitId === "degC" ? "deltaK" : property.unitId,
      })
    }
  }
  return rows
}

/** 两侧提交是否有共同的谱系祖先（含自身）。返回最近的共同祖先 id，没有则 null。 */
export function commonAncestor(
  lineageOf: (headId: string) => string[],
  leftId: string,
  rightId: string,
): string | null {
  const rightAncestors = new Set(lineageOf(rightId))
  for (const id of lineageOf(leftId)) if (rightAncestors.has(id)) return id
  return null
}
