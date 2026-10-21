import assert from "node:assert/strict"
import { z } from "zod"
import {
  applyEdit,
  getDocument,
  isDocumentDirty,
  redoDocument,
  registerDocument,
  saveDocument,
  undoDocument,
  type DocumentSpec,
} from "@/stores/draftRegistry"
import { loadPrototype } from "@/data/mockLoader"
import { checkIntegrity } from "@/schema/parse"
import {
  composeModel,
  ensureModelDocuments,
  programDocId,
  scheduleDocId,
  SCHEMA_DOC,
  type ProgramContent,
  type ScheduleContent,
  type SchemaContent,
} from "@/stores/modelDocuments"
import { createAttribute, deleteAttribute } from "@/features/ecs/operations"

/** 行为测试：由 scripts/test.mjs 通过 Vite SSR 加载；用内存 localStorage 代替浏览器存储。 */
const PREFIX = "ecs-workbench.draft.v1:"

function withMemoryStorage(
  seed: Record<string, unknown>,
  body: (data: Map<string, string>) => Promise<void>,
) {
  const data = new Map(
    Object.entries(seed).map(([k, v]) => [PREFIX + k, JSON.stringify(v)]),
  )
  const localStorage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  }
  const g = globalThis as { window?: unknown }
  const previous = g.window
  g.window = { localStorage }
  return body(data).finally(() => {
    g.window = previous
  })
}

const counterSchema = z.object({ count: z.number() })
const counterSpec: DocumentSpec<{ count: number }> = {
  kind: "schema",
  label: "counter",
  baseVersion: "v1",
  baseline: () => ({ count: 0 }),
  restore: (raw) => counterSchema.parse(raw),
}
const stored = (documentId: string, content: unknown, baseVersion = "v1") => ({
  format: "draft/1",
  documentId,
  kind: "schema",
  baseVersion,
  revision: 4,
  savedAt: "2025-01-01T00:00:00.000Z",
  content,
})

export function historyAndCoalescing() {
  registerDocument("test:history", counterSpec)
  const inc = (c: { count: number }) => ({ count: c.count + 1 })
  assert.equal(
    applyEdit("test:history", "inc", inc, { coalesceKey: "k" }),
    true,
  )
  applyEdit("test:history", "inc", inc, { coalesceKey: "k" })
  applyEdit("test:history", "other", inc)
  const doc = getDocument<{ count: number }>("test:history")!
  assert.equal(doc.content.count, 3)
  assert.equal(doc.undo.length, 2, "相同 coalesceKey 的连续编辑应合并")
  assert.equal(
    applyEdit<{ count: number }>("test:history", "noop", (c) => ({ ...c })),
    false,
    "内容不变不产生历史",
  )
  undoDocument("test:history")
  undoDocument("test:history")
  assert.equal(getDocument<{ count: number }>("test:history")!.content.count, 0)
  assert.equal(isDocumentDirty(getDocument("test:history")), false)
  redoDocument("test:history")
  assert.equal(getDocument<{ count: number }>("test:history")!.content.count, 2)
  applyEdit("test:history", "inc", inc)
  assert.equal(getDocument("test:history")!.redo.length, 0, "新编辑清空 redo")
}

export function saveAndRestore() {
  return withMemoryStorage(
    {
      "test:restored": stored("test:restored", { count: 7 }),
      "test:corrupt": stored("test:corrupt", { count: "seven" }),
      "test:stale": stored("test:stale", { count: 9 }, "v0"),
    },
    async (data) => {
      const restored = registerDocument("test:restored", counterSpec)
      assert.deepEqual(restored.content, { count: 7 })
      assert.equal(restored.restore.status, "restored")
      assert.equal(restored.revision, 4)

      const corrupt = registerDocument("test:corrupt", counterSpec)
      assert.deepEqual(corrupt.content, { count: 0 }, "损坏存档不半恢复")
      assert.ok(
        corrupt.restore.status === "rejected" &&
          corrupt.restore.reason.includes("count"),
        JSON.stringify(corrupt.restore),
      )

      const stale = registerDocument("test:stale", counterSpec)
      assert.ok(
        stale.restore.status === "rejected" &&
          stale.restore.reason.includes("v0"),
      )

      registerDocument("test:saved", counterSpec)
      applyEdit("test:saved", "set", () => ({ count: 5 }))
      assert.equal(isDocumentDirty(getDocument("test:saved")), true)
      assert.equal(await saveDocument("test:saved"), true)
      assert.equal(isDocumentDirty(getDocument("test:saved")), false)
      const payload = JSON.parse(data.get(PREFIX + "test:saved")!)
      assert.deepEqual(payload.content, { count: 5 })
      assert.equal(payload.baseVersion, "v1")
    },
  )
}

