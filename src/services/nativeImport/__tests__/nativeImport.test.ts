/**
 * V7-1 真实导入测试：归一化结果与 mas-rust 源工件逐项对拍（REAL-03/04/05/06/07/08/09）。
 * 证据锚点：design/04/resp/real_fixture_manifest.md（样例 A/B/C 哈希）。
 */
import {
  loadChemRoadedModel,
  loadRunB,
  loadRunC,
  RUN_B_ID,
  RUN_C_ID,
  type NativeModelFixtures,
  type RunBDiskFrame,
  type RunCRaw,
} from "../fixtures"
import {
  buildRunB,
  buildRunC,
  normalizeModel,
  type NormalizedModel,
} from "../normalize"
import {
  buildNativeSeed,
  loadNativeImport,
  nativeImportDataAdapter,
} from "../seedAdapter"
import { readOnlyImportAdapter } from "@/services/executionAdapter"
import { NATIVE_SYSTEM_CATALOG } from "../catalog"
import type { NativeRunBundle } from "../types"
import type { SeedData } from "@/mock/seed"

interface Ctx {
  modelFixtures: NativeModelFixtures
  model: NormalizedModel
  runBDisk: { runId: string; frames: RunBDiskFrame[]; branchIds: string[] }
  runCRaw: RunCRaw
  bundleB: NativeRunBundle
  bundleC: NativeRunBundle
  seed: SeedData
}

let ctx: Ctx | null = null

async function init(): Promise<Ctx> {
  if (ctx) return ctx
  const modelFixtures = await loadChemRoadedModel()
  const model = normalizeModel(modelFixtures)
  const runBDisk = await loadRunB()
  const runCRaw = await loadRunC()
  const bundleB = buildRunB(runBDisk)
  const builtC = buildRunC(runCRaw)
  const seed = buildNativeSeed(model, [bundleB, builtC.bundle])
  ctx = {
    modelFixtures,
    model,
    runBDisk,
    runCRaw,
    bundleB,
    bundleC: builtC.bundle,
    seed,
  }
  return ctx
}

export async function schemaCountsMatchSource() {
  const { model, modelFixtures } = await init()
  // REAL-03：schema 目录数量与源文件一一对应（19 archetype / 44 组件 fixture）。
  if (model.schema.entityTypes.length !== modelFixtures.archetypes.length)
    throw new Error(
      `entityTypes ${model.schema.entityTypes.length} != archetypes ${modelFixtures.archetypes.length}`,
    )
  if (model.schema.components.length !== modelFixtures.components.length)
    throw new Error("components 数与 fixture 不符")
  const declaredSimple = modelFixtures.components.reduce(
    (n, c) =>
      n +
      c.attributes.filter((a) => {
        const prefix = a.id.includes("/") ? a.id.split("/")[0] : c.id
        const simple = /^(n|b|s|u)$/.test(a.type) || /^n\[3\]$/.test(a.type)
        return prefix === c.id && simple
      }).length,
    0,
  )
  if (model.schema.attributes.length !== declaredSimple)
    throw new Error(
      `attributes ${model.schema.attributes.length} != 源可导出 ${declaredSimple}`,
    )
  // 复杂类型（元组数组/网格句柄）只登记不进值域（04 文档 §2 blockRef 规则）。
  if (model.schema.complexAttributes.length === 0)
    throw new Error("complexAttributes 不应为空")
}

export async function unitPolicyIsExplicit() {
  const { model } = await init()
  // REAL-05：登记单位（flammable/temperature °C）与 UNKNOWN 策略并存，不猜。
  const temp = model.schema.attributes.find((a) => a.id === "flammable/temperature")
  if (!temp) throw new Error("flammable/temperature 未导入")
  if (temp.type.unitId !== "degC" || temp.type.quantityKind !== "temperatureAbsolute")
    throw new Error(`温度单位映射错误：${String(temp.type.unitId)}`)
  const unknowns = model.schema.attributes.filter((a) => a.type.unitId === "unknown")
  if (unknowns.length === 0)
    throw new Error("应存在 UNKNOWN 单位属性（引擎无单位系统，未猜）")
  const unitDefs = new Set(model.schema.units.map((u) => u.id))
  for (const u of ["degC", "unknown"]) {
    if (!unitDefs.has(u)) throw new Error(`unit def 缺 ${u}`)
  }
}

export async function sceneIdentityMatchesPgRow() {
  const { model, modelFixtures } = await init()
  // REAL-03：实体稳定 ID 集合与 PG s_scene(chem-roaded) 行一致（93 实例）。
  const pgIds = new Set(modelFixtures.sceneInstances.map((i) => i.id))
  const imported = new Set(model.scene.entities.map((e) => e.id))
  if (imported.size !== 93) throw new Error(`实体数 ${imported.size} != 93`)
  for (const id of pgIds) {
    if (!imported.has(id)) throw new Error(`缺实例 ${id}`)
  }
  if (model.sceneDrift.pgCount !== 93 || model.sceneDrift.fixtureCount !== 93)
    throw new Error("对账基数不符")
  if (model.sceneDrift.pgOnly.length || model.sceneDrift.fixtureOnly.length)
    throw new Error("fixture/PG 出现意外漂移")
  const tank = model.scene.entities.find((e) => e.id === "ball_tank-1")
  if (!tank || tank.typeId !== "ball_tank") throw new Error("typeId 未原样保留")
}

