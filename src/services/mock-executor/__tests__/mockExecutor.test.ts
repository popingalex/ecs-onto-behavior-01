import assert from "node:assert/strict"
import { loadPrototype } from "@/data/mockLoader"
import type { PrototypeModel, ScheduleDocument } from "@/schema/model"
import {
  executeRound,
  type ExecuteInput,
  type RoundResult,
} from "@/services/mock-executor"
import { getRecord, putRecord, traceStore } from "@/stores/trace"

/**
 * M4 执行器行为测试。数值期望来自 design/02/04_data_and_trace_contract.md 的
 * 业务公式（单路 requested = −min(max(old−20,0), maxDropK)；额度=max(old−20,0)
 * 按比例分配；最终=old+Σapproved），不从 expected_runs.v05.json 抄结果进代码。
 */
const freshModel = () => structuredClone(loadPrototype().model)

function inputFor(model: PrototypeModel, id = "t"): ExecuteInput {
  return {
    model,
    world: structuredClone(model.baseWorld),
    runId: "run-main",
    branchId: "main",
    baseCommit: model.baseWorld.commitId,
    stepSeconds: 10,
    recordId: `record-${id}`,
    resultCommitId: `c9${id.padStart(2, "0")}`,
  }
}

function mustRun(input: ExecuteInput): RoundResult {
  const out = executeRound(input)
  assert.ok(
    out.ok,
    `执行失败：${out.ok === false ? out.diagnostics.map((d) => `${d.code}: ${d.message}`).join("；") : ""}`,
  )
  return out.result
}

function node(result: RoundResult, executionId: string, nodeId: string) {
  const n = result.nodeExecutions.find(
    (x) => x.executionId === executionId && x.nodeId === nodeId,
  )
  assert.ok(n, `缺少节点执行 ${executionId}:${nodeId}`)
  return n
}

function decision(result: RoundResult, entityId: string) {
  const d = result.decisions.find((x) => x.entityId === entityId)
  assert.ok(d, `缺少裁决 ${entityId}`)
  return d
}

function effect(result: RoundResult, entityId: string, systemId: string) {
  const e = result.effectRequests.find(
    (x) => x.entityId === entityId && x.systemId === systemId,
  )
  assert.ok(e, `缺少效果请求 ${entityId}/${systemId}`)
  return e
}

