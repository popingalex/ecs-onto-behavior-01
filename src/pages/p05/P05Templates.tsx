import { useState } from "react"
import { ArrowLeft, Lock, Plus, Search, Trash2, Undo2 } from "lucide-react"
import type { WorkbenchContext } from "@/app/useWorkbenchContext"
import ObjectLink from "@/components/domain/ObjectLink"
import TypedValueCell from "@/components/domain/TypedValueCell"
import Button from "@/components/ui/Button"
import Card, { Notice, PanelHeader } from "@/components/ui/Card"
import Field, { Select, TextInput } from "@/components/ui/Field"
import { Tag } from "@/components/ui/StatusTag"
import Table, { Td, Th, Tr } from "@/components/ui/Table"
import Modal from "@/components/ui/Modal"
import { toDisplay } from "@/data/world"
import { navigate, useRoute, useViewState } from "@/router/router"
import { SCHEMA_DOC, useDraftModel } from "@/stores/modelDocuments"
import { useEditingDocument } from "@/stores/draftRegistry"
import { toast } from "@/stores/toast"
import CommitText from "@/features/ecs/CommitText"
import RefsNotice from "@/features/ecs/RefsNotice"
import ValueEditor from "@/features/ecs/ValueEditor"
import { toUnitDef } from "@/features/ecs/adapters"
import {
  applySchemaOp,
  useReadOnly,
  useSchemaDoc,
} from "@/features/ecs/editing"
import {
  suggestTemplateId,
  suggestTemplateVersion,
  validId,
} from "@/features/ecs/ids"
import {
  clearTemplateOverride,
  createTemplate,
  deleteTemplate,
  renameTemplate,
  setTemplateOverride,
} from "@/features/ecs/operations"
import { templateRefs, type RefHit } from "@/features/ecs/refs"

const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)

/** P05 实体模板与覆盖：模板默认值管理；“恢复继承”与“显式设为 null”是两个不同操作。 */
export default function P05Templates({ ctx: _ctx }: { ctx: WorkbenchContext }) {
  useEditingDocument(SCHEMA_DOC)
  const model = useDraftModel()
  const route = useRoute()
  const templateId = route.params.templateId
  if (!templateId) return <TemplateList />
  const template = model.templates.find((t) => t.id === templateId)
  if (!template) {
    return (
      <div className="mx-auto w-full max-w-[1280px] px-6 py-6">
        <Notice tone="warning">
          模板 {templateId} 不在当前草稿中；可能已被删除。
        </Notice>
      </div>
    )
  }
  return <TemplateDetail key={template.id} templateId={template.id} />
}

function TemplateList() {
  const model = useDraftModel()
  const readOnly = useReadOnly()
  const [query, setQuery] = useViewState("p05.query", "")
  const [creating, setCreating] = useState(false)
  const q = query.trim().toLowerCase()
  const rows = model.templates.filter(
    (t) =>
      !q || t.id.toLowerCase().includes(q) || t.label.toLowerCase().includes(q),
  )

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-6 py-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-title font-semibold">实体模板与覆盖</h2>
          <p className="mt-1 text-body text-muted">
            模板为一类实体提供默认值；值有效顺序：实例覆盖（含显式 null）→
            模板覆盖 → 属性默认。
          </p>
        </div>
        <Button
          intent="primary"
          icon={Plus}
          disabled={readOnly}
          onClick={() => setCreating(true)}
        >
          新建模板
        </Button>
      </div>
      <Card>
        <PanelHeader
          title="全部模板"
          meta={
            <span className="tabular">
              {rows.length} / {model.templates.length} 项
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
        <Table className="min-w-[760px]">
          <thead>
            <tr>
              <Th className="w-[280px]">模板</Th>
              <Th>类型</Th>
              <Th>装配组件</Th>
              <Th align="right">覆盖</Th>
              <Th align="right">使用实体</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const type = model.entityTypes.find((x) => x.id === t.typeId)
              const usedBy = model.scene.entities.filter(
                (e) => e.templateRef?.id === t.id,
              )
              return (
                <Tr
                  key={t.id}
                  onSelect={() =>
                    navigate({ pageId: "P05", params: { templateId: t.id } })
                  }
                >
                  <Td>
                    <div className="truncate font-medium">{t.label}</div>
                    <div className="truncate font-mono text-caption text-muted">
                      {t.id}@{t.version}
                    </div>
                  </Td>
                  <Td>
                    {type ? (
                      <ObjectLink
                        label={type.label}
                        id={type.id}
                        route={{ pageId: "P02", params: { classId: type.id } }}
                      />
                    ) : (
                      <span className="text-danger">{t.typeId}</span>
                    )}
                  </Td>
                  <Td className="text-ink-soft">
                    {t.componentSchemaRefs.map((r) => r.id).join("、")}
                  </Td>
                  <Td numeric>{Object.keys(t.overrides).length}</Td>
                  <Td numeric>{usedBy.length}</Td>
                </Tr>
              )
            })}
            {rows.length === 0 ? (
              <tr>
                <Td colSpan={5} className="py-8 text-center text-muted">
                  没有匹配的模板
                </Td>
              </tr>
            ) : null}
          </tbody>
        </Table>
      </Card>
      {creating ? (
        <CreateTemplateModal onClose={() => setCreating(false)} />
      ) : null}
    </div>
  )
}

