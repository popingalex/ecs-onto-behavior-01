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
import Tabs from "@/components/ui/Tabs"
import Modal from "@/components/ui/Modal"
import { toDisplay } from "@/data/world"
import { navigate, useRoute, useViewState } from "@/router/router"
import { SCENE_DOC, useDraftModel } from "@/stores/modelDocuments"
import { useEditingDocument } from "@/stores/draftRegistry"
import { isAssembled, resolveInitialValue } from "@/schema/values"
import { toast } from "@/stores/toast"
import CommitText from "@/features/ecs/CommitText"
import RefsNotice from "@/features/ecs/RefsNotice"
import ValueEditor from "@/features/ecs/ValueEditor"
import { toUnitDef } from "@/features/ecs/adapters"
import { applySceneOp, useReadOnly, useSceneDoc } from "@/features/ecs/editing"
import { suggestEntityId, validId } from "@/features/ecs/ids"
import {
  addEntityComponent,
  clearEntityOverride,
  createSceneEntity,
  deleteSceneEntity,
  removeEntityComponent,
  renameSceneEntity,
  setEntityOverride,
} from "@/features/ecs/operations"
import { entityRefs, type RefHit } from "@/features/ecs/refs"

const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)

/** P08 场景实体实例表：实例 CRUD、组件装配与初值覆盖；null 位置照常列出（标注未放置）。 */
export default function P08Entities({ ctx: _ctx }: { ctx: WorkbenchContext }) {
  useEditingDocument(SCENE_DOC)
  const model = useDraftModel()
  const route = useRoute()
  const entityId = route.params.entityId
  if (!entityId) return <EntityList />
  const entity = model.scene.entities.find((e) => e.id === entityId)
  if (!entity) {
    return (
      <div className="mx-auto w-full max-w-[1280px] px-6 py-6">
        <Notice tone="warning">
          实体 {entityId} 不在当前场景草稿中；可能已被删除。
        </Notice>
      </div>
    )
  }
  return <EntityDetail key={entity.id} entityId={entity.id} />
}

function EntityList() {
  const model = useDraftModel()
  const readOnly = useReadOnly()
  const [typeFilter, setTypeFilter] = useViewState("p08.type", "all")
  const [query, setQuery] = useViewState("p08.query", "")
  const [creating, setCreating] = useState(false)
  const q = query.trim().toLowerCase()
  const rows = model.scene.entities.filter(
    (e) =>
      (typeFilter === "all" || e.typeId === typeFilter) &&
      (!q ||
        e.id.toLowerCase().includes(q) ||
        e.label.toLowerCase().includes(q)),
  )
  const unitM = model.units.find((u) => u.id === "m")

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-6 py-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-title font-semibold">场景实体</h2>
          <p className="mt-1 text-body text-muted">
            按类型列出场景实体；position 为 null 的实体照常列出并标注未放置，[0,
            0, 0] 是合法位置。
          </p>
        </div>
        <Button
          intent="primary"
          icon={Plus}
          disabled={readOnly}
          onClick={() => setCreating(true)}
        >
          新建实体
        </Button>
      </div>
      <Card>
        <PanelHeader
          title="实体实例"
          meta={
            <span className="tabular">
              {rows.length} / {model.scene.entities.length} 个
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
        <div className="border-b border-line px-4">
          <Tabs
            ariaLabel="按类型筛选"
            value={typeFilter}
            onChange={setTypeFilter}
            items={[
              { id: "all", label: "全部", count: model.scene.entities.length },
              ...model.entityTypes.map((t) => ({
                id: t.id,
                label: t.label,
                count: model.scene.entities.filter((e) => e.typeId === t.id)
                  .length,
              })),
            ]}
          />
        </div>
        <Table className="min-w-[900px]">
          <thead>
            <tr>
              <Th className="w-[240px]">实体</Th>
              <Th>类型</Th>
              <Th>模板</Th>
              <Th align="right">位置</Th>
              <Th align="right">组件</Th>
              <Th align="right">初值覆盖</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => {
              const type = model.entityTypes.find((t) => t.id === e.typeId)
              const position = resolveInitialValue(model, e, "position.local")
              return (
                <Tr
                  key={e.id}
                  onSelect={() =>
                    navigate({ pageId: "P08", params: { entityId: e.id } })
                  }
                >
                  <Td>
                    <div className="truncate font-medium">{e.label}</div>
                    <div className="truncate font-mono text-caption text-muted">
                      {e.id}
                    </div>
                  </Td>
                  <Td>
                    {type ? (
                      type.label
                    ) : (
                      <span className="text-danger">{e.typeId}</span>
                    )}
                  </Td>
                  <Td>
                    {e.templateRef ? (
                      <ObjectLink
                        id={`${e.templateRef.id}@${e.templateRef.version}`}
                        route={{
                          pageId: "P05",
                          params: { templateId: e.templateRef.id },
                        }}
                      />
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </Td>
                  <Td numeric>
                    {position.state === "notApplicable" ? (
                      <span className="text-faint">—</span>
                    ) : position.value === null ? (
                      <Tag tone="warning" size="sm">
                        未放置
                      </Tag>
                    ) : (
                      <TypedValueCell
                        value={toDisplay(position.value)}
                        unit={unitM ? toUnitDef(unitM) : null}
                      />
                    )}
                  </Td>
                  <Td numeric>{e.componentInstances.length}</Td>
                  <Td numeric>{Object.keys(e.initialOverrides).length}</Td>
                </Tr>
              )
            })}
            {rows.length === 0 ? (
              <tr>
                <Td colSpan={6} className="py-8 text-center text-muted">
                  没有匹配的实体
                </Td>
              </tr>
            ) : null}
          </tbody>
        </Table>
      </Card>
      {creating ? (
        <CreateEntityModal onClose={() => setCreating(false)} />
      ) : null}
    </div>
  )
}

