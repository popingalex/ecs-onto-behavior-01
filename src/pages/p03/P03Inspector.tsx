import { useState, type KeyboardEvent } from 'react'
import { Lock, MousePointerClick, Undo } from 'lucide-react'
import type { PropertyDef, RawValue, Vector3, WriteMode } from '@/core/types'
import { PRIMITIVE_LABEL, SHAPE_LABEL, WRITE_MODE_HINT, WRITE_MODE_LABEL } from '@/core/labels'
import Button from '@/components/ui/Button'
import { Notice } from '@/components/ui/Card'
import Field, { Select, Switch, TextInput } from '@/components/ui/Field'
import { Tag } from '@/components/ui/StatusTag'
import TypedValueCell from '@/components/domain/TypedValueCell'
import { toDisplay } from '@/data/world'
import { useIndex } from '@/data/store'
import { useRoute } from '@/router/router'
import { commandBus } from '@/services/commandBus'
import { effectiveProperty } from '@/services/coreValidation'
import { canEdit, useRole } from '@/stores/context'
import { useDraft } from '@/stores/draft'
import { InspectorSection } from '@/shell/Inspector'

/** P03 检查器：选中属性的编辑器。每次提交（失焦 / Enter）生成一条草稿命令。 */
export default function P03Inspector() {
  const route = useRoute()
  const index = useIndex()
  const overlay = useDraft((s) => s.overlay)
  const role = useRole()
  const propertyId = route.params.propertyId
  const base = propertyId ? index.properties.get(propertyId) : undefined

  if (!base || (route.params.componentId && base.componentId !== route.params.componentId)) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-label text-muted">
        <MousePointerClick size={20} className="text-faint" aria-hidden />
        {base ? `属性 ${base.id} 不属于组件 ${route.params.componentId}` : '选择一行属性查看与编辑'}
      </div>
    )
  }

  const p = effectiveProperty(base, overlay)
  const patch = overlay[base.id] ?? {}
  const readOnly = !canEdit(role)
  return <PropertyEditor key={base.id} base={base} p={p} dirtyFields={Object.keys(patch)} readOnly={readOnly} />
}

function PropertyEditor({ base, p, dirtyFields, readOnly }: { base: PropertyDef; p: PropertyDef; dirtyFields: string[]; readOnly: boolean }) {
  const index = useIndex()
  const unit = p.unitId ? index.units.get(p.unitId) : null
  const quantity = unit ? index.quantities.get(unit.quantityId) : null

  const edit = (field: keyof PropertyDef, value: unknown, label: string) => {
    if (JSON.stringify(value) === JSON.stringify(p[field])) return
    commandBus.draft({ type: 'UpdateProperty', label: `${p.id} · ${label}`, targetId: p.id, patch: { [field]: value } })
  }

  const revert = () => {
    const restore: Record<string, unknown> = {}
    for (const f of dirtyFields) restore[f] = (base as unknown as Record<string, unknown>)[f]
    commandBus.draft({ type: 'RevertProperty', label: `${p.id} · 恢复已发布值`, targetId: p.id, patch: restore })
  }
  const differs = dirtyFields.some((f) => JSON.stringify((p as unknown as Record<string, unknown>)[f]) !== JSON.stringify((base as unknown as Record<string, unknown>)[f]))

  return (
    <div>
      <div className="border-b border-line px-4 py-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-body-lg font-semibold">{p.label || '（未命名）'}</h2>
            <p className="font-mono text-caption text-muted">{p.id}</p>
          </div>
          {differs ? <Tag tone="purple" size="sm">草稿修改</Tag> : <Tag size="sm">已发布 r12</Tag>}
        </div>
        <p className="mt-2 text-label text-muted">{p.description}</p>
      </div>

      {readOnly ? (
        <div className="px-4 pt-3">
          <Notice tone="warning" icon={<Lock size={15} aria-hidden />}>
            观察者为只读角色，字段不可编辑。
          </Notice>
        </div>
      ) : null}

      <InspectorSection title="基本">
        <div className="flex flex-col gap-3">
          <CommitText label="显示名" value={p.label} readOnly={readOnly} required onCommit={(v) => edit('label', v, '显示名')} error={!p.label.trim() ? '显示名不能为空' : null} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="值形状">
              <TextInput value={SHAPE_LABEL[p.shape]} readOnly />
            </Field>
            <Field label="基元类型">
              <TextInput value={PRIMITIVE_LABEL[p.primitive]} readOnly />
            </Field>
          </div>
          <Field label="单位" hint={quantity ? `量种：${quantity.label}` : '无量纲'}>
            <TextInput value={unit ? `${unit.symbol} · ${unit.label}` : '—'} readOnly />
          </Field>
        </div>
      </InspectorSection>

      <InspectorSection title="值">
        <div className="flex flex-col gap-3">
          <Field label="可空">
            <Switch checked={p.nullable} disabled={readOnly} label="可空" onChange={(v) => edit('nullable', v, v ? '允许为空' : '不允许为空')} />
          </Field>
          <DefaultEditor p={p} readOnly={readOnly} unitSymbol={unit?.symbol} onCommit={(v) => edit('default', v, '默认值')} />
          <div className="flex items-center justify-between rounded-ui bg-subtle px-3 py-2 text-label">
            <span className="text-muted">已发布默认值 r12</span>
            <TypedValueCell value={toDisplay(base.default)} unit={unit} />
          </div>
        </div>
      </InspectorSection>

      <InspectorSection title="写入">
        <div className="flex flex-col gap-3">
          <Field label="写入方式" hint={WRITE_MODE_HINT[p.writeMode]}>
            <Select
              value={p.writeMode}
              disabled={readOnly}
              onChange={(e) => edit('writeMode', e.target.value as WriteMode, `写入方式 → ${WRITE_MODE_LABEL[e.target.value as WriteMode]}`)}
              options={(Object.keys(WRITE_MODE_LABEL) as WriteMode[]).map((m) => ({ value: m, label: WRITE_MODE_LABEL[m] }))}
            />
          </Field>
          {p.writeMode === 'contribution' ? (
            <Field label="归约契约" required error={!p.reducer ? '贡献写入必须关联归约契约' : null}>
              <Select
                value={p.reducer ?? ''}
                disabled={readOnly}
                invalid={!p.reducer}
                placeholder="选择归约契约"
                onChange={(e) => edit('reducer', e.target.value || undefined, '归约契约')}
                options={[...index.constraints.values()].map((c) => ({ value: c.id, label: `${c.id} · ${c.label}` }))}
              />
            </Field>
          ) : null}
        </div>
      </InspectorSection>

      {differs && !readOnly ? (
        <div className="border-t border-line px-4 py-3">
          <Button size="sm" intent="ghost" icon={Undo} onClick={revert}>
            恢复已发布值
          </Button>
        </div>
      ) : null}
    </div>
  )
}

