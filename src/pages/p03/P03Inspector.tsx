import { useState } from "react"
import {
  ArrowUpRight,
  Lock,
  MousePointerClick,
  Trash2,
  Undo,
} from "lucide-react"
import type { AttributeSchema, WriteMode } from "@/schema/model"
import type { WorkbenchContext } from "@/app/useWorkbenchContext"
import {
  PRIMITIVE_LABEL,
  SHAPE_LABEL,
  WRITE_MODE_HINT,
  WRITE_MODE_LABEL,
} from "@/core/labels"
import Button from "@/components/ui/Button"
import { Notice } from "@/components/ui/Card"
import Field, { Select, Switch } from "@/components/ui/Field"
import Modal from "@/components/ui/Modal"
import { Tag } from "@/components/ui/StatusTag"
import TypedValueCell from "@/components/domain/TypedValueCell"
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
  deleteAttribute,
  updateAttribute,
  type AttributePatch,
} from "@/features/ecs/operations"
import type { RefHit } from "@/features/ecs/refs"
import { toDisplay } from "@/data/world"
import { navigate, useRoute } from "@/router/router"
import { useDraftModel } from "@/stores/modelDocuments"
import { toast } from "@/stores/toast"
import { InspectorSection } from "@/shell/Inspector"

/** P03 检查器：选中属性的编辑器。每次提交（失焦 / Enter）写一条 SCHEMA_DOC 草稿编辑。 */
export default function P03Inspector({ ctx: _ctx }: { ctx: WorkbenchContext }) {
  const route = useRoute()
  const model = useDraftModel()
  const propertyId = route.params.propertyId
  const base = propertyId
    ? model.attributes.find((a) => a.id === propertyId)
    : undefined

  if (
    !base ||
    (route.params.componentId && base.componentId !== route.params.componentId)
  ) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-label text-muted">
        <MousePointerClick size={20} className="text-faint" aria-hidden />
        {base
          ? `属性 ${base.id} 不属于组件 ${route.params.componentId}`
          : "选择一行属性查看与编辑"}
      </div>
    )
  }
  return <PropertyEditor key={base.id} attributeId={base.id} />
}