/** 基线：F01 100→请求 −50/−50→获准 −40/−40→20；F02 80→−50→−30→20；F03 60→−40→−20→20。 */
export function baselineRound() {
  const model = freshModel()
  const result = mustRun(inputFor(model, "01"))

  // 执行批次由 schedule 推导：并行组 → 归约 → 原子提交
  assert.deepEqual(result.record.logicalParallelGroups, [
    ["cool-A", "cool-B"],
    ["reduce-cooling"],
    ["commit"],
  ])
  assert.equal(result.record.elapsedMs, null, "不编造耗时")
  assert.equal(result.record.simTimeBefore, 420)
  assert.equal(result.record.simTimeAfter, 430)
  assert.equal(result.origin, "computed")
  assert.ok(result.record.inputVersions["program:g-cool"])
  assert.ok(result.record.inputVersions["schedule:schedule-main"])

  // 6 个 system×entity 执行、30 条节点轨迹
  assert.equal(result.systemExecutions.length, 6)
  assert.equal(result.nodeExecutions.length, 30)

  // F01 / cool-A 全链路端口值：100 → 80 → min(80,50)=50 → −50 → eff
  const f1a = "exec-F01-cool-A"
  assert.equal(node(result, f1a, "n-old").outputs.value, 100)
  assert.deepEqual(node(result, f1a, "n-room").inputs, { old: 100, source: 20 })
  assert.equal(node(result, f1a, "n-room").outputs.room, 80)
  assert.deepEqual(node(result, f1a, "n-cap").inputs, { a: 80, b: 50 })
  assert.equal(node(result, f1a, "n-cap").outputs.value, 50)
  assert.equal(node(result, f1a, "n-neg").outputs.delta, -50)
  assert.equal(node(result, f1a, "n-emit").outputs.effect, "eff-F01-cool-A")
  assert.deepEqual(node(result, f1a, "n-emit").inputVersionRefs, [
    "F01.thermal.temperature@c042",
  ])
  // 同组 cool-B 也读 baseWorld 旧值（顺序不改变 previous 读取）
  assert.equal(node(result, "exec-F01-cool-B", "n-old").outputs.value, 100)

  // 请求与暂存预览
  assert.equal(effect(result, "F01", "cool-A").requestedDelta, -50)
  assert.equal(effect(result, "F01", "cool-A").selfPreview, 50)
  assert.equal(effect(result, "F02", "cool-A").requestedDelta, -50)
  assert.equal(effect(result, "F03", "cool-A").requestedDelta, -40)
  assert.equal(result.systemExecutions.find((e) => e.id === f1a)!.localPreview, 50)

  // 比例裁决：额度=max(old−20,0)，按 |requested| 分配
  const d1 = decision(result, "F01")
  assert.equal(d1.old, 100)
  assert.equal(d1.budget, 80)
  assert.equal(d1.scale, 0.8)
  assert.equal(d1.candidate, 0)
  assert.deepEqual(d1.allocations, [
    { effectId: "eff-F01-cool-A", approvedDelta: -40, status: "partial" },
    { effectId: "eff-F01-cool-B", approvedDelta: -40, status: "partial" },
  ])
  assert.equal(d1.final, 20)
  const d2 = decision(result, "F02")
  assert.equal(d2.scale, 0.6)
  assert.equal(d2.final, 20)
  const d3 = decision(result, "F03")
  assert.equal(d3.scale, 0.5)
  assert.equal(d3.final, 20)

  // 下一世界与变更
  assert.equal(result.nextWorld.values.F01["thermal.temperature"], 20)
  assert.equal(result.nextWorld.values.F02["thermal.temperature"], 20)
  assert.equal(result.nextWorld.values.F03["thermal.temperature"], 20)
  assert.equal(result.nextWorld.commitId, "c901")
  assert.equal(result.nextWorld.simTime, 430)
  assert.equal(result.changes.length, 3)
  assert.equal(
    result.changes.find((c) => c.entityId === "F01")!.versionId,
    "F01.thermal.temperature@c901",
  )
  // 依赖边：used / proposed / generated
  assert.ok(
    result.dependencyEdges.some(
      (e) =>
        e.kind === "used" &&
        e.source === "F01.thermal.temperature@c042" &&
        e.target === "exec-F01-cool-A",
    ),
  )
  assert.ok(
    result.dependencyEdges.some(
      (e) =>
        e.kind === "proposed" &&
        e.source === "exec-F01-cool-B" &&
        e.target === "decision-F01",
    ),
  )
  assert.ok(
    result.dependencyEdges.some(
      (e) =>
        e.kind === "generated" &&
        e.source === "decision-F01" &&
        e.target === "F01.thermal.temperature@c901",
    ),
  )
}

/** 停用 cool-B：单路请求全额获准，最终 50/30/20。 */
export function oneCoolerRound() {
  const model = freshModel()
  model.systems.find((s) => s.id === "cool-B")!.enabled = false
  const result = mustRun(inputFor(model, "02"))

  assert.deepEqual(result.record.logicalParallelGroups, [
    ["cool-A"],
    ["reduce-cooling"],
    ["commit"],
  ])
  assert.equal(result.systemExecutions.length, 3)
  assert.equal(result.effectRequests.length, 3)
  for (const [entity, final] of [
    ["F01", 50],
    ["F02", 30],
    ["F03", 20],
  ] as const) {
    const d = decision(result, entity)
    assert.equal(d.scale, 1)
    assert.equal(d.allocations.length, 1)
    assert.equal(d.allocations[0].status, "approved")
    assert.equal(d.final, final)
    assert.equal(
      result.nextWorld.values[entity]["thermal.temperature"],
      final,
    )
  }
}

