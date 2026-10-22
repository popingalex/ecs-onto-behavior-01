import type { Route } from "@/core/types"
import type { DraftDocument } from "./draftRegistry"

/**
 * 试算错误横幅的清理判定（W2 回归 Bug3），与 session.ts 的订阅接线分离以便测试：
 * - 执行上下文（页面 / run / branch / viewCommit）切换 → 旧上下文诊断不再适用；
 * - 任一草稿修订变化 → 造成 INPUT_MISSING 等输入类失败的输入已被修改。
 */
export function executionContextKey(route: Route): string {
  const p = route.params
  return `${route.pageId}|${p.runId ?? ""}|${p.branchId ?? ""}|${p.viewCommit ?? ""}`
}

/** 各草稿文档的修订快照（revision 只在真实编辑/撤销/放弃时变化，保存/校验不动它）。 */
export function revisionSnapshot(
  documents: Record<string, DraftDocument>,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(documents).map(([id, doc]) => [id, doc.revision]),
  )
}

export function revisionsChanged(
  prev: Record<string, number>,
  next: Record<string, number>,
): boolean {
  if (Object.keys(prev).length !== Object.keys(next).length) return true
  return Object.entries(next).some(([id, revision]) => prev[id] !== revision)
}
