import {
  refKey,
  type AttributeSchema,
  type Binding,
  type DomainDiagnostic,
  type LogicEdge,
  type LogicGraphDocument,
  type LogicNode,
  type PrototypeModel,
  type RawValue,
  type SystemDefinition,
  type TargetBinding,
  type TypeRef,
} from '@/schema/model'

/**
 * DomainBindingService：程序图的领域语义。FlowGram 只负责画布交互与表单承载；
 * 量种 / 单位 / 可空、previous 与 selfPreview 视图、贡献语义、变量候选都在这里，
 * 输入输出都是 LogicGraphDocument，与画布组件内部对象无关。
 */
export type DomainModel = Pick<PrototypeModel, 'units' | 'attributes' | 'components' | 'entityTypes' | 'scene' | 'queries' | 'baseWorld' | 'constraints'>
type Model = DomainModel

// ---------- 类型与单位 ----------

export const QUANTITY_LABEL: Record<string, string> = {
  temperatureAbsolute: '温度',
  temperatureDifference: '温差',
  length: '长度',
  volume: '体积',
}

/** 绝对量 → 其差值量：贡献写入的是差值。 */
export function differenceKind(quantityKind: string | undefined): string | undefined {
  return quantityKind === 'temperatureAbsolute' ? 'temperatureDifference' : quantityKind
}

export function unitSymbol(model: Pick<Model, 'units'>, unitId: string | undefined): string {
  if (!unitId) return ''
  return model.units.find((u) => u.id === unitId)?.symbol ?? unitId
}

export function formatType(model: Pick<Model, 'units'>, t: TypeRef | undefined): string {
  if (!t) return '—'
  if (t.primitive === 'EffectRef') return 'EffectRef'
  const base = `${t.primitive}${t.shape === 'vector3' ? '[3]' : ''}${t.nullable ? '?' : ''}`
  const qty = t.quantityKind ? `${QUANTITY_LABEL[t.quantityKind] ?? t.quantityKind}` : ''
  const unit = unitSymbol(model, t.unitId)
  return [base, [qty, unit].filter(Boolean).join(' ')].filter(Boolean).join(' · ')
}

export type Compat = { ok: true } | { ok: false; reason: string }

/** from 的值能否流入 to（端口或绑定）。不做隐式单位换算。 */
export function compatible(model: Pick<Model, 'units'>, from: TypeRef, to: TypeRef, options: { generic?: boolean } = {}): Compat {
  const isEffect = (t: TypeRef) => t.primitive === 'EffectRef'
  if (isEffect(from) !== isEffect(to))
    return { ok: false, reason: isEffect(from) ? '效果句柄 EffectRef 只能接到效果输入（如 ReadSelfPreview.after）' : '这个输入只接收 EffectRef 效果句柄' }
  if (options.generic) return { ok: true }
  if (from.primitive !== to.primitive) return { ok: false, reason: `值类型不同：${from.primitive} 不能作为 ${to.primitive}` }
  if (from.shape !== to.shape) return { ok: false, reason: `形状不同：${from.shape} 不能作为 ${to.shape}` }
  if (from.quantityKind !== to.quantityKind) {
    const a = `${QUANTITY_LABEL[from.quantityKind ?? ''] ?? from.quantityKind ?? '无量纲'} ${unitSymbol(model, from.unitId)}`.trim()
    const b = `${QUANTITY_LABEL[to.quantityKind ?? ''] ?? to.quantityKind ?? '无量纲'} ${unitSymbol(model, to.unitId)}`.trim()
    const hint = from.quantityKind === 'temperatureAbsolute' && to.quantityKind === 'temperatureDifference' ? '；绝对温度要先经 CoolingRoom 这类显式节点换算成温差' : ''
    return { ok: false, reason: `量种不同：${a} 不能直接作为 ${b}${hint}` }
  }
  if (from.unitId !== to.unitId) return { ok: false, reason: `单位不同：${unitSymbol(model, from.unitId)} 与 ${unitSymbol(model, to.unitId)}，原型不做隐式换算` }
  if (from.nullable && !to.nullable) return { ok: false, reason: '来源可空，而这个输入不接受 null；请先用 IsSome 判断' }
  return { ok: true }
}

function attrType(a: AttributeSchema): TypeRef {
  return { ...a.type }
}

function unitType(model: Pick<Model, 'units'>, unitId: string): TypeRef {
  const unit = model.units.find((u) => u.id === unitId)
  return { primitive: 'f64', shape: 'scalar', quantityKind: unit?.quantityKind, unitId, nullable: false }
}

const EFFECT: TypeRef = { primitive: 'EffectRef', shape: 'scalar', nullable: false }
const BOOL: TypeRef = { primitive: 'bool', shape: 'scalar', nullable: false }

// ---------- 节点物料 ----------

export interface PortDef {
  id: string
  label: string
  required: boolean
  /** 允许通过属性 / 参数绑定或字面默认值提供，而不只靠连线。 */
  bindable: boolean
  /** 接受任意值类型（IsSome.value）；端口类型随来源确定。 */
  generic?: boolean
}
export interface SlotDef {
  id: string
  label: string
  kind: 'read' | 'readPreview' | 'target'
}
export type NodeCategory = 'read' | 'compute' | 'emit' | 'value' | 'control'

export interface NodeTypeDef {
  type: string
  label: string
  category: NodeCategory
  summary: string
  inputs: PortDef[]
  outputs: PortDef[]
  slots: SlotDef[]
  /** 端口量纲由用户选择的单位决定（Min / Negate / Constant）。 */
  unitSelectable?: boolean
  available: boolean
  unavailableReason?: string
}

