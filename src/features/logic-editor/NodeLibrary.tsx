import { Ban, GripVertical } from "lucide-react"
import { cn } from "@/lib/cn"
import {
  CATEGORY_LABEL,
  NODE_TYPES,
  type NodeCategory,
  type NodeTypeDef,
} from "@/services/domainBindingService"
import { LOGIC_NODE_MIME, useLogicEditor } from "./editorContext"

const CATEGORY_ORDER: NodeCategory[] = [
  "read",
  "compute",
  "emit",
  "value",
  "control",
]

function LibraryItem({
  def,
  onAdd,
}: {
  def: NodeTypeDef
  onAdd: (type: string) => void
}) {
  const api = useLogicEditor()
  const disabled = !def.available || api.readOnly
  return (
    <li>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled || undefined}
        draggable={!disabled}
        onDragStart={(e) => {
          e.dataTransfer.setData(LOGIC_NODE_MIME, def.type)
          e.dataTransfer.effectAllowed = "copy"
        }}
        onDoubleClick={() => {
          if (!disabled) onAdd(def.type)
        }}
        title={def.available ? def.summary : def.unavailableReason}
        className={cn(
          "flex items-start gap-2 rounded-ui border border-border bg-surface px-2.5 py-2 transition-colors",
          disabled
            ? "cursor-not-allowed opacity-55"
            : "cursor-grab hover:border-primary hover:shadow-card",
        )}
      >
        {def.available ? (
          <GripVertical size={14} className="mt-0.5 shrink-0 text-faint" />
        ) : (
          <Ban size={14} className="mt-0.5 shrink-0 text-faint" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-label font-medium text-ink">
            {def.label}
          </span>
          <span className="block text-caption text-muted">
            {def.available ? def.summary : `暂不提供：${def.unavailableReason}`}
          </span>
        </span>
      </div>
    </li>
  )
}

/** 左栏节点库：拖入画布或双击添加；不可用物料置灰并说明，不做可点击假实现。 */
export default function NodeLibrary({
  onAdd,
}: {
  onAdd: (type: string) => void
}) {
  return (
    <div className="scroll-thin flex h-full min-h-0 flex-col overflow-auto">
      <div className="border-b border-line px-3 py-2.5 text-caption text-muted">
        拖入画布，或双击添加到画布
      </div>
      {CATEGORY_ORDER.map((cat) => {
        const defs = NODE_TYPES.filter((d) => d.category === cat)
        if (!defs.length) return null
        return (
          <section key={cat} className="px-3 py-2">
            <h3 className="pb-1.5 text-caption font-semibold tracking-wide text-muted">
              {CATEGORY_LABEL[cat]}
            </h3>
            <ul className="flex flex-col gap-1.5">
              {defs.map((d) => (
                <LibraryItem key={d.type} def={d} onAdd={onAdd} />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
