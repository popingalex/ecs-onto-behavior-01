import type { Route } from "@/core/types"
import type { PrototypeModel } from "@/schema/model"

/**
 * 引用扫描：删除 schema / 场景对象前，枚举整个组装模型里仍指向它的位置。
 * 有引用则拒绝删除并把位置交给 UI 展示（Diagnostic / 列表 + 跳转）。
 */
export interface RefHit {
  kind: "component" | "entityType" | "template" | "entity" | "query" | "program" | "system" | "attribute" | "schedule" | "baseWorld"
  id: string
  label: string
  detail: string
  route?: Route
}

const selfProp = (propertyId: string) => `self.${propertyId}`

/** 属性被谁引用：组件成员关系以外的所有可达位置（成员关系由删除操作自行清理）。 */
export function attributeRefs(
  model: PrototypeModel,
  attributeId: string,
): RefHit[] {
  const hits: RefHit[] = []
  for (const t of model.templates)
    if (Object.prototype.hasOwnProperty.call(t.overrides, attributeId))
      hits.push({
        kind: "template",
        id: t.id,
        label: t.label,
        detail: `模板覆盖 ${attributeId}`,
        route: { pageId: "P05", params: { templateId: t.id } },
      })
  for (const e of model.scene.entities)
    if (Object.prototype.hasOwnProperty.call(e.initialOverrides, attributeId))
      hits.push({
        kind: "entity",
        id: e.id,
        label: e.label,
        detail: `实例初值覆盖 ${attributeId}`,
        route: { pageId: "P08", params: { entityId: e.id } },
      })
  for (const q of model.queries)
    if (q.condition.propertyId === attributeId)
      hits.push({
        kind: "query",
        id: q.id,
        label: q.id,
        detail: `查询条件 ${attributeId} = ${String(q.condition.value)}`,
        route: { pageId: "P10", params: { queryId: q.id } },
      })
  for (const p of model.programs)
    for (const n of p.nodes)
      for (const b of Object.values(n.bindings))
        if (
          (b.root === "self" || b.root === "relation") &&
          b.propertyId === attributeId
        )
          hits.push({
            kind: "program",
            id: p.id,
            label: p.id,
            detail: `节点 ${n.id} 绑定 ${
              b.root === "self" ? "自身" : "关系"
            }属性 ${attributeId}`,
            route: { pageId: "P14", params: { graphId: p.id, nodeId: n.id } },
          })
  for (const s of model.systems) {
    const uses = [
      ...s.access.readPrevious,
      ...s.access.contribute,
      ...s.access.exclusive,
    ].filter((a) => a === selfProp(attributeId))
    if (uses.length)
      hits.push({
        kind: "system",
        id: s.id,
        label: s.label,
        detail: `读写访问 ${uses.join("、")}`,
        route: { pageId: "P11", params: { systemId: s.id } },
      })
  }
  for (const [entityId, values] of Object.entries(model.baseWorld.values))
    if (Object.prototype.hasOwnProperty.call(values, attributeId))
      hits.push({
        kind: "baseWorld",
        id: model.baseWorld.commitId,
        label: `基础世界 ${model.baseWorld.commitId}`,
        detail: `${entityId}.${attributeId} 有已提交值`,
      })
  return hits
}

/** 组件被谁引用：成员属性、类型装配、模板装配、实体实例。 */
export function componentRefs(
  model: PrototypeModel,
  componentId: string,
): RefHit[] {
  const hits: RefHit[] = []
  for (const a of model.attributes)
    if (a.componentId === componentId)
      hits.push({
        kind: "attribute",
        id: a.id,
        label: a.label,
        detail: "组件成员属性",
        route: { pageId: "P29", params: { attributeId: a.id } },
      })
  for (const t of model.entityTypes) {
    if (t.requiredComponentIds.includes(componentId))
      hits.push({
        kind: "entityType",
        id: t.id,
        label: t.label,
        detail: "必需组件",
        route: { pageId: "P02", params: { classId: t.id } },
      })
    else if (t.optionalComponentIds.includes(componentId))
      hits.push({
        kind: "entityType",
        id: t.id,
        label: t.label,
        detail: "可选组件",
        route: { pageId: "P02", params: { classId: t.id } },
      })
  }
  for (const t of model.templates)
    if (t.componentSchemaRefs.some((r) => r.id === componentId))
      hits.push({
        kind: "template",
        id: t.id,
        label: t.label,
        detail: "模板装配的组件",
        route: { pageId: "P05", params: { templateId: t.id } },
      })
  for (const e of model.scene.entities)
    if (e.componentInstances.some((ci) => ci.schemaRef.id === componentId))
      hits.push({
        kind: "entity",
        id: e.id,
        label: e.label,
        detail: "实体装配的组件实例",
        route: { pageId: "P08", params: { entityId: e.id } },
      })
  return hits
}

