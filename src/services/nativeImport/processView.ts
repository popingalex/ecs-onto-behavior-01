import type { NativeFrame, NativeRunBundle } from "./types"

/**
 * V7-2 原生运行过程视图:按提交 id 反查帧,产出 P22/P24 可渲染的事实模型。
 * 只重组引擎已有字段(source_system_id/frame_layer/after 值),不生成
 * 请求→获准对、不生成 inputVersionRefs(REAL-09:缺即不补造)。
 */

export interface NativeFrameRef {
  bundle: NativeRunBundle
  branchId: string
  branchLabel: string
  frame: NativeFrame
  /** 场景基点提交(非帧)时为 null。 */
  isSceneBase: false
}

export function nativeCommitIdOf(
  bundle: NativeRunBundle,
  branchId: string,
  frame: number,
): string {
  return `nat-${bundle.runId.slice(0, 6)}-${branchId}-f${String(frame).padStart(6, "0")}`
}

export function findNativeFrame(
  bundles: NativeRunBundle[],
  commitId: string,
): NativeFrameRef | null {
  for (const bundle of bundles) {
    for (const branch of bundle.branches) {
      for (const frame of branch.frames) {
        if (nativeCommitIdOf(bundle, branch.id, frame.frame) === commitId) {
          return {
            bundle,
            branchId: branch.id,
            branchLabel: `${bundle.runId.slice(0, 6)} / ${branch.id}`,
            frame,
            isSceneBase: false,
          }
        }
      }
    }
  }
  return null
}

/** 一帧内按 system 归并的效果组(仅 SYSTEM_EFFECT 级有 source)。 */
export interface NativeSystemEffectGroup {
  systemId: string
  count: number
  instances: string[]
  attributes: string[]
  layers: Array<"pre" | "post">
}

export interface NativeFrameProcess {
  runId: string
  executionId: string | null
  branchId: string
  branchLabel: string
  frame: number
  commitId: string
  traceCompleteness: NativeRunBundle["traceCompleteness"]
  /** 仅 SYSTEM_EFFECT 级非空(引擎 source_system_id);PROPERTY_DELTA 级恒空。 */
  systemGroups: NativeSystemEffectGroup[]
  /** 帧内属性变更(instanceId→after;对象值不在其中,见 blocks)。 */
  propertyDeltas: Array<{
    instanceId: string
    attribute: string
    layer: "pre" | "post"
    value: unknown
    sourceSystemId?: string
  }>
  /** 非标量块(environment 网格/等值线等):instanceId→path→帧内次数。 */
  blocks: Array<{ instanceId: string; attribute: string; count: number }>
  meta: NativeFrame["meta"]
  /** 该属性在本分支的全帧演化链(P24 用)。 */
  chainOf: (instanceId: string, attribute: string) => Array<{
    frame: number
    commitId: string
    layer: "pre" | "post"
    sourceSystemId?: string
    present: boolean
  }>
}

export function buildFrameProcess(ref: NativeFrameRef): NativeFrameProcess {
  const { bundle, branchId, frame } = ref
  const branch = bundle.branches.find((b) => b.id === branchId)!
  const groups = new Map<string, NativeSystemEffectGroup>()
  const propertyDeltas: NativeFrameProcess["propertyDeltas"] = []
  for (const d of frame.deltas) {
    if (d.sourceSystemId) {
      const g = groups.get(d.sourceSystemId) ?? {
        systemId: d.sourceSystemId,
        count: 0,
        instances: [],
        attributes: [],
        layers: [],
      }
      g.count += 1
      if (!g.instances.includes(d.instanceId)) g.instances.push(d.instanceId)
      if (!g.attributes.includes(d.attribute)) g.attributes.push(d.attribute)
      if (!g.layers.includes(d.layer)) g.layers.push(d.layer)
      groups.set(d.sourceSystemId, g)
    }
    propertyDeltas.push({
      instanceId: d.instanceId,
      attribute: d.attribute,
      layer: d.layer,
      value: frame.values.get(d.instanceId)?.get(d.attribute) ?? null,
      sourceSystemId: d.sourceSystemId,
    })
  }
  const blocks: NativeFrameProcess["blocks"] = []
  for (const [instanceId, attrs] of frame.blocks) {
    for (const [attribute, count] of attrs) blocks.push({ instanceId, attribute, count })
  }
  blocks.sort((a, b) => a.instanceId.localeCompare(b.instanceId))

  const chainOf = (instanceId: string, attribute: string) =>
    branch.frames
      .filter((f) => f.deltas.some((d) => d.instanceId === instanceId && d.attribute === attribute))
      .map((f) => {
        const d = f.deltas.find(
          (x) => x.instanceId === instanceId && x.attribute === attribute,
        )!
        return {
          frame: f.frame,
          commitId: nativeCommitIdOf(bundle, branchId, f.frame),
          layer: d.layer,
          sourceSystemId: d.sourceSystemId,
          present: f.values.get(instanceId)?.has(attribute) ?? false,
        }
      })

  return {
    runId: bundle.runId,
    executionId: bundle.executionId,
    branchId,
    branchLabel: ref.branchLabel,
    frame: frame.frame,
    commitId: nativeCommitIdOf(bundle, branchId, frame.frame),
    traceCompleteness: bundle.traceCompleteness,
    systemGroups: [...groups.values()].sort((a, b) => b.count - a.count),
    propertyDeltas,
    blocks,
    meta: frame.meta,
    chainOf,
  }
}

/** 该分支所有出现过的 (instanceId, attribute) 变更对(P24 属性选择用),按首次变更排序。 */
export function changedProperties(
  bundles: NativeRunBundle[],
  branchLabelPrefix: string,
): Array<{ instanceId: string; attribute: string; changes: number }> {
  const out: Array<{ instanceId: string; attribute: string; changes: number }> = []
  for (const bundle of bundles) {
    for (const branch of bundle.branches) {
      if (!`${bundle.runId.slice(0, 6)} / ${branch.id}`.startsWith(branchLabelPrefix)) continue
      const seen = new Map<string, number>()
      for (const f of branch.frames)
        for (const d of f.deltas) {
          const key = `${d.instanceId}::${d.attribute}`
          seen.set(key, (seen.get(key) ?? 0) + 1)
        }
      for (const [key, changes] of seen) {
        const [instanceId, attribute] = key.split("::")
        out.push({ instanceId, attribute, changes })
      }
    }
  }
  out.sort((a, b) => b.changes - a.changes || a.instanceId.localeCompare(b.instanceId))
  return out
}
