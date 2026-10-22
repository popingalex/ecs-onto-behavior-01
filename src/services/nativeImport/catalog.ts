import type { NativeCapability } from "./types"

/**
 * 引擎系统目录（mas-rust crates/runtime/src/system_registry.rs @65c7f96 的静态转录，
 * 非运行时读取）。用于 REAL_IMPORT_READ_ONLY 模式下 P11 的只读目录展示。
 * sClass 对应 03_capability_matrix.md §2：S0=原生黑盒，S1=可映射（lc-* workflow 覆盖）。
 */
export interface NativeSystemCatalogEntry {
  id: string
  label: string
  phase: string
  implementation: "native" | "workflow" | "infra" | "hybrid"
  sClass: "S0" | "S1" | "S0-infra"
  reads: string[]
  writes: string[]
  note: string
}

export const NATIVE_SYSTEM_CATALOG: NativeSystemCatalogEntry[] = [
  { id: "water-intake", label: "供水接入", phase: "Input", implementation: "workflow", sClass: "S1", reads: ["water_sprayer/*"], writes: ["water_sprayer/*"], note: "lc-water-intake workflow 覆盖" },
  { id: "mobile", label: "疏散移动", phase: "Simulation", implementation: "hybrid", sClass: "S1", reads: ["mobile/*", "transform/position"], writes: ["transform/position", "mobile/*"], note: "lc-mobile + native 路网/车道偏移" },
  { id: "combustion", label: "燃烧", phase: "Simulation", implementation: "hybrid", sClass: "S1", reads: ["flammable/*"], writes: ["flammable/temperature", "environment_radiation/*"], note: "lc-combustion workflow 覆盖 + native 快路径" },
  { id: "radiation-diffusion", label: "辐射扩散", phase: "Simulation", implementation: "native", sClass: "S0", reads: ["field_thermal/*"], writes: ["field_thermal/temperature_grid"], note: "网格内核（不推送客户端）" },
  { id: "fire-extinguishing", label: "灭火交互", phase: "Coupling", implementation: "workflow", sClass: "S1", reads: ["water_sprayer/*", "flammable/*"], writes: ["flammable/temperature"], note: "lc-fire-extinguishing" },
  { id: "sprinkler", label: "喷淋冷却", phase: "Coupling", implementation: "workflow", sClass: "S1", reads: ["water_sprayer/*"], writes: ["flammable/temperature"], note: "lc-sprinkler" },
  { id: "tank-init", label: "储罐初始化", phase: "Preprocess", implementation: "workflow", sClass: "S1", reads: [], writes: ["tank/*"], note: "lc-tank-init" },
  { id: "geo-damage", label: "地理受损", phase: "Simulation", implementation: "native", sClass: "S0", reads: ["geo_footprint/*"], writes: ["damage/*"], note: "原生黑盒" },
  { id: "injury-threat", label: "受威胁热力", phase: "Decision", implementation: "native", sClass: "S0", reads: ["field_thermal/*", "personnel_density/*"], writes: ["casualty_threat/*"], note: "带外 summary（PG 实测 delta 归因可能粘连）" },
  { id: "transport", label: "转运工作流", phase: "Simulation", implementation: "workflow", sClass: "S1", reads: ["controlled/commands"], writes: ["vehicle/*", "casualty/*"], note: "lc-transport" },
  { id: "system.structural", label: "结构系统", phase: "Structural", implementation: "infra", sClass: "S0-infra", reads: [], writes: [], note: "基础设施，不映射" },
  { id: "system.commit", label: "提交系统", phase: "Commit", implementation: "infra", sClass: "S0-infra", reads: [], writes: [], note: "基础设施" },
  { id: "system.history", label: "历史系统", phase: "History", implementation: "infra", sClass: "S0-infra", reads: [], writes: [], note: "基础设施" },
  { id: "system.metrics", label: "指标系统", phase: "Metrics", implementation: "infra", sClass: "S0-infra", reads: [], writes: [], note: "基础设施" },
  { id: "system.priority-arbitration", label: "优先级仲裁", phase: "Decision", implementation: "infra", sClass: "S0-infra", reads: [], writes: [], note: "基础设施" },
  { id: "system.health-monitor", label: "健康监控", phase: "Metrics", implementation: "infra", sClass: "S0-infra", reads: [], writes: [], note: "基础设施" },
]

/**
 * 运行期目录合并(H2/CAT-05):静态 registry 转录 + 从导入运行 delta 的
 * source_system_id 动态发现。未知系统保留 UNKNOWN 阶段,不推测归属
 * (field_thermal_live 即由样例 D 动态发现,不再硬编码)。
 */
export interface MergedSystemEntry extends NativeSystemCatalogEntry {
  source: "REGISTERED" | "OBSERVED_RUNTIME"
  confidence: "DECLARED" | "OBSERVED"
  /** 仅 OBSERVED_RUNTIME:首次观测位置。 */
  observedAtRun?: string
  firstObservedFrame?: number
  observedCount?: number
}

