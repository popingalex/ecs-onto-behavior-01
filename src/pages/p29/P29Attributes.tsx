import { useMemo, useState } from "react"
import { ArrowLeft, Lock, Plus, Search, Trash2 } from "lucide-react"
import type { WorkbenchContext } from "@/app/useWorkbenchContext"
import type { Primitive, ValueShape, WriteMode } from "@/schema/model"
import {
  PRIMITIVE_LABEL,
  SHAPE_LABEL,
  WRITE_MODE_HINT,
  WRITE_MODE_LABEL,
} from "@/core/labels"
import ObjectLink from "@/components/domain/ObjectLink"
import TypedValueCell from "@/components/domain/TypedValueCell"
import Button from "@/components/ui/Button"
import Card, { Notice, PanelHeader } from "@/components/ui/Card"
import Field, { Select, Switch } from "@/components/ui/Field"
import { Tag } from "@/components/ui/StatusTag"
import Table, { Td, Th, Tr } from "@/components/ui/Table"
import { TextInput } from "@/components/ui/Field"
import Modal from "@/components/ui/Modal"
import { toDisplay } from "@/data/world"
import { navigate, useRoute, useViewState } from "@/router/router"
import { SCHEMA_DOC, useDraftModel } from "@/stores/modelDocuments"
import { useEditingDocument, validateDocument } from "@/stores/draftRegistry"
import { toast } from "@/stores/toast"
import CommitText from "@/features/ecs/CommitText"
import CreateAttributeModal from "@/features/ecs/CreateAttributeModal"
import RefsNotice from "@/features/ecs/RefsNotice"
import ValueEditor from "@/features/ecs/ValueEditor"
import { toUnitDef } from "@/features/ecs/adapters"
import {
  applySchemaOp,
  useReadOnly,
  useSchemaDoc,
} from "@/features/ecs/editing"
import {
  checkRawValue,
  deleteAttribute,
  neutralDefault,
  updateAttribute,
  type AttributePatch,
} from "@/features/ecs/operations"
import { attributeRefs } from "@/features/ecs/refs"
import type { AttributeSchema } from "@/schema/model"

const MODE_TONE = {
  configuration: "neutral",
  exclusive: "primary",
  contribution: "purple",
  contract: "warning",
} as const

/** P29 属性定义：独立于组件页面的属性 CRUD；删除前扫描全部引用。 */
export default function P29Attributes({
  ctx: _ctx,
}: {
  ctx: WorkbenchContext
}) {
  useEditingDocument(SCHEMA_DOC)
  const model = useDraftModel()
  const route = useRoute()
  const attributeId = route.params.attributeId
  if (!attributeId) return <AttributeList />
  const attr = model.attributes.find((a) => a.id === attributeId)
  if (!attr) {
    return (
      <div className="mx-auto w-full max-w-[1280px] px-6 py-6">
        <Notice tone="warning">
          属性 {attributeId} 不在当前草稿中；可能已被删除。
        </Notice>
      </div>
    )
  }
  return <AttributeDetail key={attr.id} attr={attr} />
}

