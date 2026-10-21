import assert from "node:assert/strict"
import { loadPrototype } from "@/data/mockLoader"
import { stableHash } from "@/lib/hash"
import type { EditorLayout, ScheduleDocument } from "@/schema/model"
import {
  compileSchedule,
  PRODUCT_UNSUPPORTED,
  type ScheduleModelView,
} from "@/services/scheduleCompiler"
import type { ScheduleContent } from "@/stores/modelDocuments"
import { flowToSchedule, scheduleToFlow } from "../codec"
import * as ops from "../ops"

/** 外层调度：codec 往返、连线守卫、并行分组随顺序边变化、布局不进语义哈希。 */
const freshModel = () => structuredClone(loadPrototype().model)

function fixture() {
  const model = freshModel()
  const schedule = model.schedules.find((s) => s.id === "schedule-main")!
  const layout: EditorLayout = model.layouts["schedule-main"] ?? {
    documentId: "schedule-main",
    positions: {},
    viewport: { x: 12, y: -8, zoom: 1.25 },
  }
  const view: ScheduleModelView = {
    systems: model.systems,
    constraints: model.constraints,
    attributes: model.attributes,
    baseCommit: model.baseWorld.commitId,
  }
  const content: ScheduleContent = {
    schedule: structuredClone(schedule),
    layout: structuredClone(layout),
  }
  return { model, schedule, layout, view, content }
}

const codes = (p: { diagnostics: { code: string }[] }) =>
  p.diagnostics.map((d) => d.code)

export function scheduleCodecRoundTrip() {
  const { schedule, layout } = fixture()
  const flow = scheduleToFlow(schedule, layout)
  // 只有四种外层节点类型，内层节点类型不会出现在外层图里
  assert.deepEqual(
    [...new Set(flow.nodes.map((n) => n.type))].sort(),
    ["CommitNode", "ReducerNode", "SystemNode"],
  )
  assert.equal(flow.nodes.length, schedule.nodes.length)
  assert.equal(flow.edges.length, schedule.edges.length)
  // 边标签按 kind 区分
  const effectEdge = flow.edges.find((e) => e.data?.kind === "effect")!
  assert.equal(effectEdge.label, "效果 effect")
  const orderEdge = flow.edges.find((e) => e.data?.kind === "order")!
  assert.equal(orderEdge.label, "顺序 order")

  const back = flowToSchedule(
    JSON.parse(JSON.stringify(flow.nodes)),
    JSON.parse(JSON.stringify(flow.edges)),
    { schedule, layout },
  )
  assert.deepEqual(back.schedule, schedule)
  // 布局含默认位置补齐；语义部分（schedule）不受影响
  for (const n of schedule.nodes) assert.ok(back.layout.positions[n.id])

  // 反序输入仍按 base 顺序回写
  const reversed = flowToSchedule(
    [...flow.nodes].reverse(),
    [...flow.edges].reverse(),
    { schedule, layout },
  )
  assert.deepEqual(reversed.schedule, schedule)
}

export function scheduleOpsGuards() {
  const { content, view } = fixture()

  // 同一 System 不能重复放入
  const dup = ops.addSystemNode(content, "cool-A", { x: 0, y: 0 })
  assert.equal(dup.ok, false)

  // 原子提交只能有一个
  const secondCommit = ops.addCommitNode(content, { x: 0, y: 0 })
  assert.equal(secondCommit.ok, false)

  // product 边明确拒绝并说明
  const prod = ops.connectNodes(content, view, "cool-A", "cool-B", "product")
  assert.deepEqual(prod, { ok: false, reason: PRODUCT_UNSUPPORTED })

  // System → System 顺序边
  const order = ops.connectNodes(content, view, "cool-A", "cool-B", "order")
  assert.ok(order.ok && order.edge.kind === "order")

  // System → 归约器 效果边；归约器 → 提交 顺序边
  const withoutSe1 = ops.removeEdges(content, ["se1"])
  const effect = ops.connectNodes(withoutSe1, view, "cool-A", "reduce-cooling", "order")
  assert.ok(effect.ok && effect.edge.kind === "effect")
  const toCommit = ops.connectNodes(content, view, "reduce-cooling", "commit", "order")
  assert.equal(toCommit.ok, false, "已有连线的组合要拒绝")

  // 没有独占写入的 System 不能直连提交
  const directCommit = ops.connectNodes(content, view, "cool-A", "commit", "order")
  assert.equal(directCommit.ok, false)

  // 删除节点连同出入边
  const removed = ops.removeNodes(content, ["reduce-cooling"])
  assert.ok(!removed.schedule.nodes.some((n) => n.id === "reduce-cooling"))
  assert.ok(
    !removed.schedule.edges.some(
      (e) => e.source === "reduce-cooling" || e.target === "reduce-cooling",
    ),
  )
}

