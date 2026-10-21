import assert from "node:assert/strict"
import { loadPrototype } from "@/data/mockLoader"
import {
  compileSchedule,
  checkConnection,
  PRODUCT_UNSUPPORTED,
  type ScheduleModelView,
} from "@/services/scheduleCompiler"
import * as D from "@/services/domainBindingService"
import type { ScheduleDocument } from "@/schema/model"
import {
  programToWorkflow,
  workflowToProgram,
} from "@/services/logicGraphCodec"
import {
  programContentSchema,
  scheduleContentSchema,
} from "@/stores/modelDocuments"
import { parseDocumentFile } from "@/services/documentFile"

/** 行为测试：由 scripts/test.mjs 通过 Vite SSR 加载，每个导出函数是一个用例。 */
const freshModel = () => structuredClone(loadPrototype().model)

const codes = (p: { diagnostics: { code: string ;severity: string }[] }) =>
  p.diagnostics.map((d) => d.code)
export function scheduleCompiler() {
  const model = freshModel()
  const view: ScheduleModelView = {
    systems: model.systems,
    constraints: model.constraints,
    attributes: model.attributes,
    baseCommit: model.baseWorld.commitId,
  }
  const main = model.schedules.find((s) => s.id === "schedule-main")!
  const sysNode = (sid: string) =>
    main.nodes.find((n) => n.type === "SystemNode" && n.systemRef === sid)!.id

  // 1 正常
  const p = compileSchedule(main, view)
  assert.equal(p.executable, true, JSON.stringify(p.diagnostics))
  assert.deepEqual(
    p.groups.map((g) => g.systems.map((s) => s.systemId)),
    [["cool-A", "cool-B"]],
  )
  assert.equal(p.reducers[0].inputs.length, 2)
  assert.ok(
    p.concurrency.some(
      (c) => c.level === "safe" && c.property === "thermal.temperature",
    ),
  )
  assert.equal(p.diagnostics.length, 0)

  // 2 A→B order
  const a = sysNode("cool-A"),
    b = sysNode("cool-B")
  const chk = checkConnection(main, view, a, b, "order")
  assert.deepEqual(chk, { ok: true, kind: "order" })
  const ordered: ScheduleDocument = {
    ...main,
    edges: [...main.edges, { id: "x1", source: a, target: b, kind: "order" }],
  }
  const p2 = compileSchedule(ordered, view)
  assert.equal(p2.executable, true)
  assert.deepEqual(
    p2.groups.map((g) => g.systems.map((s) => s.systemId)),
    [["cool-A"], ["cool-B"]],
  )
  assert.equal(p2.orderNotes.length, 1)
  assert.ok(p2.orderNotes[0].includes("看不到"))

  // 3 cycle
  const cyc: ScheduleDocument = {
    ...ordered,
    edges: [
      ...ordered.edges,
      { id: "x2", source: b, target: a, kind: "order" },
    ],
  }
  const p3 = compileSchedule(cyc, view)
  assert.equal(p3.executable, false)
  assert.ok(codes(p3).includes("SCHEDULE_CYCLE"))
  assert.equal(p3.groups.length, 0)

  // 4 product
  const prodCheck = checkConnection(main, view, a, b, "product")
  assert.deepEqual(prodCheck, { ok: false, reason: PRODUCT_UNSUPPORTED })
  const p4 = compileSchedule(
    {
      ...main,
      edges: [
        ...main.edges,
        { id: "x3", source: a, target: b, kind: "product" },
      ],
    },
    view,
  )
  assert.ok(codes(p4).includes("SCHEDULE_PRODUCT_UNSUPPORTED"))
  assert.equal(p4.executable, false)

  // 5 dangling system node (no effect edge)
  const p5 = compileSchedule(
    { ...main, edges: main.edges.filter((e) => e.source !== b) },
    view,
  )
  assert.ok(codes(p5).includes("SCHEDULE_EFFECT_UNROUTED"))
  assert.equal(p5.executable, false)
  const p5b = compileSchedule(
    {
      ...main,
      edges: [
        ...main.edges,
        { id: "x4", source: "ghost", target: b, kind: "order" },
      ],
    },
    view,
  )
  assert.ok(codes(p5b).includes("SCHEDULE_EDGE_DANGLING"))

  // 6 missing / duplicate commit
  const commitId = main.nodes.find((n) => n.type === "CommitNode")!.id
  const p6 = compileSchedule(
    {
      ...main,
      nodes: main.nodes.filter((n) => n.type !== "CommitNode"),
      edges: main.edges.filter((e) => e.target !== commitId),
    },
    view,
  )
  assert.ok(codes(p6).includes("SCHEDULE_COMMIT_MISSING"))
  const p6b = compileSchedule(
    { ...main, nodes: [...main.nodes, { id: "commit-2", type: "CommitNode" }] },
    view,
  )
  assert.ok(codes(p6b).includes("SCHEDULE_COMMIT_MULTIPLE"))
  // duplicate system
  const p6c = compileSchedule(
    {
      ...main,
      nodes: [
        ...main.nodes,
        { id: "dupA", type: "SystemNode", systemRef: "cool-A" },
      ],
    },
    view,
  )
  assert.ok(codes(p6c).includes("SCHEDULE_SYSTEM_DUPLICATE"))

  // 7 reducer not to commit
  const p7 = compileSchedule(
    { ...main, edges: main.edges.filter((e) => e.target !== commitId) },
    view,
  )
  assert.ok(codes(p7).includes("SCHEDULE_REDUCER_UNCOMMITTED"))

  // 8 exclusive conflict
  const sys2 = structuredClone(model.systems)
  sys2[0].access.exclusive = ["self.fire.active"]
  sys2[1].access.exclusive = ["self.fire.active"]
  const p8 = compileSchedule(
    {
      ...main,
      edges: [
        ...main.edges,
        { id: "e-ex1", source: a, target: commitId, kind: "order" },
        { id: "e-ex2", source: b, target: commitId, kind: "order" },
      ],
    },
    { ...view, systems: sys2 },
  )
  assert.ok(
    codes(p8).includes("SCHEDULE_WRITE_CONFLICT"),
    JSON.stringify(p8.diagnostics),
  )
  assert.ok(p8.concurrency.some((c) => c.level === "conflict"))

  // 9 disabled
  const sys3 = structuredClone(model.systems)
  sys3[1].enabled = false
  const p9 = compileSchedule(main, { ...view, systems: sys3 })
  assert.ok(codes(p9).includes("SCHEDULE_SYSTEM_DISABLED"))
  assert.equal(p9.executable, true)

  // illegal connections
  const reducerId = main.nodes.find((n) => n.type === "ReducerNode")!.id
  assert.equal(checkConnection(main, view, reducerId, a, "order").ok, false)
  assert.equal(checkConnection(main, view, commitId, a, "order").ok, false)
  assert.equal(checkConnection(main, view, a, commitId, "order").ok, false)
}

