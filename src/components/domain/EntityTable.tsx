import type { PropertyDef, RawValue, WorldSnapshot } from '@/core/types'
import Table, { Td, Th, Tr } from '@/components/ui/Table'
import { Tag } from '@/components/ui/StatusTag'
import { useIndex } from '@/data/store'
import { rawWorldValue, worldValue } from '@/data/world'
import { formatSigned } from '@/lib/format'
import TypedValueCell from './TypedValueCell'

/** C11 EntityTable：读取 WorldSnapshot（只读）；可选与父提交比较，标出变化量。 */
export default function EntityTable({
  world,
  previous,
  columns,
  selectedId,
  onSelect,
}: {
  world: WorldSnapshot | undefined
  previous?: WorldSnapshot
  columns: PropertyDef[]
  selectedId?: string
  onSelect?: (id: string) => void
}) {
  const index = useIndex()
  const delta = (entityId: string, propertyId: string): number | null => {
    if (!previous) return null
    const a: RawValue | undefined = rawWorldValue(previous, entityId, propertyId)
    const b: RawValue | undefined = rawWorldValue(world, entityId, propertyId)
    if (typeof a === 'number' && typeof b === 'number' && a !== b) return b - a
    return null
  }
  return (
    <Table className="min-w-[760px]">
      <thead>
        <tr>
          <Th className="w-[220px]">实体</Th>
          <Th>类型</Th>
          {columns.map((c) => (
            <Th key={c.id} align={c.shape === 'vector3' ? 'left' : 'right'}>
              {c.label}
              {c.unitId ? <span className="ml-1 font-normal text-faint">{index.units.get(c.unitId)?.symbol}</span> : null}
            </Th>
          ))}
        </tr>
      </thead>
      <tbody>
        {[...index.entities.values()].map((e) => {
          const cls = index.classes.get(e.classId)
          return (
            <Tr key={e.id} selected={e.id === selectedId} onSelect={onSelect ? () => onSelect(e.id) : undefined}>
              <Td>
                <span className="font-mono text-label text-muted">{e.id}</span>
                <span className="ml-2 font-medium">{e.label}</span>
              </Td>
              <Td className="text-ink-soft">{cls?.label ?? e.classId}</Td>
              {columns.map((c) => {
                const value = worldValue(index, world, e.id, c)
                const d = delta(e.id, c.id)
                const unit = c.unitId ? index.units.get(c.unitId) : null
                return (
                  <Td key={c.id} numeric={c.shape !== 'vector3'}>
                    <span className="inline-flex items-center gap-2">
                      {c.id === 'position.local' && value.state === 'null' ? (
                        <Tag size="sm" tone="neutral">
                          未定位
                        </Tag>
                      ) : (
                        <TypedValueCell value={value} align={c.shape === 'vector3' ? 'left' : 'right'} />
                      )}
                      {d !== null ? (
                        <span className="tabular text-caption text-muted" title="相对父提交的变化">
                          ({formatSigned(d)}
                          {unit?.quantityId === 'temperature' ? ' K' : unit ? ` ${unit.symbol}` : ''})
                        </span>
                      ) : null}
                    </span>
                  </Td>
                )
              })}
            </Tr>
          )
        })}
      </tbody>
    </Table>
  )
}