export const CATEGORY_LABEL: Record<NodeCategory, string> = { read: '读取', compute: '计算', emit: '写入', value: '值', control: '控制' }

export const NODE_TYPES: NodeTypeDef[] = [
  {
    type: 'ReadPrevious',
    label: '读取旧状态',
    category: 'read',
    summary: '读取自身属性在 previous 视图（基础提交）里的值。',
    inputs: [],
    outputs: [{ id: 'value', label: '值', required: false, bindable: false }],
    slots: [{ id: 'property', label: '属性', kind: 'read' }],
    available: true,
  },
  {
    type: 'ReadSelfPreview',
    label: '读取自身暂存',
    category: 'read',
    summary: '读取 previous + 本 System 对该实体已提交的暂存贡献；其他 System 的暂存不可见。',
    inputs: [{ id: 'after', label: '在…之后', required: false, bindable: false }],
    outputs: [{ id: 'value', label: '值', required: false, bindable: false }],
    slots: [{ id: 'property', label: '属性', kind: 'readPreview' }],
    available: true,
  },
  {
    type: 'CoolingRoom',
    label: '可降温空间',
    category: 'compute',
    summary: 'max(旧温度 − 水源温度, 0)：绝对温度 °C → 温差 K。',
    inputs: [
      { id: 'old', label: '旧温度', required: true, bindable: true },
      { id: 'source', label: '水源温度', required: true, bindable: true },
    ],
    outputs: [{ id: 'room', label: '空间', required: false, bindable: false }],
    slots: [],
    available: true,
  },
  {
    type: 'Min',
    label: '取小',
    category: 'compute',
    summary: 'min(a, b)；两端量种与单位必须相同。',
    inputs: [
      { id: 'a', label: 'a', required: true, bindable: true },
      { id: 'b', label: 'b', required: true, bindable: true },
    ],
    outputs: [{ id: 'value', label: '值', required: false, bindable: false }],
    slots: [],
    unitSelectable: true,
    available: true,
  },
  {
    type: 'Negate',
    label: '取反',
    category: 'compute',
    summary: '−value；量种与单位不变。',
    inputs: [{ id: 'value', label: '值', required: true, bindable: true }],
    outputs: [{ id: 'delta', label: '结果', required: false, bindable: false }],
    slots: [],
    unitSelectable: true,
    available: true,
  },
  {
    type: 'Contribute',
    label: '提交贡献',
    category: 'emit',
    summary: '向自身贡献写入属性提交私有增量；由属性的归约规则裁决，不直接改值。',
    inputs: [{ id: 'delta', label: '增量', required: true, bindable: true }],
    outputs: [{ id: 'effect', label: '效果', required: false, bindable: false }],
    slots: [{ id: 'target', label: '目标属性', kind: 'target' }],
    available: true,
  },
  {
    type: 'Constant',
    label: '常量',
    category: 'value',
    summary: '带单位的字面量。',
    inputs: [],
    outputs: [{ id: 'value', label: '值', required: false, bindable: false }],
    slots: [],
    unitSelectable: true,
    available: true,
  },
  {
    type: 'Parameter',
    label: '程序参数',
    category: 'value',
    summary: '读取 System 调用时传入的程序参数；未传入时取参数默认值。',
    inputs: [],
    outputs: [{ id: 'value', label: '值', required: false, bindable: false }],
    slots: [],
    available: true,
  },
  {
    type: 'IsSome',
    label: '非空判断',
    category: 'value',
    summary: '可空值是否存在：输出不可空的 bool。',
    inputs: [{ id: 'value', label: '值', required: true, bindable: true, generic: true }],
    outputs: [{ id: 'some', label: '存在', required: false, bindable: false }],
    slots: [],
    available: true,
  },
  {
    type: 'Branch',
    label: '条件分支',
    category: 'control',
    summary: '按条件控制下游节点作用域。',
    inputs: [],
    outputs: [],
    slots: [],
    available: false,
    unavailableReason: '条件节点需要控制作用域（分支内节点只在条件成立时执行）；mock 执行器尚未实现控制作用域，暂不提供。',
  },
  {
    type: 'Loop',
    label: '循环',
    category: 'control',
    summary: '对集合逐项执行子图。',
    inputs: [],
    outputs: [],
    slots: [],
    available: false,
    unavailableReason: '首版不支持完整循环：回合内的子图迭代需要执行器支持，暂不提供。',
  },
  {
    type: 'Wait',
    label: '等待',
    category: 'control',
    summary: '跨回合等待条件成立。',
    inputs: [],
    outputs: [],
    slots: [],
    available: false,
    unavailableReason: '不支持长期等待：System 程序在一次回合内完成，跨回合状态需要建模为属性。',
  },
]

export function nodeTypeDef(type: string): NodeTypeDef | undefined {
  return NODE_TYPES.find((d) => d.type === type)
}

// ---------- 作用域：实体可用属性 ----------

/** program 作用域实体类型上可读的属性（必需 + 可选组件）。 */
export function scopeAttributes(
  model: Pick<Model, 'attributes' | 'entityTypes'>,
  scopeType: string,
): Array<{ attribute: AttributeSchema; optional: boolean }> {
  const type = model.entityTypes.find((t) => t.id === scopeType)
  if (!type) return []
  const out: Array<{ attribute: AttributeSchema; optional: boolean }> = []
  const groups: Array<[string[], boolean]> = [
    [type.requiredComponentIds, false],
    [type.optionalComponentIds, true],
  ]
  for (const [ids, optional] of groups)
    for (const cid of ids) for (const a of model.attributes.filter((x) => x.componentId === cid)) out.push({ attribute: a, optional })
  return out
}

