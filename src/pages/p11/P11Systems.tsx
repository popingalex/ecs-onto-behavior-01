import { useState } from "react"
import { ArrowLeft, Lock, Plus, Trash2 } from "lucide-react"
import type { WorkbenchContext } from "@/app/useWorkbenchContext"
import ObjectLink from "@/components/domain/ObjectLink"
import TypedValueCell from "@/components/domain/TypedValueCell"
import Button from "@/components/ui/Button"
import Card, { Notice, PanelHeader, SectionLabel } from "@/components/ui/Card"
import Field, { Select, Switch, TextInput } from "@/components/ui/Field"
import Modal from "@/components/ui/Modal"
import { Tag } from "@/components/ui/StatusTag"
import Table, { Td, Th, Tr } from "@/components/ui/Table"
import { toDisplay } from "@/data/world"
import { navigate, useRoute } from "@/router/router"
import type {
  AttributeSchema,
  EntityQuery,
  LogicGraphDocument,
  PrototypeModel,
  RawValue,
  SystemDefinition,
} from "@/schema/model"
import { refKey } from "@/schema/model"
import { effectiveComponents } from "@/schema/inheritance"
import { applyEdit, useEditingDocument } from "@/stores/draftRegistry"
import {
  SYSTEMS_DOC,
  useDraftModel,
  type SystemsContent,
} from "@/stores/modelDocuments"
import { toast } from "@/stores/toast"
import CommitText from "@/features/ecs/CommitText"
import RefsNotice from "@/features/ecs/RefsNotice"
import ValueEditor from "@/features/ecs/ValueEditor"
import { useReadOnly } from "@/features/ecs/editing"
import { validId } from "@/features/ecs/ids"
import { systemRefs, type RefHit } from "@/features/ecs/refs"

const ACCESS_LABEL = {
  readPrevious: "读取（previous 视图）",
  contribute: "贡献写入",
  exclusive: "独占写入",
} as const
type AccessKind = keyof typeof ACCESS_LABEL

function editSystems(label: string, fn: (c: SystemsContent) => SystemsContent) {
  return applyEdit<SystemsContent>(SYSTEMS_DOC, label, fn)
}

function queryOf(model: PrototypeModel, system: SystemDefinition): EntityQuery | undefined {
  return model.queries.find(
    (q) => q.id === system.queryRef.id && q.version === system.queryRef.version,
  )
}

function programOf(model: PrototypeModel, system: SystemDefinition): LogicGraphDocument | undefined {
  return model.programs.find(
    (p) => p.id === system.programRef.id && p.version === system.programRef.version,
  )
}

/** System 访问声明可选属性：查询目标类型装配的属性（含 parent 继承）。 */
function candidateAttributes(model: PrototypeModel, system: SystemDefinition): AttributeSchema[] {
  const query = queryOf(model, system)
  const type = model.entityTypes.find((t) => t.id === query?.typeId)
  if (!type) return model.attributes
  const componentIds = new Set(
    effectiveComponents(model.entityTypes, type.id).map((o) => o.componentId),
  )
  const propertyIds = model.components
    .filter((c) => componentIds.has(c.id))
    .flatMap((c) => c.propertyIds)
  return model.attributes.filter((a) => propertyIds.includes(a.id))
}

/** P11 System 定义与绑定：query、program@版本、参数与读写访问声明。 */
export default function P11Systems({ ctx: _ctx }: { ctx: WorkbenchContext }) {
  useEditingDocument(SYSTEMS_DOC)
  const model = useDraftModel()
  const route = useRoute()
  const systemId = route.params.systemId
  if (!systemId) return <SystemList />
  const system = model.systems.find((s) => s.id === systemId)
  if (!system) {
    return (
      <div className="mx-auto w-full max-w-[1280px] px-6 py-6">
        <Notice tone="warning">System {systemId} 不在当前模型草稿中。</Notice>
      </div>
    )
  }
  return <SystemDetail key={system.id} systemId={system.id} />
}

