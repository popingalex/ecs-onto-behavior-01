import type { UnitDef } from "@/schema/model"

/**
 * 量种运算与约束沙盒试算（P04 测试台）。纯函数，不写草稿、不产生 commit。
 * 规则：绝对温度 ± 温差 = 绝对温度；绝对温度 − 绝对温度 = 温差；
 * 同量种（非绝对温度）自由加减；跨量种拒绝（UNIT_KIND_MISMATCH）。
 * NaN / Infinity 拒绝参与（NON_FINITE），与入库校验同一口径。
 */
export interface QuantityInput {
  value: number
  unitId: string
}

export type QuantityResult =
  | { ok: true; value: number; unitId: string; quantityKind: string }
  | { ok: false; code: string; message: string }

interface Fail {
  ok: false
  code: string
  message: string
}

const fail = (code: string, message: string): Fail => ({
  ok: false,
  code,
  message,
})

const ABS = "temperatureAbsolute"
const DIFF = "temperatureDifference"

function unitOf(units: UnitDef[], unitId: string): UnitDef | undefined {
  return units.find((u) => u.id === unitId)
}

function kindUnit(units: UnitDef[], quantityKind: string): UnitDef | undefined {
  return units.find((u) => u.quantityKind === quantityKind)
}

export function evalQuantityOp(
  units: UnitDef[],
  a: QuantityInput,
  op: "add" | "sub",
  b: QuantityInput,
): QuantityResult {
  if (!Number.isFinite(a.value) || !Number.isFinite(b.value))
    return fail("NON_FINITE", "NaN / Infinity 不能参与试算，也不能入库")
  const ua = unitOf(units, a.unitId)
  const ub = unitOf(units, b.unitId)
  if (!ua) return fail("UNIT_MISSING", `单位 ${a.unitId} 不存在`)
  if (!ub) return fail("UNIT_MISSING", `单位 ${b.unitId} 不存在`)
  const ka = ua.quantityKind
  const kb = ub.quantityKind
  const value = op === "add" ? a.value + b.value : a.value - b.value

  const result = (quantityKind: string, unitId?: string): QuantityResult => {
    const unit = unitId ? unitOf(units, unitId) : kindUnit(units, quantityKind)
    if (!unit)
      return fail("UNIT_MISSING", `没有量种 ${quantityKind} 的结果单位`)
    return { ok: true, value, unitId: unit.id, quantityKind }
  }

  if (ka === kb) {
    if (ka === ABS) {
      if (op === "add")
        return fail(
          "UNIT_KIND_MISMATCH",
          `两个绝对温度（${ua.symbol}）不能相加；只有温差（K）可以叠加到绝对温度上`,
        )
      // 绝对温度 − 绝对温度 = 温差
      return result(DIFF)
    }
    return result(ka, ua.id)
  }
  if (ka === ABS && kb === DIFF) return result(ABS, ua.id)
  if (ka === DIFF && kb === ABS) {
    if (op === "add") return result(ABS, ub.id)
    return fail(
      "UNIT_KIND_MISMATCH",
      "温差减去绝对温度没有物理意义；请改写为 绝对温度 − 温差",
    )
  }
  return fail(
    "UNIT_KIND_MISMATCH",
    `量种不符：${ua.symbol}（${ka}）与 ${ub.symbol}（${kb}）不能直接${
      op === "add" ? "相加" : "相减"
    }`,
  )
}

/** 约束沙盒试算输入：冷源下限、旧值与一组冷却请求（负值 K）。 */
export interface AllocationInput {
  floorC: number
  previousC: number
  requests: number[]
}

export type AllocationResult =
  | { ok: true; quota: number; ratio: number; approved: number[] }
  | { ok: false; code: string; message: string }

/**
 * 比例分配试算：额度 = max(旧值 − 冷源下限, 0)；按 |请求| 比例限幅。
 * 与运行裁决同一口径（P23），但这里只是试算，不写任何文档。
 * 正向（升温）请求属于契约声明的不支持域，直接拒绝并说明。
 */
export function allocateProportional(
  input: AllocationInput,
): AllocationResult {
  const { floorC, previousC, requests } = input
  if (!Number.isFinite(floorC) || !Number.isFinite(previousC))
    return fail("NON_FINITE", "下限与旧值必须是有限数值")
  if (requests.some((r) => !Number.isFinite(r)))
    return fail("NON_FINITE", "请求必须是有限数值；NaN / Infinity 被拒绝")
  if (requests.some((r) => r > 0))
    return fail(
      "UNSUPPORTED",
      "存在正向（升温）请求：当前约束仅支持冷却模型（cooling-only），该请求不适用",
    )
  const quota = Math.max(previousC - floorC, 0)
  const total = requests.reduce((sum, r) => sum + Math.abs(r), 0)
  if (total === 0)
    return { ok: true, quota, ratio: 1, approved: requests.map(() => 0) }
  const ratio = Math.min(1, quota / total)
  // 显式把 -0 归一为 0：零额度不等于负零请求。
  const approved = requests.map((r) => {
    const v = r * ratio
    return v === 0 ? 0 : v
  })
  return { ok: true, quota, ratio, approved }
}
