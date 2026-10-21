import { z } from "zod"
import type { WorkflowJSON } from "@flowgram.ai/free-layout-editor"
import {
  exportDocumentFile,
  pickJsonFile,
} from "@/services/documentFile"
import {
  programToWorkflow,
  workflowToProgram,
} from "@/services/logicGraphCodec"
import { layoutSchema, normalizeProgram, seedParts } from "@/schema/parse"
import { describeError } from "@/stores/draftRegistry"
import {
  programContentSchema,
  type ProgramContent,
} from "@/stores/modelDocuments"

/**
 * 程序文档的导入 / 导出：载荷是 FlowGram WorkflowJSON（经 logicGraphCodec 生成），
 * 附带的 program/layout 作为回写基准（参数、元数据不经过画布）。
 * 导入先过 codec 往返，再过与本地恢复相同的 Zod 校验。
 */
export const LOGIC_FILE_FORMAT = "logic-graph/1"

const fileContentSchema = z.object({
  program: seedParts.logicPrograms.element.transform(normalizeProgram),
  layout: layoutSchema,
  workflow: z.custom<WorkflowJSON>(
    (v) =>
      typeof v === "object" &&
      v !== null &&
      Array.isArray((v as WorkflowJSON).nodes) &&
      Array.isArray((v as WorkflowJSON).edges),
    "workflow 不是有效的 FlowGram WorkflowJSON",
  ),
})

export function exportProgramFile(
  documentId: string,
  content: ProgramContent,
) {
  exportDocumentFile(
    LOGIC_FILE_FORMAT,
    documentId,
    {
      program: content.program,
      layout: content.layout,
      workflow: programToWorkflow(content.program, content.layout),
    },
    `${content.program.id}.logic.json`,
  )
}

export type ProgramImportResult =
  | { ok: true; content: ProgramContent }
  | { ok: false; reason: string }
  | { ok: "cancelled" }

/** 打开文件选择器并解析；用户取消返回 cancelled。 */
export async function importProgramFile(
  documentId: string,
): Promise<ProgramImportResult> {
  const picked = await pickJsonFile()
  if (!picked) return { ok: "cancelled" }
  let raw: unknown
  try {
    raw = JSON.parse(picked.text)
  } catch (error) {
    return { ok: false, reason: `不是有效的 JSON：${describeError(error)}` }
  }
  const file = raw as {
    format?: string
    documentId?: string
    content?: unknown
  } | null
  if (!file || typeof file !== "object" || file.format !== LOGIC_FILE_FORMAT)
    return {
      ok: false,
      reason: `文件格式不是 ${LOGIC_FILE_FORMAT}（读到 ${String(file?.format)}）`,
    }
  if (file.documentId !== documentId)
    return {
      ok: false,
      reason: `文件属于 ${String(file.documentId)}，当前编辑的是 ${documentId}；不跨文档导入`,
    }
  const parsed = fileContentSchema.safeParse(file.content)
  if (!parsed.success)
    return {
      ok: false,
      reason: `内容未通过校验：${describeError(parsed.error)}`,
    }
  let roundTripped: ProgramContent
  try {
    roundTripped = workflowToProgram(parsed.data.workflow, {
      program: parsed.data.program,
      layout: parsed.data.layout,
    })
  } catch (error) {
    return {
      ok: false,
      reason: `画布数据回写失败：${describeError(error)}`,
    }
  }
  const checked = programContentSchema.safeParse(roundTripped)
  if (!checked.success)
    return {
      ok: false,
      reason: `回写结果未通过校验：${describeError(checked.error)}`,
    }
  return { ok: true, content: checked.data }
}
