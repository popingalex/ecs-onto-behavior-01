import { useMemo, useRef } from "react"
import { z } from "zod"
import type { Diagnostic } from "@/core/types"
import { loadPrototype } from "@/data/mockLoader"
import type {
  AttributeSchema,
  ComponentSchema,
  ConstraintDef,
  DomainDiagnostic,
  EditorLayout,
  EntityQuery,
  EntityTemplate,
  EntityTypeDef,
  LogicGraphDocument,
  PrototypeModel,
  SceneDraft,
  ScheduleDocument,
  SystemDefinition,
  UnitDef,
} from "@/schema/model"
import {
  checkIntegrity,
  layoutSchema,
  normalizeProgram,
  seedParts,
} from "@/schema/parse"
import {
  applyEdit,
  getDocument,
  registerDocument,
  saveDocument,
  useDraftDocument,
  useDraftDocuments,
  type DraftDocument,
} from "./draftRegistry"

/**
 * v0.5 模型的草稿文档划分。每类对象只归一个文档，页面只改自己负责的文档：
 * schema（P02/P03/P05/P29）· scene（P08）· systems（P10/P11）· program:<id>（P14）· schedule:<id>（P12）。
 * 布局与语义同存一个文档，但不参与语义哈希。
 */
export interface SchemaContent {
  units: UnitDef[]
  entityTypes: EntityTypeDef[]
  components: ComponentSchema[]
  attributes: AttributeSchema[]
  templates: EntityTemplate[]
}
export interface SystemsContent {
  queries: EntityQuery[]
  systems: SystemDefinition[]
  constraints: ConstraintDef[]
}
export interface ProgramContent {
  program: LogicGraphDocument
  layout: EditorLayout
}
export interface ScheduleContent {
  schedule: ScheduleDocument
  layout: EditorLayout
}

export const SCHEMA_DOC = "schema:model-05"
export const SCENE_DOC = "scene:scene-05"
export const SYSTEMS_DOC = "systems:model-05"
export const programDocId = (programId: string) => `program:${programId}`
export const scheduleDocId = (scheduleId: string) => `schedule:${scheduleId}`

const MODEL_VERSION = "model-05"

/**
 * V7-1 原生只读基线：REAL_IMPORT_READ_ONLY 模式下由 loadWorkbench 在
 * ensureModelDocuments 之前注入（loadNativeImport 归一化产物）。
 * baseVersion 随之切换为 native-import-1@<rev>，使 localStorage 里
 * mock 存档因版本不符被拒（跨模式草稿互不污染）。
 */
let baselineOverride: PrototypeModel | null = null

export function setBaselineOverride(loader: () => PrototypeModel): void {
  baselineOverride = structuredClone(loader())
}

function baseline(): PrototypeModel {
  return baselineOverride ?? loadPrototype().model
}

function baselineVersion(): string {
  return baselineOverride ? baselineOverride.schemaVersion : MODEL_VERSION
}

/** 本地恢复与 JSON 导入共用的内容校验：不另写一份宽松版本。 */
export const programContentSchema = z
  .object({ program: seedParts.logicPrograms.element, layout: layoutSchema })
  .transform(
    (c): ProgramContent => ({
      program: normalizeProgram(c.program),
      layout: c.layout,
    }),
  )
export const scheduleContentSchema = z.object({
  schedule: seedParts.schedules.element,
  layout: layoutSchema,
})

function layoutFor(documentId: string, base: PrototypeModel): EditorLayout {
  return structuredClone(
    base.layouts[documentId] ?? {
      documentId,
      positions: {},
      viewport: { x: 0, y: 0, zoom: 1 },
    },
  )
}

function toDiagnostic(d: DomainDiagnostic): Diagnostic {
  const where = [
    d.target?.documentId,
    d.target?.nodeId,
    d.target?.portId,
    d.target?.propertyId,
  ]
    .filter(Boolean)
    .join(" · ")
  return {
    id: d.id,
    severity: d.severity,
    code: d.code,
    message: d.message,
    objectLabel: where || undefined,
  }
}