// ---------- 输入来源（连线 / 绑定 / 默认值 三者互斥） ----------

export const DEFAULT_PREFIX = 'default:'

export type InputSource = { kind: 'edge'; edge: LogicEdge } | { kind: 'binding'; binding: Binding } | { kind: 'default'; value: RawValue }

/** bindings 里既有输入端口绑定，也有槽位（property / target）；按物料定义区分。 */
function isInputPort(node: LogicNode, key: string): boolean {
  return Boolean(nodeTypeDef(node.type)?.inputs.some((p) => p.id === key))
}

export function inputSources(program: LogicGraphDocument, nodeId: string, portId: string): InputSource[] {
  const node = program.nodes.find((n) => n.id === nodeId)
  if (!node) return []
  const out: InputSource[] = program.edges
    .filter((e) => e.target.nodeId === nodeId && e.target.portId === portId)
    .map((edge) => ({ kind: 'edge' as const, edge }))
  const b = node.bindings[portId]
  if (b && isInputPort(node, portId)) out.push({ kind: 'binding', binding: b as Binding })
  const key = `${DEFAULT_PREFIX}${portId}`
  if (key in node.params) out.push({ kind: 'default', value: node.params[key] })
  return out
}

// ---------- 图工具 ----------

function walk(program: LogicGraphDocument, nodeId: string, direction: 'down' | 'up'): Set<string> {
  const seen = new Set<string>()
  const queue = [nodeId]
  while (queue.length) {
    const id = queue.shift()!
    for (const e of program.edges) {
      const [from, to] = direction === 'down' ? [e.source.nodeId, e.target.nodeId] : [e.target.nodeId, e.source.nodeId]
      if (from === id && !seen.has(to)) {
        seen.add(to)
        queue.push(to)
      }
    }
  }
  return seen
}

export function downstreamNodes(program: LogicGraphDocument, nodeId: string): Set<string> {
  return walk(program, nodeId, 'down')
}

export function upstreamNodes(program: LogicGraphDocument, nodeId: string): Set<string> {
  return walk(program, nodeId, 'up')
}

/** 确定性拓扑序（同层按节点在文档中的顺序）；成环返回 null。 */
export function topoOrder(program: LogicGraphDocument): string[] | null {
  const ids = new Set(program.nodes.map((n) => n.id))
  const indegree = new Map(program.nodes.map((n) => [n.id, 0]))
  for (const e of program.edges) if (ids.has(e.target.nodeId) && ids.has(e.source.nodeId)) indegree.set(e.target.nodeId, indegree.get(e.target.nodeId)! + 1)
  const queue = program.nodes.filter((n) => indegree.get(n.id) === 0).map((n) => n.id)
  const order: string[] = []
  while (queue.length) {
    const id = queue.shift()!
    order.push(id)
    for (const e of program.edges)
      if (e.source.nodeId === id && ids.has(e.target.nodeId)) {
        indegree.set(e.target.nodeId, indegree.get(e.target.nodeId)! - 1)
        if (indegree.get(e.target.nodeId) === 0) queue.push(e.target.nodeId)
      }
  }
  return order.length === program.nodes.length ? order : null
}

export function edgeIdFor(source: { nodeId: string; portId: string }, target: { nodeId: string; portId: string }): string {
  return `le:${source.nodeId}.${source.portId}->${target.nodeId}.${target.portId}`
}

// ---------- 候选 ----------

export type CandidateGroupId = 'self' | 'parameter' | 'upstream' | 'relation' | 'local' | 'sim'
export const CANDIDATE_GROUP_LABEL: Record<CandidateGroupId, string> = {
  self: 'self 属性',
  parameter: 'program 参数',
  upstream: '上游节点输出',
  relation: '关系路径',
  local: '局部变量',
  sim: 'sim context',
}

export interface BindingCandidate {
  key: string
  group: CandidateGroupId
  label: string
  detail: string
  type?: TypeRef
  binding?: Binding | TargetBinding
  /** 上游输出：确认后创建数据连线，而不是写 binding。 */
  upstream?: { nodeId: string; portId: string }
  compat: Compat
}
export interface CandidateGroup {
  group: CandidateGroupId
  label: string
  candidates: BindingCandidate[]
  emptyReason?: string
}

export type BindTarget = { kind: 'input'; nodeId: string; portId: string } | { kind: 'slot'; nodeId: string; slotId: string }

function group(id: CandidateGroupId, candidates: BindingCandidate[], emptyReason?: string): CandidateGroup {
  return { group: id, label: CANDIDATE_GROUP_LABEL[id], candidates, emptyReason: candidates.length ? undefined : emptyReason }
}

const TARGET_REJECT: Record<string, string> = {
  exclusive: '独占写入属性不能接收贡献',
  configuration: '配置属性在运行时只读',
  contract: '合同属性要经合同裁决，当前没有对应的合同约束',
}

