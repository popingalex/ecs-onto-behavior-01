import assert from "node:assert/strict"
import { loadPrototype } from "@/data/mockLoader"
import type { LogicGraphDocument } from "@/schema/model"
import * as D from "@/services/domainBindingService"
import {
  programToWorkflow,
  workflowToProgram,
} from "@/services/logicGraphCodec"

/** M2 行为测试：由 scripts/test.mjs 通过 Vite SSR 加载，每个导出函数是一个用例。 */
const freshModel = () => structuredClone(loadPrototype().model)

/** 1 °C（绝对温度）→ 温差 K 输入必须被 checkEdge 拒绝并说明原因。 */
export function unitMismatchEdgeRejected() {
  const model = freshModel()
  const prog = model.programs[0]
  // n-old.value 是绝对温度 degC；n-cap.b 期望温差 deltaK。
  const chk = D.checkEdge(
    model,
    prog,
    { nodeId: "n-old", portId: "value" },
    { nodeId: "n-cap", portId: "b" },
  )
  assert.equal(chk.ok, false)
  assert.ok(!chk.ok && chk.reason.includes("量种不同"), JSON.stringify(chk))
  assert.ok(!chk.ok && chk.reason.includes("n-old.value"), JSON.stringify(chk))
  assert.ok(
    !chk.ok && chk.reason.includes("CoolingRoom"),
    "提示应指出先经显式节点换算：" + JSON.stringify(chk),
  )
  // 同量种不同单位也拒绝（不隐式换算）。
  const wrongUnit = D.compatible(
    model,
    {
      primitive: "f64",
      shape: "scalar",
      quantityKind: "temperatureDifference",
      unitId: "degC",
      nullable: false,
    },
    prog.nodes.find((n) => n.id === "n-cap")!.inputs.b,
  )
  assert.ok(!wrongUnit.ok && wrongUnit.reason.includes("单位不同"))
}

/** 2 删除必需连接（n-neg.delta → n-emit.delta）后 validateProgram 失败并定位到节点 / 端口。 */
export function requiredEdgeRemovalFailsValidation() {
  const model = freshModel()
  const prog = model.programs[0]
  assert.equal(
    D.validateProgram(model, prog).filter((d) => d.severity === "error")
      .length,
    0,
  )
  const cut = D.removeEdges(prog, model, ["le4"])
  const errors = D.validateProgram(model, cut).filter(
    (d) => d.severity === "error",
  )
  const missing = errors.find((d) => d.code === "INPUT_MISSING")
  assert.ok(missing, JSON.stringify(errors))
  assert.equal(missing.target?.nodeId, "n-emit")
  assert.equal(missing.target?.portId, "delta")
}

/** 3 codec 导出再导入：nodeId / portId / binding / 单位全部保持。 */
export function codecRoundTripPreservesIdsBindingsAndUnits() {
  const model = freshModel()
  const program = model.programs[0]
  const layout = model.layouts["g-cool"]
  const exported = JSON.parse(
    JSON.stringify(programToWorkflow(program, layout)),
  )
  // 导出 JSON 里节点 id、端口 id、绑定与单位都在
  const nCap = exported.nodes.find(
    (n: { id: string }) => n.id === "n-cap",
  ) as {
    data: { node: LogicGraphDocument["nodes"][number] }
  }
  assert.deepEqual(nCap.data.node.bindings.b, {
    root: "parameter",
    parameterId: "maxDropK",
  })
  assert.equal(nCap.data.node.inputs.a.unitId, "deltaK")
  assert.equal(nCap.data.node.inputs.a.quantityKind, "temperatureDifference")
  const imported = workflowToProgram(exported, { program, layout })
  assert.deepEqual(imported.program, program)
  assert.deepEqual(imported.layout, layout)
  // 逐节点 / 逐边显式核对
  for (const node of program.nodes) {
    const back = imported.program.nodes.find((n) => n.id === node.id)!
    assert.deepEqual(back.bindings, node.bindings)
    assert.deepEqual(back.inputs, node.inputs)
    assert.deepEqual(back.outputs, node.outputs)
    assert.deepEqual(back.params, node.params)
  }
  for (const edge of program.edges) {
    const back = imported.program.edges.find((e) => e.id === edge.id)!
    assert.deepEqual(back, edge)
  }
}

/** 5 bindingCandidates 由 schema / 参数 / 当前图生成，不依赖任何硬编码节点 id。 */
export function candidatesIndependentOfHardcodedNodeIds() {
  const model = freshModel()
  const prog = model.programs[0]
  // 5a 改 id 的图：全部节点加 x- 前缀，候选跟随新 id。
  const renamed: LogicGraphDocument = {
    ...prog,
    nodes: prog.nodes.map((n) => ({ ...n, id: `x-${n.id}` })),
    edges: prog.edges.map((e) => ({
      ...e,
      source: { ...e.source, nodeId: `x-${e.source.nodeId}` },
      target: { ...e.target, nodeId: `x-${e.target.nodeId}` },
    })),
  }
  const groups = D.bindingCandidates(model, renamed, {
    kind: "input",
    nodeId: "x-n-cap",
    portId: "b",
  })
  const upstream = groups.find((g) => g.group === "upstream")!
  const roomCandidate = upstream.candidates.find(
    (c) => c.label === "x-n-room.room",
  )
  assert.ok(roomCandidate, JSON.stringify(upstream.candidates))
  assert.equal(roomCandidate.compat.ok, true)
  const serialized = JSON.stringify(groups)
  for (const hardcoded of ["n-old", "n-room", "n-cap", "n-neg", "n-emit"])
    assert.ok(
      !serialized.includes(`"${hardcoded}`),
      `候选不应引用旧 id ${hardcoded}`,
    )
  // 5b 新图（P30 新建的空程序加一个 Min 节点）：self / parameter 分组照出，上游为空并说明。
  const blank: LogicGraphDocument = {
    id: "g-blank",
    version: "v1",
    kind: "entity-program",
    scopeType: prog.scopeType,
    parameters: prog.parameters,
    nodes: [D.createNode(model, prog, "Min", "m-1")],
    edges: [],
  }
  const blankGroups = D.bindingCandidates(model, blank, {
    kind: "input",
    nodeId: "m-1",
    portId: "a",
  })
  assert.equal(blankGroups.length, 6)
  const selfGroup = blankGroups.find((g) => g.group === "self")!
  assert.ok(
    selfGroup.candidates.some((c) => c.label === "self.thermal.temperature"),
  )
  const paramGroup = blankGroups.find((g) => g.group === "parameter")!
  assert.ok(
    paramGroup.candidates.find((c) => c.label === "maxDropK")!.compat.ok,
  )
  const blankUpstream = blankGroups.find((g) => g.group === "upstream")!
  assert.equal(blankUpstream.candidates.length, 0)
  assert.ok(blankUpstream.emptyReason)
  assert.ok(!JSON.stringify(blankGroups).includes("n-min.out"))
}