/** 跨文档引用完整性：任何一个文档的校验都以“全部当前草稿”组成的模型为准。 */
function validateComposed(): Diagnostic[] {
  return checkIntegrity(composeModel("draft")).map(toDiagnostic)
}

let registered = false

/**
 * 用户在 P30 新建 / 复制的程序不属于种子，索引持久化在 localStorage，
 * 刷新后 ensureModelDocuments 依索引重新注册（草稿内容仍走各文档自己的存档键）。
 */
const PROGRAM_INDEX_KEY = "ecs-workbench.program-index.v1"
export interface ProgramIndexEntry {
  id: string
  version: string
  scopeType: string
}
const extraPrograms: ProgramIndexEntry[] = []

function programIndexStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage
  } catch {
    return null
  }
}

function loadProgramIndex(): ProgramIndexEntry[] {
  try {
    const raw = programIndexStorage()?.getItem(PROGRAM_INDEX_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as { programs?: ProgramIndexEntry[] }
    return Array.isArray(parsed.programs)
      ? parsed.programs.filter(
          (p) =>
            p && typeof p.id === "string" && typeof p.scopeType === "string",
        )
      : []
  } catch {
    return []
  }
}

function persistProgramIndex() {
  try {
    programIndexStorage()?.setItem(
      PROGRAM_INDEX_KEY,
      JSON.stringify({ format: "program-index/1", programs: extraPrograms }),
    )
  } catch {
    // 存储不可用时只影响刷新后的再注册，内存中仍可用。
  }
}

function emptyLayoutFor(documentId: string): EditorLayout {
  return { documentId, positions: {}, viewport: { x: 0, y: 0, zoom: 1 } }
}

function registerProgramDocument(
  base: PrototypeModel,
  entry: ProgramIndexEntry,
  baselineProgram?: LogicGraphDocument,
): DraftDocument<ProgramContent> {
  return registerDocument<ProgramContent>(programDocId(entry.id), {
    kind: "program",
    label: `程序 ${entry.id}`,
    baseVersion: `${entry.id}@${entry.version}`,
    baseline: () => ({
      program: baselineProgram
        ? structuredClone(baselineProgram)
        : {
            id: entry.id,
            version: entry.version,
            kind: "entity-program" as const,
            scopeType: entry.scopeType,
            parameters: [],
            nodes: [],
            edges: [],
          },
      layout: base.layouts[entry.id]
        ? structuredClone(base.layouts[entry.id])
        : emptyLayoutFor(entry.id),
    }),
    restore: (raw) => programContentSchema.parse(raw),
    semantic: (c) => c.program,
    validate: validateComposed,
  })
}

/** 全部程序文档 id：种子程序在前，用户程序按创建顺序在后。 */
export function programDocumentIds(): string[] {
  const base = baseline()
  return [
    ...base.programs.map((p) => p.id),
    ...extraPrograms.map((p) => p.id),
  ]
}

/**
 * 确保 programId 对应的草稿文档已注册：种子程序直接取；
 * 用户程序按索引条目注册（baselineProgram 可给出非空基线，如复制来源）。
 */
export function ensureProgramDocument(
  entry: ProgramIndexEntry,
  baselineProgram?: LogicGraphDocument,
): DraftDocument<ProgramContent> {
  ensureModelDocuments()
  const existing = getDocument<ProgramContent>(programDocId(entry.id))
  if (existing) return existing
  const base = loadPrototype().model
  const doc = registerProgramDocument(base, entry, baselineProgram)
  if (!extraPrograms.some((p) => p.id === entry.id)) {
    extraPrograms.push({ ...entry })
    persistProgramIndex()
  }
  return doc
}

/** 新建空程序并立即本地保存（刷新后仍在）；返回新程序 id。 */
export function createProgramDocument(scopeType: string): string {
  if (baselineOverride)
    throw new Error("REAL_IMPORT_READ_ONLY：真实只读导入模式下不能新建程序。")
  ensureModelDocuments()
  let i = 1
  let id = `g-new-${i}`
  while (
    loadPrototype().model.programs.some((p) => p.id === id) ||
    extraPrograms.some((p) => p.id === id)
  )
    id = `g-new-${++i}`
  const doc = ensureProgramDocument({ id, version: "v1", scopeType })
  void saveDocument(doc.documentId)
  return id
}

/** 复制程序当前草稿内容为新程序文档；立即本地保存。返回新程序 id。 */
export function duplicateProgramDocument(sourceProgramId: string): string {
  if (baselineOverride)
    throw new Error("REAL_IMPORT_READ_ONLY：真实只读导入模式下不能复制程序。")
  ensureModelDocuments()
  const source = getDocument<ProgramContent>(programDocId(sourceProgramId))
  if (!source) throw new Error(`程序 ${sourceProgramId} 未注册`)
  let i = 1
  let id = `${sourceProgramId}-copy-${i}`
  while (
    loadPrototype().model.programs.some((p) => p.id === id) ||
    extraPrograms.some((p) => p.id === id)
  )
    id = `${sourceProgramId}-copy-${++i}`
  const copy: LogicGraphDocument = {
    ...structuredClone(source.content.program),
    id,
    version: "v1",
  }
  const doc = ensureProgramDocument(
    { id, version: copy.version, scopeType: copy.scopeType },
    copy,
  )
  // 布局跟随来源（documentId 换成新文档），位置不参与语义哈希。
  applyEdit(doc.documentId, `复制程序 ${sourceProgramId}`, () => ({
    program: structuredClone(copy),
    layout: {
      ...structuredClone(source.content.layout),
      documentId: id,
    },
  }))
  void saveDocument(doc.documentId)
  return id
}

/** 惰性注册：首次调用时从规范化种子取基线，并尝试恢复各文档的本地存档。 */
export function ensureModelDocuments() {
  if (registered) return
  registered = true
  const base = baseline()
  const version = baselineVersion()
  registerDocument<SchemaContent>(SCHEMA_DOC, {
    kind: "schema",
    label: "实体模式",
    baseVersion: version,
    baseline: () =>
      structuredClone({
        units: base.units,
        entityTypes: base.entityTypes,
        components: base.components,
        attributes: base.attributes,
        templates: base.templates,
      }),
    restore: (raw) =>
      z.object({
        units: seedParts.units,
        entityTypes: seedParts.entityTypes,
        components: seedParts.componentSchemas,
        attributes: seedParts.attributeSchemas,
        templates: seedParts.entityTemplates,
      }).parse(raw),
    validate: validateComposed,
  })
  registerDocument<SceneDraft>(SCENE_DOC, {
    kind: "scene",
    label: `场景 ${base.scene.id}`,
    baseVersion: version,
    baseline: () => structuredClone(base.scene),
    restore: (raw) => seedParts.sceneDraft.parse(raw),
    validate: validateComposed,
  })
  registerDocument<SystemsContent>(SYSTEMS_DOC, {
    kind: "system",
    label: "System 与查询",
    baseVersion: version,
    baseline: () =>
      structuredClone({
        queries: base.queries,
        systems: base.systems,
        constraints: base.constraints,
      }),
    restore: (raw) =>
      z.object({
        queries: seedParts.queries,
        systems: seedParts.systems,
        constraints: seedParts.constraints,
      }).parse(raw),
    validate: validateComposed,
  })
  for (const program of base.programs) {
    registerProgramDocument(
      base,
      { id: program.id, version: program.version, scopeType: program.scopeType },
      structuredClone(program),
    )
  }
  for (const schedule of base.schedules) {
    registerDocument<ScheduleContent>(scheduleDocId(schedule.id), {
      kind: "schedule",
      label: `调度 ${schedule.id}`,
      baseVersion: `${schedule.id}@${schedule.version}`,
      baseline: () => ({
        schedule: structuredClone(schedule),
        layout: layoutFor(schedule.id, base),
      }),
      restore: (raw) => scheduleContentSchema.parse(raw),
      semantic: (c) => c.schedule,
      validate: validateComposed,
    })
  }
  // 用户程序（P30 新建 / 复制）：按持久化索引重新注册，内容从各自存档恢复。
  // 原生只读模式跳过：mock 用户程序不得混入真实导入（REAL-07）。
  const seedProgramIds = new Set(base.programs.map((p) => p.id))
  if (!baselineOverride) {
    for (const entry of loadProgramIndex()) {
      if (seedProgramIds.has(entry.id)) continue
      registerProgramDocument(base, entry)
      if (!extraPrograms.some((p) => p.id === entry.id)) extraPrograms.push(entry)
    }
  }
}

function contentOf<T>(documentId: string, view: "draft" | "saved"): T {
  const doc = getDocument<T>(documentId)
  if (!doc) throw new Error(`草稿文档 ${documentId} 未注册`)
  return view === "draft" ? doc.content : doc.savedContent
}

/**
 * 由各文档内容组装完整模型。draft = 当前编辑内容（试算）；saved = 最近一次本地保存。
 * baseWorld 是已提交快照，不属于任何草稿文档。
 */
export function composeModel(view: "draft" | "saved"): PrototypeModel {
  ensureModelDocuments()
  const base = baseline()
  const schema = contentOf<SchemaContent>(SCHEMA_DOC, view)
  const systems = contentOf<SystemsContent>(SYSTEMS_DOC, view)
  const programs = programDocumentIds().map((id) =>
    contentOf<ProgramContent>(programDocId(id), view),
  )
  const schedules = base.schedules.map((s) =>
    contentOf<ScheduleContent>(scheduleDocId(s.id), view),
  )
  return {
    schemaVersion: base.schemaVersion,
    scope: base.scope,
    units: schema.units,
    entityTypes: schema.entityTypes,
    components: schema.components,
    attributes: schema.attributes,
    templates: schema.templates,
    scene: contentOf<SceneDraft>(SCENE_DOC, view),
    queries: systems.queries,
    programs: programs.map((c) => c.program),
    systems: systems.systems,
    schedules: schedules.map((c) => c.schedule),
    constraints: systems.constraints,
    baseWorld: base.baseWorld,
    layouts: Object.fromEntries(
      [...programs, ...schedules].map((c) => [c.layout.documentId, c.layout]),
    ),
  }
}

export function useModelDocument<T>(
  documentId: string,
): DraftDocument<T> | undefined {
  ensureModelDocuments()
  return useDraftDocument<T>(documentId)
}

/** 组成模型的全部文档 id（种子 + 程序索引里的用户程序）。 */
export function modelDocumentIds(): string[] {
  const base = baseline()
  return [
    SCHEMA_DOC,
    SCENE_DOC,
    SYSTEMS_DOC,
    ...programDocumentIds().map(programDocId),
    ...base.schedules.map((s) => scheduleDocId(s.id)),
  ]
}

/**
 * 响应式草稿模型：任一模型文档内容变化时重新组装；只改保存 / 校验状态不会产生新模型。
 * 跨文档引用（调度 → System → 程序）都基于这一份组装结果。
 * 文档集合可随 P30 新建 / 复制程序增长，依赖按内容引用逐个比较，不定长。
 */
export function useDraftModel(): PrototypeModel {
  ensureModelDocuments()
  const docs = useDraftDocuments()
  const contents = modelDocumentIds().map((id) => docs[id]?.content)
  const compared = useRef<unknown[]>([])
  if (
    compared.current.length !== contents.length ||
    contents.some((c, i) => c !== compared.current[i])
  )
    compared.current = contents
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => composeModel("draft"), [compared.current])
}
