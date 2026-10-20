/** 键排序后的 JSON：同一语义内容无论对象键顺序如何都得到同一字符串。 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
    }
    return v
  })
}

/** FNV-1a 32 位：用于判定“内容是否变化”，不是安全哈希。 */
export function stableHash(value: unknown): string {
  const text = canonicalJson(value) ?? 'undefined'
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}