/** 候选全部由 schema、程序参数和当前图生成。 */
export function bindingCandidates(model: Model, program: LogicGraphDocument, target: BindTarget): CandidateGroup[] {
  const node = program.nodes.find((n) => n.id === target.nodeId)
  if (!node) return []
  const attrs = scopeAttributes(model, program.scopeType)
  const optionalNote = (optional: boolean) => (optional ? ' · 可选组件' : '')

  if (target.kind === 'slot') {
    const slot = nodeTypeDef(node.type)?.slots.find((s) => s.id === target.slotId)
    if (!slot) return []
    const self = attrs.map(({ attribute: a, optional }): BindingCandidate => {
      let compat: Compat = { ok: true }
      let binding: Binding | TargetBinding = { root: 'self', propertyId: a.id, view: 'previous' }
      if (slot.kind === 'readPreview') {
        binding = { root: 'self', propertyId: a.id, view: 'selfPreview' }
        if (a.writeMode !== 'contribution') compat = { ok: false, reason: '只有贡献写入属性存在本 System 的暂存视图' }
      }
      if (slot.kind === 'target') {
        binding = { root: 'self', propertyId: a.id }
        if (a.writeMode !== 'contribution') compat = { ok: false, reason: TARGET_REJECT[a.writeMode] ?? '不可写' }
      }
      return {
        key: `self:${a.id}:${slot.kind}`,
        group: 'self',
        label: `self.${a.id}`,
        detail: `${a.label} · ${a.writeMode}${optionalNote(optional)}`,
        type: attrType(a),
        binding,
        compat,
      }
    })
    return [group('self', self, `作用域类型 ${program.scopeType} 没有属性`)]
  }

  const port = nodeTypeDef(node.type)?.inputs.find((p) => p.id === target.portId)
  const expected = node.inputs[target.portId]
  if (!port || !expected) return []
  const check = (t: TypeRef): Compat => (port.bindable ? compatible(model, t, expected, { generic: port.generic }) : { ok: false, reason: '这个输入只能连线' })

  const self: BindingCandidate[] = []
  for (const { attribute: a, optional } of attrs) {
    self.push({
      key: `self:${a.id}:previous`,
      group: 'self',
      label: `self.${a.id}`,
      detail: `previous · ${a.label}${optionalNote(optional)}`,
      type: attrType(a),
      binding: { root: 'self', propertyId: a.id, view: 'previous' },
      compat: check(attrType(a)),
    })
    if (a.writeMode === 'contribution')
      self.push({
        key: `self:${a.id}:selfPreview`,
        group: 'self',
        label: `self.${a.id}`,
        detail: `selfPreview · ${a.label}`,
        type: attrType(a),
        compat: { ok: false, reason: '暂存视图要用 ReadSelfPreview 节点并接在 Contribute 之后读取，可见时机才确定' },
      })
  }
  const parameters = program.parameters.map(
    (p): BindingCandidate => ({
      key: `param:${p.id}`,
      group: 'parameter',
      label: p.id,
      detail: `默认 ${String(p.default)}`,
      type: p.type,
      binding: { root: 'parameter', parameterId: p.id },
      compat: check(p.type),
    }),
  )
  const blocked = downstreamNodes(program, node.id)
  const upstream: BindingCandidate[] = []
  for (const other of program.nodes) {
    if (other.id === node.id) continue
    for (const [portId, t] of Object.entries(other.outputs)) {
      const generic = port.generic
      upstream.push({
        key: `up:${other.id}.${portId}`,
        group: 'upstream',
        label: `${other.id}.${portId}`,
        detail: `${nodeTypeDef(other.type)?.label ?? other.type} 输出 · 确认后创建连线`,
        type: t,
        upstream: { nodeId: other.id, portId },
        compat: blocked.has(other.id) ? { ok: false, reason: `${other.id} 在当前节点下游，连接会成环` } : compatible(model, t, expected, { generic }),
      })
    }
  }
  return [
    group('self', self, `作用域类型 ${program.scopeType} 没有属性`),
    group('parameter', parameters, '程序没有声明参数'),
    group('upstream', upstream, '图中没有其他节点输出'),
    group('relation', [], '模式中尚未定义关系（P02），没有可用的关系路径'),
    group('local', [], '程序没有声明局部变量'),
    group('sim', [
      {
        key: 'sim:time',
        group: 'sim',
        label: 'sim.time',
        detail: `模拟时间 s · 基础提交 ${model.baseWorld.commitId}`,
        compat: { ok: false, reason: 'Binding 尚无 sim 根，执行器也不提供这个值，暂不可绑定' },
      },
    ]),
  ]
}

// ---------- 编辑操作（纯函数，返回新程序） ----------

function mapNode(program: LogicGraphDocument, nodeId: string, fn: (n: LogicNode) => LogicNode): LogicGraphDocument {
  return { ...program, nodes: program.nodes.map((n) => (n.id === nodeId ? fn(n) : n)) }
}

function withoutInputSources(program: LogicGraphDocument, nodeId: string, portId: string): LogicGraphDocument {
  const p = { ...program, edges: program.edges.filter((e) => !(e.target.nodeId === nodeId && e.target.portId === portId)) }
  return mapNode(p, nodeId, (n) => {
    const bindings = { ...n.bindings }
    delete bindings[portId]
    const params = { ...n.params }
    delete params[`${DEFAULT_PREFIX}${portId}`]
    return { ...n, bindings, params }
  })
}

export function clearInput(program: LogicGraphDocument, model: Model, nodeId: string, portId: string): LogicGraphDocument {
  return retypeAll(withoutInputSources(program, nodeId, portId), model)
}

export function bindInput(program: LogicGraphDocument, model: Model, nodeId: string, portId: string, binding: Binding): LogicGraphDocument {
  const cleared = withoutInputSources(program, nodeId, portId)
  return retypeAll(
    mapNode(cleared, nodeId, (n) => ({ ...n, bindings: { ...n.bindings, [portId]: binding } })),
    model,
  )
}

export function setInputDefault(program: LogicGraphDocument, model: Model, nodeId: string, portId: string, value: number): LogicGraphDocument {
  const cleared = withoutInputSources(program, nodeId, portId)
  return retypeAll(
    mapNode(cleared, nodeId, (n) => ({ ...n, params: { ...n.params, [`${DEFAULT_PREFIX}${portId}`]: value } })),
    model,
  )
}

