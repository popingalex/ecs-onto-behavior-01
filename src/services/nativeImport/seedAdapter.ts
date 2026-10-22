import type {
  BundleDef,
  ClassDef,
  CommitDef,
  EntityDef,
  PropertyDef,
  RunDef,
  BranchDef,
  WorldSnapshot,
} from "@/core/types"
import type { SeedData } from "@/mock/seed"
import type { DataAdapter } from "@/data/adapter"
import type { PrototypeModel, RawValue } from "@/schema/model"
import {
  loadChemRoadedModel,
  loadRunB,
  loadRunC,
  loadRunD,
} from "./fixtures"
import {
  buildRunB,
  buildRunC,
  normalizeModel,
  toPrototypeModel,
  type NormalizedModel,
} from "./normalize"
import type { NativeRunBundle } from "./types"
import { NATIVE_CAPABILITY } from "./catalog"

/**
 * REAL_IMPORT_READ_ONLY 数据源：装载 mas-rust 离线工件并归一化为工作台 SeedData。
 * 失败即抛错（loadWorkbench 收进 error 状态，绝不回落 F01/F02/F03 种子 —— REAL-07）。
 */

export interface NativeImport {
  model: NormalizedModel
  bundles: NativeRunBundle[]
  /** 草稿基线（P02/P03/P05/P08 只读渲染用）。 */
  prototype: PrototypeModel
  seed: SeedData
  capability: typeof NATIVE_CAPABILITY
}

/** 帧值 Map → WorldSnapshot.values。 */
function frameToValues(
  values: Map<string, Map<string, RawValue>>,
): Record<string, Record<string, RawValue>> {
  const out: Record<string, Record<string, RawValue>> = {}
  for (const [instId, attrs] of values) {
    out[instId] = Object.fromEntries(attrs)
  }
  return out
}

function runShort(runId: string): string {
  return runId.slice(0, 6)
}

function commitIdOf(bundle: NativeRunBundle, branchId: string, frame: number): string {
  return `nat-${runShort(bundle.runId)}-${branchId}-f${String(frame).padStart(6, "0")}`
}

/** 一帧 = 一提交（04 文档 §4 映射；stepSeconds=1，帧号即回合号/时间）。 */
function bundleToSeedRows(bundle: NativeRunBundle): {
  run: RunDef
  branches: BranchDef[]
  commits: CommitDef[]
  worlds: WorldSnapshot[]
} {
  const run: RunDef = {
    id: bundle.runId,
    label: `${bundle.sceneId} · 原生运行 ${runShort(bundle.runId)}`,
    bundleId: "native-import",
    stepSeconds: 1,
    playbackSeconds: 1,
    runtime: "server",
  }
  const branches: BranchDef[] = []
  const commits: CommitDef[] = []
  const worlds: WorldSnapshot[] = []
  for (const branch of bundle.branches) {
    const branchId = `${runShort(bundle.runId)}/${branch.id}`
    const forkBase = branch.forkedFrom
      ? commitIdOf(bundle, branch.forkedFrom.branch, branch.forkedFrom.frame)
      : null
    // fork 基点提交属于 main 分支链；若 fork 基帧不在 main 帧序列中（样例缺口），仍指向其 id。
    if (forkBase && !commits.some((c) => c.id === forkBase)) {
      commits.push({
        id: forkBase,
        runId: run.id,
        branchId: `${runShort(bundle.runId)}/${branch.forkedFrom!.branch}`,
        parentId: null,
        round: branch.forkedFrom!.frame,
        simTime: branch.forkedFrom!.frame,
        summary: `原生 fork 基点（branches jsonb 未随样例导出，精确基帧为缺口）`,
        checkpoint: true,
        source: "native-import",
      })
    }
    // 帧链：fork 分支首帧的父 = fork 基点提交。
    for (let i = 0; i < branch.frames.length; i++) {
      const f = branch.frames[i]
      const id = commitIdOf(bundle, branch.id, f.frame)
      const parent = i === 0
        ? forkBase ?? null
        : commitIdOf(bundle, branch.id, branch.frames[i - 1].frame)
      commits.push({
        id,
        runId: run.id,
        branchId,
        parentId: parent,
        round: f.frame,
        simTime: f.frame,
        summary: `原生帧 ${f.frame} · ${f.deltas.length} 条 delta · ${f.meta?.source ?? ""}`.trim(),
        checkpoint: f.frame === 0 && branch.id === "main",
        source: "native-import",
      })
      worlds.push({
        commitId: id,
        simTime: f.frame,
        values: frameToValues(f.values),
      })
    }
    const head = branch.frames.length
      ? commitIdOf(bundle, branch.id, bundle.heads[branch.id] ?? branch.frames[branch.frames.length - 1].frame)
      : forkBase ?? "unknown"
    branches.push({
      id: branchId,
      runId: run.id,
      label: `${runShort(bundle.runId)} / ${branch.id}`,
      baseCommit: forkBase,
      headCommit: head,
      visibility: "shared",
    })
  }
  return { run, branches, commits, worlds }
}

