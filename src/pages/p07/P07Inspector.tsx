import { useState, type KeyboardEvent } from "react"
import { MapPin, MapPinOff } from "lucide-react"
import type { WorkbenchContext } from "@/app/useWorkbenchContext"
import type { Vec3 } from "@/schema/model"
import ObjectLink from "@/components/domain/ObjectLink"
import TypedValueCell from "@/components/domain/TypedValueCell"
import Button from "@/components/ui/Button"
import { Notice } from "@/components/ui/Card"
import { TextInput } from "@/components/ui/Field"
import { Tag } from "@/components/ui/StatusTag"
import { toDisplay } from "@/data/world"
import { navigate, useViewState } from "@/router/router"
import { resolveInitialValue } from "@/schema/values"
import { useDraftModel } from "@/stores/modelDocuments"
import { InspectorSection } from "@/shell/Inspector"
import { toUnitDef } from "@/features/ecs/adapters"
import { applySceneOp, useReadOnly } from "@/features/ecs/editing"
import { setEntityPosition } from "@/features/scene/assembly"
import { isAssembled } from "@/schema/values"
import { P07_SELECTED_KEY } from "./P07SceneBuilder"

const AXIS = ["east", "north", "up"] as const

/**
 * P07 检查器：选中实体的类型 / 模板来源 / 局部位置（east / north / up 三分量）与业务属性。
 * 位置编辑写 SCENE_DOC；未装配 Position 的实体给装配指引，未放置的给放置按钮。
 */
export default function P07Inspector({
  ctx: _ctx,
}: {
  ctx: WorkbenchContext
}) {
  const model = useDraftModel()
  const [selected] = useViewState<string>(P07_SELECTED_KEY, "F01")
  const entity = model.scene.entities.find((e) => e.id === selected)
  if (!entity)
    return (
      <div className="px-4 py-6 text-body text-muted">
        在视口或底栏实体表中选择一个实体。
      </div>
    )
  const type = model.entityTypes.find((t) => t.id === entity.typeId)
  const hasPosition = isAssembled(entity, "Position")

  return (
    <div>
      <div className="border-b border-line px-4 py-4">
        <div className="flex items-center gap-2">
          <h2 className="text-body-lg font-semibold">{entity.label}</h2>
          <span className="rounded bg-neutral-soft px-1.5 font-mono text-caption text-muted">
            {entity.id}
          </span>
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-label text-muted">
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
            <ObjectLink
              id={`${entity.templateRef.id}@${entity.templateRef.version}`}
              route={{
                pageId: "P05",
                params: { templateId: entity.templateRef.id },
              }}
            />
          ) : (
            <span>无模板</span>
          )}
        </p>
      </div>

      <InspectorSection title="局部位置 · park-ENU">
        {hasPosition ? (
          <PositionEditor entityId={entity.id} />
        ) : (
          <Notice tone="warning" icon={<MapPinOff size={15} aria-hidden />}>
            实体未装配 Position 组件；先在 P08 装配后才能放置。
          </Notice>
        )}
      </InspectorSection>

      <InspectorSection title="业务属性（初值）">
        <ul className="-mx-2">
          {entity.componentInstances.flatMap((ci) => {
            const component = model.components.find(
              (c) => c.id === ci.schemaRef.id,
            )
            return (component?.propertyIds ?? [])
              .map((pid) => model.attributes.find((a) => a.id === pid))
              .filter((a) => a && a.id !== "position.local")
              .map((a) => {
                const resolved = resolveInitialValue(model, entity, a!.id)
                const unit = a!.type.unitId
                  ? toUnitDef(model.units.find((u) => u.id === a!.type.unitId)!)
                  : null
                return (
                  <li key={a!.id}>
                    <button
                      type="button"
                      onClick={() =>
                        navigate({ pageId: "P08", params: { entityId: entity.id } })
                      }
                      title="在 P08 编辑初值"
                      className="group flex w-full items-center gap-2 rounded-ui px-2 py-1.5 text-left hover:bg-hover"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-label text-ink">
                          {a!.label}
                        </span>
                        <span className="block truncate font-mono text-caption text-faint">
                          {a!.id}
                        </span>
                      </span>
                      {resolved.state === "value" ? (
                        <TypedValueCell
                          value={toDisplay(resolved.value)}
                          unit={unit}
                        />
                      ) : (
                        <span className="text-caption text-faint">不适用</span>
                      )}
                    </button>
                  </li>
                )
              })
          })}
        </ul>
      </InspectorSection>

      <InspectorSection title="关系">
        <p className="px-2 py-1 text-label text-muted">
          v0.5 契约没有关系实例数据。
        </p>
      </InspectorSection>
    </div>
  )
}

