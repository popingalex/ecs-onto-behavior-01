import type { Vector3 } from '@/core/types'

const numberFormat = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 3 })

/** 数值格式化：负号统一为 U+2212，便于与连字符区分。 */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return String(value)
  return numberFormat.format(value).replace('-', '−')
}

export function formatSigned(value: number): string {
  if (value > 0) return `+${formatNumber(value)}`
  return formatNumber(value)
}

/** 单位与数值之间保留一个空格。 */
export function formatQuantity(value: number, unitSymbol?: string | null): string {
  return unitSymbol ? `${formatNumber(value)} ${unitSymbol}` : formatNumber(value)
}

export function formatVector(value: Vector3): string {
  return `[${value.map(formatNumber).join(', ')}]`
}

export function formatSimTime(seconds: number): string {
  return `${formatNumber(seconds)} s`
}