/** 连线前的检查：端口存在、不成环、类型兼容。 */
export function checkEdge(
  model: Pick<Model, 'units'>,
  program: LogicGraphDocument,
  source: { nodeId: string; portId: string },
  target: { nodeId: string; portId: string },
): Compat {
  const from = program.nodes.find((n) => n.id === source.nodeId)
  const to = program.nodes.find((n) => n.id === target.nodeId)
  const out = from?.outputs[source.portId]
  const input = to?.inputs[target.portId]
  if (!from || !to || !out || !input) return { ok: false, reason: '端口不存在' }
  if (from.id === to.id) return { ok: false, reason: '不能连接到自身' }
  if (downstreamNodes(program, to.id).has(from.id)) return { ok: false, reason: `${from.id} 在 ${to.id} 下游，连接会成环` }
  const port = nodeTypeDef(to.type)?.inputs.find((p) => p.id === target.portId)
  const compat = compatible(model, out, input, { generic: port?.generic })
  if (!compat.ok) return { ok: false, reason: `${from.id}.${source.portId} → ${to.id}.${target.portId}：${compat.reason}` }
  return { ok: true }
}

/** 连线会替换目标端口原有的连线 / 绑定 / 默认值。调用方应先用 checkEdge。 */
export function connect(
  program: LogicGraphDocument,
  model: Model,
  source: { nodeId: string; portId: string },
  target: { nodeId: string; portId: string },
): LogicGraphDocument {
  const cleared = withoutInputSources(program, target.nodeId, target.portId)
  const out = program.nodes.find((n) => n.id === source.nodeId)?.outputs[source.portId]
  const edge: LogicEdge = { id: edgeIdFor(source, target), kind: out?.primitive === 'EffectRef' ? 'control' : 'data', source, target }
  return retypeAll({ ...cleared, edges: [...cleared.edges, edge] }, model)
}

export function bindSlot(program: LogicGraphDocument, model: Model, nodeId: string, slotId: string, binding: Binding | TargetBinding): LogicGraphDocument {
  return retypeAll(
    mapNode(program, nodeId, (n) => ({ ...n, bindings: { ...n.bindings, [slotId]: binding } })),
    model,
  )
}

export function setParam(program: LogicGraphDocument, model: Model, nodeId: string, key: string, value: RawValue): LogicGraphDocument {
  return retypeAll(
    mapNode(program, nodeId, (n) => ({ ...n, params: { ...n.params, [key]: value } })),
    model,
  )
}

/** Min / Negate / Constant：改单位即改全部数值端口的量纲。 */
export function setNodeUnit(program: LogicGraphDocument, model: Model, nodeId: string, unitId: string): LogicGraphDocument {
  const t = unitType(model, unitId)
  return retypeAll(
    mapNode(program, nodeId, (n) => ({
      ...n,
      inputs: Object.fromEntries(Object.keys(n.inputs).map((k) => [k, { ...t }])),
      outputs: Object.fromEntries(Object.keys(n.outputs).map((k) => [k, { ...t }])),
    })),
    model,
  )
}

export function nodeUnit(node: LogicNode): string | undefined {
  return Object.values(node.outputs)[0]?.unitId ?? Object.values(node.inputs)[0]?.unitId
}

export function removeNodes(program: LogicGraphDocument, model: Model, ids: string[]): LogicGraphDocument {
  const drop = new Set(ids)
  return retypeAll(
    {
      ...program,
      nodes: program.nodes.filter((n) => !drop.has(n.id)),
      edges: program.edges.filter((e) => !drop.has(e.source.nodeId) && !drop.has(e.target.nodeId)),
    },
    model,
  )
}

export function removeEdges(program: LogicGraphDocument, model: Model, ids: string[]): LogicGraphDocument {
  const drop = new Set(ids)
  return retypeAll({ ...program, edges: program.edges.filter((e) => !drop.has(e.id)) }, model)
}

export function nextNodeId(program: LogicGraphDocument, type: string): string {
  const base = `n-${type.replace(/[A-Z]/g, (c, i: number) => (i ? '-' : '') + c.toLowerCase())}`
  let i = 1
  while (program.nodes.some((n) => n.id === `${base}-${i}`)) i++
  return `${base}-${i}`
}

/** 新建物料实例：端口按物料定义与当前模型给出初始类型。 */
export function createNode(model: Model, program: LogicGraphDocument, type: string, id: string): LogicNode {
  const def = nodeTypeDef(type)
  if (!def?.available) throw new Error(`${type} 不可用：${def?.unavailableReason ?? '未知物料'}`)
  const degC = unitType(model, 'degC')
  const deltaK = unitType(model, 'deltaK')
  const base: LogicNode = { id, type, inputs: {}, outputs: {}, bindings: {}, params: {} }
  const scoped = scopeAttributes(model, program.scopeType).map((s) => s.attribute)
  const firstContribution = scoped.find((a) => a.writeMode === 'contribution')
  const firstRead = scoped[0]
  switch (type) {
    case 'ReadPrevious':
      return retypeNode({ ...base, bindings: firstRead ? { property: { root: 'self', propertyId: firstRead.id, view: 'previous' } } : {} }, model, program)
    case 'ReadSelfPreview':
      return retypeNode(
        { ...base, inputs: { after: EFFECT }, bindings: firstContribution ? { property: { root: 'self', propertyId: firstContribution.id, view: 'selfPreview' } } : {} },
        model,
        program,
      )
    case 'CoolingRoom':
      return { ...base, inputs: { old: degC, source: degC }, outputs: { room: deltaK } }
    case 'Min':
      return { ...base, inputs: { a: deltaK, b: deltaK }, outputs: { value: deltaK } }
    case 'Negate':
      return { ...base, inputs: { value: deltaK }, outputs: { delta: deltaK } }
    case 'Contribute':
      return retypeNode({ ...base, bindings: firstContribution ? { target: { root: 'self', propertyId: firstContribution.id } } : {} }, model, program)
    case 'Constant':
      return { ...base, outputs: { value: deltaK }, params: { value: 0 } }
    case 'Parameter':
      return retypeNode({ ...base, params: { parameterId: program.parameters[0]?.id ?? '' } }, model, program)
    case 'IsSome':
      return { ...base, inputs: { value: { primitive: 'f64', shape: 'scalar', nullable: true } }, outputs: { some: BOOL } }
  }
  return base
}