export function scheduleGroupingFollowsOrderEdges() {
  const { content, view } = fixture()

  const p1 = compileSchedule(content.schedule, view)
  assert.equal(p1.executable, true, JSON.stringify(p1.diagnostics))
  assert.deepEqual(
    p1.groups.map((g) => g.systems.map((s) => s.systemId)),
    [["cool-A", "cool-B"]],
  )

  // 增添 A→B 顺序边：并行组一分为二，且说明 B 仍读旧状态
  const linked = ops.connectNodes(content, view, "cool-A", "cool-B", "order")
  assert.ok(linked.ok)
  const p2 = compileSchedule(linked.content.schedule, view)
  assert.deepEqual(
    p2.groups.map((g) => g.systems.map((s) => s.systemId)),
    [["cool-A"], ["cool-B"]],
  )
  assert.equal(p2.orderNotes.length, 1)
  assert.ok(p2.orderNotes[0].includes("看不到"))
  assert.ok(p2.orderNotes[0].includes("cool-B"))

  // 再补 B→A 成环：诊断 + 禁止执行 + 分组为空
  const cycled = ops.connectNodes(linked.content, view, "cool-B", "cool-A", "order")
  assert.ok(cycled.ok)
  const p3 = compileSchedule(cycled.content.schedule, view)
  assert.equal(p3.executable, false)
  assert.ok(codes(p3).includes("SCHEDULE_CYCLE"))
  assert.equal(p3.groups.length, 0)
}

export function layoutDoesNotChangeScheduleSemantics() {
  const { content } = fixture()
  const semantic = (c: ScheduleContent) => c.schedule
  const beforeSemantic = stableHash(semantic(content))
  const beforeFull = stableHash(content)

  const moved = ops.withViewport(
    ops.withPositions(content, {
      "cool-A": { x: 999, y: 111 },
      "cool-B": { x: 999, y: 333 },
    }),
    { x: -200, y: 50, zoom: 0.75 },
  )
  assert.notEqual(stableHash(moved), beforeFull, "布局变化应改变全量哈希")
  assert.equal(
    stableHash(semantic(moved)),
    beforeSemantic,
    "布局变化不得改变调度语义哈希",
  )

  // 往返：布局不同的两份内容，调度语义哈希一致
  const flow = scheduleToFlow(moved.schedule, moved.layout)
  const back = flowToSchedule(flow.nodes, flow.edges, moved)
  assert.equal(stableHash(back.schedule), beforeSemantic)
}

export function scheduleDocumentStaysIndependent() {
  const model = freshModel()
  // 调度文档只含 system 实例、归约/contract、commit 与 order/effect 边；
  // 不得混入内层节点（ReadPrevious / Min / Contribute 等属于 program 文档）
  for (const sch of model.schedules) {
    for (const n of sch.nodes)
      assert.ok(
        ["SystemNode", "ReducerNode", "ContractNode", "CommitNode"].includes(
          n.type,
        ),
        `外层调度出现内层节点类型 ${n.type}`,
      )
    for (const e of sch.edges)
      assert.ok(["order", "effect", "product"].includes(e.kind))
    const asProgram = sch as ScheduleDocument & {
      parameters?: unknown
      bindings?: unknown
    }
    assert.equal(asProgram.parameters, undefined)
    assert.equal(asProgram.bindings, undefined)
  }
}
