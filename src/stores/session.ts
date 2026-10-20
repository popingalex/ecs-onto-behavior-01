import type { Diagnostic, RunPhase } from '@/core/types'
import { dataStore } from '@/data/store'
import { delay } from '@/lib/id'
import { createStore, useStore } from '@/lib/store'
import { navigate, routerStore } from '@/router/router'
import { referenceAdapter, type ExecutionAdapter } from '@/services/executionAdapter'
import { enqueueRunCommand, updateRunCommand } from './commandQueue'
import { contextStore } from './context'
import { appendCommit, historyStore } from './history'
import { startPlayback } from './playback'
import { toast } from './toast'

/**
 * SessionStore：权威会话阶段。
 * waitingInputs → frozen → computing → committing → committed → playing → waitingInputs；
 * 失败回到原 head 并保留诊断。
 */
export interface RunSession {
  phase: RunPhase
  idempotencyKey: string | null
  lastError: Diagnostic | null
}

const IDLE: RunSession = { phase: 'waitingInputs', idempotencyKey: null, lastError: null }

export const sessionStore = createStore<{ sessions: Record<string, RunSession>; adapter: ExecutionAdapter }>({
  sessions: {},
  adapter: referenceAdapter,
})

function getSession(runId: string): RunSession {
  return sessionStore.getState().sessions[runId] ?? IDLE
}

function patchSession(runId: string, patch: Partial<RunSession>) {
  sessionStore.setState((s) => ({ sessions: { ...s.sessions, [runId]: { ...(s.sessions[runId] ?? IDLE), ...patch } } }))
}

function fail(runId: string, diagnostic: Diagnostic) {
  patchSession(runId, { phase: 'waitingInputs', idempotencyKey: null, lastError: diagnostic })
}

export function dismissRunError(runId: string) {
  patchSession(runId, { lastError: null })
}

export async function settleRound(runId: string, branchId: string, baseCommit: string) {
  if (getSession(runId).phase !== 'waitingInputs') return
  const ctx = contextStore.getState()
  const key = `${runId}:${branchId}:${baseCommit}:settle`
  if (ctx.role === 'observer') {
    fail(runId, { id: key, severity: 'error', code: 'FORBIDDEN', message: '观察者不能推算回合。' })
    return
  }
  if (ctx.connection === 'offline') {
    fail(runId, { id: key, severity: 'error', code: 'OFFLINE', message: '离线：无法提交回合，分支头保持不变。' })
    return
  }
  const branch = historyStore.getState().branches[branchId]
  if (!branch || branch.headCommit !== baseCommit) {
    fail(runId, {
      id: key,
      severity: 'error',
      code: 'BASE_NOT_HEAD',
      message: `${baseCommit} 不是分支头，历史提交只读；请回到最新或从此提交建立分支。`,
    })
    return
  }

  const command = enqueueRunCommand({ type: 'SettleRound', idempotencyKey: key, baseCommit, actorId: ctx.actorId, args: { runId, branchId } })
  patchSession(runId, { phase: 'frozen', idempotencyKey: key, lastError: null })
  await delay(450)
  patchSession(runId, { phase: 'computing' })
  updateRunCommand(command.commandId, { status: 'accepted' })

  const result = await sessionStore.getState().adapter.settle({ runId, branchId, baseCommit, idempotencyKey: key })
  if (!result.ok) {
    updateRunCommand(command.commandId, { status: 'rejected', message: result.diagnostic.message })
    fail(runId, result.diagnostic)
    return
  }

  patchSession(runId, { phase: 'committing' })
  await delay(350)
  const index = dataStore.getState().index
  if (index) {
    index.worlds.set(result.world.commitId, result.world)
    dataStore.setState({ index: { ...index } })
  }
  appendCommit(result.commit)
  updateRunCommand(command.commandId, { status: 'applied' })
  patchSession(runId, { phase: 'committed' })
  toast(`已提交 ${result.commit.id} · 第 ${result.commit.round} 回合`)

  // 若正在查看旧 head，则跟随到新提交；其他上下文不受影响。
  const route = routerStore.getState().entries[routerStore.getState().index].route
  if (route.params.runId === runId && route.params.branchId === branchId && route.params.viewCommit === baseCommit) {
    navigate({ ...route, params: { ...route.params, viewCommit: result.commit.id } }, { replace: true })
  }

  await delay(300)
  const run = index?.runs.get(runId)
  patchSession(runId, { phase: 'playing' })
  startPlayback(runId, result.commit.id, run?.playbackSeconds ?? 1, () => patchSession(runId, { phase: 'waitingInputs', idempotencyKey: null }))
}

export function useRunSession(runId: string | undefined): RunSession {
  return useStore(sessionStore, (s) => (runId ? (s.sessions[runId] ?? IDLE) : IDLE))
}

export function useExecutionAdapterLabel() {
  return useStore(sessionStore, (s) => s.adapter.label)
}
