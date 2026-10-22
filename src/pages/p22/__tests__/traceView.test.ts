import assert from "node:assert/strict"
import { loadPrototype } from "@/data/mockLoader"
import type { LogicGraphDocument } from "@/schema/model"
import {
  executeRound,
  type NodeExecution,
  type RoundResult,
} from "@/services/mock-executor"
import { portUnit, traceabilityGaps } from "@/pages/p22/traceView"

/** P22 端口单位：以记录绑定的固定图快照（record.programs）里的端口声明为准，启发式只是回落。 */
const runBaseline = (): RoundResult => {
  const model = structuredClone(loadPrototype().model)
  const out = executeRound({
    model,
    world: structuredClone(model.baseWorld),
    runId: "run-main",
    branchId: "main",
    baseCommit: model.baseWorld.commitId,
    stepSeconds: 10,
    recordId: "record-p22-unit",
    resultCommitId: "c9p2",
  })
  assert.ok(out.ok, JSON.stringify(out.ok ? null : out.diagnostics))
  return out.ok ? out.result : undefined as never
}

const traceOf = (
  result: RoundResult,
  executionId: string,
  nodeId: string,
): NodeExecution => {
  const t = result.nodeExecutions.find(
    (n) => n.executionId === executionId && n.nodeId === nodeId,
  )
  assert.ok(t, `缺少节点轨迹 ${executionId}:${nodeId}`)
  return t
}

const programOf = (
  result: RoundResult,
  executionId: string,
): LogicGraphDocument => {
  const exec = result.systemExecutions.find((e) => e.id === executionId)
  assert.ok(exec)
  const program = result.programs[exec.programRef]
  assert.ok(program, `记录缺少图快照 ${exec.programRef}`)
  return program
}

/** 主干五节点的入/出端口单位全部来自图定义（declared），不是启发式。 */
export function portUnitsComeFromGraphDeclaration() {
  const result = runBaseline()
  const exec = "exec-F01-cool-A"
  const program = programOf(result, exec)
  const at = (nodeId: string) => traceOf(result, exec, nodeId)
  const expect = (
    nodeId: string,
    direction: "input" | "output",
    portId: string,
    unitId: string | null,
  ) =>
    assert.deepEqual(
      portUnit(program, at(nodeId), direction, portId),
      { unitId, source: "declared" },
      `${nodeId}.${direction}.${portId}`,
    )

  // ReadPrevious 输出随绑定属性：thermal.temperature 是 °C
  expect("n-old", "output", "value", "degC")
  // CoolingRoom：old/source 入 °C，room 出 K（温差）
  expect("n-room", "input", "old", "degC")
  expect("n-room", "input", "source", "degC")
  expect("n-room", "output", "room", "deltaK")
  // Min：a/b 与 value 都是 K
  expect("n-cap", "input", "a", "deltaK")
  expect("n-cap", "input", "b", "deltaK")
  expect("n-cap", "output", "value", "deltaK")
  // Negate 与 Contribute.delta 都是 K；Contribute.effect 是 EffectRef，无单位
  expect("n-neg", "input", "value", "deltaK")
  expect("n-neg", "output", "delta", "deltaK")
  expect("n-emit", "input", "delta", "deltaK")
  expect("n-emit", "output", "effect", null)

  // 证明 declared 路径带来新信息：n-emit 的 outputUnitId 为 null（第一输出是 EffectRef），
  // 旧启发式给入端口 delta 显示无单位，声明路径给出 K。
  assert.equal(at("n-emit").outputUnitId, null)
}

/** 端口不在图快照中（记录与图版本不一致）时回落启发式并标注 source。 */
export function portUnitFallbackIsMarkedHeuristic() {
  const result = runBaseline()
  const program = programOf(result, "exec-F01-cool-A")
  const base = traceOf(result, "exec-F01-cool-A", "n-cap")

  // 快照里没有的端口：old 输入按旧规则回落 °C
  const ghost: NodeExecution = { ...base, inputs: { old: 1 }, outputs: {} }
  assert.deepEqual(portUnit(program, ghost, "input", "old"), {
    unitId: "degC",
    source: "heuristic",
  })
  // 非 old/source 的未知输入回落到节点第一输出单位（n-cap → deltaK）
  assert.deepEqual(portUnit(program, ghost, "input", "mystery"), {
    unitId: "deltaK",
    source: "heuristic",
  })
  // 整条轨迹的节点不在快照中：输出同样回落并标注
  const detached: NodeExecution = { ...base, nodeId: "n-gone" }
  assert.deepEqual(portUnit(program, detached, "output", "value"), {
    unitId: "deltaK",
    source: "heuristic",
  })
}

/** W3.5：历史单位只来自记录自带图快照；当前草稿把同端口单位改掉不影响旧记录的解释。 */
export function historicalUnitsStayWithRecordSnapshot() {
  const result = runBaseline()
  const program = programOf(result, "exec-F01-cool-A")
  const trace = traceOf(result, "exec-F01-cool-A", "n-room")

  // 模拟「新 schema」：当前草稿里同一端口的单位定义变了（旧记录不被重新解释）
  const mutated = structuredClone(program)
  const roomInputs = mutated.nodes.find((n) => n.id === "n-room")!.inputs
  roomInputs.old = { ...roomInputs.old, unitId: "degF" }
  assert.equal(
    portUnit(mutated, trace, "input", "old").unitId,
    "degF",
    "新图版本按新单位解释",
  )
  assert.deepEqual(
    portUnit(program, trace, "input", "old"),
    { unitId: "degC", source: "declared" },
    "旧记录绑定旧图快照，仍按当时的 °C 解释",
  )
}

/** W3.5：缺 inputVersionRef 的读取节点被审计为不可完整追溯；缺口不编造依赖边。 */
export function traceabilityGapsDetectsMissingRefs() {
  const result = runBaseline()
  assert.deepEqual(
    traceabilityGaps(result),
    [],
    "完整记录没有追溯缺口",
  )

  // 构造损坏记录：n-old（ReadPrevious）丢失 inputVersionRefs，同时去掉对应 used 边
  const broken: RoundResult = structuredClone(result)
  const damaged = broken.nodeExecutions.find(
    (n) => n.executionId === "exec-F01-cool-A" && n.nodeId === "n-old",
  )!
  damaged.inputVersionRefs = []
  broken.dependencyEdges = broken.dependencyEdges.filter(
    (e) => !(e.kind === "used" && e.target === "exec-F01-cool-A"),
  )
  // 非读取节点（Negate）即使 refs 为空也不算缺口
  broken.nodeExecutions.find(
    (n) => n.executionId === "exec-F01-cool-A" && n.nodeId === "n-neg",
  )!.inputVersionRefs = []

  const gaps = traceabilityGaps(broken)
  assert.deepEqual(gaps, [
    {
      executionId: "exec-F01-cool-A",
      nodeId: "n-old",
      propertyId: "thermal.temperature",
    },
  ])
  assert.ok(
    !broken.dependencyEdges.some(
      (e) => e.kind === "used" && e.target === "exec-F01-cool-A",
    ),
    "审计只指出缺口，不补造 used 边",
  )
}