/** 实体类型被谁引用：子类型（parent 继承）、模板、场景实体、查询、程序作用域。 */
export function entityTypeRefs(
  model: PrototypeModel,
  typeId: string,
): RefHit[] {
  const hits: RefHit[] = []
  for (const t of model.entityTypes)
    if (t.parent === typeId)
      hits.push({
        kind: "entityType",
        id: t.id,
        label: t.label,
        detail: "子类型（parent 继承该类型）",
        route: { pageId: "P02", params: { classId: t.id } },
      })
  for (const t of model.templates)
    if (t.typeId === typeId)
      hits.push({
        kind: "template",
        id: t.id,
        label: t.label,
        detail: "模板的实体类型",
        route: { pageId: "P05", params: { templateId: t.id } },
      })
  for (const e of model.scene.entities)
    if (e.typeId === typeId)
      hits.push({
        kind: "entity",
        id: e.id,
        label: e.label,
        detail: "场景实体的类型",
        route: { pageId: "P08", params: { entityId: e.id } },
      })
  for (const q of model.queries)
    if (q.typeId === typeId)
      hits.push({
        kind: "query",
        id: q.id,
        label: q.id,
        detail: "查询的目标类型",
        route: { pageId: "P10", params: { queryId: q.id } },
      })
  for (const p of model.programs)
    if (p.scopeType === typeId)
      hits.push({
        kind: "program",
        id: p.id,
        label: p.id,
        detail: "程序作用域类型",
        route: { pageId: "P14", params: { graphId: p.id } },
      })
  return hits
}

/** 模板被谁引用：场景实体的 templateRef（按 id 匹配，版本变化不影响阻止）。 */
export function templateRefs(
  model: PrototypeModel,
  templateId: string,
): RefHit[] {
  return model.scene.entities
    .filter((e) => e.templateRef?.id === templateId)
    .map((e) => ({
      kind: "entity" as const,
      id: e.id,
      label: e.label,
      detail: `实体使用模板 ${e.templateRef!.id}@${e.templateRef!.version}`,
      route: { pageId: "P08", params: { entityId: e.id } },
    }))
}

/** 实体查询被谁引用：System 的 queryRef（按 id 匹配，版本变化不影响阻止）。 */
export function queryRefs(model: PrototypeModel, queryId: string): RefHit[] {
  return model.systems
    .filter((s) => s.queryRef.id === queryId)
    .map((s) => ({
      kind: "system" as const,
      id: s.id,
      label: s.label,
      detail: `System 的实体查询 ${s.queryRef.id}@${s.queryRef.version}`,
      route: { pageId: "P11", params: { systemId: s.id } },
    }))
}

/** System 被谁引用：调度文档里的 SystemNode（按 systemRef 匹配）。 */
export function systemRefs(model: PrototypeModel, systemId: string): RefHit[] {
  const hits: RefHit[] = []
  for (const sch of model.schedules)
    for (const n of sch.nodes)
      if (n.type === "SystemNode" && n.systemRef === systemId)
        hits.push({
          kind: "system",
          id: sch.id,
          label: `调度 ${sch.id}@${sch.version}`,
          detail: `调度节点 ${n.id} 引用该 System`,
          route: { pageId: "P12", params: { scheduleId: sch.id } },
        })
  return hits
}