function AttributeList() {
  const model = useDraftModel()
  const readOnly = useReadOnly()
  const [query, setQuery] = useViewState("p29.query", "")
  const [creating, setCreating] = useState(false)
  const q = query.trim().toLowerCase()
  const rows = model.attributes.filter(
    (a) =>
      !q ||
      a.id.toLowerCase().includes(q) ||
      a.label.toLowerCase().includes(q) ||
      a.componentId.toLowerCase().includes(q),
  )
  const units = useMemo(
    () => new Map(model.units.map((u) => [u.id, toUnitDef(u)])),
    [model.units],
  )

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-6 py-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-title font-semibold">属性定义</h2>
          <p className="mt-1 text-body text-muted">
            属性独立于组件页面管理：值形状、单位、可空、默认值与写入方式。删除前会扫描全部引用。
          </p>
        </div>
        <Button
          intent="primary"
          icon={Plus}
          disabled={readOnly}
          onClick={() => setCreating(true)}
        >
          新建属性
        </Button>
      </div>
      <Card>
        <PanelHeader
          title="全部属性"
          meta={
            <span className="tabular">
              {rows.length} / {model.attributes.length} 项
            </span>
          }
          actions={
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint"
                aria-hidden
              />
              <TextInput
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索 ID / 显示名 / 组件"
                className="h-8 w-64 pl-8 text-label"
              />
            </div>
          }
        />
        <Table className="min-w-[900px]">
          <thead>
            <tr>
              <Th className="w-[280px]">属性</Th>
              <Th>所属组件</Th>
              <Th>值形状</Th>
              <Th>单位</Th>
              <Th align="center">可空</Th>
              <Th align="right">默认值</Th>
              <Th>写入方式</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const unit = a.type.unitId ? units.get(a.type.unitId) : null
              const component = model.components.find(
                (c) => c.id === a.componentId,
              )
              return (
                <Tr
                  key={a.id}
                  onSelect={() =>
                    navigate({ pageId: "P29", params: { attributeId: a.id } })
                  }
                >
                  <Td>
                    <div className="truncate font-medium">
                      {a.label || (
                        <span className="text-danger">（未命名）</span>
                      )}
                    </div>
                    <div className="truncate font-mono text-caption text-muted">
                      {a.id}
                    </div>
                  </Td>
                  <Td>
                    {component ? (
                      <ObjectLink
                        label={component.label}
                        id={component.id}
                        route={{
                          pageId: "P03",
                          params: { componentId: component.id },
                        }}
                      />
                    ) : (
                      <span className="text-danger">{a.componentId}</span>
                    )}
                  </Td>
                  <Td>
                    <span className="text-ink-soft">
                      {SHAPE_LABEL[a.type.shape]}
                    </span>
                    <span className="ml-1.5 font-mono text-caption text-muted">
                      {a.type.primitive}
                    </span>
                  </Td>
                  <Td>
                    {unit ? unit.symbol : <span className="text-faint">—</span>}
                  </Td>
                  <Td align="center">{a.type.nullable ? "是" : "否"}</Td>
                  <Td numeric>
                    <TypedValueCell value={toDisplay(a.default)} unit={unit} />
                  </Td>
                  <Td>
                    <Tag tone={MODE_TONE[a.writeMode]} size="sm">
                      {WRITE_MODE_LABEL[a.writeMode]}
                    </Tag>
                  </Td>
                </Tr>
              )
            })}
            {rows.length === 0 ? (
              <tr>
                <Td colSpan={7} className="py-8 text-center text-muted">
                  没有匹配的属性
                </Td>
              </tr>
            ) : null}
          </tbody>
        </Table>
      </Card>
      {creating ? (
        <CreateAttributeModal
          onClose={() => setCreating(false)}
          onCreated={(id) =>
            navigate({ pageId: "P29", params: { attributeId: id } })
          }
        />
      ) : null}
    </div>
  )
}

