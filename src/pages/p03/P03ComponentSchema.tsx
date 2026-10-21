import { useMemo, useState } from "react"
import { Crosshair, Lock, Plus, Ruler, Search, Trash2 } from "lucide-react"
import type { WorkbenchContext } from "@/app/useWorkbenchContext"
import Button from "@/components/ui/Button"
import Card, { Notice, PanelHeader } from "@/components/ui/Card"
import Field, { TextInput } from "@/components/ui/Field"
import Modal from "@/components/ui/Modal"
import { Tag } from "@/components/ui/StatusTag"
import Table, { Td, Th, Tr } from "@/components/ui/Table"
import ObjectLink from "@/components/domain/ObjectLink"
import PropertyGrid from "@/components/domain/PropertyGrid"
import ValidationList from "@/components/domain/ValidationList"
import CommitText from "@/features/ecs/CommitText"
import CreateAttributeModal from "@/features/ecs/CreateAttributeModal"
import RefsNotice from "@/features/ecs/RefsNotice"
import { toPropertyDef, toUnitDef } from "@/features/ecs/adapters"
import {
  applySchemaOp,
  useReadOnly,
  useSchemaDoc,
} from "@/features/ecs/editing"
import { suggestComponentId, validId } from "@/features/ecs/ids"
import {
  createComponent,
  deleteComponent,
  renameComponent,
} from "@/features/ecs/operations"
import { componentRefs, type RefHit } from "@/features/ecs/refs"
import { buildTransitionRoute } from "@/navigation/resolve"
import { findTransition } from "@/navigation/transitions"
import { navigate, useRoute, useViewState } from "@/router/router"
import { SCHEMA_DOC, useDraftModel } from "@/stores/modelDocuments"
import { useEditingDocument, validateDocument } from "@/stores/draftRegistry"
import { toast } from "@/stores/toast"

/** P03 组件与属性模式：组件 CRUD + 成员属性表（C05）+ 跨对象诊断（C10）；字段编辑在检查器，类型层管理在 P29。 */
export default function P03ComponentSchema({
  ctx: _ctx,
}: {
  ctx: WorkbenchContext
}) {
  useEditingDocument(SCHEMA_DOC)
  const model = useDraftModel()
  const route = useRoute()
  const componentId = route.params.componentId
  if (!componentId) return <ComponentIndex />
  const component = model.components.find((c) => c.id === componentId)
  if (!component) {
    return (
      <div className="mx-auto w-full max-w-[1280px] px-6 py-6">
        <Notice tone="warning">
          组件 {componentId} 不在当前草稿中；可能已被删除。
        </Notice>
      </div>
    )
  }
  return (
    <ComponentDetail
      key={component.id}
      componentId={componentId}
      selectedId={route.params.propertyId}
    />
  )
}

function ComponentIndex() {
  const model = useDraftModel()
  const readOnly = useReadOnly()
  const [query, setQuery] = useViewState("p03.query", "")
  const [creating, setCreating] = useState(false)
  const q = query.trim().toLowerCase()
  const rows = model.components.filter(
    (c) =>
      !q || c.id.toLowerCase().includes(q) || c.label.toLowerCase().includes(q),
  )

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-6 py-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-title font-semibold">组件</h2>
          <p className="mt-1 text-body text-muted">
            组件是属性的分组单元；属性定义的独立管理在
            P29。选择一个组件查看属性模式。
          </p>
        </div>
        <Button
          intent="primary"
          icon={Plus}
          disabled={readOnly}
          onClick={() => setCreating(true)}
        >
          新建组件
        </Button>
      </div>
      <Card>
        <PanelHeader
          title="全部组件"
          meta={
            <span className="tabular">
              {rows.length} / {model.components.length} 项
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
                placeholder="搜索 ID / 显示名"
                className="h-8 w-56 pl-8 text-label"
              />
            </div>
          }
        />
        <Table>
          <thead>
            <tr>
              <Th>组件</Th>
              <Th>成员属性</Th>
              <Th align="right">属性数</Th>
              <Th>使用类型</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <Tr
                key={c.id}
                onSelect={() =>
                  navigate({ pageId: "P03", params: { componentId: c.id } })
                }
              >
                <Td>
                  <span className="font-medium">{c.label}</span>
                  <span className="ml-2 font-mono text-caption text-muted">
                    {c.id}@{c.version}
                  </span>
                </Td>
                <Td className="text-ink-soft">
                  {c.propertyIds.join("、") || (
                    <span className="text-faint">（无属性）</span>
                  )}
                </Td>
                <Td numeric>{c.propertyIds.length}</Td>
                <Td className="text-ink-soft">
                  {model.entityTypes
                    .filter(
                      (t) =>
                        t.requiredComponentIds.includes(c.id) ||
                        t.optionalComponentIds.includes(c.id),
                    )
                    .map((t) => t.label)
                    .join("、")}
                </Td>
              </Tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <Td colSpan={4} className="py-8 text-center text-muted">
                  没有匹配的组件
                </Td>
              </tr>
            ) : null}
          </tbody>
        </Table>
      </Card>
      {creating ? (
        <CreateComponentModal onClose={() => setCreating(false)} />
      ) : null}
    </div>
  )
}

