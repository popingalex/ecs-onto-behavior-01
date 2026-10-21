import { useState } from "react"
import { ArrowLeft, Box, Layers, Lock, Play, Plus, Trash2 } from "lucide-react"
import type { WorkbenchContext } from "@/app/useWorkbenchContext"
import ObjectLink from "@/components/domain/ObjectLink"
import TypedValueCell from "@/components/domain/TypedValueCell"
import Button from "@/components/ui/Button"
import Card, { KeyValue, Notice, PanelHeader } from "@/components/ui/Card"
import Field, { TextInput } from "@/components/ui/Field"
import { Tag } from "@/components/ui/StatusTag"
import Table, { Td, Th, Tr } from "@/components/ui/Table"
import Modal from "@/components/ui/Modal"
import { toDisplay } from "@/data/world"
import { formatLocalStamp } from "@/lib/format"
import { navigate, useRoute } from "@/router/router"
import { useIndex } from "@/data/store"
import { useDraftModel } from "@/stores/modelDocuments"
import { useEditingDocument } from "@/stores/draftRegistry"
import { toast } from "@/stores/toast"
import { toUnitDef } from "@/features/ecs/adapters"
import { applySceneOp, useReadOnly } from "@/features/ecs/editing"
import { validId } from "@/features/ecs/ids"
import type { OpResult } from "@/features/ecs/operations"
import {
  createSceneTemplateFromScene,
  instantiateSceneTemplate,
  type SceneTemplateDef,
} from "@/features/scene/assembly"
import {
  SCENE_TEMPLATES_DOC,
  applySceneTemplatesOp,
  useSceneTemplatesDoc,
  type SceneTemplatesContent,
} from "@/features/scene/templates"

/**
 * P06 场景模板：从当前场景另存模板（本地扩展文档，不含运行任务 / 历史），
 * 角色表如实反映场景初值装配；实例化生成新 entityId 写入场景草稿（SCENE_DOC）。
 * 旧样例 tpl-park@st2（legacy-fixture）只读展示，不参与 v0.5 模型；
 * v0.5 契约没有模板级调度绑定与资产引用，相应区域显示空态说明。
 */
export default function P06SceneTemplates({
  ctx: _ctx,
}: {
  ctx: WorkbenchContext
}) {
  useEditingDocument(SCENE_TEMPLATES_DOC)
  const route = useRoute()
  const doc = useSceneTemplatesDoc()
  const { sceneTemplateId } = route.params
  if (!sceneTemplateId) return <TemplateList />
  const template = doc?.content.templates.find((t) => t.id === sceneTemplateId)
  if (!template) return <LegacyTemplateDetail id={sceneTemplateId} />
  return <TemplateDetail key={template.id} template={template} />
}

/** 旧样例场景模板（legacy-fixture）：只有 id / 版本 / 标签，不在 v0.5 模型内。 */
function LegacyTemplateDetail({ id }: { id: string }) {
  const index = useIndex()
  const entry = index.sceneTemplates.get(id)
  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-6 py-6">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          intent="ghost"
          icon={ArrowLeft}
          onClick={() => navigate({ pageId: "P06", params: {} })}
        >
          模板列表
        </Button>
        <h2 className="text-title font-semibold">
          {entry?.label ?? id}
        </h2>
        {entry ? (
          <span className="rounded bg-neutral-soft px-1.5 font-mono text-label text-muted">
            {entry.id}@{entry.version}
          </span>
        ) : null}
        <Tag tone="warning" size="sm">
          旧样例
        </Tag>
      </div>
      <Notice tone="info">
        {entry ? (
          <>
            {entry.id}@{entry.version} 是旧工作台保留的样例入口（legacy-fixture）：
            角色与装配明细未随样例提供，不在 v0.5 模型内，不能编辑或实例化。
            可复用装配请使用「从当前场景另存为模板」创建的本地模板。
          </>
        ) : (
          <>场景模板 {id} 不存在；可能来自过期的链接。</>
        )}
      </Notice>
      <Button
        className="self-start"
        intent="secondary"
        icon={ArrowLeft}
        onClick={() => navigate({ pageId: "P06", params: {} })}
      >
        回到场景模板列表
      </Button>
    </div>
  )
}

