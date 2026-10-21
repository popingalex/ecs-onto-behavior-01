import { useMemo } from "react"
import { ArrowUpRight } from "lucide-react"
import type { Route } from "@/core/types"
import {
  PRIMITIVE_LABEL,
  SHAPE_LABEL,
  WRITE_MODE_LABEL,
} from "@/core/labels"
import ObjectLink from "@/components/domain/ObjectLink"
import TypedValueCell from "@/components/domain/TypedValueCell"
import Button from "@/components/ui/Button"
import { KeyValue, Notice } from "@/components/ui/Card"
import { Drawer } from "@/components/ui/Modal"
import { Tag } from "@/components/ui/StatusTag"
import { toDisplay } from "@/data/world"
import { closeOverlay, navigate } from "@/router/router"
import { useDraftModel } from "@/stores/modelDocuments"
import { toUnitDef } from "@/features/ecs/adapters"
import { attributeRefs } from "@/features/ecs/refs"

const MODE_TONE = {
  configuration: "neutral",
  exclusive: "primary",
  contribution: "purple",
  contract: "warning",
} as const

/** P31 属性详情抽屉：就地查看属性定义全字段与引用位置；编辑仍在 P29。 */
export default function P31AttributeDetail({ route }: { route: Route }) {
  const model = useDraftModel()
  const attributeId = route.params.attributeId
  const attr = model.attributes.find((a) => a.id === attributeId)
  const refs = useMemo(
    () => (attr ? attributeRefs(model, attr.id) : []),
    [model, attr],
  )
  const component = attr
    ? model.components.find((c) => c.id === attr.componentId)
    : undefined
  const unit = attr?.type.unitId
    ? model.units.find((u) => u.id === attr.type.unitId)
    : undefined

  return (
    <Drawer
      title={attr ? attr.label || "（未命名）" : "属性详情"}
      subtitle={
        <span className="font-mono">{attributeId ?? "（缺少 attributeId）"}</span>
      }
      onClose={() => closeOverlay({ kind: "cancel" })}
      footer={
        <>
          <Button
            intent="ghost"
            onClick={() => closeOverlay({ kind: "cancel" })}
          >
            关闭
          </Button>
          {attr ? (
            <Button
              intent="secondary"
              icon={ArrowUpRight}
              onClick={() =>
                navigate({ pageId: "P29", params: { attributeId: attr.id } })
              }
            >
              在 P29 中打开
            </Button>
          ) : null}
        </>
      }
    >
      {!attr ? (
        <div className="px-5 py-4">
          <Notice tone="warning">
            属性{" "}
            <span className="font-mono">{attributeId ?? "（未指定）"}</span>{" "}
            不在当前草稿中；可能已被删除。
          </Notice>
        </div>
      ) : (
        <div className="flex flex-col gap-4 px-5 py-4">
          <dl>
            <KeyValue label="所属组件">
              {component ? (
                <ObjectLink
                  label={component.label}
                  id={component.id}
                  route={{
                    pageId: "P03",
                    params: { componentId: component.id, propertyId: attr.id },
                  }}
                />
              ) : (
                <span className="text-danger">{attr.componentId} 不存在</span>
              )}
            </KeyValue>
            <KeyValue label="基元类型">
              {PRIMITIVE_LABEL[attr.type.primitive]}
              <span className="ml-1.5 font-mono text-caption text-muted">
                {attr.type.primitive}
              </span>
            </KeyValue>
            <KeyValue label="值形状">{SHAPE_LABEL[attr.type.shape]}</KeyValue>
            <KeyValue label="单位">
              {unit ? (
                <>
                  {unit.symbol}
                  <span className="ml-1.5 text-caption text-muted">
                    量种 {unit.quantityKind}
                  </span>
                </>
              ) : (
                <span className="text-faint">无量纲</span>
              )}
            </KeyValue>
            <KeyValue label="可空">{attr.type.nullable ? "是" : "否"}</KeyValue>
            <KeyValue label="默认值">
              <TypedValueCell
                align="left"
                value={toDisplay(attr.default)}
                unit={unit ? toUnitDef(unit) : null}
              />
            </KeyValue>
            <KeyValue label="写入方式">
              <Tag tone={MODE_TONE[attr.writeMode]} size="sm">
                {WRITE_MODE_LABEL[attr.writeMode]}
              </Tag>
            </KeyValue>
            {attr.writeMode === "contribution" ? (
              <KeyValue label="归约契约" mono>
                {attr.reducerRef
                  ? `${attr.reducerRef.id}@${attr.reducerRef.version}`
                  : "缺失"}
              </KeyValue>
            ) : null}
          </dl>

          <section>
            <div className="mb-1.5 flex items-center gap-2 text-label font-semibold">
              引用位置
              <span className="tabular text-caption text-muted">
                {refs.length} 处
              </span>
            </div>
            {refs.length === 0 ? (
              <p className="text-label text-muted">没有其他对象引用该属性。</p>
            ) : (
              <ul className="divide-y divide-line rounded-ui border border-line">
                {refs.map((r, i) => (
                  <li
                    key={`${r.kind}:${r.id}:${i}`}
                    className="flex flex-wrap items-center gap-x-3 px-3 py-2 text-label"
                  >
                    {r.route ? (
                      <ObjectLink label={r.label} id={r.id} route={r.route} />
                    ) : (
                      <span className="font-medium">{r.label}</span>
                    )}
                    <span className="text-caption text-muted">{r.detail}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Drawer>
  )
}