function CreateComponentModal({ onClose }: { onClose: () => void }) {
  const model = useDraftModel()
  const [id, setId] = useState(() =>
    suggestComponentId((x) => model.components.some((c) => c.id === x)),
  )
  const [label, setLabel] = useState("")
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    if (!validId(id))
      return setError("ID 只能包含字母、数字、点、下划线与连字符，并以字母开头")
    const result = applySchemaOp(`新建组件 ${id}`, (s) =>
      createComponent(s, { id, label }),
    )
    if (!result.ok) return setError(result.message)
    navigate({ pageId: "P03", params: { componentId: id } })
  }

  return (
    <Modal
      title="新建组件"
      onClose={onClose}
      footer={
        <>
          <Button intent="ghost" onClick={onClose}>
            取消
          </Button>
          <Button intent="primary" onClick={submit}>
            创建组件
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 px-5 py-4">
        <Field
          label="组件 ID"
          required
          hint="风格：语义化 PascalCase，例如 Thermal"
        >
          <TextInput value={id} mono onChange={(e) => setId(e.target.value)} />
        </Field>
        <Field label="显示名" hint="留空时使用 ID">
          <TextInput
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="热状态"
          />
        </Field>
        {error ? (
          <p role="alert" className="text-label text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  )
}

function ComponentDetail({
  componentId,
  selectedId,
}: {
  componentId: string
  selectedId?: string
}) {
  const model = useDraftModel()
  const doc = useSchemaDoc()
  const route = useRoute()
  const readOnly = useReadOnly()
  const [creatingAttr, setCreatingAttr] = useState(false)
  const [blocked, setBlocked] = useState<{
    message: string
    refs?: RefHit[]
  } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const component = model.components.find((c) => c.id === componentId)!

  const attributes = component.propertyIds
    .map((pid) => model.attributes.find((a) => a.id === pid))
    .filter((a) => a !== undefined)
  const properties = useMemo(() => attributes.map(toPropertyDef), [attributes])
  const units = useMemo(
    () => new Map(model.units.map((u) => [u.id, toUnitDef(u)])),
    [model.units],
  )
  const savedComponent = doc?.savedContent.components.find(
    (c) => c.id === componentId,
  )
  const isNew = !savedComponent
  const changed = useMemo(() => {
    const out: Record<string, string[]> = {}
    const savedAttrs = new Map(
      (doc?.savedContent.attributes ?? []).map((a) => [a.id, a]),
    )
    for (const a of attributes) {
      const saved = savedAttrs.get(a.id)
      if (!saved) {
        out[a.id] = ["新增"]
        continue
      }
      const fields: string[] = []
      if (saved.label !== a.label) fields.push("label")
      if (saved.type.nullable !== a.type.nullable) fields.push("nullable")
      if (JSON.stringify(saved.default) !== JSON.stringify(a.default))
        fields.push("default")
      if (saved.writeMode !== a.writeMode) fields.push("writeMode")
      if (saved.reducerRef?.id !== a.reducerRef?.id) fields.push("reducer")
      if (fields.length) out[a.id] = fields
    }
    return out
  }, [attributes, doc])
  const usedBy = model.entityTypes.filter(
    (t) =>
      t.requiredComponentIds.includes(componentId) ||
      t.optionalComponentIds.includes(componentId),
  )
  const changedCount = Object.keys(changed).length
  const refs = componentRefs(model, componentId)

  const go = (action: string) => {
    const t = findTransition("P03", action)
    const target = t ? buildTransitionRoute(route, t) : null
    if (target) navigate(target)
  }

  const remove = () => {
    const result = applySchemaOp(`删除组件 ${componentId}`, (s) =>
      deleteComponent(model, s, componentId),
    )
    if (!result.ok) {
      setConfirming(false)
      setBlocked({ message: result.message, refs: result.refs })
      return
    }
    toast(`已删除组件 ${componentId}`)
    navigate({ pageId: "P03", params: {} })
  }

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-6 py-6">
      <section className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-title font-semibold">{component.label}</h2>
            <span className="rounded bg-neutral-soft px-1.5 font-mono text-label text-muted">
              {component.id}@{component.version}
            </span>
            {isNew ? (
              <Tag tone="success" size="sm">
                草稿新增
              </Tag>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-label text-muted">
            使用类型
            {usedBy.map((t) => (
              <ObjectLink
                key={t.id}
                label={t.label}
                id={t.id}
                route={{ pageId: "P02", params: { classId: t.id } }}
              />
            ))}
            {usedBy.length === 0 ? (
              <span className="text-faint">（未被类型使用）</span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={Ruler} onClick={() => go("unit-settings")}>
            单位设置
          </Button>
          <Button icon={Crosshair} onClick={() => go("locate-reference")}>
            定位引用
          </Button>
          <Button
            intent="primary"
            icon={Plus}
            disabled={readOnly}
            onClick={() => setCreatingAttr(true)}
          >
            新增属性
          </Button>
          <Button
            intent="danger-ghost"
            icon={Trash2}
            disabled={readOnly}
            onClick={() =>
              refs.length
                ? setBlocked({
                    message: `组件 ${componentId} 仍被 ${refs.length} 处引用，不能删除`,
                    refs,
                  })
                : setConfirming(true)
            }
          >
            删除组件
          </Button>
        </div>
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

      <Card>
        <PanelHeader title="基本" />
        <div className="max-w-md px-4 py-4">
          <CommitText
            label="显示名"
            value={component.label}
            readOnly={readOnly}
            required
            error={!component.label.trim() ? "显示名不能为空" : null}
            onCommit={(v) => {
              const result = applySchemaOp(`${componentId} · 显示名`, (s) =>
                renameComponent(s, componentId, v),
              )
              setError(result.ok ? null : result.message)
            }}
          />
        </div>
      </Card>

      <Card>
        <PanelHeader
          title="属性"
          meta={
            <>
              <span className="tabular">{properties.length} 项</span>
              {changedCount ? (
                <Tag size="sm" tone="purple">
                  草稿修改 {changedCount}
                </Tag>
              ) : null}
            </>
          }
          actions={
            <span className="text-caption text-muted">
              选择一行在检查器中编辑；点属性名打开详情抽屉（P31），类型 / 删除在 P29
            </span>
          }
        />
        <PropertyGrid
          properties={properties}
          changed={changed}
          units={units}
          diagnostics={
            doc && doc.validatedRevision !== null ? doc.diagnostics : []
          }
          selectedId={selectedId}
          onSelect={(propertyId) =>
            navigate({ ...route, params: { ...route.params, propertyId } }, {
              replace: true,
            })
          }
          onOpenDetail={(id) =>
            navigate({ pageId: "P31", params: { attributeId: id } })
          }
        />
      </Card>

      {doc ? (
        <ValidationList
          diagnostics={doc.diagnostics}
          validationRevision={doc.validatedRevision}
          currentRevision={doc.revision}
          validating={doc.validating}
          onRevalidate={() => void validateDocument(SCHEMA_DOC)}
        />
      ) : null}

      {creatingAttr ? (
        <CreateAttributeModal
          componentId={componentId}
          onClose={() => setCreatingAttr(false)}
          onCreated={(id) =>
            navigate(
              { ...route, params: { ...route.params, propertyId: id } },
              { replace: true },
            )
          }
        />
      ) : null}

      {confirming ? (
        <Modal
          title={`删除组件 ${componentId}`}
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
            将删除组件定义 {component.id}@{component.version}
            。该操作可通过撤销恢复。
          </p>
        </Modal>
      ) : null}
    </div>
  )
}