/** 由槽位绑定 / 参数 / 来源推导的端口类型（读取节点输出、贡献增量、参数输出、IsSome 输入）。 */
export function retypeNode(node: LogicNode, model: Model, program: LogicGraphDocument): LogicNode {
  const attr = (key: string) => {
    const b = node.bindings[key]
    return b?.root === 'self' ? model.attributes.find((a) => a.id === b.propertyId) : undefined
  }
  switch (node.type) {
    case 'ReadPrevious':
    case 'ReadSelfPreview': {
      const a = attr('property')
      return a ? { ...node, outputs: { value: attrType(a) } } : node
    }
    case 'Contribute': {
      const a = attr('target')
      if (!a) return { ...node, outputs: { effect: EFFECT } }
      const kind = differenceKind(a.type.quantityKind)
      const unit = model.units.find((u) => u.quantityKind === kind)
      return {
        ...node,
        inputs: { delta: { primitive: 'f64', shape: 'scalar', quantityKind: kind, unitId: unit?.id, nullable: false } },
        outputs: { effect: EFFECT },
        params: { ...node.params, constraintRef: a.reducerRef ? refKey(a.reducerRef) : null },
      }
    }
    case 'Parameter': {
      const p = program.parameters.find((x) => x.id === node.params.parameterId)
      return p ? { ...node, outputs: { value: { ...p.type } } } : node
    }
    case 'IsSome': {
      const edge = program.edges.find((e) => e.target.nodeId === node.id && e.target.portId === 'value')
      const fromEdge = edge ? program.nodes.find((n) => n.id === edge.source.nodeId)?.outputs[edge.source.portId] : undefined
      const b = node.bindings.value
      const fromBinding =
        b?.root === 'self'
          ? model.attributes.find((a) => a.id === b.propertyId)?.type
          : b?.root === 'parameter'
            ? program.parameters.find((p) => p.id === b.parameterId)?.type
            : undefined
      const t = fromEdge ?? fromBinding
      return t ? { ...node, inputs: { value: { ...t } } } : node
    }
  }
  return node
}

export function retypeAll(program: LogicGraphDocument, model: Model): LogicGraphDocument {
  return { ...program, nodes: program.nodes.map((n) => retypeNode(n, model, program)) }
}

// ---------- 校验 ----------

const SOURCE_LABEL: Record<InputSource['kind'], string> = { edge: '连线', binding: '绑定', default: '默认值' }

