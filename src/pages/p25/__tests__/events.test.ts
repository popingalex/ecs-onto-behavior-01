import assert from "node:assert/strict"
import type { CommitDef } from "@/core/types"
import type { RoundResult } from "@/services/mock-executor"
import { collectEvents } from "../events"

/**
 * P25 事件链提取：事实（computed）与参考样例（reference-sample）分开标记；
 * 同刻事件按写入序号稳定排序；裁决事件携带 decisionId 供 P23 定位。
 */
const commit = (partial: Partial<CommitDef> & { id: string }): CommitDef => ({
  runId: "run-t",
  branchId: "main",
  parentId: null,
  round: 0,
  simTime: 420,
  summary: "",
  checkpoint: false,
  source: "computed",
  ...partial,
})

const record = (
  id: string,
  resultCommit: string,
  origin: RoundResult["origin"],
): RoundResult => ({
  record: {
    id,
    runId: "run-t",
    branchId: "main",
    baseCommit: "c042",
    resultCommit,
    modelVersion: "model-05",
    scheduleRef: "schedule-main@s5",
    programRefs: ["g-cool@g5"],
    inputVersions: {},
    simTimeBefore: 420,
    simTimeAfter: 430,
    logicalParallelGroups: [["cool-A", "cool-B"]],
    elapsedMs: null,
    traceOrdering: "seq",
  },
  origin,
  nextWorld: { commitId: resultCommit, simTime: 430, values: {} },
  programs: {},
  systemExecutions: [],
  nodeExecutions: [],
  effectRequests: [],
  decisions: [
    {
      id: `${id}-d1`,
      recordId: id,
      entityId: "F01",
      propertyId: "thermal.temperature",
      constraintRef: "cooling-floor@c1",
      old: 100,
      candidate: 0,
      budget: 80,
      budgetUnitId: "deltaK",
      scale: 0.8,
      allocations: [],
      final: 20,
      valueUnitId: "degC",
    },
  ],
  changes: [],
  dependencyEdges: [],
  diagnostics: [],
})

export function eventsSeparateFactFromSample() {
  const commits = {
    c042: commit({ id: "c042", source: "base" }),
    c043: commit({ id: "c043", parentId: "c042", simTime: 430, source: "reference-sample" }),
    c044: commit({ id: "c044", parentId: "c042", simTime: 430, source: "computed" }),
  }
  const records = [
    record("record-sample", "c043", "reference-sample"),
    record("record-real", "c044", "computed"),
  ]
  const events = collectEvents(commits, records)
  const byId = new Map(events.map((e) => [e.id, e]))
  assert.equal(byId.get("commit:c042")?.origin, "base")
  assert.equal(byId.get("settle:record-sample")?.origin, "reference-sample")
  assert.equal(byId.get("settle:record-real")?.origin, "computed")
  const decision = byId.get("decision:record-real-d1")
  assert.ok(decision, "裁决事件应来自真实记录")
  assert.equal(decision?.decisionId, "record-real-d1")
  assert.equal(decision?.origin, "computed")
}

export function eventsStableOrderAtSameTime() {
  const commits = {
    c042: commit({ id: "c042", source: "base" }),
    c043: commit({ id: "c043", parentId: "c042", simTime: 430 }),
    c044: commit({ id: "c044", parentId: "c043", simTime: 430 }),
  }
  const records = [record("r1", "c043", "computed"), record("r2", "c044", "computed")]
  const events = collectEvents(commits, records)
  const at430 = events.filter((e) => e.simTime === 430)
  // 排序稳定：重排输入记录顺序，同刻相对顺序不变（按提取序号）
  const reversed = collectEvents(commits, [...records].reverse()).filter(
    (e) => e.simTime === 430,
  )
  assert.deepEqual(
    reversed.map((e) => e.id),
    at430.map((e) => e.id),
    "同刻事件顺序由写入序号决定，不受输入遍历顺序影响",
  )
  assert.ok(at430.some((e) => e.kind === "decision"))
}

export function commitsWithoutRecordsHaveNoSettleEvents() {
  const commits = { c042: commit({ id: "c042", source: "base" }) }
  const events = collectEvents(commits, [])
  assert.deepEqual(
    events.map((e) => e.kind),
    ["commit"],
    "基准提交只有提交事件；结算/裁决不补造",
  )
}
