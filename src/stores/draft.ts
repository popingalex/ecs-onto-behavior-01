import { z } from 'zod'
import type { Diagnostic, DraftCommand } from '@/core/types'
import { getIndex } from '@/data/store'
import { useSyncExternalStore } from 'react'
import { useStore } from '@/lib/store'
import { validateModel, type DraftOverlay } from '@/services/coreValidation'
import {
  anyDocumentDirty,
  applyEdit,
  discardAllDocuments,
  discardDocument,
  draftRegistry,
  getDocument,
  isDocumentDirty,
  redoDocument,
  registerDocument,
  saveAllDocuments,
  saveDocument,
  undoDocument,
  validateDocument,
  type DocumentKind,
  type DraftDocument,
  type HistoryEntry,
} from './draftRegistry'
import { toast } from './toast'

/**
 * 旧 DraftStore API 的兼容层。真实状态在 draftRegistry（按 documentId 隔离）；
 * 这里把“当前编辑焦点文档”投影成旧的 DraftState 形状，并把旧的属性覆盖层登记为文档 model-draft。
 */
export const LEGACY_DRAFT_ID = 'model-draft'

/** 已发布元数据：与草稿 revision 无关。 */
export const PUBLISHED = { bundleId: 'bundle-04', modelVersion: 'model-05' } as const

registerDocument<DraftOverlay>(LEGACY_DRAFT_ID, {
  kind: 'legacy',
  label: '属性覆盖层（旧）',
  baseVersion: PUBLISHED.modelVersion,
  baseline: () => ({}),
  restore: (raw) => z.record(z.string(), z.record(z.string(), z.unknown())).parse(raw),
  validate: (overlay) => validateModel(getIndex(), overlay),
})
if (!draftRegistry.getState().activeId) draftRegistry.setState({ activeId: LEGACY_DRAFT_ID })

export interface DraftState {
  draftId: string
  kind: DocumentKind
  label: string
  revision: number
  savedRevision: number
  dirty: boolean
  saving: boolean
  saveError: string | null
  /** 最近一次本地保存时间；保存目标只有本浏览器 localStorage。 */
  savedAt: string | null
  validating: boolean
  validatedRevision: number | null
  /** 语义内容自上次校验后发生了变化（只移动布局不算）。 */
  validationStale: boolean
  diagnostics: Diagnostic[]
  published: { bundleId: string; modelVersion: string } | null
  overlay: DraftOverlay
  savedOverlay: DraftOverlay
  undo: HistoryEntry[]
  redo: HistoryEntry[]
}

function activeDoc(): DraftDocument {
  const s = draftRegistry.getState()
  return (s.activeId && s.documents[s.activeId]) || s.documents[LEGACY_DRAFT_ID]
}

let lastRegistryState: unknown = null
let lastView: DraftState | null = null

function view(): DraftState {
  const state = draftRegistry.getState()
  if (state === lastRegistryState && lastView) return lastView
  const doc = activeDoc()
  const legacy = state.documents[LEGACY_DRAFT_ID] as DraftDocument<DraftOverlay>
  lastRegistryState = state
  lastView = {
    draftId: doc.documentId,
    kind: doc.kind,
    label: doc.label,
    revision: doc.revision,
    savedRevision: doc.savedRevision,
    dirty: isDocumentDirty(doc),
    saving: doc.saving,
    saveError: doc.saveError,
    savedAt: doc.savedAt,
    validating: doc.validating,
    validatedRevision: doc.validatedRevision,
    validationStale: doc.validatedHash !== null && doc.validatedHash !== doc.semanticHash,
    diagnostics: doc.diagnostics,
    published: PUBLISHED,
    overlay: legacy.content,
    savedOverlay: legacy.savedContent,
    undo: doc.undo,
    redo: doc.redo,
  }
  return lastView
}

/** 只读投影；写入一律经 commandBus → applyDraftCommand 或 draftRegistry.applyEdit。 */
export const draftStore = {
  getState: view,
  subscribe: draftRegistry.subscribe,
}

export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'saveFailed'
export type ValidationStatus = 'unvalidated' | 'validating' | 'valid' | 'validationFailed' | 'validationStale'

/** DraftState 或单个 DraftDocument 都可以求状态。 */
type SaveFacts = Pick<DraftState, 'saving' | 'saveError' | 'dirty'>
type ValidationFacts = Pick<DraftState, 'validating' | 'validatedRevision' | 'validationStale' | 'diagnostics'>