function SystemList() {
  const model = useDraftModel()
  const readOnly = useReadOnly()
  const [creating, setCreating] = useState(false)
  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-6 py-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-title font-semibold">System 定义与绑定</h2>
          <p className="mt-1 text-body text-muted">
            System 把逻辑图程序（按版本）绑定到实体查询与参数，并声明读写访问。
          </p>
        </div>
        <Button intent="primary" icon={Plus} disabled={readOnly} onClick={() => setCreating(true)}>
          新建 System
        </Button>
      </div>
      <Card>
        <PanelHeader title="System 列表" meta={<span className="tabular">{model.systems.length} 个</span>} />
        <Table className="min-w-[960px]">
          <thead>
            <tr>
              <Th className="w-[220px]">System</Th>
              <Th>查询</Th>
              <Th>程序</Th>
              <Th>参数</Th>
              <Th>状态</Th>
              <Th align="right">调度引用</Th>
            </tr>
          </thead>
          <tbody>
            {model.systems.map((s) => {
              const usedIn = model.schedules.filter((sch) =>
                sch.nodes.some((n) => n.type === "SystemNode" && n.systemRef === s.id),
              )
              return (
                <Tr key={s.id} onSelect={() => navigate({ pageId: "P11", params: { systemId: s.id } })}>
                  <Td>
                    <div className="font-medium">{s.label}</div>
                    <div className="font-mono text-caption text-muted">{s.id}</div>
                  </Td>
                  <Td>
                    <span className="font-mono text-label">{refKey(s.queryRef)}</span>
                  </Td>
                  <Td>
                    <span className="font-mono text-label">{refKey(s.programRef)}</span>
                  </Td>
                  <Td>
                    <span className="text-caption text-muted">
                      {Object.entries(s.parameters)
                        .map(([k, v]) => `${k}=${String(v)}`)
                        .join("，") || "无"}
                    </span>
                  </Td>
                  <Td>
                    <Tag size="sm" tone={s.enabled ? "success" : "neutral"}>
                      {s.enabled ? "启用" : "停用"}
                    </Tag>
                  </Td>
                  <Td numeric>
                    {usedIn.length > 0 ? (
                      <span title={usedIn.map((x) => x.id).join("、")}>{usedIn.length}</span>
                    ) : (
                      <span className="text-faint">0</span>
                    )}
                  </Td>
                </Tr>
              )
            })}
            {model.systems.length === 0 ? (
              <tr>
                <Td colSpan={6} className="py-8 text-center text-muted">
                  没有 System
                </Td>
              </tr>
            ) : null}
          </tbody>
        </Table>
      </Card>
      {creating ? <CreateSystemModal onClose={() => setCreating(false)} /> : null}
    </div>
  )
}

