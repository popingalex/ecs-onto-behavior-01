/**
 * V7-2 过程视图测试:P22/P24 渲染模型与源工件对拍(REAL-08/09/10 数据面)。
 */
import { loadRunB, loadRunC } from "../fixtures"
import { buildRunB, buildRunC } from "../normalize"
import {
  buildFrameProcess,
  changedProperties,
  findNativeFrame,
  nativeCommitIdOf,
} from "../processView"
import type { NativeRunBundle } from "../types"

let bundles: NativeRunBundle[]
async function init() {
  if (bundles) return bundles
  const [b, c] = await Promise.all([loadRunB(), loadRunC()])
  bundles = [buildRunB(b), buildRunC(c).bundle]
  return bundles
}

export async function commitLookupRoundTrips() {
  const list = await init()
  // 每个帧提交都能反查回帧(B 10 + C 11)。
  let frames = 0
  for (const bundle of list) {
    for (const branch of bundle.branches) {
      for (const frame of branch.frames) {
        const id = nativeCommitIdOf(bundle, branch.id, frame.frame)
        const ref = findNativeFrame(list, id)
        if (!ref) throw new Error(`提交 ${id} 反查失败`)
        if (ref.frame.frame !== frame.frame || ref.bundle.runId !== bundle.runId)
          throw new Error(`提交 ${id} 反查错帧`)
        frames += 1
      }
    }
  }
  if (frames !== 21) throw new Error(`帧提交数 ${frames} != 21(10+11)`)
  if (findNativeFrame(list, "nat-scene-chem-roaded-base"))
    throw new Error("场景基点不应反查出帧")
}

export async function systemEffectGroupsMatchTicks() {
  const list = await init()
  const c = list.find((b) => b.runId === "4blIyLeuvJG-71gggXWcn")!
  const id = nativeCommitIdOf(c, "plan-evacuation", 1)
  const ref = findNativeFrame(list, id)!
  const process = buildFrameProcess(ref)
  if (process.traceCompleteness !== "SYSTEM_EFFECT")
    throw new Error("C 应为 SYSTEM_EFFECT")
  // 帧 1:203 条 delta;有来源组的总条数 = 带 source_system_id 的 delta 数。
  if (process.propertyDeltas.length !== 203)
    throw new Error(`帧 1 delta ${process.propertyDeltas.length} != 203`)
  const grouped = process.systemGroups.reduce((n, g) => n + g.count, 0)
  const withSource = process.propertyDeltas.filter((d) => d.sourceSystemId).length
  if (grouped !== withSource) throw new Error("归并组条数与来源 delta 数不符")
  if (process.systemGroups.length === 0) throw new Error("帧 1 应有系统归因组")
  for (const g of process.systemGroups) {
    if (!g.systemId) throw new Error("归因组缺 systemId")
  }
  // 无来源 delta 不进组、显示未知(REAL-09:缺即不造)。
  if (process.propertyDeltas.length === grouped && withSource < 203)
    throw new Error("存在无来源 delta 却全被归并")
}

export async function propertyDeltaLevelHasNoSource() {
  const list = await init()
  const b = list.find((x) => x.runId === "sBwT4d6RsTuGGHPIgu1L3")!
  const id = nativeCommitIdOf(b, "main", 5)
  const process = buildFrameProcess(findNativeFrame(list, id)!)
  if (process.traceCompleteness !== "PROPERTY_DELTA")
    throw new Error("B 应为 PROPERTY_DELTA")
  if (process.systemGroups.length !== 0)
    throw new Error("PROPERTY_DELTA 级不得出现系统归因组")
  if (process.propertyDeltas.some((d) => d.sourceSystemId))
    throw new Error("B 的 delta 不得带伪造来源")
}

export async function provenanceChainReconstructs() {
  const list = await init()
  const c = list.find((b) => b.runId === "4blIyLeuvJG-71gggXWcn")!
  // environment.casualty_threat/summary 在 plan-evacuation 多帧变化。
  const ref = findNativeFrame(list, nativeCommitIdOf(c, "plan-evacuation", 1))!
  const process = buildFrameProcess(ref)
  const chain = process.chainOf("environment", "casualty_threat/summary")
  if (chain.length === 0)
    throw new Error("environment.casualty_threat/summary 应有演化链")
  for (const step of chain) {
    if (!step.commitId.startsWith("nat-4blIyL-plan-evacuation-f"))
      throw new Error(`链提交 id 异常:${step.commitId}`)
    // 该属性为对象值 → present=false(块,不入值域),不得回填值。
    if (step.present) throw new Error("对象值属性不应入值域")
  }
  const changed = changedProperties(list, "4blIyL / plan-evacuation")
  if (!changed.some((x) => x.instanceId === "environment" && x.attribute === "casualty_threat/summary"))
    throw new Error("changedProperties 缺已知变更对")
}

export async function blocksListedInFrameProcess() {
  const list = await init()
  const b = list.find((x) => x.runId === "sBwT4d6RsTuGGHPIgu1L3")!
  const process = buildFrameProcess(
    findNativeFrame(list, nativeCommitIdOf(b, "main", 0))!,
  )
  const envBlocks = process.blocks.filter((x) => x.instanceId === "environment")
  if (envBlocks.length === 0) throw new Error("帧 0 environment 应有块引用")
  if (!envBlocks.some((x) => x.attribute.includes("radiation_matrix")))
    throw new Error("辐射矩阵应在块引用清单")
}