export function modelDocumentsRestoreAndCompose() {
  // 不能用 composeModel 取基线：它会在内存存储装好之前注册模型文档
  const baseline = structuredClone(loadPrototype().model)
  const program = baseline.programs[0]
  const schedule = baseline.schedules[0]
  const pid = programDocId(program.id)
  const sid = scheduleDocId(schedule.id)
  const scheduleLayout = baseline.layouts[schedule.id]
  return withMemoryStorage(
    {
      [pid]: {
        ...stored(
          pid,
          {
            program: { ...program, nodes: "broken" },
            layout: baseline.layouts[program.id],
          },
          `${program.id}@${program.version}`,
        ),
        kind: "program",
      },
      [sid]: {
        ...stored(
          sid,
          {
            schedule,
            layout: { ...scheduleLayout, viewport: { x: 1, y: 2, zoom: 1.5 } },
          },
          `${schedule.id}@${schedule.version}`,
        ),
        kind: "schedule",
      },
    },
    async () => {
      ensureModelDocuments()
      const p = getDocument<ProgramContent>(pid)!
      assert.ok(
        p.restore.status === "rejected" && p.restore.reason.includes("nodes"),
        JSON.stringify(p.restore),
      )
      assert.deepEqual(p.content.program, program)
      const s = getDocument<ScheduleContent>(sid)!
      assert.equal(s.restore.status, "restored", JSON.stringify(s.restore))
      assert.equal(s.content.layout.viewport.zoom, 1.5)
      // 仅布局变化：内容哈希变化，语义哈希不变
      const before = getDocument(sid)!
      applyEdit<ScheduleContent>(sid, "move", (c) => ({
        ...c,
        layout: { ...c.layout, viewport: { ...c.layout.viewport, x: 40 } },
      }))
      const after = getDocument(sid)!
      assert.notEqual(after.contentHash, before.contentHash)
      assert.equal(after.semanticHash, before.semanticHash)
      const draft = composeModel("draft")
      assert.equal(draft.layouts[schedule.id].viewport.x, 40)
      assert.deepEqual(draft.programs[0], program)
    },
  )
}

export function ecsCrudComposeConsistency() {
  // CRUD 写入 SCHEMA_DOC 后，composeModel('draft') 立即反映且交叉引用完整性干净；删除后复原。
  ensureModelDocuments()
  const doc = getDocument<SchemaContent>(SCHEMA_DOC)!
  const created = createAttribute(doc.content, {
    componentId: "Thermal",
    id: "thermal.testattr",
    label: "试验属性",
    type: { primitive: "f64", shape: "scalar", nullable: true },
    default: null,
    writeMode: "configuration",
  })
  assert.ok(created.ok, JSON.stringify(created))
  applyEdit(SCHEMA_DOC, "试验新增属性", () =>
    created.ok ? created.content : doc.content,
  )
  const draft = composeModel("draft")
  assert.ok(draft.attributes.some((a) => a.id === "thermal.testattr"))
  assert.ok(
    draft.components
      .find((c) => c.id === "Thermal")!
      .propertyIds.includes("thermal.testattr"),
  )
  assert.deepEqual(
    checkIntegrity(draft).filter((d) => d.severity === "error"),
    [],
  )

  const removed = deleteAttribute(
    draft,
    getDocument<SchemaContent>(SCHEMA_DOC)!.content,
    "thermal.testattr",
  )
  assert.ok(removed.ok, JSON.stringify(removed))
  applyEdit(SCHEMA_DOC, "试验删除属性", () =>
    removed.ok ? removed.content : doc.content,
  )
  const restored = composeModel("draft")
  assert.ok(!restored.attributes.some((a) => a.id === "thermal.testattr"))
  assert.ok(
    !restored.components
      .find((c) => c.id === "Thermal")!
      .propertyIds.includes("thermal.testattr"),
  )
  assert.deepEqual(
    checkIntegrity(restored).filter((d) => d.severity === "error"),
    [],
  )
}
