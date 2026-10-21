import type { Diagnostic, RunPhase } from "@/core/types"
import { dataStore } from "@/data/store"
import { delay } from "@/lib/id"
import { createStore, useStore } from "@/lib/store"
import { navigate, routerStore } from "@/router/router"
import {
  mockExecutorAdapter,
  type ExecutionAdapter,
} from "@/services/executionAdapter"
import { enqueueRunCommand, updateRunCommand } from "./commandQueue"
import { contextStore } from "./context"
import { appendCommit, historyStore } from "./history"
import { startPlayback } from "./playback"
import { toast } from "./toast"
import { putRecord } from "./trace"

/**
 * SessionStore：权威会话阶段。
 * waitingInputs → frozen → computing → committing → committed → playing → waitingInputs；
 * 失败回到原 head 并保留诊断。结算成功时先把完整 record 写入 trace store，
 * 再更新 commit/head——过程记录先于世界状态落地。
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
  // 默认执行路径：浏览器 mock 执行器对当前图真实求值。
  // referenceAdapter 只在“查看样例”入口显式指定。
  adapter: mockExecutorAdapter,
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
  // 先落完整过程记录（不可变），再更新世界与 commit/head；顺序保证任何时刻
  // 都不会出现“有提交但没有记录”的中间态。
  putRecord(result.record)
  const index = dataStore.getState().index
  if (index) {
    index.worlds.set(result.world.commitId, result.world)
    dataStore.setState({ index: { ...index } })
  }
  appendCommit(result.commit)
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
  const run = index?.runs.get(runId)
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
