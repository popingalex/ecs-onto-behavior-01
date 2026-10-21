import assert from "node:assert/strict"
import { baselineModel } from "@/data/mockLoader"
import { allocateProportional, evalQuantityOp } from "../quantityMath"

/** P04 测试台：量种运算规则与约束沙盒试算（规格示例数值）。 */

export function absoluteMinusAbsoluteIsDifference() {
  const units = baselineModel().units
  // 规格示例：100 °C − 20 °C = 80 K
  const r = evalQuantityOp(
    units,
    { value: 100, unitId: "degC" },
    "sub",
    { value: 20, unitId: "degC" },
  )
  assert.ok(r.ok, JSON.stringify(r))
  assert.ok(r.ok && r.value === 80 && r.unitId === "deltaK")
  assert.ok(r.ok && r.quantityKind === "temperatureDifference")
}

export function absolutePlusDifferenceIsAbsolute() {
  const units = baselineModel().units
  // 规格示例：100 °C + (−40 K) = 60 °C
  const r = evalQuantityOp(
    units,
    { value: 100, unitId: "degC" },
    "add",
    { value: -40, unitId: "deltaK" },
  )
  assert.ok(r.ok, JSON.stringify(r))
  assert.ok(r.ok && r.value === 60 && r.unitId === "degC")

  // 交换顺序仍可加（温差 + 绝对温度）
  const swapped = evalQuantityOp(
    units,
    { value: -40, unitId: "deltaK" },
    "add",
    { value: 100, unitId: "degC" },
  )
  assert.ok(swapped.ok && swapped.value === 60 && swapped.unitId === "degC")

  // 绝对温度 − 温差 = 绝对温度
  const sub = evalQuantityOp(
    units,
    { value: 100, unitId: "degC" },
    "sub",
    { value: 40, unitId: "deltaK" },
  )
  assert.ok(sub.ok && sub.value === 60 && sub.unitId === "degC")
}

export function kindMismatchRejected() {
  const units = baselineModel().units
  // 绝对温度相加没有物理意义
  const abs = evalQuantityOp(
    units,
    { value: 100, unitId: "degC" },
    "add",
    { value: 20, unitId: "degC" },
  )
  assert.ok(!abs.ok && abs.code === "UNIT_KIND_MISMATCH", JSON.stringify(abs))

  // 温差 − 绝对温度被拒绝并给出改写建议
  const diffSub = evalQuantityOp(
    units,
    { value: 40, unitId: "deltaK" },
    "sub",
    { value: 100, unitId: "degC" },
  )
  assert.ok(!diffSub.ok && diffSub.code === "UNIT_KIND_MISMATCH")

  // 跨量种：长度 − 体积
  const cross = evalQuantityOp(
    units,
    { value: 10, unitId: "m" },
    "sub",
    { value: 1, unitId: "L" },
  )
  assert.ok(!cross.ok && cross.code === "UNIT_KIND_MISMATCH")

  // 同量种自由加减：8000 L + 5500 L = 13500 L
  const same = evalQuantityOp(
    units,
    { value: 8000, unitId: "L" },
    "add",
    { value: 5500, unitId: "L" },
  )
  assert.ok(same.ok && same.value === 13500 && same.unitId === "L")
}

export function nonFiniteRejected() {
  const units = baselineModel().units
  for (const v of [Number.NaN, Number.POSITIVE_INFINITY]) {
    const r = evalQuantityOp(
      units,
      { value: v, unitId: "degC" },
      "sub",
      { value: 20, unitId: "degC" },
    )
    assert.ok(!r.ok && r.code === "NON_FINITE", JSON.stringify(r))
  }
  const alloc = allocateProportional({
    floorC: 20,
    previousC: Number.NaN,
    requests: [-50],
  })
  assert.ok(!alloc.ok && alloc.code === "NON_FINITE")
}

export function proportionalAllocationMatchesContract() {
  // 与运行裁决同口径：额度 = max(旧值 − 冷源下限, 0)，按 |请求| 比例限幅。
  // 100 °C、下限 20 °C：额度 80 K；两个 −50 请求共 100，比例 0.8 → 各 −40。
  const r = allocateProportional({
    floorC: 20,
    previousC: 100,
    requests: [-50, -50],
  })
  assert.ok(r.ok, JSON.stringify(r))
  assert.ok(r.ok && r.quota === 80 && r.ratio === 0.8)
  assert.ok(r.ok && JSON.stringify(r.approved) === "[-40,-40]")

  // 额度充足 → 全额获准，比例 1
  const full = allocateProportional({
    floorC: 20,
    previousC: 200,
    requests: [-50, -30],
  })
  assert.ok(full.ok && full.ratio === 1)
  assert.ok(full.ok && JSON.stringify(full.approved) === "[-50,-30]")

  // 旧值已到下限 → 额度 0，获准全 0（不是 -0），不反向升温
  const zero = allocateProportional({
    floorC: 20,
    previousC: 20,
    requests: [-50, -50],
  })
  assert.ok(zero.ok && zero.quota === 0 && zero.ratio === 0)
  assert.ok(zero.ok && zero.approved.every((v) => Object.is(v, 0)))

  // 零请求：比例按 1 处理，获准为 0
  const none = allocateProportional({ floorC: 20, previousC: 100, requests: [] })
  assert.ok(none.ok && none.ratio === 1 && none.approved.length === 0)
}

export function positiveRequestUnsupported() {
  // 正向（升温）请求属于契约声明的不支持域
  const r = allocateProportional({
    floorC: 20,
    previousC: 100,
    requests: [-50, 10],
  })
  assert.ok(!r.ok && r.code === "UNSUPPORTED", JSON.stringify(r))
  assert.ok(!r.ok && r.message.includes("冷却"))
}
