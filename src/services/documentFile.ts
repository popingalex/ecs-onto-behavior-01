import type { ZodType } from "zod"
import { describeError } from "@/stores/draftRegistry"

/**
 * 文档 JSON 导入 / 导出。文件外层带 format 标记与文档 id，内容与草稿文档同形；
 * 导入一律先过 Zod（与本地恢复同一份 schema），再由调用方以可撤销的整体替换写回草稿。
 */
export interface DocumentFile<T> {
  format: string
  documentId: string
  exportedAt: string
  content: T
}

export function exportDocumentFile<T>(
  format: string,
  documentId: string,
  content: T,
  fileName: string,
) {
  const file: DocumentFile<T> = {
    format,
    documentId,
    exportedAt: new Date().toISOString(),
    content,
  }
  const blob = new Blob([JSON.stringify(file, null, 2)], {
    type: "application/json",
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** 打开系统文件选择器读取一个 JSON 文本；用户取消时返回 null。 */
export function pickJsonFile(): Promise<{ name: string ;text: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "application/json,.json"
    input.addEventListener("change", () => {
      const file = input.files?.[0]
      if (!file) return resolve(null)
      file.text().then(
        (text) => resolve({ name: file.name, text }),
        () => resolve(null),
      )
    })
    input.addEventListener("cancel", () => resolve(null))
    input.click()
  })
}

export type ImportResult<T,> = { ok: true ;content: T } | {
  ok: false
  reason: string
}

export function parseDocumentFile<T>(
  text: string,
  format: string,
  documentId: string,
  schema: ZodType<T>,
): ImportResult<T> {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (error) {
    return { ok: false, reason: `不是有效的 JSON：${describeError(error)}` }
  }
  const file = raw as Partial<DocumentFile<unknown>> | null
  if (!file || typeof file !== "object" || file.format !== format)
    return {
      ok: false,
      reason: `文件格式不是 ${format}（读到 ${String(file && typeof file === "object" ? file.format : typeof raw)}）`,
    }
  if (file.documentId !== documentId)
    return {
      ok: false,
      reason: `文件属于 ${String(file.documentId)}，当前编辑的是 ${documentId}；不跨文档导入`,
    }
  const parsed = schema.safeParse(file.content)
  if (!parsed.success)
    return {
      ok: false,
      reason: `内容未通过校验：${describeError(parsed.error)}`,
    }
  return { ok: true, content: parsed.data }
}