export function domainBinding() {
  const model = freshModel()
  const prog = model.programs[0]
  assert.deepEqual(
    D.validateProgram(model, prog).filter((d) => d.severity === "error"),
    [],
  )
  const unitsOk = D.checkEdge(
    model,
    prog,
    { nodeId: "n-old", portId: "value" },
    { nodeId: "n-cap", portId: "b" },
  )
  assert.equal(unitsOk.ok, false)
  assert.ok(
    !unitsOk.ok && unitsOk.reason.includes("量种不同"),
    JSON.stringify(unitsOk),
  )
  // cycle
  const cyc2 = D.checkEdge(model, prog, { nodeId: "n-neg", portId: "delta" }, {
    nodeId: "n-cap",
    portId: "b",
  })
  assert.ok(!cyc2.ok && cyc2.reason.includes("成环"))
  // candidates
  const cands = D.bindingCandidates(model, prog, {
    kind: "input",
    nodeId: "n-cap",
    portId: "b",
  })
  const param = cands.find((g) => g.group === "parameter")!.candidates
  assert.equal(param.find((c) => c.label === "maxDropK")!.compat.ok, true)
  assert.equal(param.find((c) => c.label === "sourceC")!.compat.ok, false)
  assert.ok(cands.find((g) => g.group === "relation")!.emptyReason)
  const up = cands.find((g) => g.group === "upstream")!.candidates
  assert.equal(up.find((c) => c.label === "n-room.room")!.compat.ok, true)
  assert.equal(up.find((c) => c.label === "n-neg.delta")!.compat.ok, false)
  const targets = D.bindingCandidates(model, prog, {
    kind: "slot",
    nodeId: "n-emit",
    slotId: "target",
  })[0].candidates
  assert.equal(
    targets.find((c) => c.label === "self.thermal.temperature")!.compat.ok,
    true,
  )
  assert.equal(
    targets.find((c) => c.label === "self.fire.active")!.compat.ok,
    false,
  )
  // nullable position candidate for CoolingRoom: shape mismatch
  const nul = D.compatible(
    model,
    {
      primitive: "f64",
      shape: "scalar",
      unitId: "degC",
      quantityKind: "temperatureAbsolute",
      nullable: true,
    },
    prog.nodes[1].inputs.old,
  )
  assert.ok(!nul.ok && nul.reason.includes("IsSome"))

  // bind conflict / default exclusive
  let g = D.setInputDefault(prog, model, "n-cap", "b", 30)
  assert.equal(D.inputSources(g, "n-cap", "b").length, 1)
  assert.equal(D.inputSources(g, "n-cap", "b")[0].kind, "default")
  g = D.connect(g, model, { nodeId: "n-room", portId: "room" }, {
    nodeId: "n-cap",
    portId: "b",
  })
  assert.equal(D.inputSources(g, "n-cap", "b")[0].kind, "edge")
  assert.deepEqual(
    D.validateProgram(model, g).filter((d) => d.severity === "error"),
    [],
  )
  // missing input
  const g2 = D.clearInput(prog, model, "n-room", "source")
  assert.ok(
    D.validateProgram(model, g2).some(
      (d) => d.code === "INPUT_MISSING" && d.target?.nodeId === "n-room",
    ),
  )

  // sample
  const run = D.evaluateSample(model, prog, model.systems[0], "F01")
  assert.equal(run.error, undefined)
  assert.deepEqual(run.effects, [
    { nodeId: "n-emit", propertyId: "thermal.temperature", delta: -50 },
  ])
  assert.deepEqual(
    D.evaluateSample(model, prog, model.systems[0], "F03").effects[0].delta,
    -40,
  )
  assert.deepEqual(D.queryMatches(model, model.systems[0].queryRef), [
    "F01",
    "F02",
    "F03",
  ])

  // add ReadSelfPreview after Contribute
  let g3 = prog
  const id = D.nextNodeId(g3, "ReadSelfPreview")
  g3 = {
    ...g3,
    nodes: [...g3.nodes, D.createNode(model, g3, "ReadSelfPreview", id)],
  }
  assert.ok(
    D.validateProgram(model, g3).some(
      (d) => d.code === "PREVIEW_WITHOUT_CONTRIBUTE",
    ),
  )
  assert.equal(
    D.checkEdge(model, g3, { nodeId: "n-emit", portId: "effect" }, {
      nodeId: id,
      portId: "after",
    }).ok,
    true,
  )
  assert.equal(
    D.checkEdge(model, g3, { nodeId: "n-neg", portId: "delta" }, {
      nodeId: id,
      portId: "after",
    }).ok,
    false,
  )
  g3 = D.connect(g3, model, { nodeId: "n-emit", portId: "effect" }, {
    nodeId: id,
    portId: "after",
  })
  assert.equal(g3.edges.at(-1)!.kind, "control")
  assert.ok(
    !D.validateProgram(model, g3).some(
      (d) => d.code === "PREVIEW_WITHOUT_CONTRIBUTE",
    ),
  )
  const run3 = D.evaluateSample(model, g3, model.systems[0], "F01")
  assert.equal(run3.nodes.find((n) => n.nodeId === id)!.outputs[0].value, 50)
  // unavailable
  assert.throws(() => D.createNode(model, prog, "Loop", "x"))
  // Contribute target mismatch retype
  const g4 = D.removeNodes(g3, model, ["n-neg"])
  assert.ok(
    !g4.edges.some(
      (e) => e.source.nodeId === "n-neg" || e.target.nodeId === "n-neg",
    ),
  )
  assert.equal(D.nextNodeId(prog, "IsSome"), "n-is-some-1")
}

