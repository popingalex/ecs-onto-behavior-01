import { stableHash } from "@/lib/hash"
import { refKey, sameRef } from "@/schema/model"
import type {
  DomainDiagnostic,
  LogicGraphDocument,
  LogicNode,
  PrototypeModel,
  RawValue,
  SystemDefinition,
  WorldSnapshot,
} from "@/schema/model"
import { checkIntegrity } from "@/schema/parse"
import {
  inputSources,
  nodeTypeDef,
  queryMatches,
  topoOrder,
  validateProgram,
} from "@/services/domainBindingService"
import { compileSchedule } from "@/services/scheduleCompiler"
import type {
  ConstraintDecision,
  DependencyEdge,
  EffectAllocation,
  EffectRequest,
  ExecuteInput,
  ExecuteOutcome,
  NodeExecution,
  PropertyChange,
  RoundResult,
  SystemExecution,
} from "./types"

/**
 * 浏览器 mock 执行器：同步、确定性的串行参考求值。
 * 每一步都消费传入的模型 / 世界快照本身——没有 case 查表，没有 setTimeout 冒充计算。
 * 任一环节失败返回诊断数组，不产出半个 RoundResult。
 */

const TRACE_ORDERING =
  "canonical systemId/entityId/node order; not measured thread schedule"

interface Ctx {
  input: ExecuteInput
  diagnostics: DomainDiagnostic[]
  seq: number
}

function fail(ctx: Ctx, code: string, message: string): ExecuteOutcome {
  ctx.diagnostics.push({
    id: `${ctx.input.recordId}:${code}:${ctx.diagnostics.length + 1}`,
    severity: "error",
    code,
    message,
  })
  return { ok: false, diagnostics: ctx.diagnostics }
}

/** 冻结输入版本快照：语义哈希（布局不参与），执行后可据此判断记录对应哪一版输入。 */
function inputVersionsOf(
  model: PrototypeModel,
  scheduleId: string,
  programIds: string[],
  baseCommit: string,
): Record<string, string> {
  const versions: Record<string, string> = {
    schema: stableHash({
      units: model.units,
      entityTypes: model.entityTypes,
      components: model.components,
      attributes: model.attributes,
      templates: model.templates,
    }),
    scene: stableHash(model.scene),
    systems: stableHash({
      queries: model.queries,
      systems: model.systems,
      constraints: model.constraints,
    }),
    baseCommit,
  }
  for (const pid of programIds) {
    const program = model.programs.find((p) => p.id === pid)
    if (program)
      versions[`program:${pid}`] = `${refKey(program)}#${stableHash({
        parameters: program.parameters,
        nodes: program.nodes,
        edges: program.edges,
      })}`
  }
  const schedule = model.schedules.find((s) => s.id === scheduleId)
  if (schedule)
    versions[`schedule:${schedule.id}`] = `${refKey(schedule)}#${stableHash({
      nodes: schedule.nodes,
      edges: schedule.edges,
    })}`
  return versions
}

interface ExecutionScratch {
  values: Map<string, RawValue>
  /** 本 System 私有暂存：propertyId → 已提交贡献之和。其他 System 不可见。 */
  staged: Map<string, number>
  effects: EffectRequest[]
}

function resolveInputs(
  ctx: Ctx,
  program: LogicGraphDocument,
  system: SystemDefinition,
  node: LogicNode,
  previous: Record<string, RawValue>,
  scratch: ExecutionScratch,
): Record<string, RawValue> | null {
  const def = nodeTypeDef(node.type)
  const out: Record<string, RawValue> = {}
  for (const port of def?.inputs ?? []) {
    const [src] = inputSources(program, node.id, port.id)
    if (!src) continue // 必需输入缺失由 validateProgram 拦截；这里跳过
    if (src.kind === "edge") {
      const key = `${src.edge.source.nodeId}.${src.edge.source.portId}`
      out[port.id] = scratch.values.get(key) ?? null
      continue
    }
    if (src.kind === "default") {
      out[port.id] = src.value
      continue
    }
    const b = src.binding
    if (b.root === "self" && b.view === "previous") {
      out[port.id] = previous[b.propertyId] ?? null
    } else if (b.root === "parameter") {
      out[port.id] =
        system.parameters[b.parameterId] ??
        program.parameters.find((p) => p.id === b.parameterId)?.default ??
        null
    } else {
      // selfPreview 直接绑定 / relation 根在校验期已拒绝；执行期再挡一次。
      ctx.diagnostics.push({
        id: `${ctx.input.recordId}:BINDING_UNSUPPORTED:${ctx.diagnostics.length + 1}`,
        severity: "error",
        code: "BINDING_UNSUPPORTED",
        message: `${node.id}.${port.id} 的绑定根 ${b.root} 不能直接作为执行输入`,
        target: { documentId: program.id, nodeId: node.id, portId: port.id },
      })
      return null
    }
  }
  return out
}