function CreateEntityModal({ onClose }: { onClose: () => void }) {
  const model = useDraftModel()
  const [typeId, setTypeId] = useState(model.entityTypes[0]?.id ?? "")
  const [templateId, setTemplateId] = useState("")
  const [id, setId] = useState(() =>
    suggestEntityId(model.entityTypes[0]?.id ?? "E", (x) =>
      model.scene.entities.some((e) => e.id === x),
    ),
  )
  const [idTouched, setIdTouched] = useState(false)
  const [label, setLabel] = useState("")
  const [error, setError] = useState<string | null>(null)
  const templates = model.templates.filter((t) => t.typeId === typeId)

  const submit = () => {
    if (!validId(id))
      return setError("ID 只能包含字母、数字、点、下划线与连字符，并以字母开头")
    const result = applySceneOp(`新建实体 ${id}`, (scene) =>
      createSceneEntity(model, scene, {
        id,
        label,
        typeId,
        templateId: templateId || undefined,
      }),
    )
    if (!result.ok) return setError(result.message)
    navigate({ pageId: "P08", params: { entityId: id } })
  }

  return (
    <Modal
      title="新建场景实体"
      onClose={onClose}
      footer={
        <>
          <Button intent="ghost" onClick={onClose}>
            取消
          </Button>
          <Button intent="primary" onClick={submit}>
            创建实体
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 px-5 py-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="实体类型" required>
            <Select
              value={typeId}
              onChange={(e) => {
                setTypeId(e.target.value)
                setTemplateId("")
                if (!idTouched)
                  setId(
                    suggestEntityId(e.target.value, (x) =>
                      model.scene.entities.some((en) => en.id === x),
                    ),
                  )
              }}
              options={model.entityTypes.map((t) => ({
                value: t.id,
                label: `${t.id} · ${t.label}`,
              }))}
            />
          </Field>
          <Field label="模板" hint="不用模板时装配类型的必需组件">
            <Select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              options={[
                { value: "", label: "— 不使用模板" },
                ...templates.map((t) => ({
                  value: t.id,
                  label: `${t.id}@${t.version} · ${t.label}`,
                })),
              ]}
            />
          </Field>
        </div>
        <Field
          label="实体 ID"
          required
          hint="风格：类型首字母 + 两位序号，例如 F04"
        >
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
            placeholder="四号储罐火源"
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

function EntityDetail({ entityId }: { entityId: string }) {
  const model = useDraftModel()
  const doc = useSceneDoc()
  const readOnly = useReadOnly()
  const [error, setError] = useState<string | null>(null)
  const [blocked, setBlocked] = useState<{
    message: string
    refs?: RefHit[]
  } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [addComponentId, setAddComponentId] = useState("")

  const entity = model.scene.entities.find((e) => e.id === entityId)!
  const saved = doc?.savedContent.entities.find((e) => e.id === entityId)
  const isNew = !saved
  const dirty = saved ? JSON.stringify(saved) !== JSON.stringify(entity) : true
  const type = model.entityTypes.find((t) => t.id === entity.typeId)
  const refs = entityRefs(model, entityId)

  const assembledRows = model.components
    .filter((c) => isAssembled(entity, c.id))
    .flatMap((c) =>
      c.propertyIds
        .map((pid) => ({
          component: c,
          attr: model.attributes.find((a) => a.id === pid),
        }))
        .filter((r) => r.attr),
    )
  const addable = model.components.filter((c) => !isAssembled(entity, c.id))

  const edit = (label: string, op: Parameters<typeof applySceneOp>[1]) => {
    setBlocked(null)
    const result = applySceneOp(label, op)
    setError(result.ok ? null : result.message)
    return result
  }

  const remove = () => {
    const result = applySceneOp(`删除实体 ${entityId}`, (scene) =>
      deleteSceneEntity(model, scene, entityId),
    )
    if (!result.ok) {
      setConfirming(false)
      setBlocked({ message: result.message, refs: result.refs })
      return
    }
    toast(`已删除实体 ${entityId}`)
    navigate({ pageId: "P08", params: {} })
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
              onClick={() => navigate({ pageId: "P08", params: {} })}
            >
              实体列表
            </Button>
            <h2 className="text-title font-semibold">{entity.label}</h2>
            <span className="rounded bg-neutral-soft px-1.5 font-mono text-label text-muted">
              {entity.id}
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
              <span className="text-danger">{entity.typeId}</span>
            )}
            {entity.templateRef ? (
              <>
                模板
                <ObjectLink
                  id={`${entity.templateRef.id}@${entity.templateRef.version}`}
                  route={{
                    pageId: "P05",
                    params: { templateId: entity.templateRef.id },
                  }}
                />
              </>
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
                  message: `实体 ${entityId} 仍被 ${refs.length} 处引用，不能删除`,
                  refs,
                })
              : setConfirming(true)
          }
        >
          删除实体
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
            value={entity.label}
            readOnly={readOnly}
            required
            error={!entity.label.trim() ? "显示名不能为空" : null}
            onCommit={(v) =>
              edit(`${entityId} · 显示名`, (scene) =>
                renameSceneEntity(scene, entityId, v),
              )
            }
          />
        </div>
      </Card>

      <Card>
        <PanelHeader
          title="组件装配"
          meta={
            <span className="tabular">
              {entity.componentInstances.length} 个组件
            </span>
          }
        />
        <Table>
          <thead>
            <tr>
              <Th>组件</Th>
              <Th>版本</Th>
              <Th>来源</Th>
              <Th className="w-[120px]">操作</Th>
            </tr>
          </thead>
          <tbody>
            {entity.componentInstances.map((ci) => {
              const component = model.components.find(
                (c) => c.id === ci.schemaRef.id,
              )
              const required =
                type?.requiredComponentIds.includes(ci.schemaRef.id) ?? false
              return (
                <tr key={ci.schemaRef.id}>
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
                      <span className="text-danger">{ci.schemaRef.id}</span>
                    )}
                  </Td>
                  <Td className="font-mono text-label text-muted">
                    @{ci.schemaRef.version}
                  </Td>
                  <Td>
                    {required ? (
                      <Tag tone="primary" size="sm">
                        必需
                      </Tag>
                    ) : (
                      <Tag size="sm">可选</Tag>
                    )}
                  </Td>
                  <Td>
                    <Button
                      size="sm"
                      intent="ghost"
                      disabled={readOnly}
                      title={required ? "必需组件移除会报错" : "移除该组件实例"}
                      onClick={() =>
                        edit(`移除组件 ${ci.schemaRef.id}`, (scene) =>
                          removeEntityComponent(
                            model,
                            scene,
                            entityId,
                            ci.schemaRef.id,
                          ),
                        )
                      }
                    >
                      移除
                    </Button>
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </Table>
        {addable.length ? (
          <div className="flex items-center gap-2 border-t border-line px-4 py-3">
            <div className="w-64">
              <Select
                value={addComponentId}
                placeholder="选择要装配的组件"
                onChange={(e) => setAddComponentId(e.target.value)}
                options={addable.map((c) => ({
                  value: c.id,
                  label: `${c.id} · ${c.label}${
                    type?.optionalComponentIds.includes(c.id) ? "（可选）" : ""
                  }`,
                }))}
              />
            </div>
            <Button
              size="sm"
              disabled={readOnly || !addComponentId}
              onClick={() => {
                const result = edit(`装配组件 ${addComponentId}`, (scene) =>
                  addEntityComponent(model, scene, entityId, addComponentId),
                )
                if (result.ok) setAddComponentId("")
              }}
            >
              装配组件
            </Button>
          </div>
        ) : null}
      </Card>

      <Card>
        <PanelHeader
          title="初值（实例覆盖）"
          meta={
            <span className="tabular">
              {Object.keys(entity.initialOverrides).length} 项覆盖
            </span>
          }
          actions={
            <span className="text-caption text-muted">
              实例覆盖（含显式 null）→ 模板覆盖 → 属性默认
            </span>
          }
        />
        <Table className="min-w-[960px]">
          <thead>
            <tr>
              <Th className="w-[220px]">属性</Th>
              <Th align="right">生效值</Th>
              <Th>来源</Th>
              <Th className="w-[220px]">实例覆盖</Th>
              <Th className="w-[210px]">操作</Th>
            </tr>
          </thead>
          <tbody>
            {assembledRows.map(({ component, attr }) => {
              const a = attr!
              const unit = a.type.unitId
                ? toUnitDef(model.units.find((u) => u.id === a.type.unitId)!)
                : null
              const resolved = resolveInitialValue(model, entity, a.id)
              const has = own(entity.initialOverrides, a.id)
              const editValue = has
                ? entity.initialOverrides[a.id]
                : resolved.state === "value"
                  ? resolved.value
                  : null
              return (
                <tr key={a.id}>
                  <Td>
                    <ObjectLink
                      label={a.label}
                      id={a.id}
                      route={{ pageId: "P29", params: { attributeId: a.id } }}
                    />
                    <div className="font-mono text-caption text-muted">
                      {component.id}
                    </div>
                  </Td>
                  <Td numeric>
                    {resolved.state === "value" ? (
                      <TypedValueCell
                        value={toDisplay(resolved.value)}
                        unit={unit}
                      />
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </Td>
                  <Td>
                    {resolved.state === "value" ? (
                      resolved.source === "instance" ? (
                        resolved.value === null ? (
                          <Tag tone="warning" size="sm">
                            实例 · 显式 null
                          </Tag>
                        ) : (
                          <Tag tone="purple" size="sm">
                            实例覆盖
                          </Tag>
                        )
                      ) : resolved.source === "template" ? (
                        <Tag tone="primary" size="sm">
                          模板
                        </Tag>
                      ) : (
                        <Tag size="sm">默认</Tag>
                      )
                    ) : (
                      <span className="text-faint">不适用</span>
                    )}
                  </Td>
                  <Td>
                    <ValueEditor
                      attr={a}
                      value={editValue}
                      readOnly={readOnly}
                      entities={model.scene.entities.map((en) => ({
                        id: en.id,
                        label: en.label,
                      }))}
                      onCommit={(v) =>
                        edit(`${entityId} · 初值 ${a.id}`, (scene) =>
                          setEntityOverride(model, scene, entityId, a.id, v),
                        )
                      }
                    />
                  </Td>
                  <Td>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        intent="ghost"
                        icon={Undo2}
                        disabled={readOnly || !has}
                        title="删除实例覆盖，回到模板覆盖 / 属性默认"
                        onClick={() =>
                          edit(`${entityId} · 恢复继承 ${a.id}`, (scene) =>
                            clearEntityOverride(model, scene, entityId, a.id),
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
                          (has && entity.initialOverrides[a.id] === null)
                        }
                        title="写入 null 覆盖（未设置），与恢复继承不同"
                        onClick={() =>
                          edit(`${entityId} · 显式 null ${a.id}`, (scene) =>
                            setEntityOverride(
                              model,
                              scene,
                              entityId,
                              a.id,
                              null,
                            ),
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
            {assembledRows.length === 0 ? (
              <tr>
                <Td colSpan={5} className="py-6 text-center text-muted">
                  实体未装配任何组件，没有可用属性
                </Td>
              </tr>
            ) : null}
          </tbody>
        </Table>
      </Card>

      {confirming ? (
        <Modal
          title={`删除实体 ${entityId}`}
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
            将从场景 {model.scene.id} 中删除实体 {entity.id}（{entity.label}
            ）。该操作可通过撤销恢复。
          </p>
        </Modal>
      ) : null}
    </div>
  )
}
