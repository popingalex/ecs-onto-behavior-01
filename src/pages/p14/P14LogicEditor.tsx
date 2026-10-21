import { useState } from "react"
import {
  CheckCircle2,
  Download,
  Redo2,
  Save,
  Undo2,
  Upload,
} from "lucide-react"
import type { WorkbenchContext } from "@/app/useWorkbenchContext"
import Button from "@/components/ui/Button"
import { Notice } from "@/components/ui/Card"
import { Tag } from "@/components/ui/StatusTag"
import LogicEditor from "@/features/logic-editor/LogicEditor"
import {
  exportProgramFile,
  importProgramFile,
} from "@/features/logic-editor/programFile"
import { navigate } from "@/router/router"
import { canEdit, useRole } from "@/stores/context"
import {
  applyEdit,
  isDocumentDirty,
  redoDocument,
  saveDocument,
  undoDocument,
  useEditingDocument,
  validateDocument,
} from "@/stores/draftRegistry"
import {
  programDocId,
  useDraftModel,
  useModelDocument,
  type ProgramContent,
} from "@/stores/modelDocuments"
import { toast } from "@/stores/toast"

/** P14 System 内部逻辑：FlowGram 节点图编辑 program:<id> 草稿文档。 */
export default function P14LogicEditor({ ctx }: { ctx: WorkbenchContext }) {
  const model = useDraftModel()
  const programId =
    ctx.route.params.programId ?? ctx.route.params.graphId ?? "g-cool"
  const docId = programDocId(programId)
  useEditingDocument(docId)
  const doc = useModelDocument<ProgramContent>(docId)
  const role = useRole()
  const readOnly = !canEdit(role)
  const [importing, setImporting] = useState(false)

  const program = model.programs.find((p) => p.id === programId)
  if (!doc || !program) {
    return (
      <div className="mx-auto w-full max-w-[960px] px-6 py-6">
        <Notice
          tone="warning"
          actions={
            <Button
              size="sm"
              onClick={() => navigate({ pageId: "P30", params: {} })}
            >
              去程序资产库
            </Button>
          }
        >
          程序 {programId} 不在当前模型中；到 P30 新建或选择一个程序。
        </Notice>
      </div>
    )
  }

  const dirty = isDocumentDirty(doc)
  const systems = model.systems.filter(
    (s) => s.programRef.id === programId,
  )

  const doImport = async () => {
    setImporting(true)
    try {
      const result = await importProgramFile(docId)
      if (result.ok === "cancelled") return
      if (!result.ok) {
        toast(result.reason, "warning")
        return
      }
      applyEdit<ProgramContent>(docId, `导入 ${docId}`, () => result.content)
      toast(`已导入 ${docId}（codec 往返保 nodeId / portId / binding / 单位）`)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-body">
            <span className="font-semibold">{programId}</span>
            <span className="font-mono text-label text-muted">
              {program.version}
            </span>
            <Tag size="sm" tone="neutral">
              {program.scopeType}
            </Tag>
            {dirty ? (
              <Tag size="sm" tone="warning">
                未保存
              </Tag>
            ) : null}
          </div>
        </div>
        <span className="hidden min-w-0 truncate text-label text-muted xl:inline">
          {systems.length > 0
            ? `被 ${systems.map((s) => s.id).join("、")} 引用`
            : "没有 System 引用这个程序"}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            size="sm"
            intent="ghost"
            icon={Undo2}
            disabled={doc.undo.length === 0}
            onClick={() => undoDocument(docId)}
          >
            撤销
          </Button>
          <Button
            size="sm"
            intent="ghost"
            icon={Redo2}
            disabled={doc.redo.length === 0}
            onClick={() => redoDocument(docId)}
          >
            重做
          </Button>
          <span className="h-5 w-px bg-border" aria-hidden />
          <Button
            size="sm"
            intent="ghost"
            icon={Download}
            onClick={() => exportProgramFile(docId, doc.content)}
          >
            导出
          </Button>
          <Button
            size="sm"
            intent="ghost"
            icon={Upload}
            disabled={readOnly}
            busy={importing}
            onClick={() => void doImport()}
          >
            导入
          </Button>
          <Button
            size="sm"
            intent="ghost"
            icon={CheckCircle2}
            busy={doc.validating}
            onClick={() =>
              void validateDocument(docId).then((ok) =>
                ok
                  ? toast(`${doc.label} 校验通过`)
                  : toast(`${doc.label} 校验未通过，见下方诊断`, "warning"),
              )
            }
          >
            校验
          </Button>
          <Button
            size="sm"
            intent="primary"
            icon={Save}
            disabled={!dirty || readOnly}
            busy={doc.saving}
            onClick={() =>
              void saveDocument(docId).then(
                (ok) => ok && toast(`${doc.label} 已本地保存`),
              )
            }
          >
            保存
          </Button>
        </div>
      </div>
      <LogicEditor docId={docId} programId={programId} readOnly={readOnly} />
    </div>
  )
}