export async function presenceSemanticsPreserved() {
  const { model, modelFixtures } = await init()
  // REAL-04：显式 null / 缺键 UNSET / 0 / Vec3 位置四态可辨。
  const ent = model.scene.entities.find((e) => e.id === "ambulance-1")
  if (!ent) throw new Error("ambulance-1 未导入")
  const pos = ent.initialOverrides["transform/position"]
  if (!Array.isArray(pos) || pos.length !== 3) throw new Error("位置应保留为 Vec3")
  const raw = modelFixtures.sceneInstances.find((i) => i.id === "ambulance-1")!
  for (const attr of raw.attributes) {
    if (!(attr.id in ent.initialOverrides))
      throw new Error(`实例属性 ${attr.id} 丢失（显式 null 也必须保留键）`)
  }
  // 缺键不得回填 0：overrides 键集 = 源实例属性键集，一个不多。
  const overrideCount = Object.keys(ent.initialOverrides).length
  if (overrideCount !== raw.attributes.length)
    throw new Error(`overrides ${overrideCount} != 源 ${raw.attributes.length}`)
  const nullAttr = modelFixtures.sceneInstances
    .flatMap((i) => i.attributes.map((a) => ({ id: i.id, a })))
    .find(({ a }) => a.value === null)
  if (nullAttr) {
    const target = model.scene.entities.find((e) => e.id === nullAttr.id)!
    if (target.initialOverrides[nullAttr.a.id] !== null)
      throw new Error("显式 null 未按 EXPLICIT_NULL 保留")
  }
  if (model.scene.blockAttributes.length === 0)
    throw new Error("场景对象值属性应进 blockAttributes")
}

export async function runBMatchesDiskArtifacts() {
  const { bundleB, runBDisk } = await init()
  // REAL-08（静态部分）：B 10 帧、83 实例、帧值=源 frame_data 过滤结果。
  if (bundleB.runId !== RUN_B_ID) throw new Error("runId 不符")
  const main = bundleB.branches.find((b) => b.id === "main")
  if (!main || main.frames.length !== 10) throw new Error("main 应为 10 帧")
  if (bundleB.traceCompleteness !== "PROPERTY_DELTA")
    throw new Error("B 应为 PROPERTY_DELTA")
  const f0 = main.frames[0]
  if (f0.values.size !== 83) throw new Error(`帧 0 实例数 ${f0.values.size} != 83`)
  const tank1 = f0.values.get("ball_tank-1")
  if (!tank1) throw new Error("帧 0 缺 ball_tank-1")
  const srcFrame = runBDisk.frames.find((f) => f.frame === 0)!
  const srcTank = srcFrame.frameData["ball_tank-1"]
  for (const [k, v] of Object.entries(srcTank)) {
    const imported = tank1.get(k)
    const simple =
      v === null ||
      ["number", "boolean", "string"].includes(typeof v) ||
      (Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === "number"))
    if (simple && imported !== v)
      throw new Error(`帧 0 ball_tank-1.${k} 值不符: ${String(imported)} != ${String(v)}`)
  }
  // 网格/等值线对象进 blocks，不进 values。
  const env = f0.values.get("environment")
  if (!env) throw new Error("帧 0 缺 environment")
  if (env.has("environment_radiation/radiation_matrix"))
    throw new Error("网格矩阵不得进值域")
  if (!f0.blocks.get("environment")?.has("environment_radiation/radiation_matrix"))
    throw new Error("网格矩阵应入 blocks")
  // PROPERTY_DELTA：无 sourceSystemId（缺即不造）。
  if (f0.deltas.some((d) => d.sourceSystemId))
    throw new Error("磁盘工件的 delta 不得携带伪造 sourceSystemId")
}

export async function runCMatchesPgTicks() {
  const { bundleC, runCRaw } = await init()
  // REAL-09：C 11 帧、SYSTEM_EFFECT 级（source_system_id 保留）、双分支。
  if (bundleC.runId !== RUN_C_ID) throw new Error("runId 不符")
  if (bundleC.traceCompleteness !== "SYSTEM_EFFECT")
    throw new Error("C 应为 SYSTEM_EFFECT")
  if (bundleC.executionId !== runCRaw.executionId)
    throw new Error("executionId 未保留")
  const main = bundleC.branches.find((x) => x.id === "main")
  const plan = bundleC.branches.find((x) => x.id === "plan-evacuation")
  if (!main || main.frames.length !== 1) throw new Error("main 应 1 帧")
  if (!plan || plan.frames.length !== 10) throw new Error("plan-evacuation 应 10 帧")
  if (plan.forkedFrom?.branch !== "main") throw new Error("fork 源应为 main")
  const f1 = plan.frames[0]
  if (f1.frame !== 1) throw new Error("plan 首帧应为 1")
  const srcRow = runCRaw.ticks.find(
    (t) => t.branchId === "plan-evacuation" && t.frame === 1,
  )!
  if (srcRow.deltas.length !== 203) throw new Error("源帧 1 delta 数应为 203")
  const withSource = f1.deltas.filter((d) => d.sourceSystemId)
  if (withSource.length === 0) throw new Error("source_system_id 未保留")
  const expected = srcRow.deltas.filter((d) => d.source_system_id).length
  if (withSource.length !== expected)
    throw new Error(`归因数 ${withSource.length} != 源 ${expected}`)
  const frame0 = main.frames[0]
  if (frame0.values.size === 0) throw new Error("帧 0 应含 bundle 初始实例")
}

