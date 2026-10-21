import { Link2, Trash2 } from "lucide-react"
import Button from "@/components/ui/Button"
import { KeyValue, SectionLabel } from "@/components/ui/Card"
import Field, { Select, TextInput } from "@/components/ui/Field"
import { Tag } from "@/components/ui/StatusTag"
import type {
  Binding,
  LogicGraphDocument,
  LogicNode,
  TargetBinding,
} from "@/schema/model"
import {
  clearInput,
  DEFAULT_PREFIX,
  formatType,
  inputSources,
  nodeTypeDef,
  nodeUnit,
  removeNodes,
  setInputDefault,
  setNodeUnit,
  setParam,
  unitSymbol,
  type DomainModel,
} from "@/services/domainBindingService"
import { applyEdit } from "@/stores/draftRegistry"
import type { ProgramContent } from "@/stores/modelDocuments"
import { useLogicEditor } from "./editorContext"

type EditFn = (
  label: string,
  fn: (p: LogicGraphDocument) => LogicGraphDocument,
) => void

function bindingLabel(b: Binding | TargetBinding): string {
  if (b.root === "self")
    return `self.${b.propertyId}${"view" in b && b.view ? ` · ${b.view}` : ""}`
  if (b.root === "parameter") return `参数 ${b.parameterId}`
  if (b.root === "upstream") return `${b.nodeId}.${b.portId}`
  return `关系 ${b.relationId}.${b.propertyId}`
}

function SlotEditor({
  model,
  program,
  node,
  slotId,
  edit,
  readOnly,
}: {
  model: DomainModel
  program: LogicGraphDocument
  node: LogicNode
  slotId: string
  edit: EditFn
  readOnly: boolean
}) {
  const api = useLogicEditor()
  const def = nodeTypeDef(node.type)!
  const slot = def.slots.find((s) => s.id === slotId)!
  const binding = node.bindings[slotId]
  const invalid = !binding || binding.root !== "self"
  return (
    <div className="flex items-center gap-2 py-1.5">
      <div className="min-w-0 flex-1">
        <div className="text-label text-muted">{slot.label}</div>
        <div
          className={
            invalid
              ? "font-mono text-label text-danger"
              : "font-mono text-label text-ink"
          }
        >
          {binding ? bindingLabel(binding) : "未绑定"}
        </div>
      </div>
      <Button
        size="sm"
        intent="ghost"
        disabled={readOnly}
        onClick={() => api.openSlotPicker(node.id, slotId)}
      >
        更改…
      </Button>
    </div>
  )
}

