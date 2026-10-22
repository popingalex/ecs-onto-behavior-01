/**
 * X0 语义档案测试:Profile v0.2 与真实数据一致性(源码证据钉死+S 适配诊断+J3 归属核对)。
 */
import {
  adaptationFor,
  NATIVE_EXECUTION_PROFILE,
  WORKBENCH_MOCK_PROFILE,
} from "../executionProfile"
import { loadRunD } from "../fixtures"
import { buildRunC } from "../normalize"
import { mergeRuntimeCatalog, collectRuntimeObservations } from "../catalog"
import { loadNativeImport } from "../seedAdapter"

export async function profilePinnedToSourceEvidence() {
  const p = NATIVE_EXECUTION_PROFILE
  if (p.profileVersion !== "0.2" || p.engineRevision !== "65c7f96")
    throw new Error("Profile 版本/引擎修订不符")
  // 帧内可见性按写路径分置(源码证据三路径+workflow 读模式)。
  const paths = new Map(p.readVisibilityByWritePath.map((x) => [x.writePath, x.visibility]))
  if (paths.get("ExtraAttributes.write()") !== "FRAME_PROPAGATED")
    throw new Error("直写路径必须 FRAME_PROPAGATED(components.rs:734)")
  if (paths.get("ExtraAttributes.write_deferred()") !== "DEFERRED_FLUSH")
    throw new Error("延迟写路径必须 DEFERRED_FLUSH(components.rs:687-804)")
  if (paths.get("ExtraAttributes.write_silent()") !== "SILENT_BLOCK")
    throw new Error("静默块路径必须 SILENT_BLOCK")
  if (paths.get("workflow 节点读") !== "PHASE_SNAPSHOT")
    throw new Error("workflow Original 读必须 PHASE_SNAPSHOT(io.rs:24-33)")
  if (p.stageBarriers.length !== 9) throw new Error("9 阶段钉死")
  if (p.supportsProgramGraphCompilation !== false || p.supportsIntermediateProduct !== false)
    throw new Error("X1 闸门未开,编译/中间产物必须 false")
  // 工作台侧对照:ROUND_SNAPSHOT + order-only + 贡献裁决。
  if (WORKBENCH_MOCK_PROFILE.readVisibility !== "ROUND_SNAPSHOT")
    throw new Error("mock 侧必须 ROUND_SNAPSHOT")
}

export async function adaptationLevelsRefuseCompilation() {
  // S0/S1/S0-infra 在 X1 闸门开启前一律 compilable=false,理由可读。
  const cases = [
    { implementation: "native" as const, sClass: "S0" as const },
    { implementation: "workflow" as const, sClass: "S1" as const },
    { implementation: "infra" as const, sClass: "S0-infra" as const },
  ]
  for (const c of cases) {
    const a = adaptationFor(c)
    if (a.compilable !== false) throw new Error(`${c.sClass} 不得可编译(X1 未开)`)
    if (!a.reason) throw new Error("拒绝必须给理由")
  }
  const s0 = adaptationFor(cases[0])
  if (s0.level !== "S0" || !s0.reason.includes("FRAME_PROPAGATED"))
    throw new Error("S0 理由必须点名写路径语义")
}

export async function j3AttributionConsistentWithProfile() {
  // J3 归属核对:观测来源 ID 全部落入合并目录;运行期发现条目阶段=UNKNOWN;
  // 观测不改变注册条目等级;S1 系统(lc-* 覆盖)在 J3 中的归因可解释。
  const raw = await loadRunD()
  const built = buildRunC(raw)
  const imported = await loadNativeImport()
  const merged = mergeRuntimeCatalog(collectRuntimeObservations(imported.bundles))
  const byId = new Map(merged.map((s) => [s.id, s]))
  const observedIds = new Set<string>()
  for (const b of built.bundle.branches)
    for (const f of b.frames)
      for (const d of f.deltas) if (d.sourceSystemId) observedIds.add(d.sourceSystemId)
  if (observedIds.size === 0) throw new Error("J3 应有观测来源")
  for (const id of observedIds) {
    if (!byId.has(id)) throw new Error(`观测来源 ${id} 未入目录(不得丢失)`)
  }
  const live = byId.get("field_thermal_live")!
  if (live.phase !== "UNKNOWN" || live.source !== "OBSERVED_RUNTIME")
    throw new Error("运行期发现条目阶段必须 UNKNOWN")
  const fire = byId.get("fire-extinguishing")!
  if (fire.sClass !== "S1" || fire.source !== "REGISTERED")
    throw new Error("注册 S1 条目等级/来源不得被观测改写")
}
