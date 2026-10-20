import { useEffect } from 'react'
import type { Diagnostic } from '@/core/types'
import { stableHash } from '@/lib/hash'
import { createId } from '@/lib/id'
import { createStore, useStore } from '@/lib/store'

/**
 * DraftRegistry：按 documentId 隔离的资产草稿。
 * 每个文档有自己的 revision / 保存 / 校验状态、undo/redo 与 localStorage 键；
 * 一个文档的编辑、撤销、保存不会碰到其他文档。保存只写本浏览器 localStorage（原型阶段的“本地保存”）。
 */
export type DocumentKind = 'schema' | 'scene' | 'system' | 'program' | 'schedule' | 'legacy'

export interface HistoryEntry {
  id: string
  label: string
  before: unknown
  after: unknown
  at: number
  coalesceKey?: string
}

export type RestoreState = { status: 'none' } | { status: 'restored'; savedAt: string } | { status: 'rejected'; reason: string }

export interface DraftDocument<T = unknown> {
  documentId: string
  kind: DocumentKind
  label: string
  /** 草稿所基于的已发布版本；本地存档的 baseVersion 不一致时不恢复。 */
  baseVersion: string
  content: T
  savedContent: T
  revision: number
  savedRevision: number
  /** 全内容（含布局）哈希：判定是否有未保存修改。 */
  contentHash: string
  savedHash: string
  /** 语义哈希（不含布局）：判定校验是否过期、执行输入是否变化。 */
  semanticHash: string
  validatedHash: string | null
  validatedRevision: number | null
  validating: boolean
  diagnostics: Diagnostic[]
  saving: boolean
  saveError: string | null
  /** 最近一次本地保存时间；null 表示从未本地保存（内容等于已发布基线）。 */
  savedAt: string | null
  restore: RestoreState
  undo: HistoryEntry[]
  redo: HistoryEntry[]
}

export interface DocumentSpec<T> {
  kind: DocumentKind
  label: string
  baseVersion: string
  baseline: () => T
  /** 校验并规范化本地存档里的 content；不合法时抛错，存档被拒绝而不是半恢复。 */
  restore: (raw: unknown) => T
  /** 参与语义哈希的部分；默认整份内容。布局等纯展示数据应排除在外。 */
  semantic?: (content: T) => unknown
  validate?: (content: T) => Diagnostic[]
}

interface RegistryState {
  documents: Record<string, DraftDocument>
  /** 当前编辑焦点：ContextBar 与 Ctrl+Z/S 作用于它。 */
  activeId: string | null
}

export const draftRegistry = createStore<RegistryState>({ documents: {}, activeId: null })
const specs = new Map<string, DocumentSpec<unknown>>()

const STORAGE_PREFIX = 'ecs-workbench.draft.v1:'
const COALESCE_MS = 1000

interface StoredDraft {
  format: 'draft/1'
  documentId: string
  kind: DocumentKind
  baseVersion: string
  revision: number
  savedAt: string
  content: unknown
}

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

/** Zod 等校验错误带 issues；展示为“路径: 消息”，不把原始 JSON 塞给用户。 */
export function describeError(error: unknown): string {
  const issues = (error as { issues?: Array<{ path: PropertyKey[]; message: string }> })?.issues
  if (Array.isArray(issues) && issues.length > 0) {
    const shown = issues.slice(0, 2).map((i) => `${i.path.map(String).join('.') || '(root)'}: ${i.message}`)
    return shown.join('；') + (issues.length > 2 ? ` 等 ${issues.length} 项` : '')
  }
  return error instanceof Error ? error.message : String(error)
}

function semanticOf<T>(spec: DocumentSpec<T>, content: T): unknown {
  return spec.semantic ? spec.semantic(content) : content
}

function readStored<T>(documentId: string, spec: DocumentSpec<T>): { content: T; revision: number; savedAt: string } | { rejected: string } | null {
  const store = storage()
  let text: string | null = null
  try {
    text = store?.getItem(STORAGE_PREFIX + documentId) ?? null
  } catch {
    return null
  }
  if (!text) return null
  try {
    const raw = JSON.parse(text) as Partial<StoredDraft>
    if (raw.format !== 'draft/1' || raw.documentId !== documentId) return { rejected: '本地存档格式不符' }
    if (raw.baseVersion !== spec.baseVersion) return { rejected: `本地存档基于 ${String(raw.baseVersion)}，当前已发布版本为 ${spec.baseVersion}` }
    if (typeof raw.revision !== 'number' || typeof raw.savedAt !== 'string') return { rejected: '本地存档缺少 revision / savedAt' }
    return { content: spec.restore(raw.content), revision: raw.revision, savedAt: raw.savedAt }
  } catch (error) {
    return { rejected: `本地存档无法解析：${describeError(error)}` }
  }
}

