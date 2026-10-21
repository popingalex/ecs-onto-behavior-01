import { useState } from "react"
import { ArrowLeft, Lock, Plus, Search, Trash2 } from "lucide-react"
import type { WorkbenchContext } from "@/app/useWorkbenchContext"
import ObjectLink from "@/components/domain/ObjectLink"
import Button from "@/components/ui/Button"
import Card, { Notice, PanelHeader } from "@/components/ui/Card"
import Field, { Select, TextInput } from "@/components/ui/Field"
import { Tag } from "@/components/ui/StatusTag"
import Table, { Td, Th, Tr } from "@/components/ui/Table"
import Modal from "@/components/ui/Modal"
import { navigate, useRoute, useViewState } from "@/router/router"
import { SCHEMA_DOC, useDraftModel } from "@/stores/modelDocuments"
import { useEditingDocument } from "@/stores/draftRegistry"
import { toast } from "@/stores/toast"
import CommitText from "@/features/ecs/CommitText"
import RefsNotice from "@/features/ecs/RefsNotice"
import {
  applySchemaOp,
  useReadOnly,
  useSchemaDoc,
} from "@/features/ecs/editing"
import { suggestTypeId, validId } from "@/features/ecs/ids"
import {
  createEntityType,
  deleteEntityType,
  renameEntityType,
  setEntityTypeComponent,
  setEntityTypeParent,
} from "@/features/ecs/operations"
import { entityTypeRefs, type RefHit } from "@/features/ecs/refs"
import {
  effectiveComponents,
  wouldCycle,
} from "@/schema/inheritance"

type ComponentMode = "required" | "optional" | "none"

/** P02 实体类型：类型 CRUD + 必需/可选组件装配。 */
export default function P02EntityTypes({
  ctx: _ctx,
}: {
  ctx: WorkbenchContext
}) {
  useEditingDocument(SCHEMA_DOC)
  const model = useDraftModel()
  const route = useRoute()
  const typeId = route.params.classId
  if (!typeId) return <TypeList />
  const type = model.entityTypes.find((t) => t.id === typeId)
  if (!type) {
    return (
      <div className="mx-auto w-full max-w-[1280px] px-6 py-6">
        <Notice tone="warning">
          实体类型 {typeId} 不在当前草稿中；可能已被删除。
        </Notice>
      </div>
    )
  }
  return <TypeDetail key={type.id} typeId={type.id} />
}

function TypeList() {
  const model = useDraftModel()
  const readOnly = useReadOnly()
  const [query, setQuery] = useViewState("p02.query", "")
  const [creating, setCreating] = useState(false)
  const q = query.trim().toLowerCase()
  const rows = model.entityTypes.filter(
    (t) =>
      !q || t.id.toLowerCase().includes(q) || t.label.toLowerCase().includes(q),
  )

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-6 py-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-title font-semibold">实体类型</h2>
          <p className="mt-1 text-body text-muted">
            类型声明必需与可选组件；实体实例的装配在 P08，组件与属性在 P03 /
            P29。
          </p>
        </div>
        <Button
          intent="primary"
          icon={Plus}
          disabled={readOnly}
          onClick={() => setCreating(true)}
        >
          新建类型
        </Button>
      </div>
      <Card>
        <PanelHeader
          title="全部类型"
          meta={
            <span className="tabular">
              {rows.length} / {model.entityTypes.length} 项
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
        <Table className="min-w-[860px]">
          <thead>
            <tr>
              <Th className="w-[220px]">类型</Th>
              <Th className="w-[140px]">父类型</Th>
              <Th>必需组件</Th>
              <Th>可选组件</Th>
              <Th align="right">实体</Th>
              <Th align="right">模板</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const entities = model.scene.entities.filter(
                (e) => e.typeId === t.id,
              )
              const templates = model.templates.filter(
                (tp) => tp.typeId === t.id,
              )
              const parent = t.parent
                ? model.entityTypes.find((p) => p.id === t.parent)
                : undefined
              return (
                <Tr
                  key={t.id}
                  onSelect={() =>
                    navigate({ pageId: "P02", params: { classId: t.id } })
                  }
                >
                  <Td>
                    <div className="truncate font-medium">{t.label}</div>
                    <div className="truncate font-mono text-caption text-muted">
                      {t.id}
                    </div>
                  </Td>
                  <Td className="text-ink-soft">
                    {t.parent ? (
                      <span>
                        {parent?.label ?? t.parent}
                        <span className="ml-1 font-mono text-caption text-muted">
                          {t.parent}
                        </span>
                      </span>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </Td>
                  <Td className="text-ink-soft">
                    {t.requiredComponentIds.join("、") || (
                      <span className="text-faint">—</span>
                    )}
                  </Td>
                  <Td className="text-ink-soft">
                    {t.optionalComponentIds.join("、") || (
                      <span className="text-faint">—</span>
                    )}
                  </Td>
                  <Td numeric>{entities.length}</Td>
                  <Td numeric>{templates.length}</Td>
                </Tr>
              )
            })}
            {rows.length === 0 ? (
              <tr>
                <Td colSpan={6} className="py-8 text-center text-muted">
                  没有匹配的类型
                </Td>
              </tr>
            ) : null}
          </tbody>
        </Table>
      </Card>
      {creating ? <CreateTypeModal onClose={() => setCreating(false)} /> : null}
    </div>
  )
}

