import { createId } from "@/lib/id"

/**
 * 稳定 ID 建议与校验。风格对齐种子：组件/类型用语义化 PascalCase，
 * 属性用 <component>.<name>，模板用 tpl-<type>，实体用类型首字母 + 两位序号。
 * 建议值都可编辑；冲突时用 createId 兜底保证唯一。
 */
export const ID_PATTERN = /^[A-Za-z][A-Za-z0-9._-]*$/

export function validId(id: string): boolean {
  return ID_PATTERN.test(id)
}

function numberSuffix(
  taken: (id: string) => boolean,
  make: (n: number) => string,
): string {
  for (let n = 1; n < 1000; n++) {
    const id = make(n)
    if (!taken(id)) return id
  }
  return createId("obj")
}

export function suggestEntityId(
  typeId: string,
  taken: (id: string) => boolean,
): string {
  const prefix = (typeId[0] ?? "E").toUpperCase()
  return numberSuffix(taken, (n) => `${prefix}${String(n).padStart(2, "0")}`)
}

export function suggestAttributeId(
  componentId: string,
  taken: (id: string) => boolean,
): string {
  return numberSuffix(taken, (n) => `${componentId.toLowerCase()}.attr${n}`)
}

export function suggestComponentId(taken: (id: string) => boolean): string {
  return numberSuffix(taken, (n) => `NewComponent${n > 1 ? n : ""}`)
}

export function suggestTypeId(taken: (id: string) => boolean): string {
  return numberSuffix(taken, (n) => `NewType${n > 1 ? n : ""}`)
}

export function suggestTemplateId(
  typeId: string,
  taken: (id: string) => boolean,
): string {
  const base = `tpl-${typeId.toLowerCase()}`
  if (!taken(base)) return base
  return numberSuffix(taken, (n) => `${base}-${n + 1}`)
}

/** 模板版本风格对齐种子的 t3。 */
export function suggestTemplateVersion(versions: string[]): string {
  const max = versions.reduce((acc, v) => {
    const m = /^t(\d+)$/.exec(v)
    return m ? Math.max(acc, Number(m[1])) : acc
  }, 0)
  return `t${max + 1}`
}