export function validateProgram(model: Model, program: LogicGraphDocument): DomainDiagnostic[] {
  const out: DomainDiagnostic[] = []
  const add = (severity: DomainDiagnostic['severity'], code: string, message: string, nodeId?: string, portId?: string) =>
    out.push({ id: `${program.id}:${code}:${out.length + 1}`, severity, code, message, target: { documentId: program.id, nodeId, portId } })
  const nodes = new Map(program.nodes.map((n) => [n.id, n]))
  const attrs = scopeAttributes(model, program.scopeType)
  const seen = new Set<string>()
  for (const n of program.nodes) {
    if (seen.has(n.id)) add('error', 'NODE_ID_DUPLICATE', `节点 id ${n.id} 重复`, n.id)
    seen.add(n.id)
  }

  for (const e of program.edges) {
    const from = nodes.get(e.source.nodeId)
    const to = nodes.get(e.target.nodeId)
    const outType = from?.outputs[e.source.portId]
    const inType = to?.inputs[e.target.portId]
    if (!from || !to || !outType || !inType) {
      add('error', 'PORT_REF_MISSING', `连线 ${e.id} 指向不存在的节点或端口`, to ? e.target.nodeId : undefined)
      continue
    }
    const generic = nodeTypeDef(to.type)?.inputs.find((p) => p.id === e.target.portId)?.generic
    const compat = compatible(model, outType, inType, { generic })
    if (!compat.ok) add('error', 'TYPE_MISMATCH', `${e.source.nodeId}.${e.source.portId} → ${e.target.nodeId}.${e.target.portId}：${compat.reason}`, e.target.nodeId, e.target.portId)
    const expectKind = outType.primitive === 'EffectRef' ? 'control' : 'data'
    if (e.kind !== expectKind) add('warning', 'EDGE_KIND', `连线 ${e.id} 传递 ${outType.primitive}，应标记为 ${expectKind}`, e.target.nodeId, e.target.portId)
  }
  if (!topoOrder(program)) add('error', 'GRAPH_CYCLE', '程序图成环，无法确定求值顺序')

  for (const n of program.nodes) {
    const def = nodeTypeDef(n.type)
    if (!def) {
      add('error', 'NODE_TYPE_UNKNOWN', `节点 ${n.id} 的类型 ${n.type} 不在物料库中`, n.id)
      continue
    }
    if (!def.available) add('error', 'NODE_TYPE_UNAVAILABLE', `节点 ${n.id}（${def.label}）：${def.unavailableReason}`, n.id)
    for (const port of def.inputs) {
      const sources = inputSources(program, n.id, port.id)
      if (sources.length > 1)
        add('error', 'INPUT_SOURCE_CONFLICT', `${n.id}.${port.id} 同时有${sources.map((s) => SOURCE_LABEL[s.kind]).join('、')}；三者只能选一种`, n.id, port.id)
      if (sources.length === 0 && port.required) add('error', 'INPUT_MISSING', `${n.id}.${port.id}（${port.label}）没有来源：需要连线、绑定或默认值`, n.id, port.id)
      const b = n.bindings[port.id]
      const expected = n.inputs[port.id]
      if (!b || !expected) continue
      if (b.root === 'self' && b.view === 'selfPreview') {
        add('error', 'PREVIEW_VIA_NODE', `${n.id}.${port.id}：暂存视图只能经 ReadSelfPreview 读取`, n.id, port.id)
        continue
      }
      const t =
        b.root === 'self'
          ? attrs.find(({ attribute }) => attribute.id === b.propertyId)?.attribute.type
          : b.root === 'parameter'
            ? program.parameters.find((p) => p.id === b.parameterId)?.type
            : undefined
      const label = b.root === 'self' ? `self.${b.propertyId}` : b.root === 'parameter' ? `参数 ${b.parameterId}` : b.root
      if (!t) add('error', 'BINDING_REF_MISSING', `${n.id}.${port.id} 绑定的 ${label} 不存在或不在作用域内`, n.id, port.id)
      else {
        const compat = compatible(model, t, expected, { generic: port.generic })
        if (!compat.ok) add('error', 'TYPE_MISMATCH', `${n.id}.${port.id} ← ${label}：${compat.reason}`, n.id, port.id)
      }
    }
    for (const slot of def.slots) {
      const b = n.bindings[slot.id]
      if (!b || b.root !== 'self') {
        add('error', 'SLOT_UNBOUND', `${n.id} 的${slot.label}未绑定`, n.id, slot.id)
        continue
      }
      const scoped = attrs.find(({ attribute }) => attribute.id === b.propertyId)
      if (!scoped) {
        add('error', 'PROPERTY_NOT_IN_SCOPE', `${n.id} 绑定的 ${b.propertyId} 不属于作用域类型 ${program.scopeType}`, n.id, slot.id)
        continue
      }
      if (slot.kind === 'target' && scoped.attribute.writeMode !== 'contribution')
        add('error', 'TARGET_NOT_CONTRIBUTION', `${n.id} 的目标 ${b.propertyId}：${TARGET_REJECT[scoped.attribute.writeMode] ?? '不可写'}`, n.id, slot.id)
      if (slot.kind === 'readPreview' && scoped.attribute.writeMode !== 'contribution')
        add('error', 'PREVIEW_NOT_CONTRIBUTION', `${b.propertyId} 不是贡献写入属性，没有暂存视图`, n.id, slot.id)
    }
    if (n.type === 'Contribute') {
      const target = n.bindings.target
      const attr = target?.root === 'self' ? model.attributes.find((a) => a.id === target.propertyId) : undefined
      if (attr?.reducerRef && n.params.constraintRef !== refKey(attr.reducerRef))
        add('error', 'CONSTRAINT_MISMATCH', `${n.id} 的 constraintRef ${String(n.params.constraintRef)} 与属性 ${attr.id} 的归约规则 ${refKey(attr.reducerRef)} 不一致`, n.id)
    }
    if (n.type === 'ReadSelfPreview') {
      // 暂存可见时机由 after 控制边表达：必须排在对同一属性的 Contribute 之后。
      const read = n.bindings.property
      const before = upstreamNodes(program, n.id)
      const ordered = [...before].some((id) => {
        const up = nodes.get(id)
        const b = up?.bindings.target
        return up?.type === 'Contribute' && b?.root === 'self' && read?.root === 'self' && b.propertyId === read.propertyId
      })
      if (!ordered) add('warning', 'PREVIEW_WITHOUT_CONTRIBUTE', `${n.id} 的 after 没有接在对同一属性的 Contribute 之后，读到的暂存值等于 previous`, n.id, 'after')
    }
    if (n.type === 'Parameter' && !program.parameters.some((p) => p.id === n.params.parameterId))
      add('error', 'PARAMETER_UNKNOWN', `${n.id} 引用了未声明的程序参数 ${String(n.params.parameterId)}`, n.id)
    if (n.type === 'Constant' && typeof n.params.value !== 'number') add('error', 'CONSTANT_INVALID', `${n.id} 的常量值不是数字`, n.id)
  }
  if (!program.nodes.some((n) => n.type === 'Contribute')) add('warning', 'NO_EFFECT', '程序没有 Contribute 节点，执行后不会产生任何效果')
  return out
}

// ---------- 样本执行（单实体、单 System 的求值预览；不归约、不提交） ----------

export type EffectSample = { effect: string; propertyId: string; delta: number }
export type SampleValue = RawValue | EffectSample
export interface PortSample {
  portId: string
  value: SampleValue | undefined
  type?: TypeRef
  source: string
}
export interface NodeSample {
  nodeId: string
  type: string
  seq: number
  status: 'completed' | 'error'
  inputs: PortSample[]
  outputs: PortSample[]
  note?: string
}
export interface SampleRun {
  systemId: string
  entityId: string
  baseCommit: string
  nodes: NodeSample[]
  effects: Array<{ nodeId: string; propertyId: string; delta: number }>
  error?: string
}

export function isEffectSample(v: SampleValue | undefined): v is EffectSample {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && 'effect' in v
}

