import type {
  WorkflowNodeEntity,
  WorkflowNodeRegistry,
} from "@flowgram.ai/free-layout-editor"
import { WorkflowNodeRenderer } from "@flowgram.ai/free-layout-editor"
import { CircleAlert } from "lucide-react"
import { cn } from "@/lib/cn"
import type { LogicNode } from "@/schema/model"
import type { LogicNodeData } from "@/services/logicGraphCodec"
import {
  CATEGORY_LABEL,
  DEFAULT_PREFIX,
  nodeTypeDef,
  NODE_TYPES,
  unitSymbol,
  type NodeTypeDef,
} from "@/services/domainBindingService"
import { useDraftModel } from "@/stores/modelDocuments"
import { useLogicEditor } from "./editorContext"
import { defaultPortsOf, NODE_WIDTH, nodeHeight, ROW_HEIGHT } from "./geometry"

const CATEGORY_DOT: Record<string, string> = {
  read: "bg-primary",
  compute: "bg-warning",
  emit: "bg-purple",
  value: "bg-success",
  control: "bg-muted",
}

/** 注册全部可用物料：端口与尺寸由 NODE_TYPES 静态推导，复制被禁（领域 id 需要重新生成）。 */
export function logicNodeRegistries(): WorkflowNodeRegistry[] {
  return NODE_TYPES.filter((d) => d.available).map((def) => ({
    type: def.type,
    meta: {
      defaultPorts: defaultPortsOf(def),
      size: { width: NODE_WIDTH, height: nodeHeight(def) },
      copyDisable: true,
    },
  }))
}

function SlotRow({
  def,
  node,
  slotId,
}: {
  def: NodeTypeDef
  node: LogicNode
  slotId: string
}) {
  const api = useLogicEditor()
  const slot = def.slots.find((s) => s.id === slotId)!
  const binding = node.bindings[slotId]
  const bound = binding?.root === "self" ? binding.propertyId : null
  return (
    <button
      type="button"
      disabled={api.readOnly}
      onClick={() => api.openSlotPicker(node.id, slotId)}
      className={cn(
        "flex w-full items-center gap-1.5 px-2.5 text-left text-caption",
        "hover:bg-subtle",
        api.readOnly && "cursor-default",
      )}
      style={{ height: 22 }}
      title={`${slot.label}：点击更改绑定`}
    >
      <span className="shrink-0 text-muted">{slot.label}</span>
      {bound ? (
        <span className="min-w-0 flex-1 truncate font-mono text-ink-soft">
          {bound}
        </span>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-1 text-danger">
          <CircleAlert size={11} aria-hidden />
          未绑定
        </span>
      )}
      {binding?.root === "self" && "view" in binding && binding.view ? (
        <span className="shrink-0 text-faint">{binding.view}</span>
      ) : null}
    </button>
  )
}

/** 节点卡片：渲染来自 NODE_TYPES 的端口 / 槽位与当前领域数据；端口圆点由 WorkflowNodeRenderer 按 locationConfig 绘制。 */
export default function LogicNodeCard({ node }: { node: WorkflowNodeEntity }) {
  const model = useDraftModel()
  const api = useLogicEditor()
  const domain = (node.toJSON().data as Partial<LogicNodeData> | undefined)
    ?.node
  const def = domain ? nodeTypeDef(domain.type) : undefined
  if (!domain || !def) return null
  const rows = Math.max(def.inputs.length, def.outputs.length)
  return (
    <WorkflowNodeRenderer
      node={node}
      className={cn(
        "rounded-ui border border-border bg-surface shadow-card transition-colors",
        "data-[node-selected=true]:border-primary data-[node-selected=true]:shadow-pop",
      )}
      onPortClick={(port) => {
        if (api.readOnly || port.portType !== "input") return
        const portDef = def.inputs.find(
          (p) => p.id === String(port.portID),
        )
        if (portDef?.bindable)
          api.openInputPicker(domain.id, String(port.portID))
      }}
    >
      <div style={{ width: NODE_WIDTH }}>
        <div className="flex h-[38px] items-center gap-2 border-b border-line px-2.5">
          <span
            className={cn(
              "h-2.5 w-2.5 shrink-0 rounded-full",
              CATEGORY_DOT[def.category] ?? "bg-muted",
            )}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-label font-semibold text-ink">
              {def.label}
            </div>
            <div className="truncate font-mono text-caption text-faint">
              {domain.id}
            </div>
          </div>
          <span className="shrink-0 text-caption text-muted">
            {CATEGORY_LABEL[def.category]}
          </span>
        </div>
        {def.slots.map((s) => (
          <SlotRow key={s.id} def={def} node={domain} slotId={s.id} />
        ))}
        {Array.from({ length: rows }, (_, i) => {
          const input = def.inputs[i]
          const output = def.outputs[i]
          return (
            <div
              key={i}
              className="flex items-center justify-between gap-2 px-2.5"
              style={{ height: ROW_HEIGHT }}
            >
              {input ? (
                <span className="flex min-w-0 items-center gap-1 text-caption text-ink-soft">
                  <span className="truncate">
                    {input.label}
                    {input.required ? (
                      <span className="text-danger"> *</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-faint">
                    {unitSymbol(model, domain.inputs[input.id]?.unitId)}
                  </span>
                  {domain.bindings[input.id] ? (
                    <span className="shrink-0 rounded bg-primary-soft px-1 text-[10px] text-primary-strong">
                      绑
                    </span>
                  ) : `${DEFAULT_PREFIX}${input.id}` in domain.params ? (
                    <span className="shrink-0 rounded bg-subtle px-1 text-[10px] text-muted">
                      默
                    </span>
                  ) : null}
                </span>
              ) : (
                <span />
              )}
              {output ? (
                <span className="flex min-w-0 items-center gap-1 text-caption text-ink-soft">
                  <span className="shrink-0 text-faint">
                    {unitSymbol(model, domain.outputs[output.id]?.unitId)}
                  </span>
                  <span className="truncate">{output.label}</span>
                </span>
              ) : (
                <span />
              )}
            </div>
          )
        })}
        <div style={{ height: 8 }} />
      </div>
    </WorkflowNodeRenderer>
  )
}
