import type { Diagnostic, DraftCommand } from '@/core/types'
import { getIndex } from '@/data/store'
import { createId, delay } from '@/lib/id'
import { createStore, useStore } from '@/lib/store'
import { validateModel, type DraftOverlay } from '@/services/coreValidation'
import { contextStore } from './context'
import { toast } from './toast'

/**
 * DraftStore：草稿覆盖层 + 命令栈。
 * 保存状态、校验状态、发布状态分别记录；任何修改都会让已有校验结果过期。
 */
export interface DraftState {
  draftId: string
  revision: number
  savedRevision: number
  saving: boolean
  saveError: string | null
  validating: boolean
  validatedRevision: number | null
  diagnostics: Diagnostic[]
  published: { bundleId: string; revision: number } | null
  overlay: DraftOverlay
  savedOverlay: DraftOverlay
  undo: DraftCommand[]
  redo: DraftCommand[]
}

export const draftStore = createStore<DraftState>({
  draftId: 'model-draft',
  revision: 12,
  savedRevision: 12,
  saving: false,
  saveError: null,
  validating: false,
  validatedRevision: 12,
  diagnostics: [],
  published: { bundleId: 'bundle-04', revision: 12 },
  overlay: {},
  savedOverlay: {},
  undo: [],
  redo: [],
})

export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'saveFailed'
export type ValidationStatus = 'unvalidated' | 'validating' | 'valid' | 'validationFailed' | 'validationStale'

export function saveStatusOf(s: DraftState): SaveStatus {
  if (s.saving) return 'saving'
  if (s.saveError) return 'saveFailed'
  return s.revision === s.savedRevision ? 'saved' : 'dirty'
}

export function validationStatusOf(s: DraftState): ValidationStatus {
  if (s.validating) return 'validating'
  if (s.validatedRevision === null) return 'unvalidated'
  if (s.validatedRevision !== s.revision) return 'validationStale'
  return s.diagnostics.some((d) => d.severity === 'error') ? 'validationFailed' : 'valid'
}

export function isDirty(s: DraftState = draftStore.getState()) {
  return s.revision !== s.savedRevision
}

function applyPatch(overlay: DraftOverlay, targetId: string, patch: Record<string, unknown>): DraftOverlay {
  return { ...overlay, [targetId]: { ...(overlay[targetId] ?? {}), ...patch } }
}

function restore(overlay: DraftOverlay, targetId: string, prev: DraftCommand['prev']): DraftOverlay {
  const target = { ...(overlay[targetId] ?? {}) }
  for (const [field, entry] of Object.entries(prev)) {
    if (entry.present) target[field] = entry.value
    else delete target[field]
  }
  const next = { ...overlay }
  if (Object.keys(target).length === 0) delete next[targetId]
  else next[targetId] = target
  return next
}

/** 由 commandBus 调用；页面不直接改 store。 */
export function applyDraftCommand(input: { type: string; label: string; targetId: string; patch: Record<string, unknown> }): DraftCommand {
  const s = draftStore.getState()
  const current = s.overlay[input.targetId] ?? {}
  const prev: DraftCommand['prev'] = {}
  for (const field of Object.keys(input.patch)) {
    prev[field] = field in current ? { present: true, value: current[field] } : { present: false, value: undefined }
  }
  const command: DraftCommand = { commandId: createId('dc'), baseRevision: s.revision, prev, ...input }
  draftStore.setState({
    overlay: applyPatch(s.overlay, input.targetId, input.patch),
    revision: s.revision + 1,
    undo: [...s.undo, command],
    redo: [],
    saveError: null,
  })
  return command
}

export function undoDraft() {
  const s = draftStore.getState()
  const command = s.undo[s.undo.length - 1]
  if (!command) return
  draftStore.setState({
    overlay: restore(s.overlay, command.targetId, command.prev),
    revision: s.revision + 1,
    undo: s.undo.slice(0, -1),
    redo: [...s.redo, command],
  })
  toast(`已撤销：${command.label}`, 'info')
}

export function redoDraft() {
  const s = draftStore.getState()
  const command = s.redo[s.redo.length - 1]
  if (!command) return
  draftStore.setState({
    overlay: applyPatch(s.overlay, command.targetId, command.patch),
    revision: s.revision + 1,
    redo: s.redo.slice(0, -1),
    undo: [...s.undo, command],
  })
  toast(`已重做：${command.label}`, 'info')
}

export async function saveDraft(): Promise<boolean> {
  const s = draftStore.getState()
  if (s.saving) return false
  draftStore.setState({ saving: true, saveError: null })
  await delay(520)
  if (contextStore.getState().connection === 'offline') {
    draftStore.setState({ saving: false, saveError: '离线：草稿保留在本地，连接恢复后重试保存。' })
    return false
  }
  const latest = draftStore.getState()
  draftStore.setState({ saving: false, savedRevision: latest.revision, savedOverlay: latest.overlay })
  toast(`草稿已保存 · r${latest.revision}`)
  return true
}

export function discardDraft() {
  const s = draftStore.getState()
  draftStore.setState({ overlay: s.savedOverlay, revision: s.savedRevision, undo: [], redo: [], saveError: null })
  toast(`已放弃未保存修改，回到 r${s.savedRevision}`, 'info')
}

export async function validateDraft(): Promise<boolean> {
  const s = draftStore.getState()
  if (s.validating) return false
  const revision = s.revision
  draftStore.setState({ validating: true })
  await delay(640)
  const diagnostics = validateModel(getIndex(), draftStore.getState().overlay)
  draftStore.setState({ validating: false, validatedRevision: revision, diagnostics })
  const errors = diagnostics.filter((d) => d.severity === 'error').length
  if (errors === 0) toast(`r${revision} 校验通过${diagnostics.length ? ` · ${diagnostics.length} 条警告` : ''}`)
  return errors === 0
}

export function useDraft<S>(selector: (s: DraftState) => S): S {
  return useStore(draftStore, selector)
}

export function useDraftTarget(targetId: string): Record<string, unknown> | undefined {
  return useStore(draftStore, (s) => s.overlay[targetId])
}
