/**
 * ExecutionSemanticsProfile v0.2(X0):原生引擎执行语义的版本化只读档案。
 * 字段值全部来自源码取证(design/04/next/04_native_execution_semantics.md §源码证据),
 * 禁止填编造默认值;编译闸门(X1)开启前仅用于只读诊断。
 */

export type ReadVisibility =
  | "ROUND_SNAPSHOT" // 工作台 mock:全 System 读 previous
  | "FRAME_PROPAGATED" // 原生直接写:write() 即时入 map,同帧后续系统可见
  | "DEFERRED_FLUSH" // 原生延迟写:write_deferred → pending overlay,帧/schedule 末 flush
  | "PHASE_SNAPSHOT" // workflow Original:帧首快照
  | "SILENT_BLOCK" // write_silent:服务端块,不广播不入客户端值域
  | "UNKNOWN"

export interface ExecutionSemanticsProfile {
  profileVersion: "0.2"
  engine: "mas-rust"
  engineRevision: "65c7f96"
  /** 原生帧内可见性按【写路径】分置(源码证据见档案 §2)。 */
  readVisibilityByWritePath: Array<{
    writePath: string
    visibility: ReadVisibility
    evidence: string
  }>
  workflowReadModes: Array<"Original" | "Current" | "Effective">
  stageBarriers: string[]
  commitBoundary: string
  effectKinds: string
  supportsIntermediateProduct: false
  supportsProgramGraphCompilation: false
}

export const NATIVE_EXECUTION_PROFILE: ExecutionSemanticsProfile = {
  profileVersion: "0.2",
  engine: "mas-rust",
  engineRevision: "65c7f96",
  readVisibilityByWritePath: [
    {
      writePath: "ExtraAttributes.write()",
      visibility: "FRAME_PROPAGATED",
      evidence: "components.rs:734 直接 map.insert;mobile.rs 多处直写",
    },
    {
      writePath: "ExtraAttributes.write_deferred()",
      visibility: "DEFERRED_FLUSH",
      evidence: "components.rs:687-804 pending overlay,flush_pending 于帧/schedule 末",
    },
    {
      writePath: "ExtraAttributes.write_silent()",
      visibility: "SILENT_BLOCK",
      evidence: "components.rs:770-777 服务端块(网格),不入广播与值域",
    },
    {
      writePath: "workflow 节点读",
      visibility: "PHASE_SNAPSHOT",
      evidence: "behavior_workflow/io.rs:24-33 ReadMode Original/Current/Effective(默认 Effective)",
    },
  ],
  workflowReadModes: ["Original", "Current", "Effective"],
  stageBarriers: [
    "Input",
    "Structural",
    "Preprocess",
    "Simulation",
    "Coupling",
    "Decision",
    "Commit",
    "History",
    "Metrics",
  ],
  commitBoundary: "一帧 = Pre 层(命令/参数)+ Post 层(系统产出);帧内原子,失败写 failed_systems delta",
  effectKinds: "直接写(无 set/contribute/propose 协议)",
  supportsIntermediateProduct: false,
  supportsProgramGraphCompilation: false,
}

export const WORKBENCH_MOCK_PROFILE = {
  profileVersion: "0.2",
  engine: "workbench-mock",
  readVisibility: "ROUND_SNAPSHOT" as ReadVisibility,
  ordering: "order-only(顺序边不传播写入)",
  commitBoundary: "整轮原子(settle→contribute→归约→原子提交)",
  effectKinds: "Contribute→EffectRequest→ConstraintDecision",
}

/**
 * native→IR 只读适配诊断(X0):对给定系统形态给出可否映射与理由。
 * S2 判定在 X1 双向 codec 通过前恒为 false——不兼容即拒绝,不静默降级。
 */
export type SystemAdaptation =
  | { level: "S0"; compilable: false; reason: string }
  | { level: "S1"; compilable: false; reason: string }
  | { level: "S2"; compilable: boolean; reason: string }

export function adaptationFor(system: {
  implementation: "native" | "workflow" | "infra" | "hybrid"
  sClass: "S0" | "S1" | "S0-infra"
}): SystemAdaptation {
  if (system.sClass === "S0-infra")
    return {
      level: "S0",
      compilable: false,
      reason: "基础设施系统,不参与业务图映射",
    }
  if (system.sClass === "S0")
    return {
      level: "S0",
      compilable: false,
      reason: "原生黑盒:native 写路径含 FRAME_PROPAGATED/DEFERRED_FLUSH/SILENT_BLOCK 混合,无 IR 对应;只读展示+来源分析",
    }
  return {
    level: "S1",
    compilable: false,
    reason: "参数可映射(lc-* workflow 有节点图),但 X1 双向 codec+对拍闸门未开;当前仅只读展示,不编译",
  }
}
