import type { CommitDef, Diagnostic, WorldSnapshot } from "@/core/types"
import { dataStore } from "@/data/store"
import { composeModel } from "@/stores/modelDocuments"
import { historyStore } from "@/stores/history"
import {
  executeRound,
  type RoundResult,
} from "@/services/mock-executor"
import type { DomainDiagnostic } from "@/schema/model"

/**
 * 执行适配器边界：冻结后的回合交给执行器计算，返回单个不可变结果。
 * UI 不根据连线、线程完成顺序或动画位置裁决业务。
 *
 * 两个适配器分开标注：
 * - mockExecutorAdapter：浏览器 mock 执行器，按当前（saved 或指定 draft）模型真实求值；
 * - referenceAdapter：仅查阅 expected_runs 预置样例，不代表当前图的计算结果。
 */
export interface SettleRequest {
  runId: string
  branchId: string
  baseCommit: string
  idempotencyKey: string
  /** 试算输入：saved = 最近一次本地保存；draft = 当前草稿快照。默认 saved。 */
  modelView?: "saved" | "draft"
}

export type SettleResult = {
  ok: true
  commit: CommitDef
  world: WorldSnapshot
  /** 完整过程记录；调用方先写 trace store 再更新 commit/head。 */
  record: RoundResult
} | { ok: false ;diagnostic: Diagnostic }

export interface ExecutionAdapter {
  name: string
  label: string
  settle(request: SettleRequest): Promise<SettleResult>
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

/** 下一个提交 id：沿用 c0xx 序号；与已有提交冲突时追加分支后缀。 */
function nextCommitId(): string {
  const commits = historyStore.getState().commits
  let max = 0
  for (const id of Object.keys(commits)) {
    const m = /^c(\d+)$/.exec(id)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `c${String(max + 1).padStart(3, "0")}`
}

/** 预置样例回合（expected_runs），由 mock/seed 注册；只服务“查看样例”，不是默认路径。 */
const precomputed = new Map<string, {
  commit: CommitDef
  world: WorldSnapshot
  record: RoundResult
}>()

export function registerPrecomputedRound(
  branchId: string,
  baseCommit: string,
  result: { commit: CommitDef ;world: WorldSnapshot ;record: RoundResult },
) {
  precomputed.set(`${branchId}:${baseCommit}`, result)
}

export function hasPrecomputedRound(branchId: string, baseCommit: string) {
  return precomputed.has(`${branchId}:${baseCommit}`)
}

export const mockExecutorAdapter: ExecutionAdapter = {
  name: "mock-executor",
  label: "浏览器 mock 执行器 · 串行参考求值（当前图）",
  async settle(request) {
    const model = composeModel(request.modelView ?? "saved")
    const index = dataStore.getState().index
    const world =
      index?.worlds.get(request.baseCommit) ??
      (model.baseWorld.commitId === request.baseCommit
        ? model.baseWorld
        : undefined)
    if (!world)
      return {
        ok: false,
        diagnostic: {
          id: `settle:${request.idempotencyKey}`,
          severity: "error",
          code: "BASE_WORLD_MISSING",
          message: `找不到基准提交 ${request.baseCommit} 的世界快照，无法冻结输入；分支头保持 ${request.baseCommit}。`,
        },
      }
    const run = index?.runs.get(request.runId)
    const stepSeconds = run?.stepSeconds ?? 10
    const resultCommitId = nextCommitId()
    const outcome = executeRound({
      model,
      world: {
        commitId: world.commitId,
        simTime: world.simTime ?? model.baseWorld.simTime,
        values: world.values,
      },
      runId: request.runId,
      branchId: request.branchId,
      baseCommit: request.baseCommit,
      stepSeconds,
      recordId: `record-${resultCommitId}`,
      resultCommitId,
    })
    if (!outcome.ok) {
      const first = outcome.diagnostics.find((d) => d.severity === "error")!
      const diagnostic = toDiagnostic(first)
      return {
        ok: false,
        diagnostic: {
          ...diagnostic,
          message: `${diagnostic.message}（共 ${
            outcome.diagnostics.filter((d) => d.severity === "error").length
          } 个错误；未产生任何结果，分支头保持 ${request.baseCommit}）`,
        },
      }
    }
    const { result } = outcome
    const commit: CommitDef = {
      id: resultCommitId,
      runId: request.runId,
      branchId: request.branchId,
      parentId: request.baseCommit,
      round: Math.round(result.nextWorld.simTime / stepSeconds),
      simTime: result.nextWorld.simTime,
      summary: `当前图求值 · ${result.record.programRefs.join("、")}（${
        request.modelView === "draft" ? "草稿试算" : "已保存模型"
      }）`,
      checkpoint: false,
      source: "computed",
    }
    return { ok: true, commit, world: result.nextWorld, record: result }
  },
}

export const referenceAdapter: ExecutionAdapter = {
  name: "mock-reference",
  label: "参考样例查阅 · expected_runs（非当前图计算）",
  async settle(request) {
    const hit = precomputed.get(`${request.branchId}:${request.baseCommit}`)
    if (hit) return { ok: true, ...hit }
    return {
      ok: false,
      diagnostic: {
        id: `settle:${request.idempotencyKey}`,
        severity: "error",
        code: "REFERENCE_RESULT_MISSING",
        message: `没有 ${request.baseCommit} 之后的预置样例回合（expected_runs 只含三组对照样例）。分支头保持 ${request.baseCommit}。`,
      },
    }
  },
}
