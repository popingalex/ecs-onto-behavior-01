/**
 * v0.7-H 加固测试:帧重放护栏(FRAME-01..05)、J3 样例 D 逐帧对拍钉死(N-03/05/06/07)、
 * 运行期目录动态发现(CAT-01..05)。
 * 黄金数据:src/testdata/native/runs/5UYNf2wUVurVl0616t0Xn(J3 会话导出,
 * 对照证据 design/04/evidence/j3-run-compare/native-run-compare-history.json)。
 */
import { loadRunD, RUN_D_ID } from "../fixtures"
import { buildRunC } from "../normalize"
import {
  assertResolvedFrame,
  validateTicksForReplay,
} from "../replayGuards"
import {
  collectRuntimeObservations,
  mergeRuntimeCatalog,
  NATIVE_SYSTEM_CATALOG,
} from "../catalog"
import { loadNativeImport } from "../seedAdapter"
import type { NativeTickRow } from "../types"

export async function replayGuardsRejectBadSequences() {
  const row = (frame: number, branch = "main"): NativeTickRow => ({
    branchId: branch,
    frame,
    deltas: [{ attribute: "a/b", frame_layer: "post", instance_id: "x", value: 1 }],
  })
  // FRAME-02:空/丢帧/乱序/重复/分支串档
  if (validateTicksForReplay([])[0]?.code !== "REPLAY_EMPTY") throw new Error("空序列应拒绝")
  const gap = validateTicksForReplay([row(1), row(2), row(4)])
  if (!gap.some((d) => d.code === "REPLAY_FRAME_GAP")) throw new Error("丢帧未检出")
  const disorder = validateTicksForReplay([row(1), row(3), row(2)])
  if (!disorder.some((d) => d.code === "REPLAY_FRAME_DISORDER")) throw new Error("乱序未检出")
  const dup = validateTicksForReplay([row(1), row(2), row(2)])
  if (!dup.some((d) => d.code === "REPLAY_FRAME_DUPLICATE")) throw new Error("重复帧未检出")
  const cross = validateTicksForReplay([row(1), row(2, "plan")])
  if (!cross.some((d) => d.code === "REPLAY_BRANCH_MISMATCH")) throw new Error("分支串档未检出")
  // 正常序列(0 起或 1 起)零诊断
  if (validateTicksForReplay([row(0), row(1), row(2)]).length !== 0) throw new Error("正常 0 起序列误报")
  if (validateTicksForReplay([row(1), row(2)]).length !== 0) throw new Error("正常 1 起序列误报")
}

export async function buildRunCRejectsMutatedGoldenTicks() {
  const raw = await loadRunD()
  // 丢帧:去掉帧 3 → 抛错且信息含 REPLAY_FRAME_GAP
  const mutated = raw.ticks.filter((t) => t.frame !== 3)
  try {
    buildRunC({ ...raw, ticks: mutated })
    throw new Error("丢帧序列未被拒绝")
  } catch (e) {
    if (!String(e).includes("REPLAY_FRAME_GAP")) throw new Error(`诊断码不符:${String(e)}`)
  }
}

export async function goldenRunDMatchesEngineHistoryPin() {
  // N-03/N-05/N-06:样例 D 重放 = 引擎真历史端点(黄金钉死,证据 native-run-compare-history.json)。
  const raw = await loadRunD()
  const built = buildRunC(raw)
  const main = built.bundle.branches.find((b) => b.id === "main")!
  if (main.frames.length !== 6) throw new Error(`D 帧数 ${main.frames.length} != 6`)
  if (built.bundle.heads.main !== 6) throw new Error("head 应为 6")
  // FRAME-04/FRAME-01:逐帧温度演化,绝非 head 顶替(frame2 ≠ frame6)。
  const tempAt = (f: number) =>
    main.frames.find((x) => x.frame === f)!.values.get("tank-1")!.get("flammable/temperature")
  const t2 = tempAt(2) as number | undefined
  const t6 = tempAt(6) as number | undefined
  if (t2 !== 41.46773202156945 || t6 !== 77.43085965628441)
    throw new Error(`温度演化钉死失败:${String(t2)}/${String(t6)}`)
  if (Number(t2) === Number(t6)) throw new Error("历史帧被 head 顶替")
  // N-07:显式写入集分层(黄金数:全 6 帧写入值合计 3208,与引擎逐帧对照零差异)。
  const written = main.frames.reduce((n, f) => {
    let c = 0
    for (const row of f.values.values()) c += row.size
    return n + c
  }, 0)
  if (written !== 3208) throw new Error(`显式写入合计 ${written} != 3208(黄金钉死值)`)
  // 来源:fire-extinguishing 307 / field_thermal_live 1 / 无来源 82(缺即不造)。
  const src = new Map<string, number>()
  let none = 0
  let total = 0
  for (const f of main.frames)
    for (const d of f.deltas) {
      total += 1
      if (d.sourceSystemId) src.set(d.sourceSystemId, (src.get(d.sourceSystemId) ?? 0) + 1)
      else none += 1
    }
  if (total !== 390) throw new Error(`delta 总数 ${total} != 390`)
  if (src.get("fire-extinguishing") !== 307) throw new Error("fire-extinguishing 计数不符")
  if (src.get("field_thermal_live") !== 1) throw new Error("field_thermal_live 计数不符")
  if (none !== 82) throw new Error(`无来源 delta ${none} != 82(不得伪造来源)`)
}

