import { useMemo, useState } from "react"
import { Ban, Check } from "lucide-react"
import Button from "@/components/ui/Button"
import Modal from "@/components/ui/Modal"
import { Tag } from "@/components/ui/StatusTag"
import type { Route } from "@/core/types"
import { cn } from "@/lib/cn"
import { closeOverlay } from "@/router/router"
import {
  bindingCandidates,
  formatType,
  nodeTypeDef,
  type BindingCandidate,
  type BindTarget,
} from "@/services/domainBindingService"
import { canEdit, useRole } from "@/stores/context"
import {
  programDocId,
  useDraftModel,
  useModelDocument,
  type ProgramContent,
} from "@/stores/modelDocuments"

/**
 * P15 绑定选择器（模态）：候选全部由 bindingCandidates 按 schema、程序参数与
 * 当前图的上游 scope 生成，没有任何硬编码候选。确认 = 回传一次候选（调用方写
 * bindInput / connect mutation），取消 = 零副作用。
 */
export default function P15BindingPicker({ route }: { route: Route }) {
  const role = useRole()
  const model = useDraftModel()
  const { programId = "", nodeId = "", portId, slotId } = route.params
  const doc = useModelDocument<ProgramContent>(programDocId(programId))
  const [pickedKey, setPickedKey] = useState<string | null>(null)

  const target: BindTarget | null = slotId
    ? { kind: "slot", nodeId, slotId }
    : portId
      ? { kind: "input", nodeId, portId }
      : null
  const program = doc?.content.program
  const node = program?.nodes.find((n) => n.id === nodeId)
  const groups = useMemo(
    () =>
      program && target ? bindingCandidates(model, program, target) : [],
    [model, program, target],
  )
  const allCandidates = useMemo(
    () => groups.flatMap((g) => g.candidates),
    [groups],
  )
  const picked = allCandidates.find((c) => c.key === pickedKey) ?? null

  if (!program || !node || !target) {
    return (
      <Modal
        title="选择绑定来源"
        width={640}
        onClose={() => closeOverlay({ kind: "cancel" })}
      >
        <p className="px-5 py-4 text-body text-muted">
          目标 {programId} / {nodeId}
          {portId ? `.${portId}` : ""}
          {slotId ? `.${slotId}` : ""} 不在当前草稿中；关闭后重试。
        </p>
      </Modal>
    )
  }

  const def = nodeTypeDef(node.type)
  const targetLabel =
    target.kind === "input"
      ? `${nodeId}.${target.portId}（${def?.inputs.find((p) => p.id === target.portId)?.label ?? target.portId}）`
      : `${nodeId} 的${def?.slots.find((s) => s.id === target.slotId)?.label ?? target.slotId}`
  const expectedType =
    target.kind === "input" ? node.inputs[target.portId] : undefined

  const confirm = () => {
    if (!picked || !picked.compat.ok) return
    closeOverlay({
      kind: "confirm",
      payload: {
        target,
        candidate: {
          key: picked.key,
          label: picked.label,
          binding: picked.binding,
          upstream: picked.upstream,
        },
      },
    })
  }

  return (
    <Modal
      title="选择绑定来源"
      subtitle={
        <span>
          目标 <span className="font-mono text-ink-soft">{targetLabel}</span>
          {expectedType ? (
            <>
              {" "}
              · 期望{" "}
              <span className="font-mono text-ink-soft">
                {formatType(model, expectedType)}
              </span>
            </>
          ) : null}
        </span>
      }
      width={680}
      onClose={() => closeOverlay({ kind: "cancel" })}
      footer={
        <>
          <span className="mr-auto text-caption text-muted">
            候选来自 schema、程序参数与当前图 · 确认写一次绑定，取消零副作用
          </span>
          <Button intent="ghost" onClick={() => closeOverlay({ kind: "cancel" })}>
            取消
          </Button>
          <Button
            intent="primary"
            icon={Check}
            disabled={!picked || !canEdit(role)}
            onClick={confirm}
          >
            确认绑定
          </Button>
        </>
      }
    >
      <div className="divide-y divide-line">
        {groups.map((g) => (
          <section key={g.group}>
            <h3 className="bg-subtle px-5 py-1.5 text-caption font-semibold tracking-wide text-muted">
              {g.label}
              {g.candidates.length > 0 ? (
                <span className="ml-2 font-normal tabular">
                  {g.candidates.filter((c) => c.compat.ok).length} /{" "}
                  {g.candidates.length} 可用
                </span>
              ) : null}
            </h3>
            {g.candidates.length === 0 ? (
              <p className="px-5 py-3 text-caption text-muted">
                {g.emptyReason ?? "没有候选"}
              </p>
            ) : (
              <ul role="listbox" aria-label={g.label}>
                {g.candidates.map((c) => (
                  <CandidateRow
                    key={c.key}
                    candidate={c}
                    selected={pickedKey === c.key}
                    expected={expectedType ? formatType(model, expectedType) : null}
                    onPick={() => setPickedKey(c.key)}
                    onConfirm={confirm}
                  />
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </Modal>
  )
}

function CandidateRow({
  candidate: c,
  selected,
  expected,
  onPick,
  onConfirm,
}: {
  candidate: BindingCandidate
  selected: boolean
  expected: string | null
  onPick: () => void
  onConfirm: () => void
}) {
  const model = useDraftModel()
  const disabled = !c.compat.ok
  const typeLabel = c.type ? formatType(model, c.type) : "—"
  return (
    <li role="option" aria-selected={selected} aria-disabled={disabled || undefined}>
      <button
        type="button"
        disabled={disabled}
        onClick={onPick}
        onDoubleClick={() => {
          onPick()
          if (!disabled) setTimeout(onConfirm, 0)
        }}
        className={cn(
          "flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors",
          disabled
            ? "cursor-not-allowed bg-subtle/60"
            : selected
              ? "bg-primary-soft"
              : "hover:bg-subtle",
        )}
      >
        <span
          className={cn(
            "grid h-4 w-4 shrink-0 place-items-center rounded-full border",
            selected ? "border-primary bg-primary" : "border-border bg-surface",
          )}
        >
          {selected ? (
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
          ) : null}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block font-mono text-label",
              disabled ? "text-muted" : "text-ink",
            )}
          >
            {c.label}
            {c.upstream ? (
              <span className="ml-2 rounded bg-primary-soft px-1 text-[10px] text-primary-strong">
                确认后创建连线
              </span>
            ) : null}
          </span>
          <span className="block text-caption text-muted">{c.detail}</span>
          {!c.compat.ok ? (
            <span className="mt-0.5 flex items-center gap-1 text-caption text-danger">
              <Ban size={12} aria-hidden />
              {c.compat.reason}
            </span>
          ) : null}
        </span>
        <Tag
          size="sm"
          tone={expected && typeLabel === expected ? "primary" : "neutral"}
        >
          {typeLabel}
        </Tag>
      </button>
    </li>
  )
}
