import { useMemo } from 'react'
import { z } from 'zod'
import type { Diagnostic } from '@/core/types'
import { loadPrototype } from '@/data/mockLoader'
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
} from '@/schema/model'
import { checkIntegrity, layoutSchema, normalizeProgram, seedParts } from '@/schema/parse'
import { getDocument, registerDocument, useDraftDocument, useDraftDocuments, type DraftDocument } from './draftRegistry'

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

export const SCHEMA_DOC = 'schema:model-05'
export const SCENE_DOC = 'scene:scene-05'
export const SYSTEMS_DOC = 'systems:model-05'
export const programDocId = (programId: string) => `program:${programId}`
export const scheduleDocId = (scheduleId: string) => `schedule:${scheduleId}`

const MODEL_VERSION = 'model-05'

/** 本地恢复与 JSON 导入共用的内容校验：不另写一份宽松版本。 */
export const programContentSchema = z
  .object({ program: seedParts.logicPrograms.element, layout: layoutSchema })
  .transform((c): ProgramContent => ({ program: normalizeProgram(c.program), layout: c.layout }))
export const scheduleContentSchema = z.object({ schedule: seedParts.schedules.element, layout: layoutSchema })

function layoutFor(documentId: string, base: PrototypeModel): EditorLayout {
  return structuredClone(base.layouts[documentId] ?? { documentId, positions: {}, viewport: { x: 0, y: 0, zoom: 1 } })
}

function toDiagnostic(d: DomainDiagnostic): Diagnostic {
  const where = [d.target?.documentId, d.target?.nodeId, d.target?.portId, d.target?.propertyId].filter(Boolean).join(' · ')
  return { id: d.id, severity: d.severity, code: d.code, message: d.message, objectLabel: where || undefined }
}

/** 跨文档引用完整性：任何一个文档的校验都以“全部当前草稿”组成的模型为准。 */
function validateComposed(): Diagnostic[] {
  return checkIntegrity(composeModel('draft')).map(toDiagnostic)
}

let registered = false

/** 惰性注册：首次调用时从规范化种子取基线，并尝试恢复各文档的本地存档。 */
export function ensureModelDocuments() {
  if (registered) return
  registered = true
  const base = loadPrototype().model
  registerDocument<SchemaContent>(SCHEMA_DOC, {
    kind: 'schema',
    label: '实体模式',
    baseVersion: MODEL_VERSION,
    baseline: () => structuredClone({ units: base.units, entityTypes: base.entityTypes, components: base.components, attributes: base.attributes, templates: base.templates }),
    restore: (raw) =>
      z
        .object({
          units: seedParts.units,
          entityTypes: seedParts.entityTypes,
          components: seedParts.componentSchemas,
          attributes: seedParts.attributeSchemas,
          templates: seedParts.entityTemplates,
        })
        .parse(raw),
    validate: validateComposed,
  })
  registerDocument<SceneDraft>(SCENE_DOC, {
    kind: 'scene',
    label: `场景 ${base.scene.id}`,
    baseVersion: MODEL_VERSION,
    baseline: () => structuredClone(base.scene),
    restore: (raw) => seedParts.sceneDraft.parse(raw),
    validate: validateComposed,
  })
  registerDocument<SystemsContent>(SYSTEMS_DOC, {
    kind: 'system',
    label: 'System 与查询',
    baseVersion: MODEL_VERSION,
    baseline: () => structuredClone({ queries: base.queries, systems: base.systems, constraints: base.constraints }),
    restore: (raw) => z.object({ queries: seedParts.queries, systems: seedParts.systems, constraints: seedParts.constraints }).parse(raw),
    validate: validateComposed,
  })
  for (const program of base.programs) {
    registerDocument<ProgramContent>(programDocId(program.id), {
      kind: 'program',
      label: `程序 ${program.id}`,
      baseVersion: `${program.id}@${program.version}`,
      baseline: () => ({ program: structuredClone(program), layout: layoutFor(program.id, base) }),
      restore: (raw) => programContentSchema.parse(raw),
      semantic: (c) => c.program,
      validate: validateComposed,
    })
  }
  for (const schedule of base.schedules) {
    registerDocument<ScheduleContent>(scheduleDocId(schedule.id), {
      kind: 'schedule',
      label: `调度 ${schedule.id}`,
      baseVersion: `${schedule.id}@${schedule.version}`,
      baseline: () => ({ schedule: structuredClone(schedule), layout: layoutFor(schedule.id, base) }),
      restore: (raw) => scheduleContentSchema.parse(raw),
      semantic: (c) => c.schedule,
      validate: validateComposed,
    })
  }
}

function contentOf<T>(documentId: string, view: 'draft' | 'saved'): T {
  const doc = getDocument<T>(documentId)
  if (!doc) throw new Error(`草稿文档 ${documentId} 未注册`)
  return view === 'draft' ? doc.content : doc.savedContent
}

/**
 * 由各文档内容组装完整模型。draft = 当前编辑内容（试算）；saved = 最近一次本地保存。
 * baseWorld 是已提交快照，不属于任何草稿文档。
 */
export function composeModel(view: 'draft' | 'saved'): PrototypeModel {
  ensureModelDocuments()
  const base = loadPrototype().model
  const schema = contentOf<SchemaContent>(SCHEMA_DOC, view)
  const systems = contentOf<SystemsContent>(SYSTEMS_DOC, view)
  const programs = base.programs.map((p) => contentOf<ProgramContent>(programDocId(p.id), view))
  const schedules = base.schedules.map((s) => contentOf<ScheduleContent>(scheduleDocId(s.id), view))
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
    layouts: Object.fromEntries([...programs, ...schedules].map((c) => [c.layout.documentId, c.layout])),
  }
}

export function useModelDocument<T>(documentId: string): DraftDocument<T> | undefined {
  ensureModelDocuments()
  return useDraftDocument<T>(documentId)
}

/** 组成模型的全部文档 id（种子决定，运行期不变）。 */
export function modelDocumentIds(): string[] {
  const base = loadPrototype().model
  return [SCHEMA_DOC, SCENE_DOC, SYSTEMS_DOC, ...base.programs.map((p) => programDocId(p.id)), ...base.schedules.map((s) => scheduleDocId(s.id))]
}

/**
 * 响应式草稿模型：任一模型文档内容变化时重新组装；只改保存 / 校验状态不会产生新模型。
 * 跨文档引用（调度 → System → 程序）都基于这一份组装结果。
 */
export function useDraftModel(): PrototypeModel {
  ensureModelDocuments()
  const docs = useDraftDocuments()
  const contents = modelDocumentIds().map((id) => docs[id]?.content)
  // 文档集合固定，依赖数组长度不变；按内容引用比较。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => composeModel('draft'), contents)
}
