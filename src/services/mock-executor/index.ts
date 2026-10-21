import type { ReferenceRun } from "@/schema/referenceRuns"
import type { PrototypeModel, WorldSnapshot } from "@/schema/model"
import type {
  ConstraintDecision,
  DependencyEdge,
  EffectRequest,
  NodeExecution,
  PropertyChange,
  RoundResult,
  SystemExecution,
} from "./types"

export { executeRound } from "./executeRound"
export * from "./types"

/**
 * expected_runs.v05.json 的样例记录 → RoundResult（origin = reference-sample）。
 * 只用于“查看样例”与过程页对照展示；执行当前图永远走 executeRound。
 */
export function roundResultFromSample(
  run: ReferenceRun,
  model: PrototypeModel,
): RoundResult {
  const raw = run.raw as {
    record: RoundResult["record"]
    systemExecutions: SystemExecution[]
    nodeExecutions: NodeExecution[]
    effectRequests: EffectRequest[]
    constraintDecisions: ConstraintDecision[]
    propertyChanges: PropertyChange[]
    dependencyEdges: DependencyEdge[]
    diagnostics: RoundResult["diagnostics"]
  }
  return {
    record: {
      ...raw.record,
      elapsedMs: null,
      inputVersions: {
        sample: run.recordId,
        model: raw.record.modelVersion,
        schedule: raw.record.scheduleRef,
        ...Object.fromEntries(
          raw.record.programRefs.map((p) => [`program:${p.split("@")[0]}`, p]),
        ),
        baseCommit: raw.record.baseCommit,
      },
    },
    origin: "reference-sample",
    nextWorld: structuredClone(run.nextWorld) as WorldSnapshot,
    programs: Object.fromEntries(
      raw.record.programRefs
        .map((ref) => {
          const [id, version] = ref.split("@")
          const program = model.programs.find(
            (p) => p.id === id && p.version === version,
          )
          return program ? [ref, structuredClone(program)] : null
        })
        .filter((e): e is [string, (typeof model.programs)[number]] =>
          Boolean(e),
        ),
    ),
    systemExecutions: structuredClone(raw.systemExecutions),
    nodeExecutions: structuredClone(raw.nodeExecutions),
    effectRequests: structuredClone(raw.effectRequests),
    decisions: structuredClone(raw.constraintDecisions),
    changes: structuredClone(raw.propertyChanges),
    dependencyEdges: structuredClone(raw.dependencyEdges),
    diagnostics: structuredClone(raw.diagnostics),
  }
}
