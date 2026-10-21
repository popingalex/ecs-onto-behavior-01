import { ArrowRight, Trash2 } from "lucide-react"
import ObjectLink from "@/components/domain/ObjectLink"
import Button from "@/components/ui/Button"
import Field, { Select } from "@/components/ui/Field"
import { Tag } from "@/components/ui/StatusTag"
import TypedValueCell from "@/components/domain/TypedValueCell"
import { toDisplay } from "@/data/world"
import { refKey, sameRef } from "@/schema/model"
import { EDGE_KIND_LABEL, NODE_TYPE_LABEL } from "@/services/scheduleCompiler"
import type { ScheduleFlowEdge, ScheduleFlowNode } from "./codec"
import { useScheduleEditor } from "./editorContext"

/** 右侧检查器：选中节点 / 边的语义详情与操作；未选中时给操作提示。 */
export default function NodeInspector({
  node,
  edge,
  onSetConstraint,
  onDeleteNode,
  onDeleteEdge,
}: {
  node: ScheduleFlowNode | null
  edge: ScheduleFlowEdge | null
  onSetConstraint: (nodeId: string, constraintKey: string) => void
  onDeleteNode: (nodeId: string) => void
  onDeleteEdge: (edgeId: string) => void
}) {
  const api = useScheduleEditor()
  const { model, readOnly } = api

  if (edge) {
    const kind = edge.data?.kind ?? "order"
    return (
      <div className="flex flex-col gap-3 px-4 py-4">
        <div className="flex items-center gap-2 text-body font-semibold">
          调度边 <span className="font-mono text-label text-muted">{edge.id}</span>
        </div>
        <div className="flex items-center gap-1.5 text-label">
          <span className="font-mono">{edge.source}</span>
          <ArrowRight size={13} aria-hidden className="text-muted" />
          <span className="font-mono">{edge.target}</span>
        </div>
        <div>
          <Tag tone={kind === "effect" ? "success" : kind === "product" ? "danger" : "primary"}>
            {EDGE_KIND_LABEL[kind]}
          </Tag>
        </div>
        <p className="text-caption leading-5 text-muted">
          {kind === "order"
            ? "顺序边只决定执行先后，不传递新状态：下游仍读取上一提交的 previous 视图。"
            : kind === "effect"
              ? "效果边把 System 的贡献路由到归约器 / 合同裁决统一裁决。"
              : "product 边要求执行器传递中间产物，当前不支持。"}
        </p>
        <div>
          <Button
            size="sm"
            intent="danger-ghost"
            icon={Trash2}
            disabled={readOnly}
            onClick={() => onDeleteEdge(edge.id)}
          >
            删除边
          </Button>
        </div>
      </div>
    )
  }

  if (!node) {
    return (
      <div className="px-4 py-4 text-caption leading-5 text-muted">
        <p>从左侧拖入 System 或结构节点；拖动连线建立顺序 / 效果关系。</p>
        <p className="mt-2">选中节点或边查看详情；双击 System 节点打开 P14 内部逻辑。</p>
      </div>
    )
  }

  const domain = node.data.node
  if (domain.type === "SystemNode") {
    const system = model.systems.find((s) => s.id === domain.systemRef)
    if (!system)
      return (
        <div className="px-4 py-4 text-label text-danger">
          System {domain.systemRef} 不存在；删除该节点或到 P11 重建。
        </div>
      )
    const query = model.queries.find((q) => sameRef(q, system.queryRef))
    const program = model.programs.find((p) => sameRef(p, system.programRef))
    return (
      <div className="flex flex-col gap-3 px-4 py-4">
        <div className="flex items-center gap-2">
          <span className="text-body font-semibold">{system.label}</span>
          <span className="rounded bg-neutral-soft px-1.5 font-mono text-label text-muted">
            {system.id}
          </span>
          <Tag size="sm" tone={system.enabled ? "success" : "neutral"}>
            {system.enabled ? "启用" : "停用"}
          </Tag>
        </div>
        <dl className="flex flex-col gap-2 text-label">
          <div className="flex items-center gap-2">
            <dt className="w-12 shrink-0 text-muted">查询</dt>
            <dd>
              <ObjectLink
                id={refKey(system.queryRef)}
                route={{ pageId: "P10", params: { queryId: system.queryRef.id } }}
                state={query ? "valid" : "missing"}
              />
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="w-12 shrink-0 text-muted">程序</dt>
            <dd>
              <ObjectLink
                id={refKey(system.programRef)}
                route={{ pageId: "P14", params: { programId: system.programRef.id } }}
                state={program ? "valid" : "missing"}
              />
            </dd>
          </div>
          <div className="flex items-start gap-2">
            <dt className="w-12 shrink-0 text-muted">参数</dt>
            <dd className="flex flex-col gap-1">
              {Object.entries(system.parameters).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2">
                  <span className="font-mono text-muted">{k}</span>
                  <TypedValueCell value={toDisplay(v)} unit={null} />
                </div>
              ))}
              {Object.keys(system.parameters).length === 0 ? (
                <span className="text-faint">无</span>
              ) : null}
            </dd>
          </div>
          <div className="flex items-start gap-2">
            <dt className="w-12 shrink-0 text-muted">访问</dt>
            <dd className="flex flex-col gap-1 font-mono text-caption">
              {system.access.readPrevious.map((a) => (
                <div key={`r-${a}`}>读 {a}</div>
              ))}
              {system.access.contribute.map((a) => (
                <div key={`c-${a}`}>贡献 {a}</div>
              ))}
              {system.access.exclusive.map((a) => (
                <div key={`e-${a}`}>独占 {a}</div>
              ))}
            </dd>
          </div>
        </dl>
        <div className="flex gap-2">
          <Button
            size="sm"
            intent="secondary"
            onClick={() => api.openProgram(domain.systemRef)}
          >
            打开 P14 内部逻辑
          </Button>
          <Button
            size="sm"
            intent="danger-ghost"
            icon={Trash2}
            disabled={readOnly}
            onClick={() => onDeleteNode(node.id)}
          >
            移除
          </Button>
        </div>
      </div>
    )
  }

  if (domain.type === "CommitNode") {
    return (
      <div className="flex flex-col gap-3 px-4 py-4">
        <div className="text-body font-semibold">{NODE_TYPE_LABEL.CommitNode}</div>
        <p className="text-caption leading-5 text-muted">
          调度的终点：归约后的值在此形成新提交。一次回合只能有一个提交节点，它没有出边。
        </p>
        <div>
          <Button
            size="sm"
            intent="danger-ghost"
            icon={Trash2}
            disabled={readOnly}
            onClick={() => onDeleteNode(node.id)}
          >
            移除
          </Button>
        </div>
      </div>
    )
  }

  // ReducerNode / ContractNode
  const constraint = model.constraints.find((c) => sameRef(c, domain.constraintRef))
  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      <div className="flex items-center gap-2">
        <span className="text-body font-semibold">{NODE_TYPE_LABEL[domain.type]}</span>
        <span className="font-mono text-label text-muted">{domain.id}</span>
      </div>
      <Field label="约束" hint="归约 / 裁决使用的联合约束">
        <Select
          value={refKey(domain.constraintRef)}
          disabled={readOnly}
          onChange={(e) => onSetConstraint(domain.id, e.target.value)}
          options={model.constraints.map((c) => ({
            value: refKey(c),
            label: `${refKey(c)} · ${c.strategy}`,
          }))}
        />
      </Field>
      {constraint ? (
        <p className="text-caption leading-5 text-muted">
          下限 {constraint.floorC}°C；不支持：{constraint.unsupported}
        </p>
      ) : (
        <p className="text-caption text-danger">约束不存在。</p>
      )}
      <div>
        <Button
          size="sm"
          intent="danger-ghost"
          icon={Trash2}
          disabled={readOnly}
          onClick={() => onDeleteNode(node.id)}
        >
          移除
        </Button>
      </div>
    </div>
  )
}
