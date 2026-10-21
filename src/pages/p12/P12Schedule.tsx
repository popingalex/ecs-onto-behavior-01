import { CheckCircle2, Redo2, Save, Undo2 } from "lucide-react"
import type { WorkbenchContext } from "@/app/useWorkbenchContext"
import Button from "@/components/ui/Button"
import { Notice } from "@/components/ui/Card"
import { Tag } from "@/components/ui/StatusTag"
import ScheduleEditor from "@/features/schedule-editor/ScheduleEditor"
import { navigate } from "@/router/router"
import { canEdit, useRole } from "@/stores/context"
import {
  isDocumentDirty,
  redoDocument,
  saveDocument,
  undoDocument,
  useEditingDocument,
  validateDocument,
} from "@/stores/draftRegistry"
import {
  scheduleDocId,
  useDraftModel,
  useModelDocument,
  type ScheduleContent,
} from "@/stores/modelDocuments"
import { toast } from "@/stores/toast"

/** P12 System 外层调度：React Flow 图编辑 schedule:<id> 草稿文档（与程序文档独立 undo）。 */
export default function P12Schedule({ ctx }: { ctx: WorkbenchContext }) {
  const model = useDraftModel()
  const scheduleId = ctx.route.params.scheduleId ?? "schedule-main"
  const docId = scheduleDocId(scheduleId)
  useEditingDocument(docId)
  const doc = useModelDocument<ScheduleContent>(docId)
  const role = useRole()
  const readOnly = !canEdit(role)

  const schedule = model.schedules.find((s) => s.id === scheduleId)
  if (!doc || !schedule) {
    return (
      <div className="mx-auto w-full max-w-[960px] px-6 py-6">
        <Notice
          tone="warning"
          actions={
            <Button size="sm" onClick={() => navigate({ pageId: "P11", params: {} })}>
              去 System 定义
            </Button>
          }
        >
          调度 {scheduleId} 不在当前模型中。
        </Notice>
      </div>
    )
  }

  const dirty = isDocumentDirty(doc)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-body">
            <span className="font-semibold">{scheduleId}</span>
            <span className="font-mono text-label text-muted">
              {schedule.version}
            </span>
            <Tag size="sm" tone="neutral">
              {schedule.outputMode}
            </Tag>
            <Tag size="sm" tone="neutral">
              读 {schedule.readView}
            </Tag>
            {dirty ? (
              <Tag size="sm" tone="warning">
                未保存
              </Tag>
            ) : null}
          </div>
        </div>
        <span className="hidden min-w-0 truncate text-label text-muted 2xl:inline">
          外层只有 System / 归约器 / 合同裁决 / 原子提交；内层节点在 P14。
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
            icon={CheckCircle2}
            busy={doc.validating}
            onClick={() =>
              void validateDocument(docId).then((ok) =>
                ok
                  ? toast(`${doc.label} 校验通过`)
                  : toast(`${doc.label} 校验未通过，见计划预览诊断`, "warning"),
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
      <ScheduleEditor docId={docId} readOnly={readOnly} />
    </div>
  )
}
