import {
  fixtureArchetypeSchema,
  fixtureComponentSchema,
  fixtureInstanceSchema,
  type FixtureArchetype,
  type FixtureComponent,
  type FixtureInstance,
} from "./types"

/**
 * 样例工件装载（懒加载：仅在 REAL_IMPORT_READ_ONLY 模式触发导入时才取数）。
 * 来源与校验和见 design/04/resp/real_fixture_manifest.md。
 */
const globJson = import.meta.glob<{ default: unknown }>(
  "../../testdata/native/**/*.json",
)

async function loadJson<T>(path: string): Promise<T> {
  const load = globJson[`../../testdata/native/${path}`]
  if (!load) {
    throw new Error(`真实导入样例缺文件：testdata/native/${path}（REAL-07：不回退 mock）`)
  }
  const mod = await load()
  return mod.default as T
}

export interface NativeModelFixtures {
  archetypes: FixtureArchetype[]
  components: FixtureComponent[]
  /** PG s_scene(chem-roaded).instances：场景权威（93 实例）。 */
  sceneInstances: FixtureInstance[]
  sceneInstancesSource: "pg:s_scene:chem-roaded"
  /** fixtures/chem-roaded/instances/*.json 合并（93 实例，用于与 PG 对账）。 */
  fixtureInstances: FixtureInstance[]
}

async function loadArray<T>(paths: string[], parse: (raw: unknown) => T): Promise<T[]> {
  const out: T[] = []
  for (const p of paths) {
    const raw = await loadJson<unknown>(p)
    out.push(...(Array.isArray(raw) ? raw.map(parse) : [parse(raw)]))
  }
  return out
}

const parseArchetype = (raw: unknown) => fixtureArchetypeSchema.parse(raw)
const parseComponent = (raw: unknown) => fixtureComponentSchema.parse(raw)
const parseInstance = (raw: unknown) => fixtureInstanceSchema.parse(raw)

export async function loadChemRoadedModel(): Promise<NativeModelFixtures> {
  const keys = Object.keys(globJson)
  const rel = (k: string) => k.replace("../../testdata/native/", "")
  const entityFiles = keys.filter(
    (k) => k.includes("/chem-roaded/shared/entities/") && k.endsWith(".json"),
  )
  const componentFiles = keys.filter(
    (k) => k.includes("/chem-roaded/shared/components/") && k.endsWith(".json"),
  )
  const fixtureInstanceFiles = keys.filter((k) =>
    k.includes("/chem-roaded/instances/") && k.endsWith(".json"),
  )
  if (entityFiles.length === 0 || componentFiles.length === 0)
    throw new Error("真实导入样例缺 schema 目录（shared/entities|components 为空；REAL-07：不回退 mock）")
  const sceneRow = await loadJson<{
    id: string
    name: string
    instances: unknown
  }>("chem-roaded/scene-pg.json")
  const sceneInstances = (sceneRow.instances as unknown[]).map(parseInstance)
  return {
    archetypes: await loadArray(entityFiles.map(rel), parseArchetype),
    components: await loadArray(componentFiles.map(rel), parseComponent),
    sceneInstances,
    sceneInstancesSource: "pg:s_scene:chem-roaded",
    fixtureInstances: await loadArray(fixtureInstanceFiles.map(rel), parseInstance),
  }
}

// ---------- 运行样例 B（磁盘工件，PROPERTY_DELTA 级） ----------

export const RUN_B_ID = "sBwT4d6RsTuGGHPIgu1L3"

export interface RunBDiskFrame {
  frame: number
  frameData: Record<string, Record<string, unknown>>
  attributeDeltas: Array<{
    instanceId: string
    id: string
    after: unknown
    branch: string
    tick: number
  }>
  meta: unknown
}

export async function loadRunB(): Promise<{
  runId: string
  frames: RunBDiskFrame[]
  branchIds: string[]
}> {
  const keys = Object.keys(globJson)
    .map((k) => k.replace("../../testdata/native/", ""))
    .filter((k) => k.startsWith(`runs/${RUN_B_ID}/branch-`))
  const branchIds = [
    ...new Set(
      keys
        .map((k) => /^runs\/[^/]+\/(branch-[^/]+)\//.exec(k)?.[1])
        .filter((b): b is string => Boolean(b)),
    ),
  ]
  const frameNums = [
    ...new Set(
      keys
        .map((k) => /frame-(\d{6})\//.exec(k)?.[1])
        .filter((f): f is string => Boolean(f)),
    ),
  ].sort()
  const frames: RunBDiskFrame[] = []
  for (const branch of branchIds) {
    for (const f of frameNums) {
      const base = `runs/${RUN_B_ID}/${branch}/frame-${f}`
      const has = keys.some((k) => k.startsWith(`${base}/frame_data.json`))
      if (!has) continue
      const frameData = await loadJson<Record<string, Record<string, unknown>>>(
        `${base}/frame_data.json`,
      )
      const attributeDeltas = await loadJson<RunBDiskFrame["attributeDeltas"]>(
        `${base}/attribute_deltas.json`,
      )
      const meta = await loadJson<unknown>(`${base}/meta.json`)
      frames.push({ frame: Number(f), frameData, attributeDeltas, meta })
    }
  }
  if (frames.length === 0)
    throw new Error(`真实运行样例 ${RUN_B_ID} 无帧工件（REAL-07：不回退 mock）`)
  return { runId: RUN_B_ID, frames, branchIds }
}

// ---------- 运行样例 C（PG ticks + bundle，SYSTEM_EFFECT 级） ----------

export const RUN_C_ID = "4blIyLeuvJG-71gggXWcn"

export interface RunCRawTickDelta {
  attribute: string
  frame_layer?: string
  instance_id: string
  source_system_id?: string
  value: unknown
}

export interface RunCRaw {
  runId: string
  executionId: string | null
  sceneId: string
  bundle: {
    scene: { id: string; name?: string; instances: unknown }
    entities: unknown
    components: unknown
  }
  ticks: Array<{
    executionId?: string
    branchId: string
    frame: number
    revision?: number
    requestId?: string
    deltas: RunCRawTickDelta[]
  }>
}

export async function loadRunC(): Promise<RunCRaw> {
  const run = await loadJson<{ executionId?: string }>(`runs/${RUN_C_ID}/run.json`)
  const sceneInfo = await loadJson<{ sceneId?: string }>(
    `runs/${RUN_C_ID}/scene_info.json`,
  )
  const bundle = await loadJson<RunCRaw["bundle"]>(`runs/${RUN_C_ID}/bundle.json`)
  const ticks = await loadJson<RunCRaw["ticks"]>(`runs/${RUN_C_ID}/ticks.json`)
  if (!Array.isArray(ticks) || ticks.length === 0)
    throw new Error(`真实运行样例 ${RUN_C_ID} 无 tick 行（REAL-07：不回退 mock）`)
  return {
    runId: RUN_C_ID,
    executionId: run.executionId ?? null,
    sceneId: sceneInfo.sceneId ?? bundle.scene.id,
    bundle,
    ticks,
  }
}