function TemplateList() {
  const index = useIndex()
  const model = useDraftModel()
  const doc = useSceneTemplatesDoc()
  const readOnly = useReadOnly()
  const [creating, setCreating] = useState(false)
  const templates = doc?.content.templates ?? []
  const legacy = [...index.sceneTemplates.values()]

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-6 py-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-title font-semibold">场景模板</h2>
          <p className="mt-1 text-body text-muted">
            可复用的场景装配：角色（类型 / 模板来源 / 初值）快照。v0.5
            契约未含场景模板对象，本页模板是原型本地扩展，随浏览器本地保存。
          </p>
        </div>
        <Button
          intent="primary"
          icon={Plus}
          disabled={readOnly}
          title="快照当前场景草稿的实体装配；不包含运行任务与历史"
          onClick={() => setCreating(true)}
        >
          从当前场景另存为模板
        </Button>
      </div>

      <Card>
        <PanelHeader
          title="当前场景"
          meta={
            <span className="tabular">
              {model.scene.entities.length} 个实体
            </span>
          }
        />
        <dl className="px-4 py-3">
          <KeyValue label="场景" mono>
            {model.scene.id}
          </KeyValue>
          <KeyValue label="实体类型">
            {[...new Set(model.scene.entities.map((e) => e.typeId))].join("、")}
          </KeyValue>
          <KeyValue label="实体模板">
            {model.templates.length
              ? model.templates.map((t) => (
                  <ObjectLink
                    key={t.id}
                    label={t.label}
                    id={`${t.id}@${t.version}`}
                    route={{ pageId: "P05", params: { templateId: t.id } }}
                  />
                ))
              : "—"}
          </KeyValue>
          <KeyValue label="调度">
            {model.schedules.map((s) => (
              <ObjectLink
                key={s.id}
                id={`${s.id}@${s.version}`}
                route={{ pageId: "P12", params: { scheduleId: s.id } }}
              />
            ))}
          </KeyValue>
        </dl>
      </Card>

      <Card>
        <PanelHeader
          title="模板列表（本地扩展）"
          meta={<span className="tabular">{templates.length} 个</span>}
        />
        {templates.length === 0 ? (
          <div className="flex flex-col items-start gap-2 px-4 py-6">
            <p className="text-body text-muted">
              还没有场景模板。用「从当前场景另存为模板」把 {model.scene.id}{" "}
              的装配保存为可复用模板。
            </p>
            <p className="text-caption text-faint">
              模板只记录场景初值装配；运行任务与历史不属于模板内容。
            </p>
          </div>
        ) : (
          <Table className="min-w-[860px]">
            <thead>
              <tr>
                <Th className="w-[260px]">模板</Th>
                <Th>版本</Th>
                <Th>来源场景</Th>
                <Th align="right">角色</Th>
                <Th>创建时间</Th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <Tr
                  key={t.id}
                  onSelect={() =>
                    navigate({ pageId: "P06", params: { sceneTemplateId: t.id } })
                  }
                >
                  <Td>
                    <div className="truncate font-medium">{t.label}</div>
                    <div className="truncate font-mono text-caption text-muted">
                      {t.id}
                    </div>
                  </Td>
                  <Td className="font-mono text-label text-muted">
                    @{t.version}
                  </Td>
                  <Td className="font-mono text-label">{t.sourceSceneId}</Td>
                  <Td numeric>{t.roles.length}</Td>
                  <Td className="text-label text-muted">
                    {formatLocalStamp(t.createdAt)}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card>
        <PanelHeader
          title="旧样例（legacy-fixture）"
          meta={<span className="tabular">{legacy.length} 个</span>}
        />
        <Table>
          <thead>
            <tr>
              <Th className="w-[260px]">模板</Th>
              <Th>版本</Th>
              <Th>状态</Th>
            </tr>
          </thead>
          <tbody>
            {legacy.map((t) => (
              <Tr
                key={t.id}
                onSelect={() =>
                  navigate({ pageId: "P06", params: { sceneTemplateId: t.id } })
                }
              >
                <Td>
                  <div className="truncate font-medium">{t.label}</div>
                  <div className="truncate font-mono text-caption text-muted">
                    {t.id}
                  </div>
                </Td>
                <Td className="font-mono text-label text-muted">
                  @{t.version}
                </Td>
                <Td>
                  <Tag tone="warning" size="sm">
                    旧样例 · 只读
                  </Tag>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
        <div className="border-t border-line px-4 py-2.5 text-caption text-muted">
          旧工作台保留的入口，不在 v0.5 模型内，角色明细未随样例提供。
        </div>
      </Card>

      {creating ? (
        <SaveAsTemplateModal
          taken={(id) => templates.some((t) => t.id === id)}
          onClose={() => setCreating(false)}
        />
      ) : null}
    </div>
  )
}

function SaveAsTemplateModal({
  taken,
  onClose,
}: {
  taken: (id: string) => boolean
  onClose: () => void
}) {
  const model = useDraftModel()
  const [id, setId] = useState("")
  const [label, setLabel] = useState("")
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    if (!validId(id))
      return setError(
        "ID 只能包含字母、数字、点、下划线与连字符，并以字母开头",
      )
    const result = applySceneTemplatesOp(`另存场景模板 ${id}`, (c) => {
      const created = createSceneTemplateFromScene(
        model.scene,
        { id, label },
        taken,
        new Date().toISOString(),
      )
      if (!created.ok) return created as OpResult<SceneTemplatesContent>
      return {
        ok: true,
        content: { templates: [...c.templates, created.content] },
      }
    })
    if (!result.ok) return setError(result.message)
    toast(`已保存场景模板 ${id}`)
    navigate({ pageId: "P06", params: { sceneTemplateId: id } })
  }

  return (
    <Modal
      title="从当前场景另存为模板"
      subtitle={`来源：${model.scene.id} · ${model.scene.entities.length} 个实体`}
      onClose={onClose}
      footer={
        <>
          <Button intent="ghost" onClick={onClose}>
            取消
          </Button>
          <Button intent="primary" onClick={submit}>
            保存模板
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 px-5 py-4">
        <Notice tone="info" icon={<Layers size={15} aria-hidden />}>
          模板快照场景初值装配（类型、模板来源、组件、初值覆盖）。运行任务、
          回合历史与已提交 commit 不属于模板内容，不会随模板复制。
        </Notice>
        <div className="grid grid-cols-2 gap-4">
          <Field label="模板 ID" required hint="例如 tpl-park">
            <TextInput value={id} mono onChange={(e) => setId(e.target.value)} />
          </Field>
          <Field label="显示名" hint="留空时使用 ID">
            <TextInput
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="园区场景模板"
            />
          </Field>
        </div>
        {error ? (
          <p role="alert" className="text-label text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  )
}

function TemplateDetail({ template }: { template: SceneTemplateDef }) {
  const model = useDraftModel()
  const readOnly = useReadOnly()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [confirmingInstantiate, setConfirmingInstantiate] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const meter = model.units.find((u) => u.id === "m")

  const missingTypes = template.roles.filter(
    (r) => !model.entityTypes.some((t) => t.id === r.typeId),
  )
  const missingTemplates = template.roles.filter(
    (r) =>
      r.templateRef &&
      !model.templates.some(
        (t) => t.id === r.templateRef!.id && t.version === r.templateRef!.version,
      ),
  )
  const blockedReasons = [
    ...missingTypes.map((r) => `角色 ${r.roleId} 的类型 ${r.typeId} 不存在`),
    ...missingTemplates.map(
      (r) =>
        `角色 ${r.roleId} 的模板 ${r.templateRef!.id}@${r.templateRef!.version} 不存在`,
    ),
  ]

  const instantiate = () => {
    const result = applySceneOp(`实例化场景模板 ${template.id}`, (scene) =>
      instantiateSceneTemplate(model, scene, template),
    )
    if (!result.ok) {
      setError(result.message)
      return
    }
    setConfirmingInstantiate(false)
    toast(
      `已把模板 ${template.id} 实例化进场景：新增 ${template.roles.length} 个实体（新 entityId）`,
    )
    navigate({ pageId: "P07", params: {} })
  }

  const remove = () => {
    applySceneTemplatesOp(`删除场景模板 ${template.id}`, (c) => ({
      ok: true,
      content: {
        templates: c.templates.filter((t) => t.id !== template.id),
      },
    }))
    toast(`已删除场景模板 ${template.id}`)
    navigate({ pageId: "P06", params: {} })
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
              onClick={() => navigate({ pageId: "P06", params: {} })}
            >
              模板列表
            </Button>
            <h2 className="text-title font-semibold">{template.label}</h2>
            <span className="rounded bg-neutral-soft px-1.5 font-mono text-label text-muted">
              {template.id}@{template.version}
            </span>
          </div>
          <p className="mt-2 text-label text-muted">
            来源场景 <span className="font-mono">{template.sourceSceneId}</span>{" "}
            · 创建于 {formatLocalStamp(template.createdAt)} · 本地扩展文档
          </p>
        </div>
        <Button
          intent="secondary"
          icon={Play}
          disabled={readOnly || blockedReasons.length > 0}
          title={
            blockedReasons.length
              ? blockedReasons.join("；")
              : "在当前场景草稿中按角色创建新实体（新 entityId）"
          }
          onClick={() => setConfirmingInstantiate(true)}
        >
          实例化到当前场景
        </Button>
        <Button
          intent="danger-ghost"
          icon={Trash2}
          disabled={readOnly}
          onClick={() => setConfirmingDelete(true)}
        >
          删除模板
        </Button>
      </section>

      {readOnly ? (
        <Notice tone="warning" icon={<Lock size={15} aria-hidden />}>
          观察者为只读角色，实例化与删除不可用。
        </Notice>
      ) : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {blockedReasons.length ? (
        <Notice tone="warning">
          模板依赖缺失，不能实例化：{blockedReasons.join("；")}
        </Notice>
      ) : null}

      <Card>
        <PanelHeader
          title="实体角色"
          meta={<span className="tabular">{template.roles.length} 个</span>}
          actions={
            <span className="text-caption text-muted">
              实例化生成新 entityId，不复制运行 commit
            </span>
          }
        />
        <Table className="min-w-[960px]">
          <thead>
            <tr>
              <Th className="w-[220px]">角色</Th>
              <Th>类型</Th>
              <Th>模板来源</Th>
              <Th align="right">初值覆盖</Th>
              <Th align="right">空间放置</Th>
            </tr>
          </thead>
          <tbody>
            {template.roles.map((r) => {
              const type = model.entityTypes.find((t) => t.id === r.typeId)
              const position = r.overrides["position.local"]
              return (
                <tr key={r.roleId}>
                  <Td>
                    <div className="truncate font-medium">{r.label}</div>
                    <div className="truncate font-mono text-caption text-muted">
                      {r.roleId}
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
                      <span className="text-danger">{r.typeId}</span>
                    )}
                  </Td>
                  <Td>
                    {r.templateRef ? (
                      <ObjectLink
                        id={`${r.templateRef.id}@${r.templateRef.version}`}
                        route={{
                          pageId: "P05",
                          params: { templateId: r.templateRef.id },
                        }}
                      />
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </Td>
                  <Td numeric>{Object.keys(r.overrides).length}</Td>
                  <Td numeric>
                    {position === undefined ? (
                      <span className="text-faint">—</span>
                    ) : position === null ? (
                      <Tag tone="warning" size="sm">
                        未放置
                      </Tag>
                    ) : (
                      <TypedValueCell
                        value={toDisplay(position)}
                        unit={meter ? toUnitDef(meter) : null}
                      />
                    )}
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      </Card>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <PanelHeader title="默认调度" />
          <div className="px-4 py-4 text-body text-muted">
            v0.5 契约没有模板级调度绑定。当前模型的调度：
            {model.schedules.map((s) => (
              <ObjectLink
                key={s.id}
                id={`${s.id}@${s.version}`}
                route={{ pageId: "P12", params: { scheduleId: s.id } }}
              />
            ))}
          </div>
        </Card>
        <Card>
          <PanelHeader title="依赖资产" meta={<Box size={14} aria-hidden />} />
          <div className="px-4 py-4 text-body text-muted">
            v0.5 契约没有资产引用字段，模板角色不声明必需资产；资产清单见 P09。
          </div>
        </Card>
      </div>

      {confirmingInstantiate ? (
        <Modal
          title={`实例化 ${template.id}`}
          onClose={() => setConfirmingInstantiate(false)}
          footer={
            <>
              <Button intent="ghost" onClick={() => setConfirmingInstantiate(false)}>
                取消
              </Button>
              <Button intent="primary" onClick={instantiate}>
                实例化 {template.roles.length} 个角色
              </Button>
            </>
          }
        >
          <p className="px-5 py-4 text-body">
            将在当前场景草稿中为每个角色创建一个新实体（新
            entityId，初值取角色快照；模板默认如 tpl-foam 的 8000 L
            经模板来源生效）。不复制任何运行 commit。写入场景草稿，可撤销。
          </p>
        </Modal>
      ) : null}
      {confirmingDelete ? (
        <Modal
          title={`删除场景模板 ${template.id}`}
          onClose={() => setConfirmingDelete(false)}
          footer={
            <>
              <Button intent="ghost" onClick={() => setConfirmingDelete(false)}>
                取消
              </Button>
              <Button intent="danger" onClick={remove}>
                确认删除
              </Button>
            </>
          }
        >
          <p className="px-5 py-4 text-body">
            模板是本地扩展文档，没有被模型对象引用；删除不影响场景与运行。
            该操作可通过撤销恢复。
          </p>
        </Modal>
      ) : null}
    </div>
  )
}