function CreateTypeModal({ onClose }: { onClose: () => void }) {
  const model = useDraftModel()
  const [id, setId] = useState(() =>
    suggestTypeId((x) => model.entityTypes.some((t) => t.id === x)),
  )
  const [label, setLabel] = useState("")
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    if (!validId(id))
      return setError("ID 只能包含字母、数字、点、下划线与连字符，并以字母开头")
    const result = applySchemaOp(`新建实体类型 ${id}`, (s) =>
      createEntityType(s, { id, label }),
    )
    if (!result.ok) return setError(result.message)
    navigate({ pageId: "P02", params: { classId: id } })
  }

  return (
    <Modal
      title="新建实体类型"
      onClose={onClose}
      footer={
        <>
          <Button intent="ghost" onClick={onClose}>
            取消
          </Button>
          <Button intent="primary" onClick={submit}>
            创建类型
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 px-5 py-4">
        <Field
          label="类型 ID"
          required
          hint="风格：语义化 PascalCase，例如 Fire"
        >
          <TextInput value={id} mono onChange={(e) => setId(e.target.value)} />
        </Field>
        <Field label="显示名" hint="留空时使用 ID">
          <TextInput
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="火源"
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

function TypeDetail({ typeId }: { typeId: string }) {
  const model = useDraftModel()
  const doc = useSchemaDoc()
  const readOnly = useReadOnly()
  const [error, setError] = useState<string | null>(null)
  const [blocked, setBlocked] = useState<{
    message: string
    refs?: RefHit[]
  } | null>(null)
  const [confirming, setConfirming] = useState(false)

  const type = model.entityTypes.find((t) => t.id === typeId)!
  const saved = doc?.savedContent.entityTypes.find((t) => t.id === typeId)
  const isNew = !saved
  const dirty = saved ? JSON.stringify(saved) !== JSON.stringify(type) : true
  const entities = model.scene.entities.filter((e) => e.typeId === typeId)
  const refs = entityTypeRefs(model, typeId)
  /** 有效装配（自身声明 + parent 继承，就近声明优先）。 */
  const origins = effectiveComponents(model.entityTypes, typeId)
  const originOf = new Map(origins.map((o) => [o.componentId, o]))
  const parentOptions = [
    { value: "", label: "（无父类型）" },
    ...model.entityTypes
      .filter((t) => t.id !== typeId)
      .map((t) => ({
        value: t.id,
        label: `${t.label} · ${t.id}`,
        disabled: wouldCycle(model.entityTypes, typeId, t.id),
      })),
  ]

  const modeOf = (componentId: string): ComponentMode =>
    type.requiredComponentIds.includes(componentId)
      ? "required"
      : type.optionalComponentIds.includes(componentId)
        ? "optional"
        : "none"

  const setMode = (componentId: string, mode: ComponentMode) => {
    setBlocked(null)
    const result = applySchemaOp(
      `${typeId} · ${componentId} → ${
        mode === "required" ? "必需" : mode === "optional" ? "可选" : "不关联"
      }`,
      (s) => setEntityTypeComponent(s, typeId, componentId, mode),
    )
    setError(result.ok ? null : result.message)
  }

  const remove = () => {
    const result = applySchemaOp(`删除实体类型 ${typeId}`, (s) =>
      deleteEntityType(model, s, typeId),
    )
    if (!result.ok) {
      setConfirming(false)
      setBlocked({ message: result.message, refs: result.refs })
      return
    }
    toast(`已删除实体类型 ${typeId}`)
    navigate({ pageId: "P02", params: {} })
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
              onClick={() => navigate({ pageId: "P02", params: {} })}
            >
              类型列表
            </Button>
            <h2 className="text-title font-semibold">{type.label}</h2>
            <span className="rounded bg-neutral-soft px-1.5 font-mono text-label text-muted">
              {type.id}
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
        </div>
        <Button
          intent="danger-ghost"
          icon={Trash2}
          disabled={readOnly}
          onClick={() =>
            refs.length
              ? setBlocked({
                  message: `实体类型 ${typeId} 仍被 ${refs.length} 处引用，不能删除`,
                  refs,
                })
              : setConfirming(true)
          }
        >
          删除类型
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
              value={type.label}
              readOnly={readOnly}
              required
              error={!type.label.trim() ? "显示名不能为空" : null}
              onCommit={(v) => {
                const result = applySchemaOp(`${typeId} · 显示名`, (s) =>
                  renameEntityType(s, typeId, v),
                )
                setError(result.ok ? null : result.message)
              }}
            />
            <Field
              label="父类型"
              hint="子类型继承父链的必需/可选组件（就近声明优先）；子孙类型已置灰，防止继承环"
            >
              <Select
                value={type.parent ?? ""}
                disabled={readOnly}
                onChange={(e) => {
                  setBlocked(null)
                  const parentId = e.target.value || null
                  const result = applySchemaOp(
                    `${typeId} · 父类型 → ${parentId ?? "（无）"}`,
                    (s) => setEntityTypeParent(s, typeId, parentId),
                  )
                  setError(result.ok ? null : result.message)
                }}
                options={parentOptions}
              />
            </Field>
          </div>
        </Card>

        <Card>
          <PanelHeader
            title="组件装配"
            meta={
              <span className="tabular">
                {origins.filter((o) => o.mode === "required").length} 必需 ·{" "}
                {origins.filter((o) => o.mode === "optional").length} 可选
                {origins.some((o) => o.inheritedFrom)
                  ? `（含继承 ${origins.filter((o) => o.inheritedFrom).length}）`
                  : ""}
              </span>
            }
          />
          <Table>
            <thead>
              <tr>
                <Th>组件</Th>
                <Th className="w-[220px]">装配关系</Th>
              </tr>
            </thead>
            <tbody>
              {model.components.map((c) => {
                const own = modeOf(c.id)
                const origin = originOf.get(c.id)
                const inherited = own === "none" && origin ? origin : null
                return (
                  <tr key={c.id}>
                    <Td>
                      <ObjectLink
                        label={c.label}
                        id={c.id}
                        route={{ pageId: "P03", params: { componentId: c.id } }}
                      />
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Select
                          value={inherited ? inherited.mode : own}
                          disabled={readOnly || Boolean(inherited)}
                          title={
                            inherited
                              ? `${c.id} 继承自 ${inherited.inheritedFrom}，不能在子类型移除`
                              : undefined
                          }
                          onChange={(e) =>
                            setMode(c.id, e.target.value as ComponentMode)
                          }
                          options={[
                            { value: "required", label: "必需" },
                            { value: "optional", label: "可选" },
                            { value: "none", label: "不关联" },
                          ]}
                        />
                        {inherited ? (
                          <Tag tone="purple" size="sm">
                            继承自 {inherited.inheritedFrom}
                          </Tag>
                        ) : null}
                      </div>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
          <p className="border-t border-line px-4 py-2.5 text-caption text-muted">
            必需组件在实体上不可移除（P08 会报错）；可选组件由实例自由装配。父类型的装配由子类型继承，继承来的组件在子类型不可改。
          </p>
        </Card>
      </div>

      <Card>
        <PanelHeader
          title="该类型的实体"
          meta={<span className="tabular">{entities.length} 个</span>}
        />
        {entities.length === 0 ? (
          <div className="px-4 py-4 text-body text-muted">
            场景中还没有该类型的实体。
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 px-4 py-3">
            {entities.map((e) => (
              <ObjectLink
                key={e.id}
                label={e.label}
                id={e.id}
                route={{ pageId: "P08", params: { entityId: e.id } }}
              />
            ))}
          </div>
        )}
      </Card>

      {confirming ? (
        <Modal
          title={`删除实体类型 ${typeId}`}
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
            将删除实体类型定义 {typeId}。该操作可通过撤销恢复。
          </p>
        </Modal>
      ) : null}
    </div>
  )
}
