import { z } from "zod"
import type { RawValue } from "@/schema/model"

/**
 * V7-1 真实数据只读导入（REAL_IMPORT_READ_ONLY）。
 * 数据源是 mas-rust@65c7f96 的离线工件（design/04/resp/real_fixture_manifest.md 登记的样例 A/B/C）。
 * 只读契约：导入器不执行、不回写、不生成引擎不存在的记录（请求→获准效果对、节点输入版本一律缺失并明示）。
 */

export type DataSourceMode = "MOCK_SANDBOX" | "REAL_IMPORT_READ_ONLY"

export const NATIVE_SOURCE_SYSTEM_ID = "mas-rust"
export const NATIVE_SOURCE_REVISION = "65c7f96"
export const NATIVE_BASE_VERSION = `native-import-1@${NATIVE_SOURCE_REVISION}`

/** 引擎属性类型串 → 工作台形状。仅收录可无损放进 RawValue 的；其余进 complexTypes 清单。 */
const RAW_TYPE_RE = /^(n|b|s|u)$/
const VEC3_TYPE_RE = /^n\[3\]$/

export const fixtureAttributeSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  /** 可缺省（zod4 对象内 unknown 仍要求键存在，需显式 optional）。 */
  value: z.unknown().optional(),
  /** 组件定义必有类型串；archetype 默认值声明可缺省（记 "u"，不参与值域分类）。 */
  type: z.string().min(1).default("u"),
  config: z
    .object({ layer: z.string().optional(), description: z.string().optional() })
    .passthrough()
    .optional(),
})

export const fixtureComponentSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  attributes: z.array(fixtureAttributeSchema),
})

export const fixtureArchetypeSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  description: z.string().optional(),
  attributes: z.array(fixtureAttributeSchema),
})

export const fixtureInstanceSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  entity: z.string().min(1),
  attributes: z
    .array(z.object({ id: z.string().min(1), value: z.unknown().optional() }))
    .optional()
    .default([]),
})

export type FixtureAttribute = z.infer<typeof fixtureAttributeSchema>
export type FixtureComponent = z.infer<typeof fixtureComponentSchema>
export type FixtureArchetype = z.infer<typeof fixtureArchetypeSchema>
export type FixtureInstance = z.infer<typeof fixtureInstanceSchema>

/** 属性类型分级：scalar / vector3 可入工作台值域；complex 只登记不进值域（04 文档 §2 blockRef 规则）。 */
export type NativeAttrClass = "scalar" | "vector3" | "complex"

export function classifyAttrType(type: string): NativeAttrClass {
  if (RAW_TYPE_RE.test(type)) return "scalar"
  if (VEC3_TYPE_RE.test(type)) return "vector3"
  return "complex"
}

export function primitiveOf(type: string): "f64" | "bool" | "string" {
  if (type === "b") return "bool"
  if (type === "s") return "string"
  return "f64"
}

/** RawValue 兼容判定：值本身必须能放进工作台世界（对象/数组一律视为块）。 */
export function isRawValue(v: unknown): v is number | boolean | string | null {
  const t = typeof v
  return v === null || t === "number" || t === "boolean" || t === "string"
}

export function isVec3Value(v: unknown): v is [number, number, number] {
  return (
    Array.isArray(v) &&
    v.length === 3 &&
    v.every((x) => typeof x === "number")
  )
}

/** 引擎运行 delta（PG s_simulation_tick.tick_entry.deltas 元素）。 */
export const nativeTickDeltaSchema = z.object({
  attribute: z.string().min(1),
  frame_layer: z.enum(["pre", "post"]).catch("post"),
  instance_id: z.string().min(1),
  source_system_id: z.string().min(1).optional(),
  value: z.unknown(),
})

export const nativeTickRowSchema = z.object({
  executionId: z.string().nullish(),
  branchId: z.string().min(1),
  frame: z.number().int().nonnegative(),
  revision: z.number().int().nonnegative().optional(),
  requestId: z.string().nullish(),
  deltas: z.array(nativeTickDeltaSchema),
})

export type NativeTickRow = z.infer<typeof nativeTickRowSchema>
export type NativeTickDelta = z.infer<typeof nativeTickDeltaSchema>

export const nativeMetaSchema = z.object({
  branchId: z.string().min(1),
  frame: z.number().int().nonnegative(),
  tick: z.number().int().nonnegative(),
  source: z.string().optional(),
  deltaCount: z.number().int().nonnegative().optional(),
  changeCount: z.number().int().nonnegative().optional(),
  instanceCount: z.number().int().nonnegative().optional(),
  timestampMs: z.number().optional(),
  performance: z.record(z.string(), z.unknown()).optional(),
})

/** 磁盘 attribute_deltas.json 元素（无 source_system_id → PROPERTY_DELTA 级）。 */
export const nativeDiskDeltaSchema = z.object({
  instanceId: z.string().min(1),
  id: z.string().min(1),
  after: z.unknown(),
  branch: z.string().min(1),
  tick: z.number().int().nonnegative(),
})

export type NativeDiskDelta = z.infer<typeof nativeDiskDeltaSchema>
export type NativeMeta = z.infer<typeof nativeMetaSchema>

export type TraceCompleteness = "SYSTEM_EFFECT" | "PROPERTY_DELTA"

/** 一帧的规范化记录：值进入 values/blocks；来源字段只在引擎真实提供时存在。 */
export interface NativeFrame {
  frame: number
  /** RawValue 兼容属性（instanceId → attrPath → value）；对象/数组之外的复杂值不在此处。 */
  values: Map<string, Map<string, RawValue>>
  /** 非 RawValue 值（网格/等值线/元组数组）按块登记：instanceId → attrPath → 帧内出现次数。 */
  blocks: Map<string, Map<string, number>>
  deltas: Array<{
    instanceId: string
    attribute: string
    layer: "pre" | "post"
    /** 仅 SYSTEM_EFFECT 级（PG ticks）存在；PROPERTY_DELTA 级缺失。 */
    sourceSystemId?: string
  }>
  meta?: NativeMeta
}

export interface NativeBranch {
  id: string
  /** fork 基点（branch, frame）；main 为 null。 */
  forkedFrom: { branch: string; frame: number } | null
  frames: NativeFrame[]
}

export interface NativeRunBundle {
  runId: string
  executionId: string | null
  sceneId: string
  traceCompleteness: TraceCompleteness
  branches: NativeBranch[]
  /** 各分支末帧帧号（引擎 head tick）。 */
  heads: Record<string, number>
  /** 未声明属性（schema fixture 中无定义却在运行里出现的 attr path）去重清单。 */
  undeclaredAttributes: string[]
}

/** 静态能力声明：UI 依据它启停动作，不预设两个适配器能力相同。 */
export interface NativeCapability {
  contractVersion: "0.1.0"
  sourceSystemId: string
  sourceRevision: string
  capabilities: {
    schemaRead: "converted"
    entityRead: "native"
    entityWrite: "unsupported"
    systemCatalogRead: "native"
    scheduleWrite: "unsupported"
    programCompile: "unsupported"
    runStart: "readonly"
    runRecords: "native"
    traceNode: "unsupported"
    traceSystemEffect: "partial"
    historyRead: "native"
    branchCreate: "unsupported"
    geoView: "adapter"
    editDrafts: "blocked"
  }
  traceCompleteness: Record<string, TraceCompleteness>
}
