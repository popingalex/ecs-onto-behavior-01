import { useState, type KeyboardEvent } from "react"
import Field, { TextInput } from "@/components/ui/Field"

/** 文本字段：本地编辑，失焦或 Enter 提交一次；Esc 还原。 */
export default function CommitText({
  label,
  value,
  readOnly,
  required,
  error,
  mono,
  onCommit,
}: {
  label: string
  value: string
  readOnly?: boolean
  required?: boolean
  error?: string | null
  mono?: boolean
  onCommit: (value: string) => void
}) {
  const [text, setText] = useState(value)
  const [synced, setSynced] = useState(value)
  if (synced !== value) {
    setSynced(value)
    setText(value)
  }
  const keys = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return
    if (e.key === "Enter") {
      e.preventDefault()
      if (text !== value) onCommit(text)
    } else if (e.key === "Escape") {
      e.preventDefault()
      e.stopPropagation()
      setText(value)
    }
  }
  return (
    <Field label={label} required={required} error={error}>
      <TextInput
        value={text}
        readOnly={readOnly}
        invalid={Boolean(error)}
        mono={mono}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text !== value && onCommit(text)}
        onKeyDown={keys}
      />
    </Field>
  )
}
