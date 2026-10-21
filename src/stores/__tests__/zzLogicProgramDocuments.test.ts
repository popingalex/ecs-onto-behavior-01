import assert from "node:assert/strict"
import { loadPrototype } from "@/data/mockLoader"
import * as D from "@/services/domainBindingService"
import { applyEdit, getDocument } from "@/stores/draftRegistry"
import {
  composeModel,
  createProgramDocument,
  duplicateProgramDocument,
  ensureModelDocuments,
  programDocId,
  type ProgramContent,
} from "@/stores/modelDocuments"

/**
 * M2 程序文档测试。文件名 zz 前缀是有意的：ensureModelDocuments 每个进程只注册一次，
 * draftRegistry.test.ts 的恢复用例依赖“首次注册发生在它的内存 localStorage 装好之
 * 后”，所以涉及模型文档注册的用例必须排在它之后执行（scripts/test.mjs 按路径排序）。
 */
const freshModel = () => structuredClone(loadPrototype().model)

/** 4 仅改布局（节点位置 / 视口）不改变语义哈希；语义变更才改变。 */
export function layoutOnlyEditKeepsSemanticHash() {
  ensureModelDocuments()
  const docId = programDocId("g-cool")
  const doc = getDocument<ProgramContent>(docId)!
  const semanticBefore = doc.semanticHash
  const contentBefore = doc.contentHash
  const moved = applyEdit<ProgramContent>(docId, "移动节点", (c) => ({
    ...c,
    layout: {
      ...c.layout,
      positions: { ...c.layout.positions, "n-old": { x: 999, y: 888 } },
      viewport: { x: 12, y: 34, zoom: 1.5 },
    },
  }))
  assert.equal(moved, true)
  const after = getDocument<ProgramContent>(docId)!
  assert.equal(after.semanticHash, semanticBefore, "布局变更不应动语义哈希")
  assert.notEqual(after.contentHash, contentBefore, "全内容哈希应变化（脏标记）")
  // 语义变更（清掉一个输入来源）必须改变语义哈希
  applyEdit<ProgramContent>(docId, "清除绑定", (c) => ({
    ...c,
    program: D.clearInput(c.program, freshModel(), "n-cap", "b"),
  }))
  const later = getDocument<ProgramContent>(docId)!
  assert.notEqual(later.semanticHash, semanticBefore)
}

/** 6 P30 动态程序：新建空程序与复制程序都注册为模型文档并进入 composeModel。 */
export function dynamicProgramDocuments() {
  ensureModelDocuments()
  const created = createProgramDocument("Fire")
  const doc = getDocument<ProgramContent>(programDocId(created))!
  assert.equal(doc.content.program.id, created)
  assert.equal(doc.content.program.scopeType, "Fire")
  assert.deepEqual(doc.content.program.nodes, [])
  const copyId = duplicateProgramDocument("g-cool")
  const copy = getDocument<ProgramContent>(programDocId(copyId))!
  assert.equal(copy.content.program.id, copyId)
  assert.equal(copy.content.program.nodes.length, 5)
  assert.equal(copy.content.program.edges.length, 4)
  // 复制的程序语义独立：改副本绑定，原程序语义哈希不变
  const gCoolBefore = getDocument<ProgramContent>(
    programDocId("g-cool"),
  )!.semanticHash
  applyEdit<ProgramContent>(copy.documentId, "改副本", (c) => ({
    ...c,
    program: D.clearInput(c.program, freshModel(), "n-room", "source"),
  }))
  assert.equal(
    getDocument<ProgramContent>(programDocId("g-cool"))!.semanticHash,
    gCoolBefore,
  )
  // composeModel 汇总种子 + 用户程序
  const ids = composeModel("draft").programs.map((p) => p.id)
  assert.ok(ids.includes("g-cool"))
  assert.ok(ids.includes(created))
  assert.ok(ids.includes(copyId))
}