function PropertyEditor({ attributeId }: { attributeId: string }) {
  const model = useDraftModel()
  const doc = useSchemaDoc()
  const readOnly = useReadOnly()
  const [error, setError] = useState<string | null>(null)
  const [blocked, setBlocked] = useState<{
    message: string
    refs?: RefHit[]
  } | null>(null)
  const [confirming, setConfirming] = useState(false)

  const p = model.attributes.find((a) => a.id === attributeId)!
  const saved = doc?.savedContent.attributes.find((a) => a.id === attributeId)
  const unit = p.type.unitId
    ? model.units.find((u) => u.id === p.type.unitId)
    : undefined

  const dirtyFields: string[] = []
  if (saved) {
    if (saved.label !== p.label) dirtyFields.push("label")
    if (saved.type.nullable !== p.type.nullable) dirtyFields.push("nullable")
    if (JSON.stringify(saved.default) !== JSON.stringify(p.default))
      dirtyFields.push("default")
    if (saved.writeMode !== p.writeMode) dirtyFields.push("writeMode")
    if (saved.reducerRef?.id !== p.reducerRef?.id) dirtyFields.push("reducer")
  }
  const differs = dirtyFields.length > 0

  const edit = (patch: AttributePatch, label: string) => {
    setBlocked(null)
    const result = applySchemaOp(label, (s) =>
      updateAttribute(s, attributeId, patch),
    )
    setError(result.ok ? null : result.message)
  }

  const revert = () => {
    if (!saved) return
    const patch: AttributePatch = {
      label: saved.label,
      default: saved.default,
      writeMode: saved.writeMode,
      reducerRef: saved.reducerRef ?? null,
    }
    if (saved.type.nullable !== p.type.nullable)
      patch.type = { ...p.type, nullable: saved.type.nullable }
    edit(patch, `${p.id} · 恢复已保存值`)
  }

  const remove = () => {
    const result = applySchemaOp(`删除属性 ${p.id}`, (s) =>
      deleteAttribute(model, s, p.id),
    )
    if (!result.ok) {
      setConfirming(false)
      setBlocked({ message: result.message, refs: result.refs })
      return
    }
    toast(`已删除属性 ${p.id}`)
    navigate({ pageId: "P03", params: { componentId: p.componentId } })
  }

  return (
    <div>
      <div className="border-b border-line px-4 py-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-body-lg font-semibold">
              {p.label || "（未命名）"}
            </h2>
            <p className="font-mono text-caption text-muted">{p.id}</p>
          </div>
          {!saved ? (
            <Tag tone="success" size="sm">
              草稿新增
            </Tag>
          ) : differs ? (
            <Tag tone="purple" size="sm">
              草稿修改
            </Tag>
          ) : (
            <Tag size="sm">与已保存一致</Tag>
          )}
        </div>
        <button
          type="button"
          onClick={() =>
            navigate({ pageId: "P29", params: { attributeId: p.id } })
          }
          className="mt-2 inline-flex items-center gap-1 text-label text-primary-strong hover:underline"
        >
          在 P29 属性定义中编辑形状 / 类型 / 引用
          <ArrowUpRight size={13} aria-hidden />
        </button>
      </div>

      {readOnly ? (
        <div className="px-4 pt-3">
          <Notice tone="warning" icon={<Lock size={15} aria-hidden />}>
            观察者为只读角色，字段不可编辑。
          </Notice>
        </div>
      ) : null}
      {error ? (
        <div className="px-4 pt-3">
          <Notice tone="danger">{error}</Notice>
        </div>
      ) : null}
      {blocked ? (
        <div className="px-4 pt-3">
          <RefsNotice message={blocked.message} refs={blocked.refs} />
        </div>
      ) : null}

      <InspectorSection title="基本">
        <div className="flex flex-col gap-3">
          <CommitText
            label="显示名"
            value={p.label}
            readOnly={readOnly}
            required
            onCommit={(v) => edit({ label: v }, `${p.id} · 显示名`)}
            error={!p.label.trim() ? "显示名不能为空" : null}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="值形状">
              <span className="flex h-9 items-center text-body text-ink-soft">
                {SHAPE_LABEL[p.type.shape]}
              </span>
            </Field>
            <Field label="基元类型">
              <span className="flex h-9 items-center text-body text-ink-soft">
                {PRIMITIVE_LABEL[p.type.primitive]}
              </span>
            </Field>
          </div>
          <Field
            label="单位"
            hint={unit ? `量种：${unit.quantityKind}` : "无量纲"}
          >
            <span className="flex h-9 items-center text-body text-ink-soft">
              {unit ? `${unit.symbol} · ${unit.quantityKind}` : "—"}
            </span>
          </Field>
        </div>
      </InspectorSection>

      <InspectorSection title="值">
        <div className="flex flex-col gap-3">
          <Field label="可空">
            <Switch
              checked={p.type.nullable}
              disabled={readOnly}
              label="可空"
              onChange={(v) =>
                edit(
                  { type: { ...p.type, nullable: v } },
                  v ? "允许为空" : "不允许为空",
                )
              }
            />
          </Field>
          <Field
            label="默认值"
            hint={
              p.default === null
                ? "当前为未设置（不同于 0）；输入值后提交"
                : undefined
            }
          >
            <ValueEditor
              attr={p}
              value={p.default}
              readOnly={readOnly}
              onCommit={(v) => edit({ default: v }, `${p.id} · 默认值`)}
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
        </div>
      </InspectorSection>

      <InspectorSection title="写入">
        <div className="flex flex-col gap-3">
          <Field label="写入方式" hint={WRITE_MODE_HINT[p.writeMode]}>
            <Select
              value={p.writeMode}
              disabled={readOnly}
              onChange={(e) =>
                edit(
                  { writeMode: e.target.value as WriteMode },
                  `写入方式 → ${WRITE_MODE_LABEL[(e.target.value as WriteMode)]}`,
                )
              }
              options={(Object.keys(WRITE_MODE_LABEL) as WriteMode[]).map(
                (m) => ({ value: m, label: WRITE_MODE_LABEL[m] }),
              )}
            />
          </Field>
          {p.writeMode === "contribution" ? (
            <Field
              label="归约契约"
              required
              error={!p.reducerRef ? "贡献写入必须关联归约契约" : null}
            >
              <Select
                value={p.reducerRef?.id ?? ""}
                disabled={readOnly}
                invalid={!p.reducerRef}
                placeholder="选择归约契约"
                onChange={(e) => {
                  const c = model.constraints.find(
                    (x) => x.id === e.target.value,
                  )
                  edit(
                    { reducerRef: c ? { id: c.id, version: c.version } : null },
                    `${p.id} · 归约契约`,
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
      </InspectorSection>

      <div className="flex items-center gap-2 border-t border-line px-4 py-3">
        {differs && !readOnly ? (
          <Button size="sm" intent="ghost" icon={Undo} onClick={revert}>
            恢复已保存值
          </Button>
        ) : null}
        {!readOnly ? (
          <Button
            size="sm"
            intent="danger-ghost"
            icon={Trash2}
            className="ml-auto"
            onClick={() => setConfirming(true)}
          >
            删除属性
          </Button>
        ) : null}
      </div>

      {confirming ? (
        <Modal
          title={`删除属性 ${p.id}`}
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
            将从组件 {p.componentId} 的成员中移除并删除属性定义 {p.id}
            ；仍被引用的属性会被阻止并列出引用位置。
          </p>
        </Modal>
      ) : null}
    </div>
  )
}