/** 文本字段：本地编辑，失焦或 Enter 提交一次命令；Esc 还原。 */
function CommitText({
  label,
  value,
  readOnly,
  required,
  error,
  onCommit,
}: {
  label: string
  value: string
  readOnly: boolean
  required?: boolean
  error?: string | null
  onCommit: (value: string) => void
}) {
  const [text, setText] = useState(value)
  const [synced, setSynced] = useState(value)
  if (synced !== value) {
    setSynced(value)
    setText(value)
  }
  return (
    <Field label={label} required={required} error={error}>
      <TextInput
        value={text}
        readOnly={readOnly}
        invalid={Boolean(error)}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text !== value && onCommit(text)}
        onKeyDown={(e) => commitKeys(e, () => text !== value && onCommit(text), () => setText(value))}
      />
    </Field>
  )
}

function commitKeys(e: KeyboardEvent<HTMLInputElement>, commit: () => void, revert: () => void) {
  if (e.nativeEvent.isComposing) return
  if (e.key === 'Enter') {
    e.preventDefault()
    commit()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    revert()
  }
}

function parseNumber(text: string): number | null {
  const t = text.trim()
  if (t === '' || !/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return null
  return Number(t)
}

/** 默认值编辑器：按基元类型选择控件；“设为未设置”仅在可空时可用（与 0 区分）。 */
function DefaultEditor({ p, readOnly, unitSymbol, onCommit }: { p: PropertyDef; readOnly: boolean; unitSymbol?: string; onCommit: (v: RawValue) => void }) {
  const value = p.default
  const toText = (v: RawValue) => (v === null ? '' : Array.isArray(v) ? v.join(', ') : String(v))
  const [text, setText] = useState(toText(value))
  const [synced, setSynced] = useState(value)
  const [error, setError] = useState<string | null>(null)
  if (JSON.stringify(synced) !== JSON.stringify(value)) {
    setSynced(value)
    setText(toText(value))
    setError(null)
  }

  const nullAction =
    p.nullable && value !== null && !readOnly ? (
      <button type="button" onClick={() => onCommit(null)} className="ml-auto text-caption font-normal text-primary-strong hover:underline">
        设为未设置
      </button>
    ) : null

  if (p.primitive === 'bool') {
    return (
      <Field label={<span className="flex w-full items-center">默认值{nullAction}</span>}>
        <Switch checked={value === true} disabled={readOnly} label="默认值" onChange={(v) => onCommit(v)} />
      </Field>
    )
  }

  const commit = () => {
    if (text.trim() === '' && p.nullable) {
      if (value !== null) onCommit(null)
      setError(null)
      return
    }
    if (p.shape === 'vector3') {
      const parts = text.split(/[,，\s]+/).filter(Boolean).map(parseNumber)
      if (parts.length !== 3 || parts.some((n) => n === null)) return setError('请输入三个数值，例如 0, 0, 0')
      setError(null)
      return onCommit(parts as Vector3)
    }
    if (p.primitive === 'f64' || p.primitive === 'i64') {
      const n = parseNumber(text)
      if (n === null) return setError(text.trim() === '' ? '该属性不可空，请输入数值' : '请输入数值')
      if (p.primitive === 'i64' && !Number.isInteger(n)) return setError('请输入整数')
      setError(null)
      if (n !== value) onCommit(n)
      return
    }
    setError(null)
    if (text !== value) onCommit(text)
  }

  return (
    <Field
      label={<span className="flex w-full items-center">默认值{nullAction}</span>}
      error={error}
      hint={value === null ? '当前为未设置（不同于 0）' : p.unitId === 'degC' ? '绝对温度；降温量请使用温差 K' : undefined}
    >
      <TextInput
        value={text}
        placeholder={value === null ? '未设置' : undefined}
        readOnly={readOnly}
        invalid={Boolean(error)}
        mono={p.shape === 'vector3'}
        inputMode={p.primitive === 'f64' || p.primitive === 'i64' ? 'decimal' : undefined}
        suffix={unitSymbol}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) =>
          commitKeys(e, commit, () => {
            setText(toText(value))
            setError(null)
          })
        }
      />
    </Field>
  )
}
