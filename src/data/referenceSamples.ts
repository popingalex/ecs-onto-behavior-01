import { loadPrototype } from "@/data/mockLoader"
import { referenceRound } from "@/mock/seed"
import { registerPrecomputedRound } from "@/services/executionAdapter"
import { roundResultFromSample } from "@/services/mock-executor"
import { putRecord } from "@/stores/trace"

/**
 * 注册 expected_runs 参考样例：预置回合（referenceAdapter 的“查看样例”数据源）
 * 与样例过程记录（P22/P23/P24 对照展示，origin = reference-sample）。
 * 幂等；只登记，不参与当前图求值。
 */
export function registerReferenceSamples() {
  const { model, referenceRuns } = loadPrototype()
  for (const run of referenceRuns) {
    const record = roundResultFromSample(run, model)
    const { commit, world } = referenceRound(run)
    registerPrecomputedRound(run.branchId, run.baseCommit, {
      commit,
      world,
      record,
    })
    putRecord(record)
  }
}
