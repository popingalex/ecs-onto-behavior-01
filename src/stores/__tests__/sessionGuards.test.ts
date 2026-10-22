import assert from "node:assert/strict"
import type { DraftDocument } from "@/stores/draftRegistry"
import {
  executionContextKey,
  revisionSnapshot,
  revisionsChanged,
} from "@/stores/sessionGuards"

/**
 * Bug3 回归：错误横幅清理判定。上下文键必须跟踪 run/branch/viewCommit；
 * 修订快照只在真实编辑（revision 变化）时判定为“输入已修改”。
 */
export function contextKeyTracksExecutionContext() {
  const base = {
    pageId: "P20" as const,
    params: { runId: "run-main", branchId: "main", viewCommit: "c042" },
  }
  assert.equal(executionContextKey(base), executionContextKey({ ...base }))
  assert.notEqual(
    executionContextKey(base),
    executionContextKey({
      ...base,
      params: { ...base.params, branchId: "branch-other" },
    }),
  )
  assert.notEqual(
    executionContextKey(base),
    executionContextKey({
      ...base,
      params: { ...base.params, viewCommit: "c043" },
    }),
  )
  // 非执行参数（比较选择等）不影响上下文键。
  assert.equal(
    executionContextKey(base),
    executionContextKey({ ...base, params: { ...base.params, left: "c042" } }),
  )
  // 离开页面本身也是上下文切换。
  assert.notEqual(
    executionContextKey(base),
    executionContextKey({ pageId: "P26", params: base.params }),
  )
}

export function revisionSnapshotDetectsRealEdits() {
  const docs = {
    "schema:model-05": { revision: 1 },
    "program:g-cool": { revision: 2 },
  } as unknown as Record<string, DraftDocument>
  const snapshot = revisionSnapshot(docs)
  assert.equal(revisionsChanged(snapshot, revisionSnapshot(docs)), false)
  // 真实编辑：revision 变化 → 判定为输入已修改。
  assert.equal(
    revisionsChanged(
      snapshot,
      revisionSnapshot({
        ...docs,
        "schema:model-05": { revision: 2 } as DraftDocument,
      }),
    ),
    true,
  )
  // 文档集合变化（注册/注销）也算变化。
  assert.equal(revisionsChanged(snapshot, revisionSnapshot({})), true)
}
