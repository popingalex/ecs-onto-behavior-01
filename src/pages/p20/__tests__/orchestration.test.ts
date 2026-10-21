import assert from "node:assert/strict"
import { loadPrototype } from "@/data/mockLoader"
import type { PrototypeModel } from "@/schema/model"
import {
  executeRound,
  type ExecuteInput,
  type RoundResult,
} from "@/services/mock-executor"
import {
  orchestrateRound,
  orchestrationEntityRows,
} from "../orchestration"

/** P20 编排层数据推导：record → 执行批次 / 并行组 / system 合计（纯函数，不触碰 store）。 */

const freshModel = () => structuredClone(loadPrototype().model)

function mustRun(model: PrototypeModel): RoundResult {
  const input: ExecuteInput = {
    model,
    world: structuredClone(model.baseWorld),
    runId: "run-main",
    branchId: "main",
    baseCommit: model.baseWorld.commitId,
    stepSeconds: 10,
    recordId: "record-orch",
    resultCommitId: "c-orch",
  }
  const out = executeRound(input)
  assert.ok(out.ok, "基线回合应可执行")
  return out.result
}

export function orchestrationBatchesAndTotals() {
  const record = mustRun(freshModel())
  const o = orchestrateRound(record)
  assert.equal(o.recordId, "record-orch")
  assert.equal(o.baseCommit, record.record.baseCommit)
  assert.equal(o.resultCommit, "c-orch")

  // 批次与 record.logicalParallelGroups 对齐：并行组 → 归约 → 原子提交
  assert.equal(o.batches.length, record.record.logicalParallelGroups.length)
  const first = o.batches[0]
  assert.equal(first.kind, "systems")
  assert.deepEqual(
    first.systems.map((s) => s.systemId),
    ["cool-A", "cool-B"],
  )
  const stages = o.batches.filter((b) => b.kind === "stage")
  assert.deepEqual(
    stages.map((b) => b.stage.flat()),
    [["reduce-cooling"], ["commit"]],
  )

  // system 合计与逐条记录一致（基线数值见 mockExecutor 行为测试）
  const coolA = first.systems.find((s) => s.systemId === "cool-A")!
  assert.deepEqual(coolA.entities, ["F01", "F02", "F03"])
  assert.equal(coolA.requestedTotal, -140)
  assert.equal(coolA.approvedTotal, -90)
  const requestedSum = record.effectRequests
    .filter((e) => e.systemId === "cool-A")
    .reduce((s, e) => s + e.requestedDelta, 0)
  assert.equal(coolA.requestedTotal, requestedSum)
}

export function orchestrationEntityRowsDrilldown() {
  const record = mustRun(freshModel())
  const rows = orchestrationEntityRows(record, "cool-A")
  assert.deepEqual(
    rows.map((r) => r.entityId),
    ["F01", "F02", "F03"],
  )
  const f01 = rows[0]
  assert.equal(f01.requested, -50)
  assert.equal(f01.approved, -40)
  assert.equal(typeof f01.localPreview, "number")
  // 没有执行的 system 没有实体行
  assert.deepEqual(orchestrationEntityRows(record, "no-such-system"), [])
}
