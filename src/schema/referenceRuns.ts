import { z } from 'zod'
import type { WorldSnapshot } from './model'

/**
 * expected_runs.v05.json：预期结果与过程记录的“参考样例”。
 * 只用于对照与历史样例展示，执行器不得按 caseId 查表代替执行当前图。
 */
const rawValue = z.union([z.number(), z.boolean(), z.string(), z.null(), z.tuple([z.number(), z.number(), z.number()])])
const schema = z.object({
  purpose: z.string(),
  runs: z.array(
    z.looseObject({
      caseId: z.string(),
      record: z.looseObject({
        id: z.string(),
        runId: z.string(),
        branchId: z.string(),
        baseCommit: z.string(),
        resultCommit: z.string(),
        simTimeBefore: z.number(),
        simTimeAfter: z.number(),
      }),
      nextWorld: z.object({ commitId: z.string(), simTime: z.number(), values: z.record(z.string(), z.record(z.string(), rawValue)) }),
    }),
  ),
})

export interface ReferenceRun {
  caseId: string
  recordId: string
  /** 样例里的 runId（run-prototype）；工作台的稳定运行 ID 仍是 run-main，见 mock/legacy.ts 迁移表。 */
  sampleRunId: string
  branchId: string
  baseCommit: string
  resultCommit: string
  simTimeBefore: number
  simTimeAfter: number
  nextWorld: WorldSnapshot
  /** 完整样例记录（systemExecutions / nodeExecutions / …），供 M4 对照，不作为执行输入。 */
  raw: Record<string, unknown>
}

export function parseReferenceRuns(raw: unknown): { purpose: string; runs: ReferenceRun[] } {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) throw new Error(`expected_runs 解析失败：${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('；')}`)
  return {
    purpose: parsed.data.purpose,
    runs: parsed.data.runs.map((r) => ({
      caseId: r.caseId,
      recordId: r.record.id,
      sampleRunId: r.record.runId,
      branchId: r.record.branchId,
      baseCommit: r.record.baseCommit,
      resultCommit: r.record.resultCommit,
      simTimeBefore: r.record.simTimeBefore,
      simTimeAfter: r.record.simTimeAfter,
      nextWorld: r.nextWorld,
      raw: r as Record<string, unknown>,
    })),
  }
}
