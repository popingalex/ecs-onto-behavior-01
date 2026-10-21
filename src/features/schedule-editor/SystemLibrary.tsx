import { GitCommitHorizontal, Scale, Sigma } from "lucide-react"
import Card, { PanelHeader, SectionLabel } from "@/components/ui/Card"
import { Tag } from "@/components/ui/StatusTag"
import type { PrototypeModel, ScheduleDocument } from "@/schema/model"
import { refKey } from "@/schema/model"

export const DRAG_MIME = "application/x-ecs-schedule-node"

export type DragPayload =
  | { kind: "system" ;systemId: string }
  | { kind: "reducer" | "contract" | "commit" }

function startDrag(e: React.DragEvent, payload: DragPayload) {
  e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload))
  e.dataTransfer.effectAllowed = "move"
}

/** 左侧面板：System 库（拖入画布实例化）+ 结构节点（归约 / 合同 / 提交）。 */
export default function SystemLibrary({
  model,
  schedule,
  readOnly,
}: {
  model: PrototypeModel
  schedule: ScheduleDocument
  readOnly: boolean
}) {
  const placed = new Set(
    schedule.nodes.filter((n) => n.type === "SystemNode").map((n) => n.systemRef),
  )
  const hasCommit = schedule.nodes.some((n) => n.type === "CommitNode")
  const constraint = model.constraints[0]

  const item =
    "flex w-full items-center gap-2 rounded-ui border border-border bg-surface px-3 py-2 text-left text-label transition-colors"
  const draggableItem = `${item} cursor-grab hover:border-primary-line hover:bg-primary-soft/40`
  const disabledItem = `${item} cursor-not-allowed opacity-50`

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-3">
      <Card>
        <PanelHeader title="System 库" meta={<span className="tabular">{model.systems.length}</span>} />
        <div className="flex flex-col gap-2 px-3 py-3">
          {model.systems.map((s) => {
            const used = placed.has(s.id)
            return (
              <div
                key={s.id}
                draggable={!readOnly && !used}
                onDragStart={(e) => startDrag(e, { kind: "system", systemId: s.id })}
                title={used ? "已在调度中" : "拖入画布"}
                className={used || readOnly ? disabledItem : draggableItem}
              >
                <Sigma size={14} className="shrink-0 text-muted" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-ink">{s.label}</div>
                  <div className="truncate font-mono text-caption text-muted">
                    {s.id} → {refKey(s.programRef)}
                  </div>
                </div>
                {used ? (
                  <Tag size="sm">已放置</Tag>
                ) : (
                  <Tag size="sm" tone={s.enabled ? "success" : "neutral"}>
                    {s.enabled ? "启用" : "停用"}
                  </Tag>
                )}
              </div>
            )
          })}
          {model.systems.length === 0 ? (
            <p className="px-1 py-2 text-caption text-muted">
              没有 System；先到 P11 创建。
            </p>
          ) : null}
        </div>
      </Card>

      <SectionLabel className="mb-2 mt-4 px-1">结构节点</SectionLabel>
      <div className="flex flex-col gap-2">
        <div
          draggable={!readOnly && Boolean(constraint)}
          onDragStart={(e) => startDrag(e, { kind: "reducer" })}
          title="拖入画布；接收 System 的效果贡献"
          className={readOnly || !constraint ? disabledItem : draggableItem}
        >
          <Scale size={14} className="shrink-0 text-muted" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="font-medium text-ink">归约器</div>
            <div className="truncate font-mono text-caption text-muted">
              {constraint ? refKey(constraint) : "无可用约束"}
            </div>
          </div>
        </div>
        <div
          draggable={!readOnly && Boolean(constraint)}
          onDragStart={(e) => startDrag(e, { kind: "contract" })}
          title="拖入画布；合同裁决"
          className={readOnly || !constraint ? disabledItem : draggableItem}
        >
          <Scale size={14} className="shrink-0 text-muted" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="font-medium text-ink">合同裁决</div>
            <div className="truncate font-mono text-caption text-muted">
              {constraint ? refKey(constraint) : "无可用约束"}
            </div>
          </div>
        </div>
        <div
          draggable={!readOnly && !hasCommit}
          onDragStart={(e) => startDrag(e, { kind: "commit" })}
          title={hasCommit ? "一次回合只能原子提交一次" : "拖入画布"}
          className={readOnly || hasCommit ? disabledItem : draggableItem}
        >
          <GitCommitHorizontal size={14} className="shrink-0 text-muted" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="font-medium text-ink">原子提交</div>
            <div className="text-caption text-muted">atomicCommit</div>
          </div>
          {hasCommit ? <Tag size="sm">已放置</Tag> : null}
        </div>
      </div>

      <p className="mt-4 px-1 text-caption leading-5 text-muted">
        连线规则：System → System 为顺序 order；System → 归约器 / 合同裁决为效果
        effect；归约结果流向原子提交。product（显式中间产物）边当前不支持。
      </p>
    </div>
  )
}