function AttributeDetail({ attr }: { attr: AttributeSchema }) {
  const model = useDraftModel()
  const doc = useSchemaDoc()
  const readOnly = useReadOnly()
  const [error, setError] = useState<string | null>(null)
  const [blocked, setBlocked] = useState<{
    message: string
    refs?: ReturnType<typeof attributeRefs>
  } | null>(null)
  const [confirming, setConfirming] = useState(false)

  const saved = doc?.savedContent.attributes.find((a) => a.id === attr.id)
  const isNew = !saved
  const dirty = saved ? JSON.stringify(saved) !== JSON.stringify(attr) : true
  const component = model.components.find((c) => c.id === attr.componentId)
  const unit = attr.type.unitId
    ? model.units.find((u) => u.id === attr.type.unitId)
    : undefined
  const refs = useMemo(() => attributeRefs(model, attr.id), [model, attr.id])

  const edit = (patch: AttributePatch, label: string) => {
    setBlocked(null)
    const result = applySchemaOp(label, (s) =>
      updateAttribute(s, attr.id, patch),
    )
    setError(result.ok ? null : result.message)
  }

  /** 类型变化时若默认值不再合法，随本次编辑一起重置为中性默认（可空 → null）。 */
  const editType = (nextType: AttributeSchema["type"], label: string) => {
    const patch: AttributePatch = { type: nextType }
    if (checkRawValue(nextType, attr.default) !== null)
      patch.default = neutralDefault(nextType)
    edit(patch, label)
  }

  const remove = () => {
    const result = applySchemaOp(`删除属性 ${attr.id}`, (s) =>
      deleteAttribute(model, s, attr.id),
    )
    if (!result.ok) {
      setConfirming(false)
      setBlocked({ message: result.message, refs: result.refs })
      return
    }
    toast(`已删除属性 ${attr.id}`)
    navigate({ pageId: "P29", params: {} })
  }

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-6 py-6">
      <section className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              intent="ghost"
              icon={ArrowLeft}
              onClick={() => navigate({ pageId: "P29", params: {} })}
            >
              属性列表
            </Button>
            <h2 className="text-title font-semibold">
              {attr.label || "（未命名）"}
            </h2>
            <span className="rounded bg-neutral-soft px-1.5 font-mono text-label text-muted">
              {attr.id}
            </span>
            {isNew ? (
              <Tag tone="success" size="sm">
                草稿新增
              </Tag>
            ) : dirty ? (
              <Tag tone="purple" size="sm">
                草稿修改
              </Tag>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-label text-muted">
            所属组件
            {component ? (
              <ObjectLink
                label={component.label}
                id={component.id}
                route={{
                  pageId: "P03",
                  params: { componentId: component.id, propertyId: attr.id },
                }}
              />
            ) : (
              <span className="text-danger">{attr.componentId} 不存在</span>
            )}
          </div>
        </div>
        <Button
          intent="danger-ghost"
          icon={Trash2}
          disabled={readOnly}
          onClick={() =>
            refs.length
              ? setBlocked({
                  message: `属性 ${attr.id} 仍被 ${refs.length} 处引用，不能删除`,
                  refs,
                })
              : setConfirming(true)
          }
        >
          删除属性
        </Button>
      </section>

      {readOnly ? (
        <Notice tone="warning" icon={<Lock size={15} aria-hidden />}>
          观察者为只读角色，字段不可编辑。
        </Notice>
      ) : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {blocked ? (
        <RefsNotice message={blocked.message} refs={blocked.refs} />
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <PanelHeader title="基本" />
          <div className="flex flex-col gap-3 px-4 py-4">
            <CommitText
              label="显示名"
              value={attr.label}
              readOnly={readOnly}
              required
              error={!attr.label.trim() ? "显示名不能为空" : null}
              onCommit={(v) => edit({ label: v }, `${attr.id} · 显示名`)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field label="基元类型">
                <Select
                  value={attr.type.primitive}
                  disabled={readOnly}
                  onChange={(e) =>
                    editType(
                      { ...attr.type, primitive: e.target.value as Primitive },
                      `${attr.id} · 基元类型`,
                    )
                  }
                  options={([
                    "f64",
                    "i64",
                    "bool",
                    "string",
                    "EntityRef",
                  ] as Primitive[]).map((p) => ({
                    value: p,
                    label: PRIMITIVE_LABEL[p],
                  }))}
                />
              </Field>
              <Field label="值形状">
                <Select
                  value={attr.type.shape}
                  disabled={readOnly}
                  onChange={(e) =>
                    editType(
                      { ...attr.type, shape: e.target.value as ValueShape },
                      `${attr.id} · 值形状`,
                    )
                  }
                  options={(["scalar", "vector3"] as ValueShape[]).map((s) => ({
                    value: s,
                    label: SHAPE_LABEL[s],
                  }))}
                />
              </Field>
            </div>
            <Field
              label="单位"
              hint={unit ? `量种：${unit.quantityKind}` : "无量纲"}
            >
              <Select
                value={attr.type.unitId ?? ""}
                disabled={readOnly}
                onChange={(e) => {
                  const next = model.units.find((u) => u.id === e.target.value)
                  editType(
                    next
                      ? {
                          ...attr.type,
                          unitId: next.id,
                          quantityKind: next.quantityKind,
                        }
                      : {
                          ...attr.type,
                          unitId: undefined,
                          quantityKind: undefined,
                        },
                    `${attr.id} · 单位`,
                  )
                }}
                options={[
                  { value: "", label: "— 无量纲" },
                  ...model.units.map((u) => ({
                    value: u.id,
                    label: `${u.symbol} · ${u.quantityKind}`,
                  })),
                ]}
              />
            </Field>
            <Field label="可空">
              <Switch
                checked={attr.type.nullable}
                disabled={readOnly}
                label="可空"
                onChange={(v) =>
                  editType(
                    { ...attr.type, nullable: v },
                    v ? "允许为空" : "不允许为空",
                  )
                }
              />
            </Field>
          </div>
        </Card>

        <Card>
          <PanelHeader title="值与写入" />
          <div className="flex flex-col gap-3 px-4 py-4">
            <Field
              label="默认值"
              hint={
                attr.default === null
                  ? "当前为未设置（不同于 0）；输入值后提交"
                  : unit
                    ? `单位 ${unit.symbol}`
                    : undefined
              }
            >
              <ValueEditor
                attr={attr}
                value={attr.default}
                readOnly={readOnly}
                onCommit={(v) => edit({ default: v }, `${attr.id} · 默认值`)}
              />
            </Field>
            {saved ? (
              <div className="flex items-center justify-between rounded-ui bg-subtle px-3 py-2 text-label">
                <span className="text-muted">已保存默认值</span>
                <TypedValueCell
                  value={toDisplay(saved.default)}
                  unit={unit ? toUnitDef(unit) : null}
                />
              </div>
            ) : null}
            <Field label="写入方式" hint={WRITE_MODE_HINT[attr.writeMode]}>
              <Select
                value={attr.writeMode}
                disabled={readOnly}
                onChange={(e) =>
                  edit(
                    { writeMode: e.target.value as WriteMode },
                    `${attr.id} · 写入方式`,
                  )
                }
                options={(Object.keys(WRITE_MODE_LABEL) as WriteMode[]).map(
                  (m) => ({ value: m, label: WRITE_MODE_LABEL[m] }),
                )}
              />
            </Field>
            {attr.writeMode === "contribution" ? (
              <Field
                label="归约契约"
                required
                error={!attr.reducerRef ? "贡献写入必须关联归约契约" : null}
              >
                <Select
                  value={attr.reducerRef?.id ?? ""}
                  disabled={readOnly}
                  invalid={!attr.reducerRef}
                  placeholder="选择归约契约"
                  onChange={(e) => {
                    const c = model.constraints.find(
                      (x) => x.id === e.target.value,
                    )
                    edit(
                      {
                        reducerRef: c ? { id: c.id, version: c.version } : null,
                      },
                      `${attr.id} · 归约契约`,
                    )
                  }}
                  options={model.constraints.map((c) => ({
                    value: c.id,
                    label: `${c.id} · ${c.strategy}`,
                  }))}
                />
              </Field>
            ) : null}
          </div>
        </Card>
      </div>

      <Card>
        <PanelHeader
          title="引用位置"
          meta={<span className="tabular">{refs.length} 处</span>}
          actions={
            <span className="text-caption text-muted">
              删除前必须清空这些引用
            </span>
          }
        />
        {refs.length === 0 ? (
          <div className="px-4 py-4 text-body text-muted">
            没有其他对象引用该属性，可以安全删除。
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {refs.map((r, i) => (
              <li
                key={`${r.kind}:${r.id}:${i}`}
                className="flex flex-wrap items-center gap-x-3 px-4 py-2.5 text-body"
              >
                {r.route ? (
                  <ObjectLink label={r.label} id={r.id} route={r.route} />
                ) : (
                  <span className="font-medium">{r.label}</span>
                )}
                <span className="text-label text-muted">{r.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {confirming ? (
        <Modal
          title={`删除属性 ${attr.id}`}
          onClose={() => setConfirming(false)}
          footer={
            <>
              <Button intent="ghost" onClick={() => setConfirming(false)}>
                取消
              </Button>
              <Button intent="danger" onClick={remove}>
                确认删除
              </Button>
            </>
          }
        >
          <p className="px-5 py-4 text-body">
            将从组件 {attr.componentId} 的成员中移除并删除属性定义 {attr.id}
            。该操作可通过撤销恢复。
          </p>
        </Modal>
      ) : null}
      <RevalidateBar />
    </div>
  )
}

function RevalidateBar() {
  const doc = useSchemaDoc()
  if (!doc) return null
  const errors = doc.diagnostics.filter((d) => d.severity === "error").length
  return (
    <div className="flex items-center gap-3 text-label text-muted">
      <Button
        size="sm"
        busy={doc.validating}
        onClick={() => void validateDocument(SCHEMA_DOC)}
      >
        重新校验
      </Button>
      {doc.validatedRevision !== null ? (
        <span>
          r{doc.validatedRevision} ·{" "}
          {errors ? (
            <span className="text-danger">{errors} 错误</span>
          ) : (
            "无错误"
          )}
        </span>
      ) : (
        <span>尚未校验</span>
      )}
    </div>
  )
}
