type Ref = { id: string ;version: string }
interface Ctx {
  input: { id: string ;version: string }
  diagnostics: string[]
}
export function f(q: { id: string ;version: string }): { ok: boolean ;value: number } {
  const m: Map<string, { id: string ;version: string }> = new Map()
  return { ok: m.has(q.id), value: 1 }
}