function CreateTemplateModal({ onClose }: { onClose: () => void }) {
  const model = useDraftModel()
  const [typeId, setTypeId] = useState(model.entityTypes[0]?.id ?? "")
  const [id, setId] = useState(() =>
    suggestTemplateId(model.entityTypes[0]?.id ?? "entity", (x) =>
      model.templates.some((t) => t.id === x),
    ),
  )
  const [idTouched, setIdTouched] = useState(false)
  const [label, setLabel] = useState("")
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    if (!validId(id))
      return setError("ID 只能包含字母、数字、点、下划线与连字符，并以字母开头")
    const version = suggestTemplateVersion(
      model.templates.map((t) => t.version),
    )
    const result = applySchemaOp(`新建模板 ${id}`, (s) =>
      createTemplate(s, { id, version, label, typeId }),
    )
    if (!result.ok) return setError(result.message)
    navigate({ pageId: "P05", params: { templateId: id } })
  }

  return (
    <Modal
      title="新建实体模板"
      onClose={onClose}
      footer={
        <>
          <Button intent="ghost" onClick={onClose}>
            取消
          </Button>
          <Button intent="primary" onClick={submit}>
            创建模板
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 px-5 py-4">
        <Field label="实体类型" required hint="新模板装配该类型的必需组件">
          <Select
            value={typeId}
            onChange={(e) => {
              setTypeId(e.target.value)
              if (!idTouched)
                setId(
                  suggestTemplateId(e.target.value, (x) =>
                    model.templates.some((t) => t.id === x),
                  ),
                )
            }}
            options={model.entityTypes.map((t) => ({
              value: t.id,
              label: `${t.id} · ${t.label}`,
            }))}
          />
        </Field>
        <Field label="模板 ID" required hint="风格：tpl-<类型小写>">
          <TextInput
            value={id}
            mono
            onChange={(e) => {
              setId(e.target.value)
              setIdTouched(true)
            }}
          />
        </Field>
        <Field label="显示名" hint="留空时使用 ID">
          <TextInput
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="10吨泡沫消防车"
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

function TemplateDetail({ templateId }: { templateId: string }) {
  const model = useDraftModel()
  const doc = useSchemaDoc()
  const readOnly = useReadOnly()
  const [error, setError] = useState<string | null>(null)
  const [blocked, setBlocked] = useState<{
    message: string
    refs?: RefHit[]
  } | null>(null)
  const [confirming, setConfirming] = useState(false)

  const template = model.templates.find((t) => t.id === templateId)!
  const saved = doc?.savedContent.templates.find((t) => t.id === templateId)
  const isNew = !saved
  const dirty = saved
    ? JSON.stringify(saved) !== JSON.stringify(template)
    : true
  const type = model.entityTypes.find((t) => t.id === template.typeId)
  const usedBy = model.scene.entities.filter(
    (e) => e.templateRef?.id === templateId,
  )
  const refs = templateRefs(model, templateId)

  const assembled = template.componentSchemaRefs.map((r) => r.id)
  const rows = model.components
    .filter((c) => assembled.includes(c.id))
    .flatMap((c) =>
      c.propertyIds
        .map((pid) => ({
          component: c,
          attr: model.attributes.find((a) => a.id === pid),
        }))
        .filter((r) => r.attr),
    )

  const edit = (label: string, op: Parameters<typeof applySchemaOp>[1]) => {
    setBlocked(null)
    const result = applySchemaOp(label, op)
    setError(result.ok ? null : result.message)
  }

  const remove = () => {
    const result = applySchemaOp(`删除模板 ${templateId}`, (s) =>
      deleteTemplate(model, s, templateId),
    )
    if (!result.ok) {
      setConfirming(false)
      setBlocked({ message: result.message, refs: result.refs })
      return
    }
    toast(`已删除模板 ${templateId}`)
    navigate({ pageId: "P05", params: {} })
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
              onClick={() => navigate({ pageId: "P05", params: {} })}
            >
              模板列表
            </Button>
            <h2 className="text-title font-semibold">{template.label}</h2>
            <span className="rounded bg-neutral-soft px-1.5 font-mono text-label text-muted">
              {template.id}@{template.version}
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
            类型
            {type ? (
              <ObjectLink
                label={type.label}
                id={type.id}
                route={{ pageId: "P02", params: { classId: type.id } }}
              />
            ) : (
              <span className="text-danger">{template.typeId}</span>
            )}
            组件 {assembled.join("、")}
          </div>
        </div>
        <Button
          intent="danger-ghost"
          icon={Trash2}
          disabled={readOnly}
          onClick={() =>
            refs.length
              ? setBlocked({
                  message: `模板 ${templateId} 仍被 ${refs.length} 个实体使用，不能删除`,
                  refs,
                })
              : setConfirming(true)
          }
        >
          删除模板
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

      <Card>
        <PanelHeader title="基本" />
        <div className="max-w-md px-4 py-4">
          <CommitText
            label="显示名"
            value={template.label}
            readOnly={readOnly}
            required
            error={!template.label.trim() ? "显示名不能为空" : null}
            onCommit={(v) =>
              edit(`${templateId} · 显示名`, (s) =>
                renameTemplate(s, templateId, v),
              )
            }
          />
        </div>
      </Card>

      <Card>
        <PanelHeader
          title="模板覆盖"
          meta={
            <span className="tabular">
              {Object.keys(template.overrides).length} 项覆盖
            </span>
          }
          actions={
            <span className="text-caption text-muted">
              恢复继承 = 删除覆盖键；显式 null = 写入 null 覆盖，两者不同
            </span>
          }
        />
        <Table className="min-w-[900px]">
          <thead>
            <tr>
              <Th className="w-[240px]">属性</Th>
              <Th align="right">属性默认</Th>
              <Th className="w-[220px]">模板覆盖</Th>
              <Th>状态</Th>
              <Th className="w-[210px]">操作</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ component, attr }) => {
              const a = attr!
              const unit = a.type.unitId
                ? toUnitDef(model.units.find((u) => u.id === a.type.unitId)!)
                : null
              const has = own(template.overrides, a.id)
              const value = has ? template.overrides[a.id] : a.default
              return (
                <tr key={a.id}>
                  <Td>
                    <ObjectLink
                      label={a.label}
                      id={a.id}
                      route={{ pageId: "P31", params: { attributeId: a.id } }}
                    />
                    <div className="font-mono text-caption text-muted">
                      {component.id}
                    </div>
                  </Td>
                  <Td numeric>
                    <TypedValueCell value={toDisplay(a.default)} unit={unit} />
                  </Td>
                  <Td>
                    <ValueEditor
                      attr={a}
                      value={value}
                      readOnly={readOnly}
                      onCommit={(v) =>
                        edit(`${templateId} · 覆盖 ${a.id}`, (s) =>
                          setTemplateOverride(s, templateId, a.id, v),
                        )
                      }
                    />
                  </Td>
                  <Td>
                    {has ? (
                      template.overrides[a.id] === null ? (
                        <Tag tone="warning" size="sm">
                          显式 null
                        </Tag>
                      ) : (
                        <Tag tone="primary" size="sm">
                          模板覆盖
                        </Tag>
                      )
                    ) : (
                      <Tag size="sm">继承默认</Tag>
                    )}
                  </Td>
                  <Td>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        intent="ghost"
                        icon={Undo2}
                        disabled={readOnly || !has}
                        title="删除覆盖键，回到属性默认值"
                        onClick={() =>
                          edit(`${templateId} · 恢复继承 ${a.id}`, (s) =>
                            clearTemplateOverride(s, templateId, a.id),
                          )
                        }
                      >
                        恢复继承
                      </Button>
                      <Button
                        size="sm"
                        intent="ghost"
                        disabled={
                          readOnly ||
                          !a.type.nullable ||
                          (has && template.overrides[a.id] === null)
                        }
                        title="写入 null 覆盖（未设置），与恢复继承不同"
                        onClick={() =>
                          edit(`${templateId} · 显式 null ${a.id}`, (s) =>
                            setTemplateOverride(s, templateId, a.id, null),
                          )
                        }
                      >
                        显式设为 null
                      </Button>
                    </div>
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      </Card>

      <Card>
        <PanelHeader
          title="使用该模板的实体"
          meta={<span className="tabular">{usedBy.length} 个</span>}
        />
        {usedBy.length === 0 ? (
          <div className="px-4 py-4 text-body text-muted">
            没有实体使用该模板，可以安全删除。
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 px-4 py-3">
            {usedBy.map((e) => (
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
          title={`删除模板 ${templateId}`}
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
            将删除模板 {template.id}@{template.version}。该操作可通过撤销恢复。
          </p>
        </Modal>
      ) : null}
    </div>
  )
}