function patchDoc(documentId: string, patch: Partial<DraftDocument>) {
  draftRegistry.setState((s) => {
    const doc = s.documents[documentId]
    return doc ? { documents: { ...s.documents, [documentId]: { ...doc, ...patch } } } : {}
  })
}

function withContent<T>(doc: DraftDocument<T>, content: T): Pick<DraftDocument<T>, 'content' | 'contentHash' | 'semanticHash'> {
  const spec = specs.get(doc.documentId) as DocumentSpec<T>
  return { content, contentHash: stableHash(content), semanticHash: stableHash(semanticOf(spec, content)) }
}

/** 注册（或取回已注册的）文档；首次注册时尝试从 localStorage 恢复已保存的草稿。 */
export function registerDocument<T>(documentId: string, spec: DocumentSpec<T>): DraftDocument<T> {
  const existing = draftRegistry.getState().documents[documentId]
  if (existing) return existing as DraftDocument<T>
  specs.set(documentId, spec as DocumentSpec<unknown>)
  const stored = readStored(documentId, spec)
  const restored = stored && 'content' in stored ? stored : null
  const content = restored ? restored.content : spec.baseline()
  const contentHash = stableHash(content)
  const doc: DraftDocument<T> = {
    documentId,
    kind: spec.kind,
    label: spec.label,
    baseVersion: spec.baseVersion,
    content,
    savedContent: content,
    revision: restored?.revision ?? 0,
    savedRevision: restored?.revision ?? 0,
    contentHash,
    savedHash: contentHash,
    semanticHash: stableHash(semanticOf(spec, content)),
    validatedHash: null,
    validatedRevision: null,
    validating: false,
    diagnostics: [],
    saving: false,
    saveError: null,
    savedAt: restored?.savedAt ?? null,
    restore: restored ? { status: 'restored', savedAt: restored.savedAt } : stored && 'rejected' in stored ? { status: 'rejected', reason: stored.rejected } : { status: 'none' },
    undo: [],
    redo: [],
  }
  draftRegistry.setState((s) => ({ documents: { ...s.documents, [documentId]: doc as DraftDocument } }))
  return doc
}

export function getDocument<T>(documentId: string): DraftDocument<T> | undefined {
  return draftRegistry.getState().documents[documentId] as DraftDocument<T> | undefined
}

export function isDocumentDirty(doc: DraftDocument | undefined): boolean {
  return Boolean(doc && doc.contentHash !== doc.savedHash)
}

/**
 * 一次编辑事务：recipe 返回新内容（不可原地修改）。内容不变则不产生历史。
 * coalesceKey 相同且间隔很短的连续编辑（例如逐字输入）合并为一条撤销记录。
 */
export function applyEdit<T>(documentId: string, label: string, recipe: (content: T) => T, options: { coalesceKey?: string } = {}): boolean {
  const doc = getDocument<T>(documentId)
  if (!doc) throw new Error(`草稿文档 ${documentId} 未注册`)
  const next = recipe(doc.content)
  const nextHash = stableHash(next)
  if (next === doc.content || nextHash === doc.contentHash) return false
  const now = Date.now()
  const last = doc.undo[doc.undo.length - 1]
  const merge = Boolean(options.coalesceKey && last?.coalesceKey === options.coalesceKey && now - last.at < COALESCE_MS && doc.redo.length === 0)
  const undo = merge
    ? [...doc.undo.slice(0, -1), { ...last!, after: next, at: now }]
    : [...doc.undo, { id: createId('edit'), label, before: doc.content, after: next, at: now, coalesceKey: options.coalesceKey }]
  patchDoc(documentId, { ...withContent(doc, next), revision: doc.revision + 1, undo, redo: [], saveError: null })
  return true
}

export function undoDocument(documentId: string): HistoryEntry | null {
  const doc = getDocument(documentId)
  const entry = doc?.undo[doc.undo.length - 1]
  if (!doc || !entry) return null
  patchDoc(documentId, { ...withContent(doc, entry.before), revision: doc.revision + 1, undo: doc.undo.slice(0, -1), redo: [...doc.redo, entry] })
  return entry
}

export function redoDocument(documentId: string): HistoryEntry | null {
  const doc = getDocument(documentId)
  const entry = doc?.redo[doc.redo.length - 1]
  if (!doc || !entry) return null
  patchDoc(documentId, { ...withContent(doc, entry.after), revision: doc.revision + 1, redo: doc.redo.slice(0, -1), undo: [...doc.undo, entry] })
  return entry
}

