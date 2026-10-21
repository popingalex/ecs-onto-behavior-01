import { useState } from "react"
import { ArrowLeft, Lock, Plus, Trash2 } from "lucide-react"
import type { WorkbenchContext } from "@/app/useWorkbenchContext"
import ObjectLink from "@/components/domain/ObjectLink"
import Button from "@/components/ui/Button"
import Card, { Notice, PanelHeader } from "@/components/ui/Card"
import Field, { Select, TextInput } from "@/components/ui/Field"
import Modal from "@/components/ui/Modal"
import { Tag } from "@/components/ui/StatusTag"
import Table, { Td, Th, Tr } from "@/components/ui/Table"
import { queryMatches } from "@/services/domainBindingService"
import { navigate, useRoute } from "@/router/router"
import type { EntityQuery, PrototypeModel } from "@/schema/model"
import { applyEdit, useEditingDocument } from "@/stores/draftRegistry"
import {
  SYSTEMS_DOC,
  useDraftModel,
  type SystemsContent,
} from "@/stores/modelDocuments"
import { toast } from "@/stores/toast"
import RefsNotice from "@/features/ecs/RefsNotice"
import ValueEditor from "@/features/ecs/ValueEditor"
import { useReadOnly } from "@/features/ecs/editing"
import { validId } from "@/features/ecs/ids"
import { queryRefs, type RefHit } from "@/features/ecs/refs"

/** 类型可装配组件里的全部属性（条件只能指向这些属性）。 */
function typeAttributes(model: PrototypeModel, typeId: string) {
  const type = model.entityTypes.find((t) => t.id === typeId)
  if (!type) return []
  const componentIds = new Set([
    ...type.requiredComponentIds,
    ...type.optionalComponentIds,
  ])
  const propertyIds = model.components
    .filter((c) => componentIds.has(c.id))
    .flatMap((c) => c.propertyIds)
  return model.attributes.filter((a) => propertyIds.includes(a.id))
}

function editSystems(label: string, fn: (c: SystemsContent) => SystemsContent) {
  return applyEdit<SystemsContent>(SYSTEMS_DOC, label, fn)
}

/** P10 实体查询：类型化条件编辑与匹配预览；保存版本后才更新引用（draft/saved 分界由草稿文档承担）。 */
export default function P10EntityQueries({ ctx: _ctx }: { ctx: WorkbenchContext }) {
  useEditingDocument(SYSTEMS_DOC)
  const model = useDraftModel()
  const route = useRoute()
  const queryId = route.params.queryId
  if (!queryId) return <QueryList />
  const query = model.queries.find((q) => q.id === queryId)
  if (!query) {
    return (
      <div className="mx-auto w-full max-w-[1280px] px-6 py-6">
        <Notice tone="warning">查询 {queryId} 不在当前模型草稿中。</Notice>
      </div>
    )
  }
  return <QueryDetail key={query.id} queryId={query.id} />
}

function QueryList() {
  const model = useDraftModel()
  const readOnly = useReadOnly()
  const [creating, setCreating] = useState(false)
  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-6 py-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-title font-semibold">实体查询</h2>
          <p className="mt-1 text-body text-muted">
            类型化条件 + previous 读取视图 + id 稳定排序；System 按 id@version 引用查询。
          </p>
        </div>
        <Button intent="primary" icon={Plus} disabled={readOnly} onClick={() => setCreating(true)}>
          新建查询
        </Button>
      </div>
      <Card>
        <PanelHeader title="查询列表" meta={<span className="tabular">{model.queries.length} 个</span>} />
        <Table className="min-w-[900px]">
          <thead>
            <tr>
              <Th className="w-[220px]">查询</Th>
              <Th>实体类型</Th>
              <Th>条件</Th>
              <Th align="right">匹配实体</Th>
              <Th align="right">被 System 引用</Th>
            </tr>
          </thead>
          <tbody>
            {model.queries.map((q) => {
              const type = model.entityTypes.find((t) => t.id === q.typeId)
              const matched = queryMatches(model, q)
              const usedBy = model.systems.filter((s) => s.queryRef.id === q.id)
              return (
                <Tr key={q.id} onSelect={() => navigate({ pageId: "P10", params: { queryId: q.id } })}>
                  <Td>
                    <div className="font-medium">{q.id}</div>
                    <div className="font-mono text-caption text-muted">@{q.version}</div>
                  </Td>
                  <Td>{type ? type.label : <span className="text-danger">{q.typeId}</span>}</Td>
                  <Td>
                    <span className="font-mono text-label">
                      {q.condition.propertyId} = {String(q.condition.value)}
                    </span>
                  </Td>
                  <Td numeric>{matched.length}</Td>
                  <Td numeric>
                    {usedBy.length > 0 ? (
                      <span title={usedBy.map((s) => s.id).join("、")}>{usedBy.length}</span>
                    ) : (
                      <span className="text-faint">0</span>
                    )}
                  </Td>
                </Tr>
              )
            })}
            {model.queries.length === 0 ? (
              <tr>
                <Td colSpan={5} className="py-8 text-center text-muted">
                  没有查询
                </Td>
              </tr>
            ) : null}
          </tbody>
        </Table>
      </Card>
      {creating ? <CreateQueryModal onClose={() => setCreating(false)} /> : null}
    </div>
  )
}

