import type { EntityTypeDef } from "./model"

/**
 * 实体类型 parent 继承：子类型在自身声明之上叠加父链的必需/可选组件。
 * 就近声明优先（自身 > 近祖 > 远祖），同一组件只取第一次出现的声明。
 * 所有函数对成环 / 缺失父宽容（在问题处截断），成环由 checkIntegrity 报 ONTOLOGY_CYCLE。
 */

function byId(types: readonly EntityTypeDef[]): Map<string, EntityTypeDef> {
  return new Map(types.map((t) => [t.id, t]))
}

/** 父链 id（自近及远，不含自身）；缺失父或回到已见 id 时截断。 */
export function parentChain(
  types: readonly EntityTypeDef[],
  typeId: string,
): string[] {
  const index = byId(types)
  const seen = new Set<string>([typeId])
  const chain: string[] = []
  let cur = index.get(typeId)?.parent ?? null
  while (cur && !seen.has(cur)) {
    seen.add(cur)
    chain.push(cur)
    cur = index.get(cur)?.parent ?? null
  }
  return chain
}

/** 把 typeId 的父设为 parentId 是否成环：parentId 是自身，或其父链已经经过 typeId。 */
export function wouldCycle(
  types: readonly EntityTypeDef[],
  typeId: string,
  parentId: string,
): boolean {
  if (parentId === typeId) return true
  return parentChain(types, parentId).includes(typeId)
}

/** typeId 是否处在继承环上（沿父链走回自身）。 */
export function hasCycle(
  types: readonly EntityTypeDef[],
  typeId: string,
): boolean {
  const index = byId(types)
  const seen = new Set<string>([typeId])
  let cur = index.get(typeId)?.parent ?? null
  while (cur) {
    if (cur === typeId) return true
    if (seen.has(cur)) return false // 进入别人的环：自身不在环上
    seen.add(cur)
    cur = index.get(cur)?.parent ?? null
  }
  return false
}

export interface ComponentOrigin {
  componentId: string
  mode: "required" | "optional"
  /** 声明该组件的最近祖先 id；自身声明为 null。 */
  inheritedFrom: string | null
}

/** 有效装配：自身声明 + 父链补充（自身未声明的组件按最近祖先的声明补齐）。 */
export function effectiveComponents(
  types: readonly EntityTypeDef[],
  typeId: string,
): ComponentOrigin[] {
  const index = byId(types)
  const out: ComponentOrigin[] = []
  const declared = new Set<string>()
  const collect = (t: EntityTypeDef, inheritedFrom: string | null) => {
    for (const [ids, mode] of [
      [t.requiredComponentIds, "required"],
      [t.optionalComponentIds, "optional"],
    ] as const)
      for (const cid of ids) {
        if (declared.has(cid)) continue
        declared.add(cid)
        out.push({ componentId: cid, mode, inheritedFrom })
      }
  }
  const self = index.get(typeId)
  if (self) collect(self, null)
  for (const ancestorId of parentChain(types, typeId)) {
    const ancestor = index.get(ancestorId)
    if (ancestor) collect(ancestor, ancestorId)
  }
  return out
}

/** 有效必需组件 id（含继承），供实体装配与完整性检查使用。 */
export function effectiveRequiredIds(
  types: readonly EntityTypeDef[],
  typeId: string,
): string[] {
  return effectiveComponents(types, typeId)
    .filter((o) => o.mode === "required")
    .map((o) => o.componentId)
}