/** 位置三分量编辑：逐轴提交；非有限数阻止；清空 = 显式 null（实体保留）。 */
function PositionEditor({ entityId }: { entityId: string }) {
  const model = useDraftModel()
  const readOnly = useReadOnly()
  const [error, setError] = useState<string | null>(null)
  const entity = model.scene.entities.find((e) => e.id === entityId)!
  const resolved = resolveInitialValue(model, entity, "position.local")
  const position =
    resolved.state === "value" && Array.isArray(resolved.value)
      ? (resolved.value as Vec3)
      : null

  const commitAxis = (axis: number, raw: string) => {
    if (!position) return
    const n = Number(raw.trim())
    if (raw.trim() === "" || !Number.isFinite(n)) {
      setError("坐标必须是有限数值，NaN / Infinity 不能入库")
      return
    }
    const next: Vec3 = [...position] as Vec3
    next[axis] = n
    setError(null)
    const result = applySceneOp(`移动 ${entityId}`, (scene) =>
      setEntityPosition(model, scene, entityId, next),
    )
    if (!result.ok) setError(result.message)
  }

  const write = (value: Vec3 | null, label: string) => {
    setError(null)
    const result = applySceneOp(label, (scene) =>
      setEntityPosition(model, scene, entityId, value),
    )
    if (!result.ok) setError(result.message)
  }

  if (!position)
    return (
      <div className="flex flex-col items-start gap-2 px-2 py-1">
        <div className="flex items-center gap-2 text-body">
          <Tag tone="warning" size="sm" icon={MapPinOff}>
            尚未放置
          </Tag>
          <span className="text-label text-muted">
            位置为 null：逻辑保留，视图不绘制
          </span>
        </div>
        <Button
          size="sm"
          icon={MapPin}
          disabled={readOnly}
          title="把实体放到原点 [0, 0, 0]（原点合法）"
          onClick={() => write([0, 0, 0], `放置 ${entityId}`)}
        >
          放置到原点
        </Button>
        {error ? (
          <p role="alert" className="text-caption text-danger">
            {error}
          </p>
        ) : null}
      </div>
    )

  return (
    <div className="flex flex-col gap-2 px-2 py-1">
      <div className="grid grid-cols-3 gap-2">
        {AXIS.map((axis, i) => (
          <AxisInput
            key={`${entityId}:${axis}:${position[i]}`}
            axis={axis}
            value={position[i]}
            readOnly={readOnly}
            onCommit={(raw) => commitAxis(i, raw)}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          intent="ghost"
          disabled={readOnly}
          title="写入 null：移除空间表现但保留实体（可撤销恢复清空前的位置）"
          onClick={() => write(null, `清空位置 ${entityId}`)}
        >
          清空位置
        </Button>
        <span className="text-caption text-faint">单位 m；[0, 0, 0] 合法</span>
      </div>
      {error ? (
        <p role="alert" className="text-caption text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function AxisInput({
  axis,
  value,
  readOnly,
  onCommit,
}: {
  axis: string
  value: number
  readOnly?: boolean
  onCommit: (raw: string) => void
}) {
  const [text, setText] = useState(String(value))
  const keys = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return
    if (e.key === "Enter") {
      e.preventDefault()
      if (text.trim() !== String(value)) onCommit(text)
    } else if (e.key === "Escape") {
      e.preventDefault()
      e.stopPropagation()
      setText(String(value))
    }
  }
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-caption text-muted">{axis}</span>
      <TextInput
        value={text}
        readOnly={readOnly}
        mono
        inputMode="decimal"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text.trim() !== String(value) && onCommit(text)}
        onKeyDown={keys}
      />
    </label>
  )
}
