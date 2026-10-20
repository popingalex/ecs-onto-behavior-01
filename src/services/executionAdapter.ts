import type { CommitDef, Diagnostic, WorldSnapshot } from '@/core/types'
import { delay } from '@/lib/id'

/**
 * 执行适配器边界：冻结后的回合交给参考器 / Rust core 计算，返回单个不可变结果。
 * UI 不根据连线、线程完成顺序或动画位置裁决业务。
 */
export interface SettleRequest {
  runId: string
  branchId: string
  baseCommit: string
  idempotencyKey: string
}

export type SettleResult =
  | { ok: true; commit: CommitDef; world: WorldSnapshot }
  | { ok: false; diagnostic: Diagnostic }

export interface ExecutionAdapter {
  name: string
  label: string
  settle(request: SettleRequest): Promise<SettleResult>
}

/** 预置回合结果，由 runs/*.json（simulate.py 生成）注册；不手工编造数字。 */
const precomputed = new Map<string, { commit: CommitDef; world: WorldSnapshot }>()

export function registerPrecomputedRound(branchId: string, baseCommit: string, result: { commit: CommitDef; world: WorldSnapshot }) {
  precomputed.set(`${branchId}:${baseCommit}`, result)
}

export const referenceAdapter: ExecutionAdapter = {
  name: 'mock-reference',
  label: 'Mock 参考器 · 结果待接入',
  async settle(request) {
    await delay(900)
    const hit = precomputed.get(`${request.branchId}:${request.baseCommit}`)
    if (hit) return { ok: true, ...hit }
    return {
      ok: false,
      diagnostic: {
        id: `settle:${request.idempotencyKey}`,
        severity: 'error',
        code: 'REFERENCE_RESULT_MISSING',
        message: `参考计算尚未接入：没有 ${request.baseCommit} 之后的回合结果（待 runs/*.json 或 Rust mock adapter）。分支头保持 ${request.baseCommit}。`,
      },
    }
  },
}
