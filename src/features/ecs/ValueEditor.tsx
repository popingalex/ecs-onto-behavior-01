import { useState, type KeyboardEvent } from "react"
import type { AttributeSchema, RawValue, Vec3 } from "@/schema/model"
import { Select, Switch, TextInput } from "@/components/ui/Field"
import { checkRawValue } from "./operations"

/**
 * 单个 RawValue 的编辑控件：按属性类型选择输入方式。
 * 只负责显式值的编辑；“恢复继承”与“显式设为 null”是调用方的独立操作。
 */
export default function ValueEditor({
  attr,
  value,
  readOnly,
  entities,
  onCommit,
  onError,
}: {
  attr: AttributeSchema
  value: RawValue
  readOnly?: boolean
  entities?: Array<{ id: string ;label: string }>
  onCommit: (value: RawValue) => void
  onError?: (message: string | null) => void
}) {
  if (attr.type.primitive === "bool") {
    return (
      <Switch
        checked={value === true}
        disabled={readOnly}
        label={attr.id}
        onChange={(v) => onCommit(v)}
      />
    )
  }
  if (attr.type.primitive === "EntityRef" && entities) {
    return (
      <Select
        value={typeof value === "string" ? value : ""}
        disabled={readOnly}
        placeholder={value === null ? "未设置" : "选择实体"}
        onChange={(e) => e.target.value && onCommit(e.target.value)}
        options={entities.map((en) => ({
          value: en.id,
          label: `${en.id} · ${en.label}`,
        }))}
      />
    )
  }
  return (
    <TextValue
      attr={attr}
      value={value}
      readOnly={readOnly}
      onCommit={onCommit}
      onError={onError}
    />
  )
}

const toText = (v: RawValue) =>
  v === null ? "" : Array.isArray(v) ? v.join(", ") : String(v)

function parseNumber(text: string): number | null {
  const t = text.trim()
  if (t === "" || !/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return null
  return Number(t)
}

function TextValue({
  attr,
  value,
  readOnly,
  onCommit,
  onError,
}: {
  attr: AttributeSchema
  value: RawValue
  readOnly?: boolean
  onCommit: (v: RawValue) => void
  onError?: (m: string | null) => void
}) {
  const [text, setText] = useState(toText(value))
  const [synced, setSynced] = useState(value)
  const [error, setError] = useState<string | null>(null)
  if (JSON.stringify(synced) !== JSON.stringify(value)) {
    setSynced(value)
    setText(toText(value))
    setError(null)
  }

  const report = (m: string | null) => {
    setError(m)
    onError?.(m)
  }

  const commit = () => {
    if (text.trim() === "" && attr.type.nullable) {
      if (value !== null) onCommit(null)
      report(null)
      return
    }
    let next: RawValue = text
    if (attr.type.shape === "vector3") {
      const parts = text
        .split(/[,，\s]+/)
        .filter(Boolean)
        .map(parseNumber)
      next =
        parts.length === 3 && parts.every((n) => n !== null)
          ? parts as Vec3
          : text
    } else if (attr.type.primitive === "f64" || attr.type.primitive === "i64") {
      next = parseNumber(text) ?? text
    }
    const err = checkRawValue(attr.type, next)
    if (err) return report(err)
    report(null)
    if (JSON.stringify(next) !== JSON.stringify(value)) onCommit(next)
  }

  const keys = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return
    if (e.key === "Enter") {
      e.preventDefault()
      commit()
    } else if (e.key === "Escape") {
      e.preventDefault()
      e.stopPropagation()
      setText(toText(value))
      report(null)
    }
  }

  return (
    <TextInput
      value={text}
      title={error ?? undefined}
      placeholder={value === null ? "未设置" : undefined}
      readOnly={readOnly}
      invalid={Boolean(error)}
      mono={attr.type.shape === "vector3"}
      inputMode={
        attr.type.primitive === "f64" || attr.type.primitive === "i64"
          ? "decimal"
          : undefined
      }
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={keys}
    />
  )
}