/** 场景实体被谁引用：EntityRef 类型的覆盖值与基础世界值。 */
export function entityRefs(model: PrototypeModel, entityId: string): RefHit[] {  const hits: RefHit[] = []
  const entityRefProps = new Set(
    model.attributes
      .filter((a) => a.type.primitive === "EntityRef")
      .map((a) => a.id),
  )
  if (entityRefProps.size === 0) return hits
  for (const t of model.templates)
    for (const [pid, v] of Object.entries(t.overrides))
      if (entityRefProps.has(pid) && v === entityId)
        hits.push({
          kind: "template",
          id: t.id,
          label: t.label,
          detail: `模板覆盖 ${pid} 指向该实体`,
          route: { pageId: "P05", params: { templateId: t.id } },
        })
  for (const e of model.scene.entities)
    for (const [pid, v] of Object.entries(e.initialOverrides))
      if (entityRefProps.has(pid) && v === entityId)
        hits.push({
          kind: "entity",
          id: e.id,
          label: e.label,
          detail: `实例初值 ${pid} 指向该实体`,
          route: { pageId: "P08", params: { entityId: e.id } },
        })
  return hits
}

/** 单位被谁引用：属性类型、程序参数与节点端口类型（按 id 匹配）。 */
export function unitRefs(model: PrototypeModel, unitId: string): RefHit[] {
  const hits: RefHit[] = []
  for (const a of model.attributes)
    if (a.type.unitId === unitId)
      hits.push({
        kind: "attribute",
        id: a.id,
        label: a.label,
        detail: `属性类型的单位 ${unitId}`,
        route: { pageId: "P29", params: { attributeId: a.id } },
      })
  for (const p of model.programs) {
    for (const param of p.parameters)
      if (param.type.unitId === unitId)
        hits.push({
          kind: "program",
          id: p.id,
          label: p.id,
          detail: `程序参数 ${param.id} 的单位`,
          route: { pageId: "P14", params: { graphId: p.id } },
        })
    for (const n of p.nodes)
      for (const [portId, t] of [
        ...Object.entries(n.inputs),
        ...Object.entries(n.outputs),
      ])
        if (t.unitId === unitId)
          hits.push({
            kind: "program",
            id: p.id,
            label: p.id,
            detail: `节点 ${n.id} 端口 ${portId} 的单位`,
            route: { pageId: "P14", params: { graphId: p.id, nodeId: n.id } },
          })
  }
  return hits
}

/** 约束被谁引用：属性归约契约、调度 Reducer/Contract 节点、Contribute 节点参数。 */
export function constraintRefs(
  model: PrototypeModel,
  constraintId: string,
): RefHit[] {
  const hits: RefHit[] = []
  for (const a of model.attributes)
    if (a.reducerRef?.id === constraintId)
      hits.push({
        kind: "attribute",
        id: a.id,
        label: a.label,
        detail: `归约契约 ${a.reducerRef.id}@${a.reducerRef.version}`,
        route: { pageId: "P29", params: { attributeId: a.id } },
      })
  for (const sch of model.schedules)
    for (const n of sch.nodes)
      if (
        (n.type === "ReducerNode" || n.type === "ContractNode") &&
        n.constraintRef.id === constraintId
      )
        hits.push({
          kind: "schedule",
          id: sch.id,
          label: `调度 ${sch.id}@${sch.version}`,
          detail: `${n.type === "ReducerNode" ? "归约" : "契约"}节点 ${n.id} 引用该约束`,
          route: { pageId: "P12", params: { scheduleId: sch.id } },
        })
  for (const p of model.programs)
    for (const n of p.nodes)
      if (
        typeof n.params.constraintRef === "string" &&
        (n.params.constraintRef as string).startsWith(`${constraintId}@`)
      )
        hits.push({
          kind: "program",
          id: p.id,
          label: p.id,
          detail: `节点 ${n.id} 的 constraintRef 参数`,
          route: { pageId: "P14", params: { graphId: p.id, nodeId: n.id } },
        })
  return hits
}