export function queryMatches(model: Pick<Model, 'queries' | 'scene' | 'baseWorld'>, queryRef: { id: string; version: string }): string[] {
  const q = model.queries.find((x) => x.id === queryRef.id && x.version === queryRef.version)
  if (!q) return []
  return model.scene.entities
    .filter((e) => e.typeId === q.typeId && model.baseWorld.values[e.id]?.[q.condition.propertyId] === q.condition.value)
    .map((e) => e.id)
    .sort()
}

export function evaluateSample(model: Model, program: LogicGraphDocument, system: SystemDefinition | null, entityId: string): SampleRun {
  const run: SampleRun = { systemId: system?.id ?? '（未绑定 System）', entityId, baseCommit: model.baseWorld.commitId, nodes: [], effects: [] }
  const order = topoOrder(program)
  if (!order) return { ...run, error: '程序图成环，无法求值' }
  const previous = model.baseWorld.values[entityId]
  if (!previous) return { ...run, error: `基础提交 ${model.baseWorld.commitId} 中没有实体 ${entityId}` }
  const values = new Map<string, SampleValue>()
  const fromSystem = (id: string) => Boolean(system && id in system.parameters)
  const paramValue = (id: string): RawValue | undefined => (system && id in system.parameters ? system.parameters[id] : program.parameters.find((p) => p.id === id)?.default)

  order.forEach((nodeId, index) => {
    const node = program.nodes.find((n) => n.id === nodeId)!
    const def = nodeTypeDef(node.type)
    const inputs: PortSample[] = (def?.inputs ?? []).map((port) => {
      const type = node.inputs[port.id]
      const [src] = inputSources(program, node.id, port.id)
      if (!src) return { portId: port.id, value: undefined, type, source: '无来源' }
      if (src.kind === 'edge') {
        const key = `${src.edge.source.nodeId}.${src.edge.source.portId}`
        return { portId: port.id, value: values.get(key), type, source: key }
      }
      if (src.kind === 'default') return { portId: port.id, value: src.value, type, source: '默认值' }
      const b = src.binding
      if (b.root === 'self') return { portId: port.id, value: previous[b.propertyId] ?? null, type, source: `self.${b.propertyId} @ ${model.baseWorld.commitId}` }
      if (b.root === 'parameter')
        return { portId: port.id, value: paramValue(b.parameterId), type, source: `参数 ${b.parameterId}${fromSystem(b.parameterId) ? `（${system!.id}）` : '（默认）'}` }
      return { portId: port.id, value: undefined, type, source: b.root }
    })
    const v = (id: string) => inputs.find((i) => i.portId === id)?.value
    const num = (id: string) => {
      const x = v(id)
      return typeof x === 'number' ? x : NaN
    }
    let outputs: Record<string, SampleValue> = {}
    let note: string | undefined
    switch (node.type) {
      case 'ReadPrevious': {
        const b = node.bindings.property
        if (b?.root === 'self') {
          outputs = { value: previous[b.propertyId] ?? null }
          note = `${entityId}.${b.propertyId} 在 ${model.baseWorld.commitId} 的 previous 值`
        }
        break
      }
      case 'ReadSelfPreview': {
        const b = node.bindings.property
        if (b?.root === 'self') {
          const base = previous[b.propertyId]
          const own = run.effects.filter((e) => e.propertyId === b.propertyId).reduce((s, e) => s + e.delta, 0)
          outputs = { value: typeof base === 'number' ? base + own : (base ?? null) }
          note = `previous ${String(base)} + 本 System 已提交的暂存 ${own}；其他 System 的暂存不可见`
        }
        break
      }
      case 'CoolingRoom':
        outputs = { room: Math.max(num('old') - num('source'), 0) }
        break
      case 'Min':
        outputs = { value: Math.min(num('a'), num('b')) }
        break
      case 'Negate':
        outputs = { delta: -num('value') }
        break
      case 'Constant':
        outputs = { value: node.params.value ?? null }
        break
      case 'Parameter': {
        const id = String(node.params.parameterId)
        outputs = { value: paramValue(id) ?? null }
        note = fromSystem(id) ? `由 ${system!.id} 传入` : '取参数默认值'
        break
      }
      case 'IsSome':
        outputs = { some: v('value') !== null && v('value') !== undefined }
        break
      case 'Contribute': {
        const b = node.bindings.target
        const delta = num('delta')
        if (b?.root === 'self' && Number.isFinite(delta)) {
          run.effects.push({ nodeId: node.id, propertyId: b.propertyId, delta })
          outputs = { effect: { effect: `${run.systemId}/${entityId}/${node.id}`, propertyId: b.propertyId, delta } }
          note = `请求贡献 ${delta} → ${b.propertyId}；获准值由 ${String(node.params.constraintRef)} 归约后决定`
        }
        break
      }
    }
    const outs: PortSample[] = Object.keys(node.outputs).map((portId) => ({ portId, value: outputs[portId], type: node.outputs[portId], source: node.id }))
    const missing = inputs.some((i) => i.value === undefined && def?.inputs.find((p) => p.id === i.portId)?.required)
    const nan = outs.some((o) => typeof o.value === 'number' && Number.isNaN(o.value))
    const status: NodeSample['status'] = missing || nan || !def?.available ? 'error' : 'completed'
    if (status === 'error') note = missing ? '有必需输入没有值' : nan ? '输入不是数值，无法计算' : (def?.unavailableReason ?? `未知物料 ${node.type}`)
    for (const o of outs) if (o.value !== undefined && !(typeof o.value === 'number' && Number.isNaN(o.value))) values.set(`${node.id}.${o.portId}`, o.value)
    run.nodes.push({ nodeId: node.id, type: node.type, seq: index + 1, status, inputs, outputs: outs, note })
  })
  return run
}
