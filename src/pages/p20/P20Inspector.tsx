import { ArrowUpRight, Flame } from "lucide-react"
import type { WorkbenchContext } from "@/app/useWorkbenchContext"
import { Notice } from "@/components/ui/Card"
import TypedValueCell from "@/components/domain/TypedValueCell"
import { useIndex } from "@/data/store"
import { rawWorldValue, worldValue } from "@/data/world"
import { formatSigned } from "@/lib/format"
import { navigate, useViewState } from "@/router/router"
import { InspectorSection } from "@/shell/Inspector"

/** P20 检查器：选中实体在 viewCommit 下的全部属性；每个值可追溯来源（P24）。 */
export default function P20Inspector({ ctx }: { ctx: WorkbenchContext }) {
  const index = useIndex()
  const [selected] = useViewState<string>("selectedEntity", "F01")
  const entity = index.entities.get(selected)
  const { viewCommit, branch, run } = ctx
  if (!entity || !viewCommit || !branch || !run) return null
  const cls = index.classes.get(entity.classId)
  const world = index.worlds.get(viewCommit.id)
  const previous = viewCommit.parentId
    ? index.worlds.get(viewCommit.parentId)
    : undefined
  const temp = rawWorldValue(world, entity.id, "thermal.temperature")
  const active = rawWorldValue(world, entity.id, "fire.active")

  return (
    <div>
      <div className="border-b border-line px-4 py-4">
        <div className="flex items-center gap-2">
          <h2 className="text-body-lg font-semibold">{entity.label}</h2>
          <span className="rounded bg-neutral-soft px-1.5 font-mono text-caption text-muted">
            {entity.id}
          </span>
        </div>
        <p className="mt-1 text-label text-muted">
          {cls?.label} ·{" "}
          {entity.templateRef ? (
            <span className="font-mono">{entity.templateRef}</span>
          ) : (
            "无模板"
          )}
        </p>
      </div>

      {typeof temp === "number" && active === true && temp <= 20 ? (
        <div className="px-4 pt-3">
          <Notice tone="info" icon={<Flame size={15} aria-hidden />}>
            温度已降至冷源温度，但{" "}
            <span className="font-mono">fire.active</span> 仍为
            true：降温不等于熄灭。
          </Notice>
        </div>
      ) : null}

      {entity.components.map((componentId) => {
        const component = index.components.get(componentId)
        const props = index.propertiesByComponent.get(componentId) ?? []
        return (
          <InspectorSection
            key={componentId}
            title={`${component?.label ?? componentId} · ${componentId}`}
          >
            <ul className="-mx-2">
              {props.map((p) => {
                const unit = p.unitId ? index.units.get(p.unitId) : null
                const a = rawWorldValue(previous, entity.id, p.id)
                const b = rawWorldValue(world, entity.id, p.id)
                const d =
                  typeof a === "number" && typeof b === "number" && a !== b
                    ? b - a
                    : null
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() =>
                        navigate({
                          pageId: "P24",
                          params: {
                            runId: run.id,
                            branchId: branch.id,
                            viewCommit: viewCommit.id,
                            entityId: entity.id,
                            propertyId: p.id,
                          },
                        })
                      }
                      title="追溯属性来源（P24）"
                      className="group flex w-full items-center gap-2 rounded-ui px-2 py-1.5 text-left hover:bg-hover"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-label text-ink">
                          {p.label}
                        </span>
                        <span className="block truncate font-mono text-caption text-faint">
                          {p.id}
                        </span>
                      </span>
                      <span className="flex flex-col items-end">
                        <TypedValueCell
                          value={worldValue(index, world, entity.id, p)}
                          unit={unit}
                        />
                        {d !== null ? (
                          <span className="tabular text-caption text-muted">
                            {formatSigned(d)}
                            {unit?.quantityId === "temperature"
                              ? " K"
                              : unit
                                ? ` ${unit.symbol}`
                                : ""}
                          </span>
                        ) : null}
                      </span>
                      <ArrowUpRight
                        size={13}
                        className="shrink-0 text-faint opacity-0 group-hover:opacity-100"
                        aria-hidden
                      />
                    </button>
                  </li>
                )
              })}
            </ul>
          </InspectorSection>
        )
      })}
    </div>
  )
}
