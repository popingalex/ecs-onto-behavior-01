import type { Diagnostic, RunPhase } from "@/core/types"
import { dataStore } from "@/data/store"
import { delay } from "@/lib/id"
import { createStore, useStore } from "@/lib/store"
import { navigate, routerStore } from "@/router/router"
import {
  mockExecutorAdapter,
  readOnlyImportAdapter,
  type ExecutionAdapter,
} from "@/services/executionAdapter"
import { CURRENT_MODE } from "@/stores/dataSource"
import { enqueueRunCommand, updateRunCommand } from "./commandQueue"
import { contextStore } from "./context"
import { draftRegistry } from "./draftRegistry"
import { historyStore } from "./history"
import { noteFailedSettle } from "./persistence/historyPersistence"
import { startPlayback } from "./playback"
import {
  executionContextKey,
  revisionSnapshot,
  revisionsChanged,
} from "./sessionGuards"
import { applySettleFacts } from "./settleFacts"
import { toast } from "./toast"

/**
 * SessionStore：权威会话阶段。
 * waitingInputs → frozen → computing → committing → committed → playing → waitingInputs；
 * 失败回到原 head 并保留诊断。结算成功的事实落地见 settleFacts.applySettleFacts：
 * record 先行，本地持久层原子事务成功后才移动世界与 commit/head。
 */
export interface RunSession {
  phase: RunPhase
  idempotencyKey: string | null
  lastError: Diagnostic | null
}

const IDLE: RunSession = {
  phase: "waitingInputs",
  idempotencyKey: null,
  lastError: null,
}

export const sessionStore = createStore<{
  sessions: Record<string, RunSession>
  adapter: ExecutionAdapter
}>({
  sessions: {},
  // 默认执行路径：MOCK_SANDBOX 用浏览器 mock 执行器对当前图真实求值；
  // REAL_IMPORT_READ_ONLY 用只读适配器（settle 一律拒绝，见 executionAdapter）。
  // referenceAdapter 只在“查看样例”入口显式指定。
  adapter:
    CURRENT_MODE === "REAL_IMPORT_READ_ONLY" ? readOnlyImportAdapter : mockExecutorAdapter,
})

function getSession(runId: string): RunSession {
  return sessionStore.getState().sessions[runId] ?? IDLE
}

function patchSession(runId: string, patch: Partial<RunSession>) {
  sessionStore.setState((s) => ({
    sessions: {
      ...s.sessions,
      [runId]: { ...(s.sessions[runId] ?? IDLE), ...patch },
    },
  }))
}

function fail(runId: string, diagnostic: Diagnostic) {
  patchSession(runId, {
    phase: "waitingInputs",
    idempotencyKey: null,
    lastError: diagnostic,
  })
}

export function dismissRunError(runId: string) {
  patchSession(runId, { lastError: null })
}

export interface SettleOptions {
  /** 显式指定适配器（如“查看样例”走 referenceAdapter）；缺省用会话默认（mock 执行器）。 */
  adapter?: ExecutionAdapter
  /** 试算输入版本：saved（默认）或明确的 draft 草稿试算快照。 */
  modelView?: "saved" | "draft"
}