function num(value: RawValue | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

/** 单 System × 单实体的程序求值；nodeExecution 的 seq 由 ctx 全局递增（规范顺序）。 */
function executeEntity(
  ctx: Ctx,
  program: LogicGraphDocument,
  system: SystemDefinition,
  entityId: string,
  previous: Record<string, RawValue>,
  contributeCount: number,
): { execution: SystemExecution ;nodes: NodeExecution[] ;effects: EffectRequest[] } | null {
  const { input } = ctx
  const executionId = `exec-${entityId}-${system.id}`
  const order = topoOrder(program)
  if (!order) return null // validateProgram 已报 GRAPH_CYCLE
  const scratch: ExecutionScratch = {
    values: new Map(),
    staged: new Map(),
    effects: [],
  }
  const nodes: NodeExecution[] = []
  /** 节点（传递）读取的属性版本：沿数据边向上游累积。 */
  const versionRefs = new Map<string, string[]>()
  const graphRef = refKey(program)

  for (const nodeId of order) {
    const node = program.nodes.find((n) => n.id === nodeId)!
    const inputs = resolveInputs(ctx, program, system, node, previous, scratch)
    if (!inputs) return null
    const refs = new Set<string>()
    for (const e of program.edges)
      if (e.target.nodeId === nodeId)
        for (const r of versionRefs.get(e.source.nodeId) ?? []) refs.add(r)

    let outputs: Record<string, RawValue> = {}
    let readRef: string | null = null
    const numericInputs = Object.values(inputs).filter(
      (v) => typeof v === "number",
    )
    const badNumber = numericInputs.some((v) => !Number.isFinite(v))

    switch (node.type) {
      case "ReadPrevious": {
        const b = node.bindings.property
        if (b?.root === "self") {
          outputs = { value: previous[b.propertyId] ?? null }
          readRef = `${entityId}.${b.propertyId}@${input.baseCommit}`
        }
        break
      }
      case "ReadSelfPreview": {
        const b = node.bindings.property
        if (b?.root === "self") {
          const base = num(previous[b.propertyId])
          const own = scratch.staged.get(b.propertyId) ?? 0
          outputs = { value: base === null ? null : base + own }
          readRef = `${entityId}.${b.propertyId}@${input.baseCommit}`
        }
        break
      }
      case "CoolingRoom": {
        const old = num(inputs.old)
        const source = num(inputs.source)
        if (old === null || source === null) {
          ctx.diagnostics.push({
            id: `${input.recordId}:VALUE_NOT_NUMERIC:${ctx.diagnostics.length + 1}`,
            severity: "error",
            code: "VALUE_NOT_NUMERIC",
            message: `${node.id}（CoolingRoom）的输入不是数值：old=${String(inputs.old)}，source=${String(inputs.source)}`,
            target: { documentId: program.id, nodeId: node.id },
          })
          return null
        }
        outputs = { room: Math.max(old - source, 0) }
        break
      }
      case "Min": {
        const a = num(inputs.a)
        const b = num(inputs.b)
        if (a === null || b === null) {
          ctx.diagnostics.push({
            id: `${input.recordId}:VALUE_NOT_NUMERIC:${ctx.diagnostics.length + 1}`,
            severity: "error",
            code: "VALUE_NOT_NUMERIC",
            message: `${node.id}（Min）的输入不是数值：a=${String(inputs.a)}，b=${String(inputs.b)}`,
            target: { documentId: program.id, nodeId: node.id },
          })
          return null
        }
        outputs = { value: Math.min(a, b) }
        break
      }
      case "Negate": {
        const value = num(inputs.value)
        if (value === null) {
          ctx.diagnostics.push({
            id: `${input.recordId}:VALUE_NOT_NUMERIC:${ctx.diagnostics.length + 1}`,
            severity: "error",
            code: "VALUE_NOT_NUMERIC",
            message: `${node.id}（Negate）的输入不是数值：${String(inputs.value)}`,
            target: { documentId: program.id, nodeId: node.id },
          })
          return null
        }
        outputs = { delta: -value }
        break
      }
      case "Constant":
        outputs = { value: node.params.value ?? null }
        break
      case "Parameter": {
        const id = String(node.params.parameterId ?? "")
        outputs = {
          value:
            system.parameters[id] ??
            program.parameters.find((p) => p.id === id)?.default ??
            null,
        }
        break
      }
      case "IsSome":
        outputs = {
          some: inputs.value !== null && inputs.value !== undefined,
        }
        break
      case "Contribute": {
        const b = node.bindings.target
        const delta = num(inputs.delta)
        if (b?.root !== "self" || delta === null) {
          ctx.diagnostics.push({
            id: `${input.recordId}:EFFECT_INVALID:${ctx.diagnostics.length + 1}`,
            severity: "error",
            code: "EFFECT_INVALID",
            message: `${node.id}（Contribute）目标或增量无效：target=${String(node.bindings.target?.root === "self" ? node.bindings.target.propertyId : "（未绑定）")}，delta=${String(inputs.delta)}`,
            target: { documentId: program.id, nodeId: node.id },
          })
          return null
        }
        scratch.staged.set(
          b.propertyId,
          (scratch.staged.get(b.propertyId) ?? 0) + delta,
        )
        const effectId =
          contributeCount === 1
            ? `eff-${entityId}-${system.id}`
            : `eff-${entityId}-${system.id}-${node.id}`
        const base = num(previous[b.propertyId])
        const staged = scratch.staged.get(b.propertyId) ?? 0
        const attr = ctx.input.model.attributes.find(
          (a) => a.id === b.propertyId,
        )
        scratch.effects.push({
          id: effectId,
          recordId: input.recordId,
          executionId,
          nodeId: node.id,
          systemId: system.id,
          entityId,
          propertyId: b.propertyId,
          requestedDelta: delta,
          unitId: node.inputs.delta?.unitId ?? null,
          selfPreview: base === null ? null : base + staged,
          previewUnitId: attr?.type.unitId ?? null,
          constraintRef:
            typeof node.params.constraintRef === "string"
              ? node.params.constraintRef
              : null,
        })
        outputs = { effect: effectId }
        break
      }
      default:
        ctx.diagnostics.push({
          id: `${input.recordId}:NODE_TYPE_UNKNOWN:${ctx.diagnostics.length + 1}`,
          severity: "error",
          code: "NODE_TYPE_UNKNOWN",
          message: `执行器不支持节点 ${node.id} 的类型 ${node.type}`,
          target: { documentId: program.id, nodeId: node.id },
        })
        return null
    }
    if (badNumber) {
      ctx.diagnostics.push({
        id: `${input.recordId}:VALUE_NOT_NUMERIC:${ctx.diagnostics.length + 1}`,
        severity: "error",
        code: "VALUE_NOT_NUMERIC",
        message: `${node.id} 的输入含非有限数值`,
        target: { documentId: program.id, nodeId: node.id },
      })
      return null
    }
    if (readRef) refs.add(readRef)
    versionRefs.set(nodeId, [...refs].sort())
    for (const [portId, value] of Object.entries(outputs))
      scratch.values.set(`${node.id}.${portId}`, value)

    ctx.seq += 1
    nodes.push({
      id: `${executionId}:${nodeId}`,
      recordId: input.recordId,
      executionId,
      systemId: system.id,
      entityId,
      nodeId,
      graphRef,
      seq: ctx.seq,
      status: "completed",
      inputs,
      outputs,
      outputUnitId: Object.values(node.outputs)[0]?.unitId ?? null,
      inputVersionRefs: [...refs].sort(),
      elapsedMs: null,
    })
  }

  const firstProperty = scratch.effects[0]?.propertyId
  const base = firstProperty ? num(previous[firstProperty]) : null
  const stagedTotal = firstProperty
    ? (scratch.staged.get(firstProperty) ?? 0)
    : 0
  return {
    execution: {
      id: executionId,
      recordId: input.recordId,
      systemId: system.id,
      entityId,
      programRef: graphRef,
      inputCommit: input.baseCommit,
      nodeExecutionIds: nodes.map((n) => n.id),
      localPreview: base === null ? null : base + stagedTotal,
      elapsedMs: null,
    },
    nodes,
    effects: scratch.effects,
  }
}

/** 比例裁决：额度 = max(old − floorC, 0)，按 |requested| 比例分配；拒绝的请求（反向升温）不参与分配。 */
function decide(
  ctx: Ctx,
  constraintRef: string,
  entityId: string,
  propertyId: string,
  effects: EffectRequest[],
  sharedEntity: boolean,
): ConstraintDecision | null {
  const { input } = ctx
  const constraint = input.model.constraints.find(
    (c) => refKey(c) === constraintRef,
  )
  const old = num(input.world.values[entityId]?.[propertyId])
  if (!constraint || old === null) {
    ctx.diagnostics.push({
      id: `${input.recordId}:DECISION_INPUT_MISSING:${ctx.diagnostics.length + 1}`,
      severity: "error",
      code: "DECISION_INPUT_MISSING",
      message: `无法裁决 ${entityId}.${propertyId}：约束 ${constraintRef} 或 previous 值缺失`,
    })
    return null
  }
  const budget = Math.max(old - constraint.floorC, 0)
  const rejected = new Set<string>()
  for (const e of effects)
    if (e.requestedDelta > 0) {
      rejected.add(e.id)
      ctx.diagnostics.push({
        id: `${input.recordId}:POSITIVE_DELTA_REJECTED:${ctx.diagnostics.length + 1}`,
        severity: "warning",
        code: "POSITIVE_DELTA_REJECTED",
        message: `${e.id} 请求反向升温 +${e.requestedDelta} K，超出 ${constraintRef} 的冷却额度域，已拒绝（不升温）`,
      })
    }
  const live = effects.filter((e) => !rejected.has(e.id))
  const totalRequested = live.reduce((s, e) => s + Math.abs(e.requestedDelta), 0)
  const scale = totalRequested > 0 ? Math.min(1, budget / totalRequested) : 1
  const allocations: EffectAllocation[] = effects.map((e) =>
    rejected.has(e.id)
      ? { effectId: e.id, approvedDelta: 0, status: "rejected" }
      : {
          effectId: e.id,
          approvedDelta: e.requestedDelta * scale,
          status: scale >= 1 ? "approved" : "partial",
        }
  )
  const candidate =
    old + live.reduce((s, e) => s + e.requestedDelta, 0)
  const final = old + allocations.reduce((s, a) => s + a.approvedDelta, 0)
  const attr = input.model.attributes.find((a) => a.id === propertyId)
  const decisionId = sharedEntity
    ? `decision-${entityId}-${propertyId}`
    : `decision-${entityId}`
  return {
    id: decisionId,
    recordId: input.recordId,
    entityId,
    propertyId,
    constraintRef,
    old,
    candidate,
    budget,
    budgetUnitId: effects[0]?.unitId ?? null,
    scale,
    allocations,
    final,
    valueUnitId: attr?.type.unitId ?? null,
  }
}

export function executeRound(input: ExecuteInput): ExecuteOutcome {
  const ctx: Ctx = { input, diagnostics: [], seq: 0 }
  const { model, world } = input

  if (world.commitId !== input.baseCommit)
    return fail(
      ctx,
      "BASE_WORLD_MISMATCH",
      `世界快照 ${world.commitId} 与基准提交 ${input.baseCommit} 不一致`,
    )

  // 1. 完整性：模式 / 场景 / 引用的跨对象检查
  for (const d of checkIntegrity(model)) ctx.diagnostics.push(d)
  if (ctx.diagnostics.some((d) => d.severity === "error"))
    return { ok: false, diagnostics: ctx.diagnostics }

  // 2. 调度编译：执行组由 schedule 推导（order 边改组序，effect 边定归约输入）
  const schedule =
    model.schedules.find((s) => s.id === input.scheduleId) ?? model.schedules[0]
  if (!schedule)
    return fail(ctx, "SCHEDULE_MISSING", "模型中没有可调度的 ScheduleDocument")
  const plan = compileSchedule(schedule, {
    systems: model.systems,
    constraints: model.constraints,
    attributes: model.attributes,
    baseCommit: input.baseCommit,
  })
  ctx.diagnostics.push(...plan.diagnostics)
  if (!plan.executable) return { ok: false, diagnostics: ctx.diagnostics }

  // 3. 参与执行的 System（启用、按规范顺序），逐个校验程序
  const plannedSystems = plan.groups
    .flatMap((g) => g.systems)
    .filter((p) => p.enabled)
    .sort((a, b) => (a.systemId < b.systemId ? -1 : 1))
  const systemDefs = new Map<string, SystemDefinition>()
  const programs = new Map<string, LogicGraphDocument>()
  for (const p of plannedSystems) {
    const system = model.systems.find((s) => s.id === p.systemId)
    if (!system) continue // compileSchedule 已报 SCHEDULE_SYSTEM_MISSING
    const program = model.programs.find((g) => sameRef(g, system.programRef))
    if (!program)
      return fail(
        ctx,
        "PROGRAM_REF_MISSING",
        `System ${system.id} 引用的程序 ${refKey(system.programRef)} 不存在`,
      )
    systemDefs.set(system.id, system)
    programs.set(system.id, program)
    for (const d of validateProgram(model, program)) ctx.diagnostics.push(d)
  }
  if (ctx.diagnostics.some((d) => d.severity === "error"))
    return { ok: false, diagnostics: ctx.diagnostics }

  // 4. 按组串行参考执行：所有 System 都读 baseWorld 的 previous 视图
  const systemExecutions: SystemExecution[] = []
  const nodeExecutions: NodeExecution[] = []
  const effectRequests: EffectRequest[] = []
  const queryView = {
    queries: model.queries,
    scene: model.scene,
    baseWorld: world,
  }
  for (const p of plannedSystems) {
    const system = systemDefs.get(p.systemId)!
    const program = programs.get(p.systemId)!
    const contributeCount = program.nodes.filter(
      (n) => n.type === "Contribute",
    ).length
    for (const entityId of queryMatches(queryView, system.queryRef)) {
      const previous = world.values[entityId]
      if (!previous)
        return fail(
          ctx,
          "ENTITY_MISSING",
          `基础提交 ${input.baseCommit} 中没有实体 ${entityId}`,
        )
      const ran = executeEntity(
        ctx,
        program,
        system,
        entityId,
        previous,
        contributeCount,
      )
      if (!ran) return { ok: false, diagnostics: ctx.diagnostics }
      systemExecutions.push(ran.execution)
      nodeExecutions.push(...ran.nodes)
      effectRequests.push(...ran.effects)
    }
  }

  // 5. 效果收集 → 比例裁决（effect 边确定归约输入）
  const decisions: ConstraintDecision[] = []
  const groups = new Map<string, EffectRequest[]>()
  for (const e of effectRequests) {
    if (!e.constraintRef)
      return fail(
        ctx,
        "EFFECT_WITHOUT_REDUCER",
        `${e.id} 没有归约约束（属性的 reducerRef 未配置），贡献无法裁决`,
      )
    const key = `${e.constraintRef}|${e.entityId}|${e.propertyId}`
    groups.set(key, [...(groups.get(key) ?? []), e])
  }
  const effectById = new Map(effectRequests.map((e) => [e.id, e]))
  const entityGroupCount = new Map<string, number>()
  for (const key of groups.keys()) {
    const entityId = key.split("|")[1]
    entityGroupCount.set(entityId, (entityGroupCount.get(entityId) ?? 0) + 1)
  }
  for (const [key, effects] of [...groups.entries()].sort()) {
    const [constraintRef, entityId, propertyId] = key.split("|")
    const decision = decide(
      ctx,
      constraintRef,
      entityId,
      propertyId,
      effects,
      (entityGroupCount.get(entityId) ?? 0) > 1,
    )
    if (!decision) return { ok: false, diagnostics: ctx.diagnostics }
    decisions.push(decision)
  }

  // 6. 原子结果：变更、下一世界、依赖边
  const changes: PropertyChange[] = decisions
    .filter((d) => d.final !== d.old)
    .map((d) => ({
      entityId: d.entityId,
      propertyId: d.propertyId,
      old: d.old,
      new: d.final,
      unitId: d.valueUnitId,
      versionId: `${d.entityId}.${d.propertyId}@${input.resultCommitId}`,
      decisionId: d.id,
    }))
  const nextWorld: WorldSnapshot = {
    commitId: input.resultCommitId,
    simTime: world.simTime + input.stepSeconds,
    values: structuredClone(world.values),
  }
  for (const c of changes)
    nextWorld.values[c.entityId] = {
      ...nextWorld.values[c.entityId],
      [c.propertyId]: c.new,
    }

  const dependencyEdges: DependencyEdge[] = []
  const usedSeen = new Set<string>()
  for (const n of nodeExecutions)
    for (const ref of n.inputVersionRefs) {
      const key = `${ref}->${n.executionId}`
      if (usedSeen.has(key)) continue
      usedSeen.add(key)
      dependencyEdges.push({ source: ref, target: n.executionId, kind: "used" })
    }
  for (const d of decisions) {
    for (const a of d.allocations) {
      const effect = effectById.get(a.effectId)
      if (effect)
        dependencyEdges.push({
          source: effect.executionId,
          target: d.id,
          kind: "proposed",
        })
    }
    const change = changes.find(
      (c) => c.decisionId === d.id,
    )
    if (change)
      dependencyEdges.push({
        source: d.id,
        target: change.versionId,
        kind: "generated",
      })
  }

  const programRefs = [
    ...new Set(plannedSystems.map((p) => programs.get(p.systemId)!)),
  ].map((p) => refKey(p))
  const result: RoundResult = {
    record: {
      id: input.recordId,
      runId: input.runId,
      branchId: input.branchId,
      baseCommit: input.baseCommit,
      resultCommit: input.resultCommitId,
      modelVersion: model.schemaVersion,
      scheduleRef: refKey(schedule),
      programRefs,
      inputVersions: inputVersionsOf(
        model,
        schedule.id,
        [...new Set(plannedSystems.map((p) => programs.get(p.systemId)!.id))],
        input.baseCommit,
      ),
      simTimeBefore: world.simTime,
      simTimeAfter: nextWorld.simTime,
      logicalParallelGroups: [
        ...plan.groups
          .map((g) =>
            g.systems
              .filter((s) => s.enabled)
              .map((s) => s.systemId)
              .sort(),
          )
          .filter((g) => g.length > 0),
        plan.reducers.map((r) => r.nodeId),
        ...(plan.commitNodeId ? [[plan.commitNodeId]] : []),
      ].filter((g) => g.length > 0),
      elapsedMs: null,
      traceOrdering: TRACE_ORDERING,
    },
    origin: "computed",
    nextWorld,
    programs: Object.fromEntries(
      [...programs.values()].map((p) => [refKey(p), structuredClone(p)]),
    ),
    systemExecutions,
    nodeExecutions,
    effectRequests,
    decisions,
    changes,
    dependencyEdges,
    diagnostics: ctx.diagnostics,
  }
  return { ok: true, result }
}
