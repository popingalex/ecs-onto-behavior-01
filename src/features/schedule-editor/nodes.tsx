import { Handle, Position, type Node, type NodeProps } from "@xyflow/react"
import { GitCommitHorizontal, Pause, Play, Scale, Sigma } from "lucide-react"
import type { ReactNode, CSSProperties } from "react"
import { Tag } from "@/components/ui/StatusTag"
import { refKey } from "@/schema/model"
import { NODE_TYPE_LABEL } from "@/services/scheduleCompiler"
import type { ScheduleNodeData } from "./codec"
import { useScheduleEditor } from "./editorContext"

/** 默认 6px 的把手在小缩放下难命中；放大并上色。 */
const HANDLE_STYLE: CSSProperties = {
  width: 12,
  height: 12,
  background: "#087f8c",
  border: "2px solid #ffffff",
}

/**
 * 外层调度的四种节点：System / 归约器 / 合同裁决 / 原子提交。
 * 这里刻意不注册内层节点类型（ReadPrevious / Min / Contribute 只属于 P14）。
 */
type FlowNode<T extends ScheduleNodeData["node"]["type"]> = Node<
  ScheduleNodeData,
  T
>

function Shell({
  selected,
  icon,
  title,
  subtitle,
  tags,
  dimmed,
}: {
  selected?: boolean
  icon: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  tags?: ReactNode
  dimmed?: boolean
}) {
  return (
    <div
      className={`w-[220px] rounded-ui border bg-surface text-left shadow-card transition-colors ${
        selected ? "border-primary ring-2 ring-primary/20" : "border-border"
      } ${dimmed ? "opacity-60" : ""}`}
    >
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <span className="text-muted" aria-hidden>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-label font-semibold text-ink">
            {title}
          </div>
          {subtitle ? (
            <div className="truncate font-mono text-caption text-muted">
              {subtitle}
            </div>
          ) : null}
        </div>
        {tags}
      </div>
    </div>
  )
}

export function SystemNodeCard({ data, selected }: NodeProps<FlowNode<"SystemNode">>) {
  const api = useScheduleEditor()
  const node = data.node
  if (node.type !== "SystemNode") return null
  const system = api.model.systems.find((s) => s.id === node.systemRef)
  const enabled = system?.enabled ?? false
  return (
    <div
      onDoubleClick={(e) => {
        e.stopPropagation()
        api.openProgram(node.systemRef)
      }}
      title="双击打开 P14 内部逻辑"
    >
      <Handle type="target" position={Position.Left} style={HANDLE_STYLE} />
      <Shell
        selected={selected}
        dimmed={!enabled}
        icon={<Sigma size={14} />}
        title={system?.label ?? node.systemRef}
        subtitle={`${NODE_TYPE_LABEL.SystemNode} · ${node.systemRef}`}
        tags={
          <button
            type="button"
            disabled={api.readOnly || !system}
            onClick={(e) => {
              e.stopPropagation()
              api.toggleSystem(node.systemRef)
            }}
            title={enabled ? "停用（执行时跳过）" : "启用"}
            className="nodrag shrink-0 cursor-pointer"
          >
            <Tag size="sm" tone={enabled ? "success" : "neutral"}>
              {enabled ? <Play size={11} aria-hidden /> : <Pause size={11} aria-hidden />}
              {enabled ? "启用" : "停用"}
            </Tag>
          </button>
        }
      />
      {system ? (
        <div className="flex flex-col gap-0.5 px-3 py-2 text-caption text-muted">
          <div className="truncate">
            查询 <span className="font-mono">{refKey(system.queryRef)}</span>
          </div>
          <div className="truncate">
            程序 <span className="font-mono">{refKey(system.programRef)}</span>
          </div>
        </div>
      ) : (
        <div className="px-3 py-2 text-caption text-danger">
          System 定义不存在
        </div>
      )}
      <Handle type="source" position={Position.Right} style={HANDLE_STYLE} />
    </div>
  )
}

export function ReducerNodeCard({ data, selected }: NodeProps<FlowNode<"ReducerNode">>) {
  const api = useScheduleEditor()
  const node = data.node
  if (node.type !== "ReducerNode") return null
  const constraint = api.model.constraints.find(
    (c) => c.id === node.constraintRef.id && c.version === node.constraintRef.version,
  )
  return (
    <div>
      <Handle type="target" position={Position.Left} style={HANDLE_STYLE} />
      <Shell
        selected={selected}
        icon={<Scale size={14} />}
        title={NODE_TYPE_LABEL.ReducerNode}
        subtitle={refKey(node.constraintRef)}
        tags={
          constraint ? (
            <Tag size="sm" tone="primary">
              {constraint.strategy}
            </Tag>
          ) : (
            <Tag size="sm" tone="danger">
              缺失
            </Tag>
          )
        }
      />
      <Handle type="source" position={Position.Right} style={HANDLE_STYLE} />
    </div>
  )
}

export function ContractNodeCard({ data, selected }: NodeProps<FlowNode<"ContractNode">>) {
  const api = useScheduleEditor()
  const node = data.node
  if (node.type !== "ContractNode") return null
  const constraint = api.model.constraints.find(
    (c) => c.id === node.constraintRef.id && c.version === node.constraintRef.version,
  )
  return (
    <div>
      <Handle type="target" position={Position.Left} style={HANDLE_STYLE} />
      <Shell
        selected={selected}
        icon={<Scale size={14} />}
        title={NODE_TYPE_LABEL.ContractNode}
        subtitle={refKey(node.constraintRef)}
        tags={
          constraint ? (
            <Tag size="sm" tone="purple">
              {constraint.strategy}
            </Tag>
          ) : (
            <Tag size="sm" tone="danger">
              缺失
            </Tag>
          )
        }
      />
      <Handle type="source" position={Position.Right} style={HANDLE_STYLE} />
    </div>
  )
}

export function CommitNodeCard({ data, selected }: NodeProps<FlowNode<"CommitNode">>) {
  const node = data.node
  if (node.type !== "CommitNode") return null
  return (
    <div>
      <Handle type="target" position={Position.Left} style={HANDLE_STYLE} />
      <Shell
        selected={selected}
        icon={<GitCommitHorizontal size={14} />}
        title={NODE_TYPE_LABEL.CommitNode}
        subtitle="atomicCommit"
        tags={
          <Tag size="sm" tone="success">
            终点
          </Tag>
        }
      />
    </div>
  )
}

export const SCHEDULE_NODE_TYPES = {
  SystemNode: SystemNodeCard,
  ReducerNode: ReducerNodeCard,
  ContractNode: ContractNodeCard,
  CommitNode: CommitNodeCard,
}
