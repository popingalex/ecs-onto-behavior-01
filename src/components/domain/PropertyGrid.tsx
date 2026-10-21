import { CircleAlert, TriangleAlert } from "lucide-react"
import type { Diagnostic, PropertyDef, UnitDef } from "@/core/types"
import { SHAPE_LABEL, WRITE_MODE_LABEL } from "@/core/labels"
import Table, { Td, Th, Tr } from "@/components/ui/Table"
import { Tag } from "@/components/ui/StatusTag"
import { toDisplay } from "@/data/world"
import { cn } from "@/lib/cn"
import TypedValueCell from "./TypedValueCell"

const MODE_TONE = {
  configuration: "neutral",
  exclusive: "primary",
  contribution: "purple",
  contract: "warning",
} as const

/**
 * C05 PropertyGrid：显示有效值（已发布 + 草稿覆盖），草稿字段单独标记。
 * 单元格只格式化；修改通过检查器 → CommandBus 进入 DraftStore。
 */
export default function PropertyGrid({
  properties,
  changed,
  units,
  diagnostics,
  selectedId,
  onSelect,
  /** propertyId → 草稿中被覆盖的字段 */
}: {
  properties: PropertyDef[]
  changed: Record<string, string[]>
  units: Map<string, UnitDef>
  diagnostics: Diagnostic[]
  selectedId?: string
  onSelect: (id: string) => void
}) {
  return (
    <div className="scroll-thin overflow-auto">
      <Table className="min-w-[860px]">
        <thead>
          <tr>
            <Th className="w-[260px]">属性</Th>
            <Th>值形状</Th>
            <Th>单位</Th>
            <Th align="center">可空</Th>
            <Th align="right">默认值</Th>
            <Th>写入方式</Th>
            <Th>归约契约</Th>
          </tr>
        </thead>
        <tbody>
          {properties.map((p) => {
            const unit = p.unitId ? units.get(p.unitId) : null
            const fields = changed[p.id] ?? []
            const isChanged = (f: string) => fields.includes(f)
            const diag = diagnostics.filter(
              (d) => d.target?.params.propertyId === p.id,
            )
            const hasError = diag.some((d) => d.severity === "error")
            return (
              <Tr
                key={p.id}
                selected={p.id === selectedId}
                onSelect={() => onSelect(p.id)}
              >
                <Td>
                  <div className="flex items-center gap-2">
                    {diag.length ? (
                      hasError ? (
                        <CircleAlert
                          size={14}
                          className="shrink-0 text-danger"
                          aria-label="有错误"
                        />
                      ) : (
                        <TriangleAlert
                          size={14}
                          className="shrink-0 text-warning"
                          aria-label="有警告"
                        />
                      )
                    ) : null}
                    <div className="min-w-0">
                      <div
                        className={cn(
                          "truncate font-medium",
                          isChanged("label") && "text-purple",
                        )}
                      >
                        {p.label || (
                          <span className="text-danger">（未命名）</span>
                        )}
                      </div>
                      <div className="truncate font-mono text-caption text-muted">
                        {p.id}
                      </div>
                    </div>
                    {fields.length ? (
                      <Tag tone="purple" size="sm" className="ml-auto">
                        草稿 · {fields.length}
                      </Tag>
                    ) : null}
                  </div>
                </Td>
                <Td>
                  <span className="text-ink-soft">{SHAPE_LABEL[p.shape]}</span>
                  <span className="ml-1.5 font-mono text-caption text-muted">
                    {p.primitive}
                  </span>
                </Td>
                <Td>
                  {unit ? (
                    <span title={unit.label}>{unit.symbol}</span>
                  ) : (
                    <span className="text-faint">—</span>
                  )}
                </Td>
                <Td
                  align="center"
                  className={cn(isChanged("nullable") && "text-purple")}
                >
                  {p.nullable ? "是" : "否"}
                </Td>
                <Td
                  numeric
                  className={cn(isChanged("default") && "bg-purple-soft/50")}
                >
                  <TypedValueCell value={toDisplay(p.default)} unit={unit} />
                </Td>
                <Td>
                  <Tag
                    tone={MODE_TONE[p.writeMode]}
                    size="sm"
                    className={cn(
                      isChanged("writeMode") && "ring-1 ring-purple",
                    )}
                  >
                    {WRITE_MODE_LABEL[p.writeMode]}
                  </Tag>
                </Td>
                <Td>
                  {p.reducer ? (
                    <span
                      className={cn(
                        "font-mono text-label",
                        isChanged("reducer") ? "text-purple" : "text-ink-soft",
                      )}
                    >
                      {p.reducer}
                    </span>
                  ) : p.writeMode === "contribution" ? (
                    <span className="text-label text-danger">缺失</span>
                  ) : (
                    <span className="text-faint">—</span>
                  )}
                </Td>
              </Tr>
            )
          })}
        </tbody>
      </Table>
    </div>
  )
}
