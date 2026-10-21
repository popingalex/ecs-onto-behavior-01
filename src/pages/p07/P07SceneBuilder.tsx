import { useState } from "react"
import { MapPin, MousePointer2, X } from "lucide-react"
import type { WorkbenchContext } from "@/app/useWorkbenchContext"
import SpatialViewport from "@/components/domain/SpatialViewport"
import ValidationList from "@/components/domain/ValidationList"
import TypedValueCell from "@/components/domain/TypedValueCell"
import ObjectLink from "@/components/domain/ObjectLink"
import Button from "@/components/ui/Button"
import { Notice } from "@/components/ui/Card"
import { Select } from "@/components/ui/Field"
import { Tag } from "@/components/ui/StatusTag"
import Table, { Td, Th, Tr } from "@/components/ui/Table"
import Tabs from "@/components/ui/Tabs"
import { toDisplay } from "@/data/world"
import { navigate, useViewState } from "@/router/router"
import { resolveInitialValue } from "@/schema/values"
import { SCENE_DOC, useDraftModel } from "@/stores/modelDocuments"
import { useEditingDocument, validateDocument } from "@/stores/draftRegistry"
import { useLayout } from "@/stores/layout"
import { toast } from "@/stores/toast"
import { toUnitDef } from "@/features/ecs/adapters"
import { applySceneOp, useReadOnly, useSceneDoc } from "@/features/ecs/editing"
import { suggestEntityId } from "@/features/ecs/ids"
import {
  placeNewEntity,
  sceneSpatialItems,
  setEntityPosition,
  spatialCounts,
} from "@/features/scene/assembly"

export const P07_SELECTED_KEY = "p07.selected"

/**
 * P07 场景构建工作台：在空间视口中装配实体。拖动图钉改 position.local（一次拖动一条草稿命令）；
 * 位置为 null 的实体在树 / 表中列出但不在视口绘制；放置模式点击落点创建实体。全部写 SCENE_DOC。
 */
