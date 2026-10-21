import assert from "node:assert/strict"
import { baselineModel } from "@/data/mockLoader"
import type { ConstraintDef, UnitDef } from "@/schema/model"
import type {
  SchemaContent,
  SystemsContent,
} from "@/stores/modelDocuments"
import { checkIntegrity } from "@/schema/parse"
import * as ops from "@/features/ecs/operations"
import { constraintRefs, unitRefs } from "@/features/ecs/refs"

/** P04：单位与约束的 CRUD；删除走引用阻止。纯函数层，不碰 DraftRegistry。 */

const schemaOf = (units?: UnitDef[]): SchemaContent => {
  const m = baselineModel()
  return {
    units: units ?? m.units,
    entityTypes: m.entityTypes,
    components: m.components,
    attributes: m.attributes,
    templates: m.templates,
  }
}

const systemsOf = (constraints?: ConstraintDef[]): SystemsContent => {
  const m = baselineModel()
  return {
    queries: m.queries,
    systems: m.systems,
    constraints: constraints ?? m.constraints,
  }
}

export function unitLifecycleAndDeleteBlocked() {
  const model = baselineModel()
  // 种子单位全部被属性 / 程序端口引用，删除被阻止并列出位置
  const refs = unitRefs(model, "degC")
  assert.ok(refs.some((r) => r.kind === "attribute" && r.id === "thermal.temperature"))
  assert.ok(refs.some((r) => r.kind === "program" && r.id === "g-cool"))
  assert.equal(ops.deleteUnit(model, schemaOf(), "degC").ok, false)

  // 新建单位：同量种并列；符号 / 量种必填
  const created = ops.createUnit(schemaOf(), {
    id: "degF",
    symbol: "°F",
    quantityKind: "temperatureAbsolute",
  })
  assert.ok(created.ok, JSON.stringify(created))
  assert.equal(
    ops.createUnit(schemaOf(), { id: "degC", symbol: "x", quantityKind: "x" })
      .ok,
    false,
  )
  assert.equal(
    ops.createUnit(schemaOf(), { id: "psi", symbol: "", quantityKind: "x" }).ok,
    false,
  )

  // 无引用单位可删除
  const s = created.ok ? created.content : schemaOf()
  const removed = ops.deleteUnit(
    { ...model, units: s.units },
    s,
    "degF",
  )
  assert.ok(removed.ok, JSON.stringify(removed))

  // 量种改成与引用属性不符 → 完整性检查报 UNIT_KIND_MISMATCH
  const renamed = ops.updateUnit(schemaOf(), "degC", {
    quantityKind: "temperatureDifference",
  })
  assert.ok(renamed.ok)
  const broken = { ...model, units: (renamed.ok ? renamed.content : schemaOf()).units }
  const diags = checkIntegrity(broken).filter(
    (d) => d.code === "UNIT_KIND_MISMATCH",
  )
  assert.ok(diags.length >= 1, JSON.stringify(checkIntegrity(broken)))
}

export function constraintUpdateAndDeleteBlocked() {
  const model = baselineModel()
  // cooling-floor 被属性归约契约、调度节点与 Contribute 参数引用
  const refs = constraintRefs(model, "cooling-floor")
  assert.ok(
    refs.some((r) => r.kind === "attribute" && r.id === "thermal.temperature"),
    JSON.stringify(refs),
  )
  assert.ok(
    refs.some((r) => r.kind === "schedule" && r.id === "schedule-main"),
    JSON.stringify(refs),
  )
  assert.ok(
    refs.some((r) => r.kind === "program" && r.id === "g-cool"),
    JSON.stringify(refs),
  )
  const blocked = ops.deleteConstraint(model, systemsOf(), "cooling-floor")
  assert.equal(blocked.ok, false)
  assert.ok(!blocked.ok && blocked.refs && blocked.refs.length === refs.length)

  // 更新下限：20 → 24；非法值拒绝
  const updated = ops.updateConstraint(systemsOf(), "cooling-floor", {
    floorC: 24,
  })
  assert.ok(updated.ok, JSON.stringify(updated))
  assert.equal(
    (updated.ok ? updated.content : systemsOf()).constraints.find(
      (c) => c.id === "cooling-floor",
    )!.floorC,
    24,
  )
  assert.equal(
    ops.updateConstraint(systemsOf(), "cooling-floor", { floorC: Number.NaN })
      .ok,
    false,
  )
  assert.equal(
    ops.updateConstraint(systemsOf(), "cooling-floor", { domain: " " }).ok,
    false,
  )

  // 新建无引用约束可删除；校验通过
  const created = ops.createConstraint(systemsOf(), {
    id: "cooling-floor-b",
    floorC: 18,
    domain: "cooling-only-fixed-equal-sources",
    unsupported: "",
  })
  assert.ok(created.ok, JSON.stringify(created))
  const c2 = created.ok ? created.content : systemsOf()
  assert.deepEqual(
    checkIntegrity({ ...model, constraints: c2.constraints }).filter(
      (d) => d.severity === "error",
    ),
    [],
  )
  assert.ok(ops.deleteConstraint({ ...model, constraints: c2.constraints }, c2, "cooling-floor-b").ok)
}