/** cool-A 的 maxDropK 改 20K：节点输入/请求/获准/final 同时变化（30/20/20）。 */
export function lowerPowerRound() {
  const model = freshModel()
  model.systems.find((s) => s.id === "cool-A")!.parameters.maxDropK = 20
  const result = mustRun(inputFor(model, "03"))

  // 节点轨迹同步变化：cool-A 的 Min b 输入 20
  assert.deepEqual(node(result, "exec-F01-cool-A", "n-cap").inputs, {
    a: 80,
    b: 20,
  })
  assert.equal(node(result, "exec-F01-cool-A", "n-neg").outputs.delta, -20)
  assert.equal(effect(result, "F01", "cool-A").requestedDelta, -20)
  assert.equal(effect(result, "F01", "cool-A").selfPreview, 80)
  assert.equal(effect(result, "F01", "cool-B").requestedDelta, -50)

  const d1 = decision(result, "F01")
  assert.equal(d1.scale, 1, "总额 70 ≤ 额度 80，全额获准")
  assert.deepEqual(d1.allocations, [
    { effectId: "eff-F01-cool-A", approvedDelta: -20, status: "approved" },
    { effectId: "eff-F01-cool-B", approvedDelta: -50, status: "approved" },
  ])
  assert.equal(d1.final, 30)

  const d2 = decision(result, "F02")
  assert.equal(d2.scale, 0.8571428571428571)
  assert.equal(
    d2.allocations.find((a) => a.effectId === "eff-F02-cool-A")!
      .approvedDelta,
    -17.142857142857142,
  )
  assert.equal(d2.final, 20)
  const d3 = decision(result, "F03")
  assert.equal(d3.scale, 0.6666666666666666)
  assert.equal(d3.final, 20)

  assert.equal(result.nextWorld.values.F01["thermal.temperature"], 30)
  assert.equal(result.nextWorld.values.F02["thermal.temperature"], 20)
  assert.equal(result.nextWorld.values.F03["thermal.temperature"], 20)
}

/** 调度成环 / product 边 → Diagnostic 报错，不产出结果。 */
export function scheduleErrorsBlockRound() {
  const model = freshModel()
  const main = model.schedules.find((s) => s.id === "schedule-main")!
  const cyc: ScheduleDocument = {
    ...main,
    edges: [
      ...main.edges,
      { id: "x1", source: "cool-A", target: "cool-B", kind: "order" },
      { id: "x2", source: "cool-B", target: "cool-A", kind: "order" },
    ],
  }
  const out1 = executeRound(inputFor({ ...model, schedules: [cyc] }, "04"))
  assert.equal(out1.ok, false)
  if (!out1.ok) {
    assert.ok(out1.diagnostics.some((d) => d.code === "SCHEDULE_CYCLE"))
    assert.ok(
      out1.diagnostics.every((d) => d.severity === "error" || d.severity),
    )
  }

  const prod: ScheduleDocument = {
    ...main,
    edges: [
      ...main.edges,
      { id: "x3", source: "cool-A", target: "cool-B", kind: "product" },
    ],
  }
  const out2 = executeRound(inputFor({ ...model, schedules: [prod] }, "05"))
  assert.equal(out2.ok, false)
  if (!out2.ok)
    assert.ok(
      out2.diagnostics.some((d) => d.code === "SCHEDULE_PRODUCT_UNSUPPORTED"),
    )
}