export default function P07SceneBuilder({
  ctx: _ctx,
}: {
  ctx: WorkbenchContext
}) {
  useEditingDocument(SCENE_DOC)
  const model = useDraftModel()
  const readOnly = useReadOnly()
  const [selected, setSelected] = useViewState<string>(P07_SELECTED_KEY, "F01")
  const [placing, setPlacing] = useViewState<string>("p07.placing", "")
  const [error, setError] = useState<string | null>(null)
  const dockOpen = useLayout((s) => s.dockOpen)
  const dockHeight = useLayout((s) => s.dockHeight)
  const fullscreen = useLayout((s) => s.fullscreen)
  const [dockTab, setDockTab] = useViewState("p07.dockTab", "entities")

  const items = sceneSpatialItems(model)
  const counts = spatialCounts(model)
  const meter = model.units.find((u) => u.id === "m")
  const selectedEntity = model.scene.entities.find((e) => e.id === selected)

  const move = (id: string, east: number, north: number) => {
    setError(null)
    const current = model.scene.entities.find((e) => e.id === id)
    const resolved = current
      ? resolveInitialValue(model, current, "position.local")
      : null
    const z =
      resolved?.state === "value" && Array.isArray(resolved.value)
        ? resolved.value[2]
        : 0
    const result = applySceneOp(`移动 ${id}`, (scene) =>
      setEntityPosition(model, scene, id, [east, north, z]),
    )
    if (!result.ok) setError(result.message)
  }

  /** 放置模式落点：创建实体（类型或模板来源）并放到点击位置，单条草稿命令。 */
  const place = (east: number, north: number) => {
    if (!placing) return
    setError(null)
    const templateId = placing.startsWith("tpl:") ? placing.slice(4) : undefined
    const typeId = placing.startsWith("tpl:")
      ? (model.templates.find((t) => t.id === placing.slice(4))?.typeId ?? "")
      : placing.slice(5)
    const id = suggestEntityId(typeId || "E", (x) =>
      model.scene.entities.some((e) => e.id === x),
    )
    const result = applySceneOp(`放置实体 ${id}`, (scene) =>
      placeNewEntity(model, scene, {
        id,
        label: "",
        typeId,
        templateId,
        position: [east, north, 0],
      }),
    )
    if (!result.ok) return setError(result.message)
    toast(`已放置实体 ${id}`)
    setSelected(id)
  }

  const placeOptions = [
    ...model.templates.map((t) => ({
      value: `tpl:${t.id}`,
      label: `模板 ${t.id}@${t.version} · ${t.label}`,
    })),
    ...model.entityTypes.map((t) => ({
      value: `type:${t.id}`,
      label: `类型 ${t.id} · ${t.label}（必需组件）`,
    })),
  ]

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
        <div className="flex min-w-0 items-center gap-2 whitespace-nowrap text-body">
          <span className="font-semibold">场景装配</span>
          <span className="font-mono text-label text-muted">
            {model.scene.id}
          </span>
          <Tag size="sm" tone="neutral">
            逻辑 {counts.logical} / 空间 {counts.placed}
          </Tag>
          {counts.placed < counts.logical ? (
            <span className="hidden text-caption text-muted 2xl:inline">
              未放置实体仅在树 / 表中出现
            </span>
          ) : null}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {placing ? (
            <>
              <Tag tone="primary" size="sm" icon={MousePointer2}>
                点击视口放置
              </Tag>
              <Button
                size="sm"
                intent="ghost"
                icon={X}
                onClick={() => setPlacing("")}
              >
                取消放置
              </Button>
            </>
          ) : (
            <div className="w-56">
              <Select
                aria-label="放置来源"
                value=""
                placeholder="选择放置来源（模板 / 类型）"
                disabled={readOnly}
                onChange={(e) => e.target.value && setPlacing(e.target.value)}
                options={placeOptions}
              />
            </div>
          )}
          {selectedEntity ? (
            <Button
              size="sm"
              intent="ghost"
              className="hidden xl:inline-flex"
              onClick={() =>
                navigate({ pageId: "P08", params: { entityId: selected } })
              }
            >
              在 P08 编辑 {selected}
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="shrink-0 border-b border-border bg-surface px-4 py-2">
          <Notice tone="danger">{error}</Notice>
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1">
        <SpatialViewport
          items={items}
          selectedId={selected}
          onSelect={setSelected}
          onMove={readOnly ? undefined : move}
          onCanvasClick={placing && !readOnly ? place : undefined}
          caption={`${model.scene.id} · park-ENU 局部米坐标${
            readOnly ? " · 只读" : ""
          }`}
        />
      </div>

      {dockOpen && !fullscreen ? (
        <div
          className="flex shrink-0 flex-col border-t border-border bg-surface"
          style={{ height: dockHeight }}
        >
          <div className="flex h-10 shrink-0 items-center gap-3 border-b border-line px-4">
            <Tabs
              ariaLabel="场景工作台底栏"
              value={dockTab}
              onChange={setDockTab}
              className="border-b-0"
              items={[
                {
                  id: "entities",
                  label: "实体",
                  count: model.scene.entities.length,
                },
                { id: "relations", label: "关系" },
                { id: "issues", label: "问题" },
              ]}
            />
          </div>
          <div className="scroll-thin min-h-0 flex-1 overflow-auto">
            {dockTab === "entities" ? (
              <EntityDock
                selected={selected}
                onSelect={setSelected}
                readOnly={readOnly}
                onError={setError}
              />
            ) : dockTab === "relations" ? (
              <div className="px-4 py-6 text-body text-muted">
                v0.5 契约没有关系实例数据；实体间关系在当前模型中为空。
              </div>
            ) : (
              <SceneIssues />
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function EntityDock({
  selected,
  onSelect,
  readOnly,
  onError,
}: {
  selected: string
  onSelect: (id: string) => void
  readOnly: boolean
  onError: (m: string | null) => void
}) {
  const model = useDraftModel()
  const meter = model.units.find((u) => u.id === "m")

  const placeAtOrigin = (id: string) => {
    onError(null)
    const result = applySceneOp(`放置 ${id}`, (scene) =>
      setEntityPosition(model, scene, id, [0, 0, 0]),
    )
    if (!result.ok) onError(result.message)
    else onSelect(id)
  }

  return (
    <Table className="min-w-[900px]">
      <thead>
        <tr>
          <Th className="w-[240px]">实体</Th>
          <Th>类型</Th>
          <Th>模板</Th>
          <Th align="right">位置</Th>
          <Th className="w-[120px]">操作</Th>
        </tr>
      </thead>
      <tbody>
        {model.scene.entities.map((e) => {
          const type = model.entityTypes.find((t) => t.id === e.typeId)
          const position = resolveInitialValue(model, e, "position.local")
          return (
            <Tr
              key={e.id}
              selected={e.id === selected}
              onSelect={() => onSelect(e.id)}
            >
              <Td>
                <div className="truncate font-medium">{e.label}</div>
                <div className="truncate font-mono text-caption text-muted">
                  {e.id}
                </div>
              </Td>
              <Td>{type?.label ?? e.typeId}</Td>
              <Td>
                {e.templateRef ? (
                  <ObjectLink
                    id={`${e.templateRef.id}@${e.templateRef.version}`}
                    route={{
                      pageId: "P05",
                      params: { templateId: e.templateRef.id },
                    }}
                  />
                ) : (
                  <span className="text-faint">—</span>
                )}
              </Td>
              <Td numeric>
                {position.state === "notApplicable" ? (
                  <span className="text-faint">—</span>
                ) : position.value === null ? (
                  <Tag tone="warning" size="sm">
                    尚未放置
                  </Tag>
                ) : (
                  <TypedValueCell
                    value={toDisplay(position.value)}
                    unit={meter ? toUnitDef(meter) : null}
                  />
                )}
              </Td>
              <Td>
                {position.state === "value" && position.value === null ? (
                  <Button
                    size="sm"
                    intent="ghost"
                    icon={MapPin}
                    disabled={readOnly}
                    title="把实体放到原点 [0, 0, 0]（原点合法）"
                    onClick={() => placeAtOrigin(e.id)}
                  >
                    放置
                  </Button>
                ) : null}
              </Td>
            </Tr>
          )
        })}
      </tbody>
    </Table>
  )
}

function SceneIssues() {
  const doc = useSceneDoc()
  if (!doc) return null
  return (
    <div className="p-4">
      <ValidationList
        diagnostics={doc.diagnostics}
        validationRevision={doc.validatedRevision}
        currentRevision={doc.revision}
        validating={doc.validating}
        onRevalidate={() => void validateDocument(SCENE_DOC)}
      />
    </div>
  )
}
