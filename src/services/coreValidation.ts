import type { Diagnostic, PropertyDef } from '@/core/types'
import type { WorkbenchIndex } from '@/data/index'

/**
 * Mock core 校验。正式版由 Rust core 返回诊断；UI 不复制编译器，只展示与定位。
 * 此处仅覆盖属性模式的几条规则，便于验证「字段 → 对象 → 跨对象」的分层反馈。
 */
export type DraftOverlay = Record<string, Record<string, unknown>>

export function effectiveProperty(property: PropertyDef, overlay: DraftOverlay): PropertyDef {
  const patch = overlay[property.id]
  return patch ? ({ ...property, ...patch } as PropertyDef) : property
}

export function validateModel(index: WorkbenchIndex, overlay: DraftOverlay): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  for (const base of index.properties.values()) {
    const p = effectiveProperty(base, overlay)
    const target = { pageId: 'P03' as const, params: { componentId: p.componentId, propertyId: p.id } }
    const objectLabel = `${p.componentId} · ${p.id}`
    if (!String(p.label ?? '').trim()) {
      diagnostics.push({ id: `${p.id}:label`, severity: 'error', code: 'LABEL_REQUIRED', message: '显示名不能为空。', objectLabel, target })
    }
    if (p.default === null && !p.nullable) {
      diagnostics.push({ id: `${p.id}:null`, severity: 'error', code: 'NULL_NOT_ALLOWED', message: '属性不允许无值，但默认值为未设置。', objectLabel, target })
    }
    if (p.unitId === 'degC' && typeof p.default === 'number' && p.default < -273.15) {
      diagnostics.push({ id: `${p.id}:abs0`, severity: 'error', code: 'BELOW_ABSOLUTE_ZERO', message: `默认值 ${p.default} °C 低于绝对零度。`, objectLabel, target })
    }
    if (p.writeMode === 'contribution' && !p.reducer) {
      diagnostics.push({ id: `${p.id}:reducer`, severity: 'error', code: 'CONTRIBUTION_WITHOUT_REDUCER', message: '贡献写入必须关联归约契约。', objectLabel, target })
    }
    if (p.writeMode !== 'contribution' && base.writeMode === 'contribution') {
      diagnostics.push({
        id: `${p.id}:mode`,
        severity: 'warning',
        code: 'WRITE_MODE_CHANGED',
        message: `写入方式由贡献改为 ${p.writeMode}；引用该属性的 system 需重新校验。`,
        objectLabel,
        target: { pageId: 'P14', params: { graphId: 'g-cool', nodeId: 'n-old' } },
      })
    }
  }
  return diagnostics
}