/** 不支持的节点 / 未知节点 / 断必需连接 → 校验诊断阻止执行。 */
export function programErrorsBlockRound() {
  const model = freshModel()
  const program = model.programs.find((p) => p.id === "g-cool")!

  const withBranch = structuredClone(model)
  withBranch.programs
    .find((p) => p.id === "g-cool")!
    .nodes.push({
      id: "n-branch",
      type: "Branch",
      inputs: {},
      outputs: {},
      bindings: {},
      params: {},
    })
  const out1 = executeRound(inputFor(withBranch, "06"))
  assert.equal(out1.ok, false)
  if (!out1.ok)
    assert.ok(out1.diagnostics.some((d) => d.code === "NODE_TYPE_UNAVAILABLE"))

  const withFrob = structuredClone(model)
  withFrob.programs
    .find((p) => p.id === "g-cool")!
    .nodes.push({
      id: "n-frob",
      type: "Frob",
      inputs: {},
      outputs: {},
      bindings: {},
      params: {},
    })
  const out2 = executeRound(inputFor(withFrob, "07"))
  assert.equal(out2.ok, false)
  if (!out2.ok)
    assert.ok(out2.diagnostics.some((d) => d.code === "NODE_TYPE_UNKNOWN"))

  // 删除 n-neg→n-emit 边（error_cases missing-input / le4）：必需输入缺失，禁止运行
  const broken = structuredClone(model)
  const bp = broken.programs.find((p) => p.id === "g-cool")!
  bp.edges = bp.edges.filter((e) => e.target.nodeId !== "n-emit")
  const out3 = executeRound(inputFor(broken, "08"))
  assert.equal(out3.ok, false)
  if (!out3.ok)
    assert.ok(out3.diagnostics.some((d) => d.code === "INPUT_MISSING"))
  void program
}

/** 记录不可变：写入 trace store 后，当前图参数修改与新执行都不改变旧记录。 */
export function recordsAreImmutable() {
  const model = freshModel()
  const first = mustRun(inputFor(model, "09"))
  putRecord(first)
  const snapshot = JSON.stringify(getRecord(first.record.id))

  // 用户改了当前图参数（A 的 maxDropK 20K）并再次试算
  const variant = freshModel()
  variant.systems.find((s) => s.id === "cool-A")!.parameters.maxDropK = 20
  const second = mustRun(inputFor(variant, "10"))
  putRecord(second)

  // 同 id 重复写入被忽略
  putRecord(mustRun(inputFor(freshModel(), "09")))
  const stored = getRecord(first.record.id)!
  assert.equal(JSON.stringify(stored), snapshot, "旧记录不得随当前图修改变化")
  assert.equal(decision(stored, "F01").final, 20)
  assert.equal(
    traceStore.getState().order.filter((id) => id === first.record.id).length,
    1,
    "同 id 记录只入索引一次",
  )
  // 记录自带程序快照：改掉输入模型后，旧记录里的图版本不变
  assert.equal(
    stored.programs["g-cool@g5"].nodes.find((n) => n.id === "n-cap")!.type,
    "Min",
  )
  assert.notEqual(second.record.id, first.record.id)
}

/** 初温低于 20°C：请求为 0，不反向升温。 */
export function coldStartRequestsZero() {
  const model = freshModel()
  const input = inputFor(model, "11")
  input.world.values.F01["thermal.temperature"] = 15
  const result = mustRun(input)

  assert.equal(node(result, "exec-F01-cool-A", "n-room").outputs.room, 0)
  for (const sys of ["cool-A", "cool-B"]) {
    const e = effect(result, "F01", sys)
    assert.ok(e.requestedDelta === 0, `${sys} 的请求必须为 0`)
    assert.ok(e.requestedDelta <= 0, "不得产生升温请求")
  }
  const d = decision(result, "F01")
  assert.equal(d.budget, 0)
  assert.equal(d.final, 15, "低于冷源温度时保持原值，不升温")
  assert.ok(
    !result.changes.some((c) => c.entityId === "F01"),
    "值不变不产生变更记录",
  )
  // 其余实体照常冷却
  assert.equal(decision(result, "F02").final, 20)
}