/** 本地保存：写入 localStorage；失败（禁用存储、配额）时记录 saveError，内容留在内存草稿里。 */
export async function saveDocument(documentId: string): Promise<boolean> {
  const doc = getDocument(documentId)
  if (!doc || doc.saving) return false
  patchDoc(documentId, { saving: true, saveError: null })
  await Promise.resolve()
  const latest = getDocument(documentId)!
  const savedAt = new Date().toISOString()
  const payload: StoredDraft = { format: 'draft/1', documentId, kind: latest.kind, baseVersion: latest.baseVersion, revision: latest.revision, savedAt, content: latest.content }
  const store = storage()
  try {
    if (!store) throw new Error('浏览器未提供 localStorage')
    store.setItem(STORAGE_PREFIX + documentId, JSON.stringify(payload))
  } catch (error) {
    patchDoc(documentId, { saving: false, saveError: `本地保存失败：${error instanceof Error ? error.message : String(error)}；修改仍在内存草稿中。` })
    return false
  }
  patchDoc(documentId, { saving: false, savedContent: latest.content, savedRevision: latest.revision, savedHash: latest.contentHash, savedAt })
  return true
}

/** 放弃未保存修改，回到最近一次本地保存（或已发布基线）。 */
export function discardDocument(documentId: string) {
  const doc = getDocument(documentId)
  if (!doc) return
  patchDoc(documentId, { ...withContent(doc, doc.savedContent), revision: doc.savedRevision, undo: [], redo: [], saveError: null })
}

/** 删除本地存档并回到已发布基线。 */
export function resetDocumentToBaseline(documentId: string) {
  const doc = getDocument(documentId)
  const spec = specs.get(documentId)
  if (!doc || !spec) return
  try {
    storage()?.removeItem(STORAGE_PREFIX + documentId)
  } catch {
    // 存储不可用时只重置内存状态。
  }
  const content = spec.baseline()
  const hashes = withContent(doc, content)
  patchDoc(documentId, { ...hashes, savedContent: content, savedHash: hashes.contentHash, revision: 0, savedRevision: 0, savedAt: null, undo: [], redo: [], saveError: null, restore: { status: 'none' } })
}

export async function validateDocument(documentId: string): Promise<boolean> {
  const doc = getDocument(documentId)
  const spec = specs.get(documentId)
  if (!doc || !spec || doc.validating) return false
  patchDoc(documentId, { validating: true })
  await Promise.resolve()
  const latest = getDocument(documentId)!
  let diagnostics: Diagnostic[]
  try {
    diagnostics = spec.validate?.(latest.content) ?? []
  } catch (error) {
    diagnostics = [{ id: `${documentId}:validator`, severity: 'error', code: 'VALIDATOR_FAILED', message: `校验器异常：${error instanceof Error ? error.message : String(error)}` }]
  }
  patchDoc(documentId, { validating: false, diagnostics, validatedHash: latest.semanticHash, validatedRevision: latest.revision })
  return !diagnostics.some((d) => d.severity === 'error')
}

export function anyDocumentDirty(): boolean {
  return Object.values(draftRegistry.getState().documents).some(isDocumentDirty)
}

export async function saveAllDocuments(): Promise<boolean> {
  const dirty = Object.values(draftRegistry.getState().documents).filter(isDocumentDirty)
  const results = await Promise.all(dirty.map((d) => saveDocument(d.documentId)))
  return results.every(Boolean)
}

export function discardAllDocuments() {
  for (const doc of Object.values(draftRegistry.getState().documents)) if (isDocumentDirty(doc)) discardDocument(doc.documentId)
}

export function setActiveDocument(documentId: string | null) {
  if (draftRegistry.getState().activeId !== documentId) draftRegistry.setState({ activeId: documentId })
}

export function useDraftDocuments(): Record<string, DraftDocument> {
  return useStore(draftRegistry, (s) => s.documents)
}

export function useDraftDocument<T>(documentId: string): DraftDocument<T> | undefined {
  return useStore(draftRegistry, (s) => s.documents[documentId] as DraftDocument<T> | undefined)
}

/** 页面挂载期间把 documentId 设为编辑焦点，卸载时还原为之前的焦点。 */
export function useEditingDocument(documentId: string | null) {
  useEffect(() => {
    if (!documentId) return
    const previous = draftRegistry.getState().activeId
    setActiveDocument(documentId)
    return () => {
      if (draftRegistry.getState().activeId === documentId) setActiveDocument(previous)
    }
  }, [documentId])
}

if (typeof window !== 'undefined') {
  // 未保存修改只在内存里，刷新会丢失；交给浏览器原生确认。
  window.addEventListener('beforeunload', (event) => {
    if (!anyDocumentDirty()) return
    event.preventDefault()
    event.returnValue = ''
  })
}