export function logicGraphCodecAndFiles() {
  const model = freshModel()
  const program = model.programs[0]
  const layout = model.layouts["g-cool"]
  const json = programToWorkflow(program, layout)
  assert.equal(json.nodes.length, 5)
  assert.equal(json.edges[0].sourcePortID, "value")
  const back = workflowToProgram(JSON.parse(JSON.stringify(json)), {
    program,
    layout,
  })
  assert.deepEqual(back.program, program)
  assert.deepEqual(back.layout, layout)
  // reversed order input keeps base order
  const rev = workflowToProgram(
    { nodes: [...json.nodes].reverse(), edges: [...json.edges].reverse() },
    { program, layout },
  )
  assert.deepEqual(rev.program, program)
  // file round trip
  const file = JSON.stringify({
    format: "f",
    documentId: "program:g-cool",
    exportedAt: "x",
    content: { program, layout },
  })
  const r = parseDocumentFile(file, "f", "program:g-cool", programContentSchema)
  assert.ok(r.ok)
  assert.deepEqual(r.ok && r.content.program, program)
  const bad = parseDocumentFile(
    JSON.stringify({
      format: "f",
      documentId: "program:g-cool",
      content: { program: { ...program, nodes: 3 }, layout },
    }),
    "f",
    "program:g-cool",
    programContentSchema,
  )
  assert.ok(!bad.ok && bad.reason.includes("nodes"), JSON.stringify(bad))
  assert.ok(!parseDocumentFile("{", "f", "x", programContentSchema).ok)
  assert.ok(
    !parseDocumentFile(file, "f", "program:other", programContentSchema).ok,
  )
  const sch = model.schedules[0]
  const sf = JSON.stringify({
    format: "s",
    documentId: "schedule:schedule-main",
    content: { schedule: sch, layout: model.layouts["schedule-main"] },
  })
  const sr = parseDocumentFile(
    sf,
    "s",
    "schedule:schedule-main",
    scheduleContentSchema,
  )
  assert.ok(sr.ok)
  assert.deepEqual(sr.ok && sr.content.schedule, sch)
}
