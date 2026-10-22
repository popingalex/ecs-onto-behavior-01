import { loadPrototype } from "@/data/mockLoader"
import type { PrototypeModel } from "@/schema/model"
import { queryMatches } from "@/services/domainBindingService"
import {
  executeRound,
  type ExecuteInput,
  type RoundResult,
} from "@/services/mock-executor"

/**
 * W5.4 性能/容量基线（design/03 §9 W5.4「真实基线」）。
 * 由 scripts/perf-baseline.mjs 驱动；环境信息（机器/Node/commit）由驱动打印。
 * 0.5s 结算 / 1s 播放是长期目标，这里只登记差距，不以小 fixture 宣布合格。
 */

function baseModel(): PrototypeModel {
  return structuredClone(loadPrototype().model)
}

/** 在种子场景上追加 n 个合成火源实体（同 Fire 类型与组件，独立 id），用于放大构造。 */
function synthModel(n: number): PrototypeModel {
  const model = baseModel()
  const fire = model.scene.entities.find((e) => e.typeId === "Fire")!
  for (let i = 1; i <= n; i++) {
    const id = `FS${String(i).padStart(5, "0")}`
    model.scene.entities.push({
      ...structuredClone(fire),
      id,
      label: `合成火源 ${i}`,
      templateRef: null,
    })
    model.baseWorld.values[id] = {
      "thermal.temperature": 40 + (i % 60),
      "fire.active": true,
      "position.local": [i % 400, Math.floor(i / 400), 0],
    }
  }
  return model
}

function inputFor(model: PrototypeModel, id: string): ExecuteInput {
  return {
    model,
    world: structuredClone(model.baseWorld),
    runId: "run-main",
    branchId: "main",
    baseCommit: model.baseWorld.commitId,
    stepSeconds: 10,
    recordId: `perf-${id}`,
    resultCommitId: `cp-${id}`,
  }
}

function mustRun(input: ExecuteInput): RoundResult {
  const out = executeRound(input)
  if (!out.ok)
    throw new Error(
      out.diagnostics.map((d) => `${d.code}: ${d.message}`).join("；"),
    )
  return out.result
}

function percentile(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]
}

function kb(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MiB`
    : `${(bytes / 1024).toFixed(1)} KiB`
}

export async function runPerfBaseline(): Promise<string> {
  const lines: string[] = [
    `W5 性能基线 · ${new Date().toISOString()}`,
    "",
  ]

  // 1. 查询预览（q-fire，3 实体）：queryMatches 单次与 1000 次平均
  {
    const model = baseModel()
    const q = model.queries.find((x) => x.id === "q-fire")!
    const view = { queries: model.queries, scene: model.scene, baseWorld: model.baseWorld }
    const ref = { id: q.id, version: q.version }
    const t0 = performance.now()
    const matched = queryMatches(view, ref)
    const singleMs = performance.now() - t0
    const w0 = performance.now()
    for (let i = 0; i < 10; i++) queryMatches(view, ref)
    const t1 = performance.now()
    for (let i = 0; i < 1000; i++) queryMatches(view, ref)
    const avgMs = (performance.now() - t1) / 1000
    lines.push(
      `== 查询预览 q-fire（${matched.length} 实体命中）==`,
      `  首次 ${singleMs.toFixed(3)} ms；1000 次平均 ${avgMs.toFixed(4)} ms`,
      "",
    )
  }

  // 2. 一次 executeRound 参考执行（3 实体基线，200 次取平均/p95，10 次预热）
  {
    const model = baseModel()
    for (let i = 0; i < 10; i++) mustRun(inputFor(model, `w${i}`))
    const times: number[] = []
    let result!: RoundResult
    for (let i = 0; i < 200; i++) {
      const t0 = performance.now()
      result = mustRun(inputFor(model, `r${i}`))
      times.push(performance.now() - t0)
    }
    times.sort((a, b) => a - b)
    const avg = times.reduce((s, t) => s + t, 0) / times.length
    const traceBytes = JSON.stringify(result).length
    lines.push(
      `== executeRound 参考执行（3 实体 × 2 system，含完整 trace）==`,
      `  200 次：平均 ${avg.toFixed(3)} ms，p50 ${percentile(times, 50).toFixed(3)} ms，p95 ${percentile(times, 95).toFixed(3)} ms，max ${times[times.length - 1].toFixed(3)} ms`,
      `  单次 RoundResult 序列化体积 ${kb(traceBytes)}（节点轨迹 ${result.nodeExecutions.length} 条）`,
      "",
    )
  }

  // 3. 放大构造：合成场景 N 实体求值（含 trace 生成与序列化体积）
  for (const n of [100, 1000, 10000]) {
    const total = n + 6 // 种子 3 火源 + 2 车 + 1 指挥
    try {
      const buildStart = performance.now()
      const model = synthModel(n)
      const buildMs = performance.now() - buildStart
      const runs = n >= 10000 ? 1 : 3
      const times: number[] = []
      let result!: RoundResult
      for (let i = 0; i < runs; i++) {
        const t0 = performance.now()
        result = mustRun(inputFor(model, `s${n}-${i}`))
        times.push(performance.now() - t0)
      }
      const s0 = performance.now()
      const traceBytes = JSON.stringify(result).length
      const stringifyMs = performance.now() - s0
      lines.push(
        `== 合成场景 ${n} 火源（场景共 ${total} 实体）==`,
        `  场景构造 ${buildMs.toFixed(0)} ms；executeRound ${runs === 1 ? "单次" : `${runs} 次平均`} ${(times.reduce((s, t) => s + t, 0) / times.length).toFixed(1)} ms（${times.map((t) => t.toFixed(0)).join("/")}）`,
        `  轨迹规模：systemExecutions ${result.systemExecutions.length}，nodeExecutions ${result.nodeExecutions.length}，effectRequests ${result.effectRequests.length}，decisions ${result.decisions.length}，dependencyEdges ${result.dependencyEdges.length}`,
        `  RoundResult 序列化 ${kb(traceBytes)}（stringify ${stringifyMs.toFixed(0)} ms）`,
        "",
      )
    } catch (error) {
      lines.push(
        `== 合成场景 ${n} 火源（场景共 ${total} 实体）==`,
        `  未跑通：${error instanceof Error ? error.message : String(error)}`,
        "",
      )
    }
  }
  return lines.join("\n")
}