export async function seedHasNoMockLeakage() {
  const { seed } = await init()
  // REAL-07：真实导入不得混入 F01/F02/F03/V01 等种子实体；系统/程序/查询为空（引擎无此层）。
  const ids = seed.entities.map((e) => e.id)
  for (const mockId of ["F01", "F02", "F03", "V01", "V02", "C01"]) {
    if (ids.includes(mockId)) throw new Error(`mock 实体 ${mockId} 泄入真实导入`)
  }
  if (seed.systems.length !== 0)
    throw new Error("原生系统不得伪装为 SystemDefinition")
  if (seed.queries.length !== 0 || seed.graphs.length !== 0)
    throw new Error("引擎无查询/程序层")
  if (seed.runs.length !== 2) throw new Error(`运行数 ${seed.runs.length} != 2`)
  const runIds = seed.runs.map((r) => r.id)
  if (!runIds.includes(RUN_B_ID) || !runIds.includes(RUN_C_ID))
    throw new Error("运行 id 缺失")
  // 一帧一提交：B main 10 + C main 1 + C plan 10 + 场景基点 1 = 22。
  const nativeCommits = seed.commits.filter((c) => c.source === "native-import")
  if (nativeCommits.length !== 22)
    throw new Error(`native 提交数 ${nativeCommits.length} != 22`)
  const commitIds = new Set(seed.commits.map((c) => c.id))
  for (const c of nativeCommits) {
    if (c.parentId && !commitIds.has(c.parentId))
      throw new Error(`提交 ${c.id} 的父 ${c.parentId} 缺失`)
  }
  const worldIds = new Set(seed.worlds.map((w) => w.commitId))
  for (const c of nativeCommits) {
    if (!worldIds.has(c.id) && !c.summary.includes("fork 基点"))
      throw new Error(`提交 ${c.id} 无世界快照`)
  }
}

export async function nativeAdapterIsTheDataSource() {
  // REAL-07：adapter 名与 project 标识必须是原生导入，而非种子。
  const loaded = await nativeImportDataAdapter.load()
  if (loaded.project.id !== "native-import")
    throw new Error(`project.id 应为 native-import，得到 ${loaded.project.id}`)
  if (!nativeImportDataAdapter.label.includes("REAL_IMPORT_READ_ONLY"))
    throw new Error("adapter label 应标注 REAL_IMPORT_READ_ONLY")
  if (loaded.project.description.includes("mas-rust") !== true)
    throw new Error("project 描述应含来源系统")
}

export async function readOnlyAdapterRejectsSettle() {
  // REAL-07/12：只读模式 settle 一律拒绝，绝不静默执行。
  const result = await readOnlyImportAdapter.settle({
    runId: RUN_B_ID,
    branchId: "sBwT4d/main",
    baseCommit: "nat-sBwT4d-main-f000000",
    idempotencyKey: "test",
  })
  if (result.ok) throw new Error("只读适配器不得 settle 成功")
  if (result.diagnostic.code !== "REAL_READ_ONLY")
    throw new Error("应返回 REAL_READ_ONLY")
}

export async function catalogIsWellFormed() {
  if (NATIVE_SYSTEM_CATALOG.length < 16) throw new Error("系统目录应至少 16 项")
  const ids = new Set(NATIVE_SYSTEM_CATALOG.map((s) => s.id))
  for (const must of ["combustion", "radiation-diffusion", "sprinkler", "mobile"]) {
    if (!ids.has(must)) throw new Error(`目录缺 ${must}`)
  }
  for (const s of NATIVE_SYSTEM_CATALOG) {
    if (!s.sClass.startsWith("S")) throw new Error("分级非法")
  }
}

export async function fullImportPipelineIsConsistent() {
  // 端到端：loadNativeImport 一次装配，prototype 基线与 seed 同源一致。
  const imported = await loadNativeImport()
  if (imported.prototype.scene.entities.length !== imported.seed.entities.length)
    throw new Error("prototype 与 seed 实体数不一致")
  if (imported.prototype.systems.length !== 0 || imported.prototype.queries.length !== 0)
    throw new Error("prototype 不得含伪造 systems/queries")
  const baseWorldCommit = imported.prototype.baseWorld.commitId
  if (!imported.seed.commits.some((c) => c.id === baseWorldCommit))
    throw new Error("baseWorld 提交未入 seed")
}