function CreateQueryModal({ onClose }: { onClose: () => void }) {
  const model = useDraftModel()
  const [typeId, setTypeId] = useState(model.entityTypes[0]?.id ?? "")
  const attrs = typeAttributes(model, typeId)
  const [propertyId, setPropertyId] = useState(attrs[0]?.id ?? "")
  const attr = attrs.find((a) => a.id === propertyId) ?? attrs[0]
  const [id, setId] = useState("q-new-1")
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    if (!validId(id))
      return setError("ID 只能包含字母、数字、点、下划线与连字符，并以字母开头")
    if (model.queries.some((q) => q.id === id)) return setError(`查询 ${id} 已存在`)
    if (!attr) return setError("该类型没有可用属性")
    const query: EntityQuery = {
      id,
      version: "q1",
      typeId,
      condition: { propertyId: attr.id, op: "eq", value: attr.default },
      readView: "previous",
      sort: "id",
    }
    editSystems(`新建查询 ${id}`, (c) => ({ ...c, queries: [...c.queries, query] }))
    toast(`已创建查询 ${id}@q1`)
    navigate({ pageId: "P10", params: { queryId: id } })
  }

  return (
    <Modal
      title="新建实体查询"
      onClose={onClose}
      footer={
        <>
          <Button intent="ghost" onClick={onClose}>
            取消
          </Button>
          <Button intent="primary" onClick={submit}>
            创建查询
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 px-5 py-4">
        <Field label="查询 ID" required>
          <TextInput value={id} mono onChange={(e) => setId(e.target.value)} />
        </Field>
        <Field label="实体类型" required>
          <Select
            value={typeId}
            onChange={(e) => {
              setTypeId(e.target.value)
              setPropertyId(typeAttributes(model, e.target.value)[0]?.id ?? "")
            }}
            options={model.entityTypes.map((t) => ({
              value: t.id,
              label: `${t.id} · ${t.label}`,
            }))}
          />
        </Field>
        <Field label="条件属性" hint="条件为 属性 = 值；读取视图固定 previous，排序固定 id">
          <Select
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            options={attrs.map((a) => ({ value: a.id, label: `${a.id} · ${a.label}` }))}
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

function QueryDetail({ queryId }: { queryId: string }) {
  const model = useDraftModel()
  const readOnly = useReadOnly()
  const [blocked, setBlocked] = useState<{ message: string ;refs?: RefHit[] } | null>(null)
  const [confirming, setConfirming] = useState(false)

  const query = model.queries.find((q) => q.id === queryId)!
  const attrs = typeAttributes(model, query.typeId)
  const attr = attrs.find((a) => a.id === query.condition.propertyId)
  const matched = queryMatches(model, query)
  const refs = queryRefs(model, queryId)
  const entities = matched
    .map((id) => model.scene.entities.find((e) => e.id === id))
    .filter((e) => e !== undefined)

  const patch = (label: string, fn: (q: EntityQuery) => EntityQuery) => {
    setBlocked(null)
    editSystems(label, (c) => ({
      ...c,
      queries: c.queries.map((q) => (q.id === queryId ? fn(q) : q)),
    }))
  }

  const remove = () => {
    editSystems(`删除查询 ${queryId}`, (c) => ({
      ...c,
      queries: c.queries.filter((q) => q.id !== queryId),
    }))
    toast(`已删除查询 ${queryId}`)
    navigate({ pageId: "P10", params: {} })
  }

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-6 py-6">
      <section className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Button size="sm" intent="ghost" icon={ArrowLeft} onClick={() => navigate({ pageId: "P10", params: {} })}>
              查询列表
            </Button>
            <h2 className="text-title font-semibold">{query.id}</h2>
            <span className="rounded bg-neutral-soft px-1.5 font-mono text-label text-muted">
              @{query.version}
            </span>
            <Tag size="sm">读 {query.readView}</Tag>
            <Tag size="sm">排序 {query.sort}</Tag>
          </div>
        </div>
        <Button
          intent="danger-ghost"
          icon={Trash2}
          disabled={readOnly}
          onClick={() =>
            refs.length
              ? setBlocked({
                  message: `查询 ${queryId} 仍被 ${refs.length} 个 System 引用，不能删除`,
                  refs,
                })
              : setConfirming(true)
          }
        >
          删除查询
        </Button>
      </section>

      {readOnly ? (
        <Notice tone="warning" icon={<Lock size={15} aria-hidden />}>
          观察者为只读角色，字段不可编辑。
        </Notice>
      ) : null}
      {blocked ? <RefsNotice message={blocked.message} refs={blocked.refs} /> : null}

      <Card>
        <PanelHeader title="类型化条件" />
        <div className="grid max-w-3xl grid-cols-2 gap-4 px-4 py-4">
          <Field label="实体类型" required>
            <Select
              value={query.typeId}
              disabled={readOnly}
              onChange={(e) => {
                const nextAttrs = typeAttributes(model, e.target.value)
                patch(`${queryId} · 类型`, (q) => ({
                  ...q,
                  typeId: e.target.value,
                  condition: nextAttrs.some((a) => a.id === q.condition.propertyId)
                    ? q.condition
                    : {
                        propertyId: nextAttrs[0]?.id ?? q.condition.propertyId,
                        op: "eq",
                        value: nextAttrs[0]?.default ?? null,
                      },
                }))
              }}
              options={model.entityTypes.map((t) => ({
                value: t.id,
                label: `${t.id} · ${t.label}`,
              }))}
            />
          </Field>
          <Field label="条件属性" required hint={attr ? `类型 ${attr.type.primitive} · ${attr.type.shape}` : "该类型下没有此属性"}>
            <Select
              value={query.condition.propertyId}
              disabled={readOnly}
              invalid={!attr}
              onChange={(e) => {
                const next = attrs.find((a) => a.id === e.target.value)
                patch(`${queryId} · 条件属性`, (q) => ({
                  ...q,
                  condition: {
                    propertyId: e.target.value,
                    op: "eq",
                    value: next?.default ?? null,
                  },
                }))
              }}
              options={attrs.map((a) => ({
                value: a.id,
                label: `${a.id} · ${a.label}`,
              }))}
            />
          </Field>
          <Field label="条件值" hint="比较运算符固定为 =（eq）">
            {attr ? (
              <ValueEditor
                attr={attr}
                value={query.condition.value}
                readOnly={readOnly}
                entities={model.scene.entities.map((en) => ({ id: en.id, label: en.label }))}
                onCommit={(v) =>
                  patch(`${queryId} · 条件值`, (q) => ({
                    ...q,
                    condition: { ...q.condition, value: v },
                  }))
                }
              />
            ) : (
              <span className="text-label text-danger">先选择有效属性</span>
            )}
          </Field>
        </div>
      </Card>

      <Card>
        <PanelHeader
          title="匹配预览"
          meta={<span className="tabular">{matched.length} 个实体</span>}
          actions={
            <span className="text-caption text-muted">
              按 baseWorld 已提交值（previous 视图）匹配
            </span>
          }
        />
        <Table>
          <thead>
            <tr>
              <Th className="w-[200px]">实体</Th>
              <Th>显示名</Th>
              <Th>条件属性当前值</Th>
            </tr>
          </thead>
          <tbody>
            {entities.map((e) => (
              <Tr key={e.id} onSelect={() => navigate({ pageId: "P08", params: { entityId: e.id } })}>
                <Td>
                  <ObjectLink
                    id={e.id}
                    route={{ pageId: "P08", params: { entityId: e.id } }}
                  />
                </Td>
                <Td>{e.label}</Td>
                <Td>
                  <span className="font-mono text-label">
                    {String(model.baseWorld.values[e.id]?.[query.condition.propertyId])}
                  </span>
                </Td>
              </Tr>
            ))}
            {entities.length === 0 ? (
              <tr>
                <Td colSpan={3} className="py-6 text-center text-muted">
                  当前条件下没有匹配的实体
                </Td>
              </tr>
            ) : null}
          </tbody>
        </Table>
      </Card>

      {confirming ? (
        <Modal
          title={`删除查询 ${queryId}`}
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
            将删除查询 {query.id}@{query.version}。该操作可通过撤销恢复。
          </p>
        </Modal>
      ) : null}
    </div>
  )
}