export async function resolvedFrameAssertionBlocksHeadSubstitution() {
  // FRAME-01:请求帧与端点解析帧不符即拒绝(查询参数形式恒返 head 的场景)。
  let threw = false
  try {
    assertResolvedFrame(2, { tick: 6 })
  } catch (e) {
    threw = String(e).includes("FRAME_NOT_RESOLVED")
  }
  if (!threw) throw new Error("head 顶替未被拦截")
  assertResolvedFrame(2, { tick: 2 }) // 一致则放行
}

export async function runtimeCatalogDiscoversUnknownSystems() {
  // CAT-01/02/05:静态 16(硬编码 field_thermal_live 已移除)+ 运行期动态发现。
  if (NATIVE_SYSTEM_CATALOG.some((s) => s.id === "field_thermal_live"))
    throw new Error("field_thermal_live 应改为动态发现,不得硬编码")
  const imported = await loadNativeImport()
  const merged = mergeRuntimeCatalog(collectRuntimeObservations(imported.bundles))
  const staticIds = new Set(NATIVE_SYSTEM_CATALOG.map((s) => s.id))
  const live = merged.find((s) => s.id === "field_thermal_live")
  if (!live) throw new Error("运行期未发现 field_thermal_live(样例 D 缺失?)")
  if (live.phase !== "UNKNOWN") throw new Error("未知系统阶段必须 UNKNOWN,不推测")
  if (live.source !== "OBSERVED_RUNTIME" || live.confidence !== "OBSERVED")
    throw new Error("来源/置信度标注错误")
  if (live.observedCount !== 1) throw new Error("观测计数不符")
  // 已注册系统观测后保持 DECLARED 且带观测信息(CAT-03/04:同 id 归并,不串档)。
  const fire = merged.find((s) => s.id === "fire-extinguishing")!
  if (fire.source !== "REGISTERED" || fire.confidence !== "DECLARED") throw new Error("注册系统标注错误")
  if ((fire.observedCount ?? 0) < 307) throw new Error("注册系统观测计数应累计(跨运行)")
  // 运行期发现条目不进入任何静态阶段泳道(CAT-02)。
  for (const s of merged.filter((x) => x.source === "OBSERVED_RUNTIME")) {
    if (staticIds.has(s.id)) throw new Error("OBSERVED 条目不得与注册 id 重叠")
  }
  // 多运行同 id 归并为一条(collectRuntimeObservations 聚合)。
  const obs = collectRuntimeObservations(imported.bundles)
  if (obs.filter((o) => o.systemId === "fire-extinguishing").length !== 1)
    throw new Error("跨运行同 id 应聚合一档")
}

export async function importIncludesThreeRunsConsistently() {
  const imported = await loadNativeImport()
  const ids = imported.bundles.map((b) => b.runId)
  if (!ids.includes(RUN_D_ID)) throw new Error("样例 D 未进入导入")
  if (imported.seed.runs.length !== 3) throw new Error(`运行数 ${imported.seed.runs.length} != 3`)
  const nativeCommits = imported.seed.commits.filter((c) => c.source === "native-import")
  // B main 10 + C main 1 + C plan 10 + D main 6 + 场景基点 1 = 28。
  if (nativeCommits.length !== 28)
    throw new Error(`native 提交数 ${nativeCommits.length} != 28`)
}
