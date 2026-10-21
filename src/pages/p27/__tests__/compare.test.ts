import assert from "node:assert/strict"
import type { WorldSnapshot } from "@/core/types"
import { buildIndex } from "@/data/index"
import { loadSeed } from "@/mock/seed"
import { lineage } from "@/stores/history"
import type { CommitDef } from "@/core/types"
import { commonAncestor, compareWorlds } from "../compare"

/**
 * P27 分支对比：缺值显示「未记录」且不参与差值（不当 0）；
 * 温差列单位 K；同值行保留（来源差异由页面层标注）。纯函数测试，不触碰草稿文档。
 */
const seed = loadSeed()
const index = buildIndex(seed)

function rowOf(
  rows: ReturnType<typeof compareWorlds>,
  entityId: string,
  propertyId: string,
) {
  const row = rows.find(
    (r) => r.entityId === entityId && r.propertyId === propertyId,
  )
  assert.ok(row, `缺少对比行 ${entityId}.${propertyId}`)
  return row
}

export function compareBaselineVsSample() {
  const left = index.worlds.get("c042")
  const right = index.worlds.get("c043")
  const rows = compareWorlds(index, left, right)
  const f01 = rowOf(rows, "F01", "thermal.temperature")
  assert.equal(f01.left.state, "value")
  assert.equal(f01.right.state, "value")
  assert.equal(f01.delta, -80, "右−左 = 20 − 100")
  assert.equal(f01.deltaUnitId, "deltaK", "°C 的差是温差 K，不是 °C 绝对温度")
  assert.equal(f01.sameValue, false)
  // null 位置是有效值，不是缺失
  const pos = rowOf(rows, "C01", "position.local")
  assert.equal(pos.left.state, "null")
  assert.equal(pos.delta, null, "非数值不计算差值")
}

export function compareSameValueDifferentBranch() {
  const left = index.worlds.get("c043")
  const right = index.worlds.get("c043-one-cooler")
  const rows = compareWorlds(index, left, right)
  const f01 = rowOf(rows, "F01", "thermal.temperature")
  assert.equal(f01.delta, 30, "禁用 B 后 F01 差值 30K")
  assert.equal(f01.deltaUnitId, "deltaK")
  const f03 = rowOf(rows, "F03", "thermal.temperature")
  assert.equal(f03.sameValue, true, "F03 同值（来源差异由页面结合记录标注）")
  assert.equal(f03.delta, 0)
}

export function missingSideIsUnrecordedNotZero() {
  const full = index.worlds.get("c042")
  const partial: WorldSnapshot = {
    commitId: "c-partial",
    simTime: 430,
    values: { F02: { "thermal.temperature": 80 } },
  }
  const rows = compareWorlds(index, full, partial)
  const f01 = rowOf(rows, "F01", "thermal.temperature")
  assert.equal(f01.right.state, "unrecorded", "快照缺字段显示未记录")
  assert.equal(f01.delta, null, "缺值不当 0 参与差值")
  const f02 = rowOf(rows, "F02", "thermal.temperature")
  assert.equal(f02.delta, 0)
  // 一侧快照整体缺失
  const vsMissing = compareWorlds(index, full, undefined)
  assert.ok(
    rowOf(vsMissing, "F01", "thermal.temperature").right.state === "unrecorded",
  )
}

export function commonAncestorFindsForkPoint() {
  const commits: Record<string, CommitDef> = {
    c001: {
      id: "c001", runId: "r", branchId: "main", parentId: null,
      round: 0, simTime: 420, summary: "", checkpoint: true, source: "base",
    },
    c002: {
      id: "c002", runId: "r", branchId: "main", parentId: "c001",
      round: 1, simTime: 430, summary: "", checkpoint: false, source: "computed",
    },
    c101: {
      id: "c101", runId: "r", branchId: "b-one", parentId: "c001",
      round: 1, simTime: 430, summary: "", checkpoint: false, source: "computed",
    },
  }
  const lineageOf = (head: string) => lineage(commits, head).map((c) => c.id)
  assert.equal(commonAncestor(lineageOf, "c002", "c101"), "c001")
  assert.equal(commonAncestor(lineageOf, "c002", "c002"), "c002", "自身即祖先")
}