function CreateSystemModal({ onClose }: { onClose: () => void }) {
  const model = useDraftModel()
  const [id, setId] = useState("")
  const [label, setLabel] = useState("")
  const [queryKey, setQueryKey] = useState(model.queries[0] ? refKey(model.queries[0]) : "")
  const [programKey, setProgramKey] = useState(model.programs[0] ? refKey(model.programs[0]) : "")
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    if (!validId(id))
      return setError("ID 只能包含字母、数字、点、下划线与连字符，并以字母开头")
    if (model.systems.some((s) => s.id === id)) return setError(`System ${id} 已存在`)
    const query = model.queries.find((q) => refKey(q) === queryKey)
    const program = model.programs.find((p) => refKey(p) === programKey)
    if (!query || !program) return setError("请选择查询与程序")
    const system: SystemDefinition = {
      id,
      label: label.trim() || id,
      queryRef: { id: query.id, version: query.version },
      programRef: { id: program.id, version: program.version },
      parameters: Object.fromEntries(program.parameters.map((p) => [p.id, p.default])),
      enabled: true,
      access: { readPrevious: [], contribute: [], exclusive: [] },
    }
    editSystems(`新建 System ${id}`, (c) => ({ ...c, systems: [...c.systems, system] }))
    toast(`已创建 System ${id}`)
    navigate({ pageId: "P11", params: { systemId: id } })
  }

  return (
    <Modal
      title="新建 System"
      onClose={onClose}
      footer={
        <>
          <Button intent="ghost" onClick={onClose}>
            取消
          </Button>
          <Button intent="primary" onClick={submit}>
            创建 System
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 px-5 py-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="System ID" required hint="例如 cool-A、cool-B">
            <TextInput value={id} mono onChange={(e) => setId(e.target.value)} />
          </Field>
          <Field label="显示名" hint="留空时使用 ID">
            <TextInput value={label} onChange={(e) => setLabel(e.target.value)} />
          </Field>
        </div>
        <Field label="实体查询" required>
          <Select
            value={queryKey}
            onChange={(e) => setQueryKey(e.target.value)}
            options={model.queries.map((q) => ({
              value: refKey(q),
              label: `${refKey(q)} · ${q.typeId}（${q.condition.propertyId} = ${String(q.condition.value)}）`,
            }))}
          />
        </Field>
        <Field label="程序（按版本绑定）" required hint="参数取该程序版本的默认值">
          <Select
            value={programKey}
            onChange={(e) => setProgramKey(e.target.value)}
            options={model.programs.map((p) => ({
              value: refKey(p),
              label: `${refKey(p)} · ${p.scopeType}`,
            }))}
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

function SystemDetail({ systemId }: { systemId: string }) {
  const model = useDraftModel()
  const readOnly = useReadOnly()
  const [blocked, setBlocked] = useState<{ message: string ;refs?: RefHit[] } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [addAccess, setAddAccess] = useState<Record<AccessKind, string>>({
    readPrevious: "",
    contribute: "",
    exclusive: "",
  })

  const system = model.systems.find((s) => s.id === systemId)!
  const query = queryOf(model, system)
  const program = programOf(model, system)
  const refs = systemRefs(model, systemId)
  const candidates = candidateAttributes(model, system)

  const patch = (label: string, fn: (s: SystemDefinition) => SystemDefinition) => {
    setBlocked(null)
    editSystems(label, (c) => ({
      ...c,
      systems: c.systems.map((s) => (s.id === systemId ? fn(s) : s)),
    }))
  }

  const remove = () => {
    editSystems(`删除 System ${systemId}`, (c) => ({
      ...c,
      systems: c.systems.filter((s) => s.id !== systemId),
    }))
    toast(`已删除 System ${systemId}`)
    navigate({ pageId: "P11", params: {} })
  }

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-6 py-6">
      <section className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Button size="sm" intent="ghost" icon={ArrowLeft} onClick={() => navigate({ pageId: "P11", params: {} })}>
              System 列表
            </Button>
            <h2 className="text-title font-semibold">{system.label}</h2>
            <span className="rounded bg-neutral-soft px-1.5 font-mono text-label text-muted">
              {system.id}
            </span>
            <Tag size="sm" tone={system.enabled ? "success" : "neutral"}>
              {system.enabled ? "启用" : "停用"}
            </Tag>
          </div>
        </div>
        <Button
          intent="danger-ghost"
          icon={Trash2}
          disabled={readOnly}
          onClick={() =>
            refs.length
              ? setBlocked({
                  message: `System ${systemId} 仍被 ${refs.length} 个调度引用，不能删除`,
                  refs,
                })
              : setConfirming(true)
          }
        >
          删除 System
        </Button>
      </section>

      {readOnly ? (
        <Notice tone="warning" icon={<Lock size={15} aria-hidden />}>
          观察者为只读角色，字段不可编辑。
        </Notice>
      ) : null}
      {blocked ? <RefsNotice message={blocked.message} refs={blocked.refs} /> : null}

      <Card>
        <PanelHeader title="基本" />
        <div className="grid max-w-3xl grid-cols-2 gap-4 px-4 py-4">
          <CommitText
            label="显示名"
            value={system.label}
            readOnly={readOnly}
            required
            error={!system.label.trim() ? "显示名不能为空" : null}
            onCommit={(v) => patch(`${systemId} · 显示名`, (s) => ({ ...s, label: v }))}
          />
          <Field label="启用状态" hint="停用的 System 保留在调度中，执行时跳过">
            <Switch
              checked={system.enabled}
              disabled={readOnly}
              label={system.enabled ? "启用" : "停用"}
              onChange={(v) => patch(`${systemId} · ${v ? "启用" : "停用"}`, (s) => ({ ...s, enabled: v }))}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <PanelHeader title="绑定" />
        <div className="grid max-w-3xl grid-cols-2 gap-4 px-4 py-4">
          <Field label="实体查询" required hint={query ? `匹配 ${query.typeId} · ${query.condition.propertyId} = ${String(query.condition.value)}` : "引用的查询不存在"}>
            <Select
              value={refKey(system.queryRef)}
              disabled={readOnly}
              invalid={!query}
              onChange={(e) => {
                const [qid, qv] = e.target.value.split("@")
                patch(`${systemId} · 查询`, (s) => ({
                  ...s,
                  queryRef: { id: qid, version: qv },
                }))
              }}
              options={model.queries.map((q) => ({
                value: refKey(q),
                label: `${refKey(q)} · ${q.typeId}`,
              }))}
            />
          </Field>
          <Field label="程序（按版本绑定）" required hint={program ? `作用域 ${program.scopeType}` : "引用的程序不存在"}>
            <Select
              value={refKey(system.programRef)}
              disabled={readOnly}
              invalid={!program}
              onChange={(e) => {
                const next = model.programs.find((p) => refKey(p) === e.target.value)
                if (!next) return
                patch(`${systemId} · 程序`, (s) => ({
                  ...s,
                  programRef: { id: next.id, version: next.version },
                  parameters: Object.fromEntries(
                    next.parameters.map((p) => [p.id, p.default]),
                  ),
                }))
              }}
              options={model.programs.map((p) => ({
                value: refKey(p),
                label: `${refKey(p)} · ${p.scopeType}`,
              }))}
            />
          </Field>
        </div>
        <div className="flex gap-2 border-t border-line px-4 py-3">
          <Button
            size="sm"
            intent="ghost"
            onClick={() => navigate({ pageId: "P10", params: { queryId: system.queryRef.id } })}
          >
            打开 P10 查询
          </Button>
          <Button
            size="sm"
            intent="ghost"
            onClick={() => navigate({ pageId: "P14", params: { programId: system.programRef.id } })}
          >
            打开 P14 程序
          </Button>
        </div>
      </Card>

      <Card>
        <PanelHeader
          title="参数"
          meta={<span className="tabular">{Object.keys(system.parameters).length} 项</span>}
          actions={
            program ? (
              <Button
                size="sm"
                intent="ghost"
                disabled={readOnly}
                onClick={() =>
                  patch(`${systemId} · 参数重置`, (s) => ({
                    ...s,
                    parameters: Object.fromEntries(
                      program.parameters.map((p) => [p.id, p.default]),
                    ),
                  }))
                }
              >
                重置为程序默认值
              </Button>
            ) : undefined
          }
        />
        {program && program.parameters.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th className="w-[220px]">参数</Th>
                <Th>类型</Th>
                <Th align="right">程序默认</Th>
                <Th className="w-[240px]">System 值</Th>
              </tr>
            </thead>
            <tbody>
              {program.parameters.map((p) => {
                const pseudo: AttributeSchema = {
                  id: p.id,
                  componentId: "",
                  label: p.id,
                  type: p.type,
                  default: p.default,
                  writeMode: "configuration",
                }
                const value: RawValue = Object.prototype.hasOwnProperty.call(
                  system.parameters,
                  p.id,
                )
                  ? system.parameters[p.id]
                  : p.default
                return (
                  <tr key={p.id}>
                    <Td>
                      <span className="font-mono text-label">{p.id}</span>
                    </Td>
                    <Td>
                      <span className="text-caption text-muted">
                        {p.type.primitive} · {p.type.shape}
                        {p.type.unitId ? ` · ${p.type.unitId}` : ""}
                      </span>
                    </Td>
                    <Td numeric>
                      <TypedValueCell value={toDisplay(p.default)} unit={null} />
                    </Td>
                    <Td>
                      <ValueEditor
                        attr={pseudo}
                        value={value}
                        readOnly={readOnly}
                        onCommit={(v) =>
                          patch(`${systemId} · 参数 ${p.id}`, (s) => ({
                            ...s,
                            parameters: { ...s.parameters, [p.id]: v },
                          }))
                        }
                      />
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        ) : (
          <p className="px-4 py-4 text-label text-muted">
            {program ? "该程序没有参数。" : "程序缺失，无法解析参数。"}
          </p>
        )}
      </Card>

      <Card>
        <PanelHeader title="读写访问声明" />
        <div className="flex flex-col gap-4 px-4 py-4">
          {(Object.keys(ACCESS_LABEL) as AccessKind[]).map((kind) => {
            const list = system.access[kind]
            const taken = new Set(list)
            const options = candidates
              .filter((a) => !taken.has(`self.${a.id}`))
              .map((a) => ({
                value: a.id,
                label: `${a.id} · ${a.label}（${a.writeMode}）`,
              }))
            return (
              <section key={kind}>
                <SectionLabel className="mb-1.5">
                  {ACCESS_LABEL[kind]}
                  <span className="ml-2 font-normal tabular">{list.length} 项</span>
                </SectionLabel>
                <div className="flex flex-col gap-1.5">
                  {list.map((path) => {
                    const attr = model.attributes.find((a) => `self.${a.id}` === path)
                    return (
                      <div
                        key={path}
                        className="flex items-center gap-2 rounded-ui border border-line bg-subtle px-3 py-1.5"
                      >
                        <span className="min-w-0 flex-1 truncate font-mono text-label">
                          {path}
                        </span>
                        {attr ? (
                          <Tag size="sm" tone={attr.writeMode === "exclusive" ? "warning" : attr.writeMode === "contribution" ? "primary" : "neutral"}>
                            {attr.writeMode}
                          </Tag>
                        ) : (
                          <Tag size="sm" tone="danger">
                            属性缺失
                          </Tag>
                        )}
                        <Button
                          size="sm"
                          intent="ghost"
                          disabled={readOnly}
                          onClick={() =>
                            patch(`${systemId} · 移除访问 ${path}`, (s) => ({
                              ...s,
                              access: {
                                ...s.access,
                                [kind]: s.access[kind].filter((x) => x !== path),
                              },
                            }))
                          }
                        >
                          移除
                        </Button>
                      </div>
                    )
                  })}
                  {list.length === 0 ? (
                    <p className="text-caption text-faint">无</p>
                  ) : null}
                  <div className="flex items-center gap-2">
                    <div className="w-96">
                      <Select
                        value={addAccess[kind]}
                        disabled={readOnly || options.length === 0}
                        placeholder={options.length ? "选择要声明的属性" : "没有可添加的属性"}
                        onChange={(e) =>
                          setAddAccess((prev) => ({ ...prev, [kind]: e.target.value }))
                        }
                        options={options}
                      />
                    </div>
                    <Button
                      size="sm"
                      disabled={readOnly || !addAccess[kind]}
                      onClick={() => {
                        const pid = addAccess[kind]
                        patch(`${systemId} · 声明访问 self.${pid}`, (s) => ({
                          ...s,
                          access: {
                            ...s.access,
                            [kind]: [...s.access[kind], `self.${pid}`],
                          },
                        }))
                        setAddAccess((prev) => ({ ...prev, [kind]: "" }))
                      }}
                    >
                      添加
                    </Button>
                  </div>
                </div>
              </section>
            )
          })}
          <p className="text-caption leading-5 text-muted">
            贡献写入必须流入使用对应归约器的节点；独占写入必须直达原子提交。P12 的计划预览与校验会按这里的声明做并发分析。
          </p>
        </div>
      </Card>

      {confirming ? (
        <Modal
          title={`删除 System ${systemId}`}
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
            将删除 System {system.id}（{system.label}）。该操作可通过撤销恢复。
          </p>
        </Modal>
      ) : null}
    </div>
  )
}