export async function settleRound(
  runId: string,
  branchId: string,
  baseCommit: string,
  options: SettleOptions = {},
) {
  if (getSession(runId).phase !== "waitingInputs") return
  const ctx = contextStore.getState()
  const key = `${runId}:${branchId}:${baseCommit}:settle`
  if (ctx.role === "observer") {
    fail(runId, {
      id: key,
      severity: "error",
      code: "FORBIDDEN",
      message: "观察者不能推算回合。",
    })
    return
  }
  if (ctx.connection === "offline") {
    fail(runId, {
      id: key,
      severity: "error",
      code: "OFFLINE",
      message: "离线：无法提交回合，分支头保持不变。",
    })
    return
  }
  const branch = historyStore.getState().branches[branchId]
  if (!branch || branch.headCommit !== baseCommit) {
    fail(runId, {
      id: key,
      severity: "error",
      code: "BASE_NOT_HEAD",
      message: `${baseCommit} 不是分支头，历史提交只读；请回到最新或从此提交建立分支。`,
    })
    return
  }

  const command = enqueueRunCommand({
    type: "SettleRound",
    idempotencyKey: key,
    baseCommit,
    actorId: ctx.actorId,
    args: { runId, branchId },
  })
  patchSession(runId, { phase: "frozen", idempotencyKey: key, lastError: null })
  await delay(450)
  patchSession(runId, { phase: "computing" })
  updateRunCommand(command.commandId, { status: "accepted" })

  const adapter = options.adapter ?? sessionStore.getState().adapter
  const result = await adapter.settle({
    runId,
    branchId,
    baseCommit,
    idempotencyKey: key,
    modelView: options.modelView,
  })
  if (!result.ok) {
    updateRunCommand(command.commandId, {
      status: "rejected",
      message: result.diagnostic.message,
    })
    fail(runId, result.diagnostic)
    return
  }

  patchSession(runId, { phase: "committing" })
  await delay(350)
  const applied = await applySettleFacts(result)
  if (!applied.ok) {
    updateRunCommand(command.commandId, {
      status: "rejected",
      message: applied.message,
    })
    noteFailedSettle({ runId, branchId, baseCommit })
    fail(runId, {
      id: key,
      severity: "error",
      code: "HISTORY_PERSIST_FAILED",
      message: `本地历史写入失败：${applied.message}；分支头保持 ${baseCommit}，可重试推算或在状态栏清空本地历史。`,
    })
    return
  }
  updateRunCommand(command.commandId, { status: "applied" })
  patchSession(runId, { phase: "committed" })
  toast(
    `已提交 ${result.commit.id} · 第 ${result.commit.round} 回合 · ${
      result.commit.source === "computed" ? "当前图求值" : "参考样例"
    }`,
  )

  // 若正在查看旧 head，则跟随到新提交；其他上下文不受影响。
  const route =
    routerStore.getState().entries[routerStore.getState().index].route
  if (
    route.params.runId === runId &&
    route.params.branchId === branchId &&
    route.params.viewCommit === baseCommit
  ) {
    navigate(
      { ...route, params: { ...route.params, viewCommit: result.commit.id } },
      { replace: true },
    )
  }

  await delay(300)
  const run = dataStore.getState().index?.runs.get(runId)
  patchSession(runId, { phase: "playing" })
  startPlayback(runId, result.commit.id, run?.playbackSeconds ?? 1, () =>
    patchSession(runId, { phase: "waitingInputs", idempotencyKey: null }),
  )
}

export function useRunSession(runId: string | undefined): RunSession {
  return useStore(sessionStore, (s) =>
    runId ? (s.sessions[runId] ?? IDLE) : IDLE,
  )
}

export function useExecutionAdapterLabel() {
  return useStore(sessionStore, (s) => s.adapter.label)
}

/** 清除所有会话的错误横幅：上下文切换或试算输入被修改后，旧诊断不再适用。 */
function clearAllRunErrors() {
  sessionStore.setState((s) => {
    if (!Object.values(s.sessions).some((session) => session.lastError))
      return {}
    return {
      sessions: Object.fromEntries(
        Object.entries(s.sessions).map(([id, session]) => [
          id,
          session.lastError ? { ...session, lastError: null } : session,
        ]),
      ),
    }
  })
}

// 错误横幅清理时机（W2 回归 Bug3）：执行上下文切换（切分支/换提交/离开页面），
// 或任一草稿修订变化（修复造成 INPUT_MISSING 的输入）时清除残留诊断；
// 下一次 settle 发起时由 patchSession(phase: frozen, lastError: null) 清理（既有）。
let lastContextKey: string | null = null
routerStore.subscribe(() => {
  const state = routerStore.getState()
  const key = executionContextKey(state.entries[state.index].route)
  if (lastContextKey === null) {
    lastContextKey = key
    return
  }
  if (key !== lastContextKey) {
    lastContextKey = key
    clearAllRunErrors()
  }
})

let lastRevisions: Record<string, number> = {}
draftRegistry.subscribe(() => {
  const next = revisionSnapshot(draftRegistry.getState().documents)
  if (revisionsChanged(lastRevisions, next)) clearAllRunErrors()
  lastRevisions = next
})