export function buildNativeSeed(model: NormalizedModel, bundles: NativeRunBundle[]): SeedData {
  const { schema, scene } = model
  const entities: EntityDef[] = scene.entities.map((e) => ({
    id: e.id,
    label: e.label,
    classId: e.typeId,
    templateRef: null,
    components: e.componentInstances.map((ci) => ci.schemaRef.id),
  }))
  const properties: PropertyDef[] = schema.attributes.map((a) => ({
    id: a.id,
    componentId: a.componentId,
    label: a.label,
    shape: a.type.shape,
    primitive: a.type.primitive,
    unitId: a.type.unitId ?? null,
    nullable: a.type.nullable,
    default: a.default,
    writeMode: a.writeMode,
    reducer: undefined,
    description: `原生导入（mas-rust）· 组件 ${a.componentId}；单位 ${
      a.type.unitId === "unknown" ? "未知（引擎无单位系统，未猜）" : a.type.unitId
    }。`,
  }))
  const classes: ClassDef[] = schema.entityTypes.map((t) => ({
    id: t.id,
    label: t.label,
    parent: t.parent ?? null,
    components: [...t.requiredComponentIds, ...t.optionalComponentIds],
    requiredComponents: t.requiredComponentIds,
    optionalComponents: t.optionalComponentIds,
  }))

  const runs: RunDef[] = []
  const branches: BranchDef[] = []
  const commits: CommitDef[] = []
  const worlds: WorldSnapshot[] = []
  for (const bundle of bundles) {
    const rows = bundleToSeedRows(bundle)
    runs.push(rows.run)
    branches.push(...rows.branches)
    commits.push(...rows.commits)
    worlds.push(...rows.worlds)
  }
  commits.sort((a, b) => a.id.localeCompare(b.id))

  // 基础世界：A 场景（chem-roaded 93 实例）初值 —— 场景级 c0 供 P26/树展示场景起点。
  const sceneWorldCommit = "nat-scene-chem-roaded-base"
  const baseWorld = worldOfScene(model)
  return {
    project: {
      id: "native-import",
      label: "真实数据只读导入",
      description: `mas-rust@${NATIVE_CAPABILITY.sourceRevision} 离线工件 · REAL_IMPORT_READ_ONLY`,
    },
    quantities: [...new Set(schema.units.map((u) => u.quantityKind))].map((id) => ({
      id,
      label: id === "unknown" ? "未知量种（引擎无单位系统）" : id,
    })),
    units: schema.units.map((u) => ({
      id: u.id,
      symbol: u.symbol,
      label: u.id === "unknown" ? "未知单位" : u.id,
      quantityId: u.quantityKind,
    })),
    components: schema.components.map((c) => ({
      id: c.id,
      label: c.label,
      description: `原生组件 · ${c.propertyIds.length} 个可导入属性；复杂类型属性 ${
        schema.complexAttributes.filter((x) => x.componentId === c.id).length
      } 个仅登记。`,
    })),
    properties,
    classes,
    templates: [],
    sceneTemplates: [],
    scenes: [{ id: scene.sceneId, version: "native-1", label: "危化品火灾-路网场景（PG 权威）" }],
    assets: [],
    entities,
    queries: [],
    graphs: [],
    systems: [],
    schedules: [],
    constraints: [],
    policies: [],
    tasks: [],
    events: [],
    bundles: [{ id: "native-import", label: "mas-rust 只读导入包", revision: 1 } satisfies BundleDef],
    runs,
    branches: [
      ...branches,
      {
        id: "native/scene",
        runId: runs[0]?.id ?? "native-scene",
        label: "场景初值（chem-roaded）",
        baseCommit: null,
        headCommit: sceneWorldCommit,
        visibility: "shared",
      },
    ],
    commits: [
      {
        id: sceneWorldCommit,
        runId: runs[0]?.id ?? "native-scene",
        branchId: "native/scene",
        parentId: null,
        round: 0,
        simTime: 0,
        summary: `场景初值 · chem-roaded · ${entities.length} 实例（PG s_scene 权威）`,
        checkpoint: true,
        source: "native-import",
      },
      ...commits,
    ],
    worlds: [baseWorld, ...worlds],
  }

  function worldOfScene(m: NormalizedModel): WorldSnapshot {
    const values: Record<string, Record<string, RawValue>> = {}
    for (const e of m.scene.entities) values[e.id] = { ...e.initialOverrides }
    return { commitId: sceneWorldCommit, simTime: 0, values }
  }
}

let cachedImport: NativeImport | null = null

/** 原生导入结果（数据就绪后可用；未就绪返回 null，由 UI 显示加载/错误状态）。 */
export function getNativeImport(): NativeImport | null {
  return cachedImport
}

export async function loadNativeImport(): Promise<NativeImport> {
  if (cachedImport) return cachedImport
  const modelFixtures = await loadChemRoadedModel()
  const model = normalizeModel(modelFixtures)
  const [runBDisk, runCRaw, runDRaw] = await Promise.all([
    loadRunB(),
    loadRunC(),
    loadRunD(),
  ])
  const bundleB = buildRunB(runBDisk)
  const built = buildRunC(runCRaw)
  const builtD = buildRunC(runDRaw)
  const bundles = [bundleB, built.bundle, builtD.bundle]
  const seed = buildNativeSeed(model, bundles)
  const sceneWorldCommit = "nat-scene-chem-roaded-base"
  const baseValues: Record<string, Record<string, RawValue>> = {}
  for (const e of model.scene.entities) baseValues[e.id] = { ...e.initialOverrides }
  const prototype = toPrototypeModel(model.schema, model.scene, {
    commitId: sceneWorldCommit,
    simTime: 0,
    values: baseValues,
  })
  cachedImport = {
    model,
    bundles,
    prototype,
    seed,
    capability: NATIVE_CAPABILITY,
  }
  return cachedImport
}

export const nativeImportDataAdapter: DataAdapter = {
  name: "native-import",
  label: `真实只读导入 · mas-rust@${NATIVE_CAPABILITY.sourceRevision}（REAL_IMPORT_READ_ONLY）`,
  async load() {
    const imported = await loadNativeImport()
    return imported.seed
  },
}
