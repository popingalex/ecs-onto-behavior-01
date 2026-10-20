import rawSeed from '../../design/02/mock/prototype_seed.v05.json'
import rawRuns from '../../design/02/mock/expected_runs.v05.json'
import type { DomainDiagnostic, PrototypeModel } from '@/schema/model'
import { parsePrototypeSeed } from '@/schema/parse'
import { parseReferenceRuns, type ReferenceRun } from '@/schema/referenceRuns'

/**
 * 唯一的业务 mock 输入：design/02/mock/prototype_seed.v05.json。
 * 直接从设计包读取，不在 src 下复制第二份；所有页面数据都从这里派生。
 */
export interface PrototypeLoad {
  model: PrototypeModel
  integrity: DomainDiagnostic[]
  referencePurpose: string
  referenceRuns: ReferenceRun[]
}

let cached: PrototypeLoad | null = null

export function loadPrototype(): PrototypeLoad {
  if (cached) return cached
  const { model, diagnostics } = parsePrototypeSeed(rawSeed)
  const reference = parseReferenceRuns(rawRuns)
  cached = { model, integrity: diagnostics, referencePurpose: reference.purpose, referenceRuns: reference.runs }
  return cached
}

/** 草稿的“已发布基线”：每次返回深拷贝，调用方不能改到规范化输入本身。 */
export function baselineModel(): PrototypeModel {
  return structuredClone(loadPrototype().model)
}
