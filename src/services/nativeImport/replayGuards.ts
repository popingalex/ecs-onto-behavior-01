import type { NativeTickRow } from "./types"

/**
 * 帧重放护栏(H1/FRAME-02):对将用于重放的 tick 序列做完整性校验。
 * 丢帧/乱序/重复/分支不一致一律产生 error 诊断并拒绝构造帧态——
 * 不能拿 head 或最新值填空(REAL/FRAME:缺即拒绝)。
 */

export interface ReplayDiagnostic {
  code:
    | "REPLAY_EMPTY"
    | "REPLAY_FRAME_GAP"
    | "REPLAY_FRAME_DISORDER"
    | "REPLAY_FRAME_DUPLICATE"
    | "REPLAY_BRANCH_MISMATCH"
    | "REPLAY_REVISION_REGRESSION"
  severity: "error"
  message: string
}

export interface ReplayGuardsOptions {
  /** 允许的首帧(引擎语义:bundle 初始态=帧 0;直接从 1 开始的会话允许 1)。 */
  allowedFirstFrames?: number[]
  /** 参与校验的分支(缺省取首行 branchId)。 */
  branchId?: string
}

export function validateTicksForReplay(
  rows: NativeTickRow[],
  options: ReplayGuardsOptions = {},
): ReplayDiagnostic[] {
  const diagnostics: ReplayDiagnostic[] = []
  if (rows.length === 0) {
    return [{ code: "REPLAY_EMPTY", severity: "error", message: "无任何 tick 行,无法重放。" }]
  }
  const allowedFirst = options.allowedFirstFrames ?? [0, 1]
  const branchId = options.branchId ?? rows[0].branchId
  let lastFrame = -1
  const seen = new Set<number>()
  let lastRevision = -1
  for (const row of rows) {
    if (row.branchId !== branchId) {
      diagnostics.push({
        code: "REPLAY_BRANCH_MISMATCH",
        severity: "error",
        message: `tick 行分支 ${row.branchId} 与重放分支 ${branchId} 不一致(frame=${row.frame})。`,
      })
      continue
    }
    if (seen.has(row.frame)) {
      diagnostics.push({
        code: "REPLAY_FRAME_DUPLICATE",
        severity: "error",
        message: `帧 ${row.frame} 重复出现,重放次序不可判定。`,
      })
      continue
    }
    if (lastFrame >= 0 && row.frame !== lastFrame + 1) {
      if (row.frame < lastFrame) {
        diagnostics.push({
          code: "REPLAY_FRAME_DISORDER",
          severity: "error",
          message: `帧序倒退:${lastFrame} → ${row.frame}。`,
        })
      } else {
        diagnostics.push({
          code: "REPLAY_FRAME_GAP",
          severity: "error",
          message: `帧缺失:${lastFrame} 之后直接出现 ${row.frame}(${row.frame - lastFrame - 1} 帧无记录)。`,
        })
      }
    }
    if (lastFrame < 0 && !allowedFirst.includes(row.frame)) {
      diagnostics.push({
        code: "REPLAY_FRAME_GAP",
        severity: "error",
        message: `首帧 ${row.frame} 异常(允许 ${allowedFirst.join("/")} 起步,更早状态无据)。`,
      })
    }
    if (typeof row.revision === "number" && row.revision < lastRevision) {
      diagnostics.push({
        code: "REPLAY_REVISION_REGRESSION",
        severity: "error",
        message: `revision 倒退:${lastRevision} → ${row.revision}(frame=${row.frame})。`,
      })
    }
    if (typeof row.revision === "number") lastRevision = row.revision
    seen.add(row.frame)
    lastFrame = row.frame
  }
  return diagnostics
}

/** 引擎 HTTP 属性读取的帧解析检查(H1/FRAME-01):响应未按请求帧解析即拒绝使用。 */
export function assertResolvedFrame(requestedFrame: number, resolved: { tick?: number; frame?: number }): void {
  const resolvedFrame = resolved.tick ?? resolved.frame
  if (resolvedFrame === undefined || resolvedFrame !== requestedFrame) {
    throw new Error(
      `FRAME_NOT_RESOLVED:请求帧 ${requestedFrame},端点实际解析为 ${
        resolvedFrame === undefined ? "(未标明)" : String(resolvedFrame)
      }。该响应不得当作第 ${requestedFrame} 帧历史状态使用(查询参数形式会被引擎忽略并恒返 head;历史帧必须走路径参数端点或本地 delta 重放)。`,
    )
  }
}
