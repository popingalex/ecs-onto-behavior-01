import { useMemo, useState } from "react"
import type { Primitive, ValueShape, WriteMode } from "@/schema/model"
import { PRIMITIVE_LABEL, SHAPE_LABEL, WRITE_MODE_LABEL } from "@/core/labels"
import Button from "@/components/ui/Button"
import Field, { Select, Switch, TextInput } from "@/components/ui/Field"
import Modal from "@/components/ui/Modal"
import { useDraftModel } from "@/stores/modelDocuments"
import { VALUE_PRIMITIVES } from "@/schema/model"
import { applySchemaOp } from "./editing"
import { suggestAttributeId, validId } from "./ids"
import { checkRawValue, createAttribute, neutralDefault } from "./operations"
import ValueEditor from "./ValueEditor"

const SHAPES: ValueShape[] = ["scalar", "vector3"]
const MODES: WriteMode[] = [
  "configuration",
  "exclusive",
  "contribution",
  "contract",
]

/** 新建属性对话框：P29 与 P03 共用；创建成功即登记为组件成员。 */
export default function CreateAttributeModal({
  componentId: preset,
  onClose,
  onCreated,
}: {
  componentId?: string
  onClose: () => void
  onCreated: (attributeId: string) => void
}) {
  const model = useDraftModel()
  const [componentId, setComponentId] = useState(
    preset ?? model.components[0]?.id ?? "",
  )
  const [id, setId] = useState(() =>
    suggestAttributeId(componentId, (x) =>
      model.attributes.some((a) => a.id === x),
    ),
  )
  const [idTouched, setIdTouched] = useState(false)
  const [label, setLabel] = useState("")
  const [primitive, setPrimitive] = useState<Primitive>("f64")
  const [shape, setShape] = useState<ValueShape>("scalar")
  const [unitId, setUnitId] = useState("")
  const [nullable, setNullable] = useState(false)
  const [def, setDef] = useState<ReturnType<typeof neutralDefault>>(0)
  const [writeMode, setWriteMode] = useState<WriteMode>("configuration")
  const [reducerId, setReducerId] = useState("")
  const [error, setError] = useState<string | null>(null)

  const type = useMemo(() => {
    const unit = model.units.find((u) => u.id === unitId)
    return {
      primitive,
      shape,
      ...(unit ? { unitId: unit.id, quantityKind: unit.quantityKind } : {}),
      ...(shape === "vector3" ? { frameId: "park-ENU" } : {}),
      nullable,
    }
  }, [primitive, shape, unitId, nullable, model.units])

  const resetDefault = (nextType: typeof type) =>
    setDef(neutralDefault(nextType))

  const pickComponent = (cid: string) => {
    setComponentId(cid)
    if (!idTouched)
      setId(
        suggestAttributeId(cid, (x) =>
          model.attributes.some((a) => a.id === x),
        ),
      )
  }

  const attrStub = { id, componentId, label, type, default: def, writeMode }

  const submit = () => {
    if (!validId(id))
      return setError("ID 只能包含字母、数字、点、下划线与连字符，并以字母开头")
    if (model.attributes.some((a) => a.id === id))
      return setError(`ID ${id} 已存在`)
    const valueErr = checkRawValue(type, def)
    if (valueErr) return setError(`默认值：${valueErr}`)
    const reducerRef = reducerId
      ? {
          id: reducerId,
          version:
            model.constraints.find((c) => c.id === reducerId)?.version ?? "c1",
        }
      : undefined
    const result = applySchemaOp(`新增属性 ${id}`, (s) =>
      createAttribute(s, {
        componentId,
        id,
        label,
        type,
        default: def,
        writeMode,
        reducerRef,
      }),
    )
    if (!result.ok) return setError(result.message)
    onClose()
    onCreated(id)
  }

  return (
    <Modal
      title="新增属性"
      subtitle={preset ? `组件 ${preset}` : undefined}
      width={640}
      onClose={onClose}
      footer={
        <>
          <Button intent="ghost" onClick={onClose}>
            取消
          </Button>
          <Button intent="primary" onClick={submit}>
            创建属性
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 px-5 py-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="所属组件" required>
            <Select
              value={componentId}
              disabled={Boolean(preset)}
              onChange={(e) => pickComponent(e.target.value)}
              options={model.components.map((c) => ({
                value: c.id,
                label: `${c.id} · ${c.label}`,
              }))}
            />
          </Field>
          <Field label="显示名" hint="留空时使用 ID">
            <TextInput
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="温度"
            />
          </Field>
        </div>
        <Field
          label="属性 ID"
          required
          hint="风格：<组件小写>.<名称>，例如 thermal.temperature"
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
        <div className="grid grid-cols-2 gap-4">
          <Field label="基元类型">
            <Select
              value={primitive}
              onChange={(e) => {
                const p = e.target.value as Primitive
                setPrimitive(p)
                const t = { ...type, primitive: p }
                resetDefault(t)
              }}
              options={VALUE_PRIMITIVES.map((p) => ({
                value: p,
                label: PRIMITIVE_LABEL[p],
              }))}
            />
          </Field>
          <Field label="值形状">
            <Select
              value={shape}
              onChange={(e) => {
                const sh = e.target.value as ValueShape
                setShape(sh)
                resetDefault({ ...type, shape: sh })
              }}
              options={SHAPES.map((s) => ({ value: s, label: SHAPE_LABEL[s] }))}
            />
          </Field>
          <Field label="单位" hint="选择单位后量种随之确定">
            <Select
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              options={[
                { value: "", label: "— 无量纲" },
                ...model.units.map((u) => ({
                  value: u.id,
                  label: `${u.symbol} · ${u.quantityKind}`,
                })),
              ]}
            />
          </Field>
          <Field label="可空" hint="可空时默认值为 null（未设置），不是 0">
            <Switch
              checked={nullable}
              label="可空"
              onChange={(v) => {
                setNullable(v)
                resetDefault({ ...type, nullable: v })
              }}
            />
          </Field>
        </div>
        <Field
          label="默认值"
          hint={
            def === null ? "当前为未设置（不同于 0）；输入值后提交" : undefined
          }
        >
          <ValueEditor attr={attrStub} value={def} onCommit={setDef} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="写入方式">
            <Select
              value={writeMode}
              onChange={(e) => setWriteMode(e.target.value as WriteMode)}
              options={MODES.map((m) => ({
                value: m,
                label: WRITE_MODE_LABEL[m],
              }))}
            />
          </Field>
          {writeMode === "contribution" ? (
            <Field label="归约契约" required>
              <Select
                value={reducerId}
                placeholder="选择归约契约"
                onChange={(e) => setReducerId(e.target.value)}
                options={model.constraints.map((c) => ({
                  value: c.id,
                  label: `${c.id} · ${c.strategy}`,
                }))}
              />
            </Field>
          ) : null}
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