export function documentFacts(doc: DraftDocument): SaveFacts & ValidationFacts {
  return {
    saving: doc.saving,
    saveError: doc.saveError,
    dirty: isDocumentDirty(doc),
    validating: doc.validating,
    validatedRevision: doc.validatedRevision,
    validationStale: doc.validatedHash !== null && doc.validatedHash !== doc.semanticHash,
    diagnostics: doc.diagnostics,
  }
}

export function saveStatusOf(s: SaveFacts): SaveStatus {
  if (s.saving) return 'saving'
  if (s.saveError) return 'saveFailed'
  return s.dirty ? 'dirty' : 'saved'
}

export function validationStatusOf(s: ValidationFacts): ValidationStatus {
  if (s.validating) return 'validating'
  if (s.validatedRevision === null) return 'unvalidated'
  if (s.validationStale) return 'validationStale'
  return s.diagnostics.some((d) => d.severity === 'error') ? 'validationFailed' : 'valid'
}

/** 任一草稿文档有未保存修改。 */
export function isDirty() {
  return anyDocumentDirty()
}

/** 由 commandBus 调用：旧属性覆盖层的一次 patch，进入 model-draft 文档自己的历史。 */
export function applyDraftCommand(input: { type: string; label: string; targetId: string; patch: Record<string, unknown> }): DraftCommand {
  const doc = getDocument<DraftOverlay>(LEGACY_DRAFT_ID)!
  const current = doc.content[input.targetId] ?? {}
  const prev: DraftCommand['prev'] = {}
  for (const field of Object.keys(input.patch)) {
    prev[field] = field in current ? { present: true, value: current[field] } : { present: false, value: undefined }
  }
  const command: DraftCommand = { commandId: `${LEGACY_DRAFT_ID}:r${doc.revision + 1}`, baseRevision: doc.revision, prev, ...input }
  applyEdit<DraftOverlay>(LEGACY_DRAFT_ID, input.label, (overlay) => ({ ...overlay, [input.targetId]: { ...(overlay[input.targetId] ?? {}), ...input.patch } }), {
    coalesceKey: `${input.type}:${input.targetId}:${Object.keys(input.patch).sort().join(',')}`,
  })
  return command
}

export function undoDraft() {
  const entry = undoDocument(activeDoc().documentId)
  if (entry) toast(`已撤销：${entry.label}`, 'info')
}

export function redoDraft() {
  const entry = redoDocument(activeDoc().documentId)
  if (entry) toast(`已重做：${entry.label}`, 'info')
}

/** 保存当前编辑焦点文档到本地。 */
export async function saveDraft(): Promise<boolean> {
  const doc = activeDoc()
  const ok = await saveDocument(doc.documentId)
  const latest = getDocument(doc.documentId)!
  if (ok) toast(`${latest.label} 已本地保存 · r${latest.savedRevision}`)
  return ok
}

/** 离开确认用：保存全部有修改的文档。 */
export async function saveAllDrafts(): Promise<boolean> {
  const ok = await saveAllDocuments()
  if (ok) toast('全部草稿已本地保存')
  return ok
}

export function discardDraft() {
  const doc = activeDoc()
  discardDocument(doc.documentId)
  toast(`已放弃 ${doc.label} 的未保存修改，回到 r${doc.savedRevision}`, 'info')
}

export function discardAllDrafts() {
  discardAllDocuments()
  toast('已放弃全部未保存修改', 'info')
}

export async function validateDraft(): Promise<boolean> {
  const doc = activeDoc()
  const ok = await validateDocument(doc.documentId)
  const latest = getDocument(doc.documentId)!
  const errors = latest.diagnostics.filter((d) => d.severity === 'error').length
  if (errors === 0) toast(`${latest.label} r${latest.validatedRevision} 校验通过${latest.diagnostics.length ? ` · ${latest.diagnostics.length} 条警告` : ''}`)
  return ok
}

export function useDraft<S>(selector: (s: DraftState) => S): S {
  const read = () => selector(view())
  return useSyncExternalStore(draftRegistry.subscribe, read, read)
}

export function useDraftTarget(targetId: string): Record<string, unknown> | undefined {
  return useStore(draftRegistry, (s) => (s.documents[LEGACY_DRAFT_ID] as DraftDocument<DraftOverlay>).content[targetId])
}