export interface RuntimeObservation {
  systemId: string
  runId: string
  firstFrame: number
  count: number
}

export function collectRuntimeObservations(
  bundles: Array<{
    runId: string
    branches: Array<{ id: string; frames: Array<{ frame: number; deltas: Array<{ sourceSystemId?: string }> }> }>
  }>,
): RuntimeObservation[] {
  const bySystem = new Map<string, RuntimeObservation>()
  for (const bundle of bundles) {
    for (const branch of bundle.branches) {
      for (const frame of branch.frames) {
        for (const d of frame.deltas) {
          if (!d.sourceSystemId) continue
          const key = `${d.sourceSystemId}`
          const cur = bySystem.get(key)
          if (!cur) {
            bySystem.set(key, {
              systemId: d.sourceSystemId,
              runId: bundle.runId,
              firstFrame: frame.frame,
              count: 1,
            })
          } else {
            cur.count += 1
          }
        }
      }
    }
  }
  return [...bySystem.values()].sort((a, b) => b.count - a.count)
}

export function mergeRuntimeCatalog(
  observations: RuntimeObservation[],
): MergedSystemEntry[] {
  const out: MergedSystemEntry[] = NATIVE_SYSTEM_CATALOG.map((s) => ({
    ...s,
    source: "REGISTERED" as const,
    confidence: "DECLARED" as const,
  }))
  for (const obs of observations) {
    const known = out.find((s) => s.id === obs.systemId)
    if (known) {
      known.source = "REGISTERED"
      known.confidence = "DECLARED"
      known.observedAtRun = obs.runId
      known.firstObservedFrame = obs.firstFrame
      known.observedCount = obs.count
      continue
    }
    // 运行期发现:不推测阶段/实现形态,phase 记 UNKNOWN。
    out.push({
      id: obs.systemId,
      label: `${obs.systemId}(运行期发现)`,
      phase: "UNKNOWN",
      implementation: "native",
      sClass: "S0",
      reads: [],
      writes: [],
      note: `由运行 ${obs.runId.slice(0, 8)} delta 归因观测(${obs.count} 条,首现帧 ${obs.firstFrame});静态 registry 转录未收录,阶段不推测`,
      source: "OBSERVED_RUNTIME",
      confidence: "OBSERVED",
      observedAtRun: obs.runId,
      firstObservedFrame: obs.firstFrame,
      observedCount: obs.count,
    })
  }
  return out
}

/**
 * 单位/量种映射（03_capability_matrix value.unit.quantity）。
 * 引擎无数值单位系统；此处为**人工登记表**（来源：components.rs/attr_ids.rs 字段注释审计），
 * 查不到 = UNKNOWN，导入侧不校验、UI 标注，不猜测。
 */
export const NATIVE_UNIT_MAP: Record<string, { unitId: string; symbol: string; quantityKind: string }> = {
  "flammable/temperature": { unitId: "degC", symbol: "°C", quantityKind: "temperatureAbsolute" },
  "environment_radiation/ambient": { unitId: "degC", symbol: "°C", quantityKind: "temperatureAbsolute" },
  "water_sprayer/flow_rate": { unitId: "Lps", symbol: "L/s", quantityKind: "volumeFlowRate" },
  "water_tank/remaining": { unitId: "L", symbol: "L", quantityKind: "volume" },
  "mobile/speed": { unitId: "mperf", symbol: "m/帧", quantityKind: "velocity" },
  "casualty_threat/density": { unitId: "perha", symbol: "人/ha", quantityKind: "populationDensity" },
  "transform/position": { unitId: "deg", symbol: "°(经纬度)", quantityKind: "geodetic" },
}

export function lookupNativeUnit(attrPath: string) {
  return NATIVE_UNIT_MAP[attrPath] ?? null
}

export const NATIVE_UNKNOWN_UNIT = {
  unitId: "unknown",
  symbol: "?",
  quantityKind: "unknown",
}

export const NATIVE_CAPABILITY: NativeCapability = {
  contractVersion: "0.1.0",
  sourceSystemId: "mas-rust",
  sourceRevision: "65c7f96",
  capabilities: {
    schemaRead: "converted",
    entityRead: "native",
    entityWrite: "unsupported",
    systemCatalogRead: "native",
    scheduleWrite: "unsupported",
    programCompile: "unsupported",
    runStart: "readonly",
    runRecords: "native",
    traceNode: "unsupported",
    traceSystemEffect: "partial",
    historyRead: "native",
    branchCreate: "unsupported",
    geoView: "adapter",
    editDrafts: "blocked",
  },
  traceCompleteness: {
    "4blIyLeuvJG-71gggXWcn": "SYSTEM_EFFECT",
    sBwT4d6RsTuGGHPIgu1L3: "PROPERTY_DELTA",
  },
}