function InputEditor({
  model,
  program,
  node,
  portId,
  edit,
  readOnly,
}: {
  model: DomainModel
  program: LogicGraphDocument
  node: LogicNode
  portId: string
  edit: EditFn
  readOnly: boolean
}) {
  const api = useLogicEditor()
  const def = nodeTypeDef(node.type)!
  const port = def.inputs.find((p) => p.id === portId)!
  const expected = node.inputs[portId]
  const sources = inputSources(program, node.id, portId)
  const [source] = sources
  const defaultValue = node.params[`${DEFAULT_PREFIX}${portId}`]
  const numeric = expected?.primitive === "f64"
  return (
    <div className="border-t border-line py-2 first:border-t-0">
      <div className="flex items-center gap-2">
        <span className="text-label font-medium text-ink">
          {port.label}
          {port.required ? <span className="text-danger"> *</span> : null}
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-caption text-muted">
          {formatType(model, expected)}
        </span>
        {port.required && sources.length === 0 ? (
          <Tag tone="danger" size="sm">
            缺来源
          </Tag>
        ) : null}
      </div>
      <div className="mt-1 font-mono text-caption text-ink-soft">
        {source?.kind === "edge"
          ? `连线 ${source.edge.source.nodeId}.${source.edge.source.portId}`
          : source?.kind === "binding"
            ? bindingLabel(source.binding)
            : source?.kind === "default"
              ? `默认值 ${String(source.value)}`
              : "没有来源：需要连线、绑定或默认值"}
      </div>
      {!readOnly && (port.bindable || sources.length > 0) ? (
        <div className="mt-1.5 flex items-center gap-1.5">
          {port.bindable ? (
            <Button
              size="sm"
              intent="ghost"
              icon={Link2}
              onClick={() => api.openInputPicker(node.id, portId)}
            >
              绑定…
            </Button>
          ) : null}
          {port.bindable && numeric ? (
            <TextInput
              key={`${node.id}:${portId}:${String(defaultValue ?? "")}`}
              type="number"
              className="h-7 w-24 text-caption"
              placeholder="默认值"
              defaultValue={
                typeof defaultValue === "number" ? String(defaultValue) : ""
              }
              onBlur={(e) => {
                const raw = e.currentTarget.value.trim()
                if (raw === "") return
                const value = Number(raw)
                if (!Number.isFinite(value) || value === defaultValue) return
                edit(`默认值 ${node.id}.${portId} = ${value}`, (p) =>
                  setInputDefault(p, model, node.id, portId, value),
                )
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur()
              }}
            />
          ) : null}
          {sources.length > 0 ? (
            <Button
              size="sm"
              intent="ghost"
              onClick={() =>
                edit(`清除 ${node.id}.${portId} 的来源`, (p) =>
                  clearInput(p, model, node.id, portId),
                )
              }
            >
              清除
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/** 右栏节点表单：槽位绑定、输入来源（连线 / 绑定 / 默认值）、单位与参数；未选中时显示程序信息。 */
export default function NodeForm({
  docId,
  model,
  program,
  selectedNodeId,
  readOnly,
}: {
  docId: string
  model: DomainModel
  program: LogicGraphDocument
  selectedNodeId: string | null
  readOnly: boolean
}) {
  const edit: EditFn = (label, fn) =>
    applyEdit<ProgramContent>(docId, label, (c) => ({
      ...c,
      program: fn(c.program),
    }))
  const node = selectedNodeId
    ? program.nodes.find((n) => n.id === selectedNodeId)
    : undefined

  if (!node) {
    return (
      <div className="scroll-thin h-full min-h-0 overflow-auto px-4 py-3">
        <SectionLabel>程序</SectionLabel>
        <dl className="mt-1">
          <KeyValue label="id" mono>
            {program.id}
          </KeyValue>
          <KeyValue label="版本" mono>
            {program.version}
          </KeyValue>
          <KeyValue label="作用域" mono>
            {program.scopeType}
          </KeyValue>
          <KeyValue label="节点">
            {program.nodes.length} 个节点 · {program.edges.length} 条连线
          </KeyValue>
        </dl>
        <SectionLabel className="mt-4">程序参数</SectionLabel>
        {program.parameters.length === 0 ? (
          <p className="mt-1 text-caption text-muted">没有声明参数。</p>
        ) : (
          <ul className="mt-1 flex flex-col gap-1">
            {program.parameters.map((p) => (
              <li key={p.id} className="font-mono text-caption text-ink-soft">
                {p.id} · {formatType(model, p.type)} · 默认{" "}
                {String(p.default)}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-caption text-muted">
          选中画布上的节点以编辑其绑定与参数。
        </p>
      </div>
    )
  }

  const def = nodeTypeDef(node.type)
  if (!def) return null
  const unit = nodeUnit(node)
  return (
    <div className="scroll-thin flex h-full min-h-0 flex-col overflow-auto">
      <div className="border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-body font-semibold text-ink">{def.label}</span>
          <Tag size="sm" tone="neutral">
            {def.type}
          </Tag>
        </div>
        <div className="mt-0.5 font-mono text-caption text-muted">{node.id}</div>
        <p className="mt-1 text-caption text-muted">{def.summary}</p>
      </div>
      <div className="min-h-0 flex-1 px-4 py-3">
        {def.slots.length > 0 ? (
          <>
            <SectionLabel>槽位绑定</SectionLabel>
            <div className="divide-y divide-transparent">
              {def.slots.map((s) => (
                <SlotEditor
                  key={s.id}
                  model={model}
                  program={program}
                  node={node}
                  slotId={s.id}
                  edit={edit}
                  readOnly={readOnly}
                />
              ))}
            </div>
          </>
        ) : null}
        {def.inputs.length > 0 ? (
          <>
            <SectionLabel className="mt-3">输入</SectionLabel>
            <div className="mt-1">
              {def.inputs.map((p) => (
                <InputEditor
                  key={p.id}
                  model={model}
                  program={program}
                  node={node}
                  portId={p.id}
                  edit={edit}
                  readOnly={readOnly}
                />
              ))}
            </div>
          </>
        ) : null}
        {def.unitSelectable ? (
          <div className="mt-3">
            <Field label="端口单位" hint="改单位会同时改写全部数值端口的量纲">
              <Select
                value={unit ?? ""}
                disabled={readOnly}
                options={model.units.map((u) => ({
                  value: u.id,
                  label: `${u.id}（${u.symbol}）`,
                }))}
                onChange={(e) =>
                  edit(`节点 ${node.id} 单位 → ${e.currentTarget.value}`, (p) =>
                    setNodeUnit(p, model, node.id, e.currentTarget.value),
                  )
                }
              />
            </Field>
          </div>
        ) : null}
        {node.type === "Constant" ? (
          <div className="mt-3">
            <Field label={`常量值（${unitSymbol(model, unit)}）`}>
              <TextInput
                key={`const:${node.id}:${String(node.params.value ?? "")}`}
                type="number"
                disabled={readOnly}
                defaultValue={
                  typeof node.params.value === "number"
                    ? String(node.params.value)
                    : ""
                }
                onBlur={(e) => {
                  const value = Number(e.currentTarget.value)
                  if (!Number.isFinite(value) || value === node.params.value)
                    return
                  edit(`常量 ${node.id} = ${value}`, (p) =>
                    setParam(p, model, node.id, "value", value),
                  )
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur()
                }}
              />
            </Field>
          </div>
        ) : null}
        {node.type === "Parameter" ? (
          <div className="mt-3">
            <Field label="程序参数">
              <Select
                value={String(node.params.parameterId ?? "")}
                disabled={readOnly}
                placeholder="选择参数"
                options={program.parameters.map((p) => ({
                  value: p.id,
                  label: `${p.id}（默认 ${String(p.default)}）`,
                }))}
                onChange={(e) =>
                  edit(`节点 ${node.id} 读取参数 ${e.currentTarget.value}`, (p) =>
                    setParam(p, model, node.id, "parameterId", e.currentTarget.value),
                  )
                }
              />
            </Field>
          </div>
        ) : null}
      </div>
      {!readOnly ? (
        <div className="border-t border-line px-4 py-3">
          <Button
            size="sm"
            intent="ghost"
            icon={Trash2}
            onClick={() =>
              edit(`删除节点 ${node.id}`, (p) => removeNodes(p, model, [node.id]))
            }
          >
            删除节点
          </Button>
        </div>
      ) : null}
    </div>
  )
}
