import type { PropertyDef } from '@/core/types'
import type { SpatialItem } from '@/components/domain/SpatialViewport'
import type { WorkbenchIndex } from '@/data/index'
import { rawWorldValue } from '@/data/world'
import { formatNumber } from '@/lib/format'
import type { WorldSnapshot, Vector3 } from '@/core/types'

/** P20 ViewModel：WorldSnapshot → 表格列 / 空间条目。页面不复制数字为静态文本。 */
export const RUN_COLUMNS = ['thermal.temperature', 'fire.active', 'water.remaining', 'position.local']

export function runColumns(index: WorkbenchIndex): PropertyDef[] {
  return RUN_COLUMNS.map((id) => index.properties.get(id)).filter((p): p is PropertyDef => Boolean(p))
}

const KIND_BY_CLASS: Record<string, SpatialItem['kind']> = {
  Fire: 'fire',
  FoamTruck: 'vehicle',
  Command: 'command',
}

export function spatialItems(index: WorkbenchIndex, world: WorldSnapshot | undefined): SpatialItem[] {
  return [...index.entities.values()].map((e) => {
    const pos = rawWorldValue(world, e.id, 'position.local')
    const temp = rawWorldValue(world, e.id, 'thermal.temperature')
    const active = rawWorldValue(world, e.id, 'fire.active')
    const water = rawWorldValue(world, e.id, 'water.remaining')
    const caption =
      typeof temp === 'number'
        ? `${formatNumber(temp)} °C · ${active === true ? '活跃' : active === false ? '已熄灭' : '未记录'}`
        : typeof water === 'number'
          ? `${formatNumber(water)} L`
          : undefined
    return {
      id: e.id,
      label: e.label,
      kind: KIND_BY_CLASS[e.classId] ?? 'command',
      position: Array.isArray(pos) ? (pos as Vector3) : null,
      caption,
      active: active === true,
    }
  })
}
