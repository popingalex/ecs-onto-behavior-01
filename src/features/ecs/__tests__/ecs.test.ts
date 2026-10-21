import assert from "node:assert/strict"
import { baselineModel } from "@/data/mockLoader"
import type { PrototypeModel, SceneDraft } from "@/schema/model"
import { checkIntegrity } from "@/schema/parse"
import {
  effectiveComponents,
} from "@/schema/inheritance"
import { scopeAttributes } from "@/services/domainBindingService"
import { resolveInitialValue, valuesEqual } from "@/schema/values"
import type { SchemaContent } from "@/stores/modelDocuments"
import * as ops from "@/features/ecs/operations"
import {
  attributeRefs,
  componentRefs,
  entityTypeRefs,
  templateRefs,
} from "@/features/ecs/refs"

/** 行为测试：纯函数层，不碰 DraftRegistry（注册表一致性见 stores/__tests__/draftRegistry.test.ts）。 */
const fresh = () => baselineModel()

const schemaOf = (m: PrototypeModel): SchemaContent =>
  structuredClone({
    units: m.units,
    entityTypes: m.entityTypes,
    components: m.components,
    attributes: m.attributes,
    templates: m.templates,
  })

const withSchema = (m: PrototypeModel, s: SchemaContent): PrototypeModel => ({
  ...m,
  units: s.units,
  entityTypes: s.entityTypes,
  components: s.components,
  attributes: s.attributes,
  templates: s.templates,
})

const withScene = (m: PrototypeModel, scene: SceneDraft): PrototypeModel => ({
  ...m,
  scene,
})

const errors = (m: PrototypeModel) =>
  checkIntegrity(m).filter((d) => d.severity === "error")

export function attributeDeleteBlockedByReferences() {
  const model = fresh()
  const refs = attributeRefs(model, "thermal.temperature")
  const kinds = new Set(refs.map((r) => r.kind))
  assert.ok(
    refs.some((r) => r.kind === "entity" && r.id === "F01"),
    JSON.stringify(refs),
  )
  assert.ok(
    kinds.has("program") && kinds.has("system") && kinds.has("baseWorld"),
    JSON.stringify(refs),
  )
  // 查询条件引用：fire.active 被 q-fire 引用
  assert.ok(
    attributeRefs(model, "fire.active").some(
      (r) => r.kind === "query" && r.id === "q-fire",
    ),
  )
  // 引用位置带跳转路由（baseWorld 除外）
  for (const r of refs)
    if (r.kind !== "baseWorld") assert.ok(r.route, `${r.kind}:${r.id} 缺少路由`)

  const result = ops.deleteAttribute(
    model,
    schemaOf(model),
    "thermal.temperature",
  )
  assert.equal(result.ok, false)
  assert.ok(!result.ok && result.refs && result.refs.length === refs.length)
  assert.ok(!result.ok && result.message.includes("thermal.temperature"))
}

export function unreferencedAttributeLifecycle() {
  const model = fresh()
  let s = schemaOf(model)

  const c = ops.createComponent(s, { id: "Battery", label: "电池" })
  assert.ok(c.ok)
  s = c.ok ? c.content : s
  const a = ops.createAttribute(s, {
    componentId: "Battery",
    id: "battery.level",
    label: "电量",
    type: { primitive: "f64", shape: "scalar", nullable: false },
    default: 87.5,
    writeMode: "configuration",
  })
  assert.ok(a.ok, JSON.stringify(a))
  s = a.ok ? a.content : s
  assert.ok(
    s.components
      .find((x) => x.id === "Battery")!
      .propertyIds.includes("battery.level"),
  )
  assert.deepEqual(errors(withSchema(model, s)), [])

  // 重复 ID / 非法默认值 / 贡献写入缺归约都被拒绝
  assert.equal(
    ops.createAttribute(s, {
      componentId: "Battery",
      id: "battery.level",
      label: "",
      type: { primitive: "f64", shape: "scalar", nullable: false },
      default: 1,
      writeMode: "configuration",
    }).ok,
    false,
  )
  assert.equal(
    ops.createAttribute(s, {
      componentId: "Battery",
      id: "battery.bad",
      label: "",
      type: { primitive: "f64", shape: "scalar", nullable: false },
      default: null,
      writeMode: "configuration",
    }).ok,
    false,
  )
  assert.equal(
    ops.createAttribute(s, {
      componentId: "Battery",
      id: "battery.flow",
      label: "",
      type: { primitive: "f64", shape: "scalar", nullable: false },
      default: 1,
      writeMode: "contribution",
    }).ok,
    false,
  )

  // 无引用属性可删除，组件成员同步清理
  const d = ops.deleteAttribute(withSchema(model, s), s, "battery.level")
  assert.ok(d.ok, JSON.stringify(d))
  s = d.ok ? d.content : s
  assert.ok(!s.attributes.some((x) => x.id === "battery.level"))
  assert.deepEqual(
    s.components.find((x) => x.id === "Battery")!.propertyIds,
    [],
  )
  assert.deepEqual(errors(withSchema(model, s)), [])

  // 成员清空后组件可删除
  const dc = ops.deleteComponent(withSchema(model, s), s, "Battery")
  assert.ok(dc.ok, JSON.stringify(dc))
}

export function componentAndTypeDeleteBlocked() {
  const model = fresh()
  const s = schemaOf(model)

  const waterRefs = componentRefs(model, "Water")
  assert.ok(
    waterRefs.some((r) => r.kind === "attribute" && r.id === "water.remaining"),
  )
  assert.ok(
    waterRefs.some(
      (r) =>
        r.kind === "entityType" &&
        r.id === "FoamTruck" &&
        r.detail === "必需组件",
    ),
  )
  assert.ok(waterRefs.some((r) => r.kind === "template" && r.id === "tpl-foam"))
  assert.ok(waterRefs.some((r) => r.kind === "entity" && r.id === "V01"))
  assert.equal(ops.deleteComponent(model, s, "Water").ok, false)

  const fireRefs = entityTypeRefs(model, "Fire")
  assert.ok(fireRefs.some((r) => r.kind === "entity" && r.id === "F01"))
  assert.ok(fireRefs.some((r) => r.kind === "query" && r.id === "q-fire"))
  assert.ok(fireRefs.some((r) => r.kind === "program" && r.id === "g-cool"))
  assert.equal(ops.deleteEntityType(model, s, "Fire").ok, false)

  const tplRefs = templateRefs(model, "tpl-foam")
  assert.deepEqual(tplRefs.map((r) => r.id).sort(), ["V01", "V02"])
  assert.equal(ops.deleteTemplate(model, s, "tpl-foam").ok, false)
}

export function overrideLayeringIsolation() {
  const model = fresh()
  const v01 = model.scene.entities.find((e) => e.id === "V01")!
  const v02 = model.scene.entities.find((e) => e.id === "V02")!

  // 基线：V01 实例覆盖 5500，V02 实例覆盖 9000，容量都走模板 10000，属性默认 8000
  assert.deepEqual(resolveInitialValue(model, v01, "water.remaining"), {
    state: "value",
    value: 5500,
    source: "instance",
  })
  assert.deepEqual(resolveInitialValue(model, v02, "water.remaining"), {
    state: "value",
    value: 9000,
    source: "instance",
  })
  assert.deepEqual(resolveInitialValue(model, v01, "water.capacity"), {
    state: "value",
    value: 10000,
    source: "template",
  })

  // 修改 V01 实例水量：属性默认、模板覆盖、V02 都不受影响
  const r = ops.setEntityOverride(
    model,
    model.scene,
    "V01",
    "water.remaining",
    4200,
  )
  assert.ok(r.ok, JSON.stringify(r))
  const m2 = withScene(model, r.ok ? r.content : model.scene)
  assert.deepEqual(
    resolveInitialValue(
      m2,
      m2.scene.entities.find((e) => e.id === "V01")!,
      "water.remaining",
    ),
    { state: "value", value: 4200, source: "instance" },
  )
  assert.deepEqual(
    resolveInitialValue(
      m2,
      m2.scene.entities.find((e) => e.id === "V02")!,
      "water.remaining",
    ),
    { state: "value", value: 9000, source: "instance" },
  )
  assert.equal(
    m2.attributes.find((a) => a.id === "water.remaining")!.default,
    8000,
  )
  assert.equal(
    m2.templates.find((t) => t.id === "tpl-foam")!.overrides["water.remaining"],
    8000,
  )

  // 恢复继承：V01 回到模板覆盖（不是属性默认，也不是 0）
  const cleared = ops.clearEntityOverride(
    m2,
    m2.scene,
    "V01",
    "water.remaining",
  )
  assert.ok(cleared.ok)
  const m3 = withScene(m2, cleared.ok ? cleared.content : m2.scene)
  assert.deepEqual(
    resolveInitialValue(
      m3,
      m3.scene.entities.find((e) => e.id === "V01")!,
      "water.remaining",
    ),
    { state: "value", value: 8000, source: "template" },
  )

  // 不可空属性不能显式设 null；可空属性可以
  assert.equal(
    ops.setEntityOverride(model, model.scene, "V01", "water.remaining", null)
      .ok,
    false,
  )
  const nulled = ops.setEntityOverride(
    model,
    model.scene,
    "F01",
    "position.local",
    null,
  )
  assert.ok(nulled.ok)
  const m4 = withScene(model, nulled.ok ? nulled.content : model.scene)
  assert.deepEqual(
    resolveInitialValue(
      m4,
      m4.scene.entities.find((e) => e.id === "F01")!,
      "position.local",
    ),
    { state: "value", value: null, source: "instance" },
  )

  // 属性默认变化不影响已有实例覆盖（F01 保持 100）
  const s0 = schemaOf(model)
  const up = ops.updateAttribute(s0, "thermal.temperature", { default: 120 })
  assert.ok(up.ok)
  const m5 = withSchema(model, up.ok ? up.content : s0)
  assert.equal(
    m5.attributes.find((a) => a.id === "thermal.temperature")!.default,
    120,
  )
  assert.deepEqual(
    resolveInitialValue(
      m5,
      m5.scene.entities.find((e) => e.id === "F01")!,
      "thermal.temperature",
    ),
    { state: "value", value: 100, source: "instance" },
  )
}

export function nullPositionSemantics() {
  const model = fresh()
  const c01 = model.scene.entities.find((e) => e.id === "C01")!
  // 显式 null 位置：是有效值（未放置），不是缺失，也不是 [0,0,0]
  const p = resolveInitialValue(model, c01, "position.local")
  assert.deepEqual(p, { state: "value", value: null, source: "instance" })
  assert.ok(!valuesEqual(null, [0, 0, 0]))

  // [0,0,0] 是合法位置，不能当空
  const r = ops.setEntityOverride(
    model,
    model.scene,
    "C01",
    "position.local",
    [0, 0, 0],
  )
  assert.ok(r.ok, JSON.stringify(r))
  const m2 = withScene(model, r.ok ? r.content : model.scene)
  const p2 = resolveInitialValue(
    m2,
    m2.scene.entities.find((e) => e.id === "C01")!,
    "position.local",
  )
  assert.ok(p2.state === "value" && valuesEqual(p2.value, [0, 0, 0]))

  // 恢复继承后回到属性默认 null（Position 默认即 null），仍是有效“未设置”
  const cleared = ops.clearEntityOverride(m2, m2.scene, "C01", "position.local")
  assert.ok(cleared.ok)
  const m3 = withScene(m2, cleared.ok ? cleared.content : m2.scene)
  assert.deepEqual(
    resolveInitialValue(
      m3,
      m3.scene.entities.find((e) => e.id === "C01")!,
      "position.local",
    ),
    { state: "value", value: null, source: "default" },
  )
}

export function requiredComponentRemovalFails() {
  const model = fresh()
  // Thermal 是 Fire 的必需组件：移除报错
  const bad = ops.removeEntityComponent(model, model.scene, "F01", "Thermal")
  assert.equal(bad.ok, false)
  assert.ok(!bad.ok && bad.message.includes("必需"), JSON.stringify(bad))

  // Position 是可选组件：可移除，且其属性覆盖一并清理
  const good = ops.removeEntityComponent(model, model.scene, "F01", "Position")
  assert.ok(good.ok, JSON.stringify(good))
  const m2 = withScene(model, good.ok ? good.content : model.scene)
  const f01 = m2.scene.entities.find((e) => e.id === "F01")!
  assert.ok(
    !f01.componentInstances.some((ci) => ci.schemaRef.id === "Position"),
  )
  assert.ok(
    !Object.prototype.hasOwnProperty.call(
      f01.initialOverrides,
      "position.local",
    ),
  )
  // 未装配组件的属性不适用
  assert.deepEqual(resolveInitialValue(m2, f01, "position.local"), {
    state: "notApplicable",
  })
  assert.deepEqual(errors(m2), [])

  // 覆盖未装配组件的属性被拒绝
  assert.equal(
    ops.setEntityOverride(m2, m2.scene, "F01", "position.local", [1, 2, 3]).ok,
    false,
  )
}

export function createChainIntegrity() {
  const model = fresh()
  let s = schemaOf(model)

  const mk = <T>(r: ops.OpResult<T>): T => {
    assert.ok(r.ok, JSON.stringify(r))
    return r.ok ? r.content : undefined as never
  }

  // 组件 → 属性 → 类型 → 实体，链路可用且完整性干净
  s = mk(ops.createComponent(s, { id: "ThermalNew", label: "新热状态" }))
  s = mk(
    ops.createAttribute(s, {
      componentId: "ThermalNew",
      id: "thermalnew.temperature",
      label: "温度",
      type: {
        primitive: "f64",
        shape: "scalar",
        quantityKind: "temperatureAbsolute",
        unitId: "degC",
        nullable: false,
      },
      default: 100,
      writeMode: "configuration",
    }),
  )
  s = mk(ops.createEntityType(s, { id: "FireNew", label: "新火源" }))
  s = mk(ops.setEntityTypeComponent(s, "FireNew", "ThermalNew", "required"))
  let m = withSchema(model, s)
  const scene = mk(
    ops.createSceneEntity(m, structuredClone(model.scene), {
      id: "F20",
      label: "试验火源",
      typeId: "FireNew",
    }),
  )
  m = withScene(m, scene)
  assert.deepEqual(errors(m), [])
  assert.deepEqual(
    resolveInitialValue(
      m,
      m.scene.entities.find((e) => e.id === "F20")!,
      "thermalnew.temperature",
    ),
    { state: "value", value: 100, source: "default" },
  )

  // 引用存在时逐级阻止删除；按依赖逆序删除后全部可删
  assert.equal(ops.deleteComponent(m, s, "ThermalNew").ok, false)
  assert.equal(ops.deleteEntityType(m, s, "FireNew").ok, false)
  const scene2 = mk(ops.deleteSceneEntity(m, m.scene, "F20"))
  m = withScene(m, scene2)
  s = mk(ops.deleteEntityType(m, s, "FireNew"))
  m = withSchema(m, s)
  s = mk(ops.deleteAttribute(m, s, "thermalnew.temperature"))
  m = withSchema(m, s)
  s = mk(ops.deleteComponent(m, s, "ThermalNew"))
  m = withSchema(m, s)
  assert.deepEqual(errors(m), [])
}

/** parent 继承：子类型的有效装配叠加父链必需/可选组件；就近声明优先。 */
export function inheritanceAssemblyExpands() {
  const model = fresh()
  let s = schemaOf(model)
  const mk = <T>(r: ops.OpResult<T>): T => {
    assert.ok(r.ok, JSON.stringify(r))
    return r.ok ? r.content : undefined as never
  }

  // 父类型 VehicleBase：必需 Position、可选 Water；子类型 PatrolCar 继承它
  s = mk(ops.createEntityType(s, { id: "VehicleBase", label: "载具基座" }))
  s = mk(ops.setEntityTypeComponent(s, "VehicleBase", "Position", "required"))
  s = mk(ops.setEntityTypeComponent(s, "VehicleBase", "Water", "optional"))
  s = mk(ops.createEntityType(s, { id: "PatrolCar", label: "巡逻车" }))
  s = mk(ops.setEntityTypeComponent(s, "PatrolCar", "Thermal", "optional"))
  s = mk(ops.setEntityTypeParent(s, "PatrolCar", "VehicleBase"))

  const origins = effectiveComponents(s.entityTypes, "PatrolCar")
  assert.deepEqual(
    origins.map((o) => [o.componentId, o.mode, o.inheritedFrom]),
    [
      ["Thermal", "optional", null],
      ["Position", "required", "VehicleBase"],
      ["Water", "optional", "VehicleBase"],
    ],
  )
  // 就近声明优先：子类型自己声明可选 Position 时，覆盖父类的必需声明
  const sOverride = mk(
    ops.setEntityTypeComponent(s, "PatrolCar", "Position", "optional"),
  )
  const own = effectiveComponents(sOverride.entityTypes, "PatrolCar").find(
    (o) => o.componentId === "Position",
  )!
  assert.deepEqual([own.mode, own.inheritedFrom], ["optional", null])

  // 程序作用域属性包含继承来的组件属性
  const scoped = scopeAttributes(
    { attributes: model.attributes, entityTypes: s.entityTypes },
    "PatrolCar",
  )
  assert.ok(scoped.some((x) => x.attribute.id === "position.local"))
  assert.ok(scoped.some((x) => x.attribute.id === "water.remaining"))

  // 完整性：加 parent 之后种子链路仍无错误
  let m = withSchema(model, s)
  assert.deepEqual(errors(m), [])

  // 新建模板 / 实体：初始装配含继承来的必需组件 Position
  s = mk(
    ops.createTemplate(s, {
      id: "tpl-patrol",
      version: "1",
      label: "巡逻车模板",
      typeId: "PatrolCar",
    }),
  )
  const tpl = s.templates.find((t) => t.id === "tpl-patrol")!
  assert.ok(tpl.componentSchemaRefs.some((r) => r.id === "Position"))
  assert.ok(!tpl.componentSchemaRefs.some((r) => r.id === "Water"))
  m = withSchema(model, s)
  const scene = mk(
    ops.createSceneEntity(m, structuredClone(model.scene), {
      id: "P901",
      label: "巡逻车 1 号",
      typeId: "PatrolCar",
    }),
  )
  const p901 = scene.entities.find((e) => e.id === "P901")!
  assert.ok(p901.componentInstances.some((ci) => ci.schemaRef.id === "Position"))
  m = withScene(m, scene)
  assert.deepEqual(errors(m), [])

  // 继承来的必需组件不能从实体移除（报文标注继承来源）；继承来的可选组件可以移除
  const bad = ops.removeEntityComponent(m, m.scene, "P901", "Position")
  assert.equal(bad.ok, false)
  assert.ok(
    !bad.ok && bad.message.includes("继承自 VehicleBase"),
    JSON.stringify(bad),
  )
  const dropped = ops.addEntityComponent(m, m.scene, "P901", "Water")
  assert.ok(dropped.ok, JSON.stringify(dropped))
  const mWater = withScene(m, dropped.ok ? dropped.content : m.scene)
  const good = ops.removeEntityComponent(mWater, mWater.scene, "P901", "Water")
  assert.ok(good.ok, JSON.stringify(good))
}

/** 继承环：操作层拒绝自身/子孙作父；直接注入成环数据时 checkIntegrity 报 ONTOLOGY_CYCLE。 */
export function inheritanceCycleRejected() {
  const model = fresh()
  let s = schemaOf(model)
  const mk = <T>(r: ops.OpResult<T>): T => {
    assert.ok(r.ok, JSON.stringify(r))
    return r.ok ? r.content : undefined as never
  }
  s = mk(ops.createEntityType(s, { id: "BaseA", label: "A" }))
  s = mk(ops.createEntityType(s, { id: "ChildB", label: "B" }))
  s = mk(ops.createEntityType(s, { id: "GrandC", label: "C" }))

  // 不能继承自身
  const selfLoop = ops.setEntityTypeParent(s, "BaseA", "BaseA")
  assert.equal(selfLoop.ok, false)
  assert.ok(!selfLoop.ok && selfLoop.message.includes("自身"))

  // BaseA ← ChildB ← GrandC 之后，BaseA 不能继承自己的子孙
  s = mk(ops.setEntityTypeParent(s, "ChildB", "BaseA"))
  s = mk(ops.setEntityTypeParent(s, "GrandC", "ChildB"))
  assert.equal(ops.setEntityTypeParent(s, "BaseA", "GrandC").ok, false)
  assert.equal(ops.setEntityTypeParent(s, "BaseA", "ChildB").ok, false)
  // 父类型必须存在
  assert.equal(ops.setEntityTypeParent(s, "BaseA", "Ghost").ok, false)
  // 清掉 parent 后可以再设
  s = mk(ops.setEntityTypeParent(s, "GrandC", null))
  assert.equal(
    s.entityTypes.find((t) => t.id === "GrandC")!.parent ?? null,
    null,
  )
  s = mk(ops.setEntityTypeParent(s, "BaseA", "GrandC"))
  assert.deepEqual(errors(withSchema(model, s)), [])

  // 绕过操作层直接注入环：完整性检查报 ONTOLOGY_CYCLE 并定位
  const cycled = withSchema(model, s)
  cycled.entityTypes = cycled.entityTypes.map((t) =>
    t.id === "GrandC" ? { ...t, parent: "BaseA" } : t,
  )
  const diags = checkIntegrity(cycled).filter((d) => d.code === "ONTOLOGY_CYCLE")
  assert.ok(diags.length >= 1, JSON.stringify(checkIntegrity(cycled)))
  assert.ok(diags.every((d) => d.severity === "error"))
}

/** 删除被继承的父类型被阻止（子类型计入引用）；清除继承后可删。 */
export function inheritedParentDeleteBlocked() {
  const model = fresh()
  let s = schemaOf(model)
  const mk = <T>(r: ops.OpResult<T>): T => {
    assert.ok(r.ok, JSON.stringify(r))
    return r.ok ? r.content : undefined as never
  }
  s = mk(ops.createEntityType(s, { id: "BaseX", label: "基类 X" }))
  s = mk(ops.createEntityType(s, { id: "ChildY", label: "子类 Y" }))
  s = mk(ops.setEntityTypeParent(s, "ChildY", "BaseX"))
  const m = withSchema(model, s)

  const refs = entityTypeRefs(m, "BaseX")
  assert.ok(
    refs.some((r) => r.kind === "entityType" && r.id === "ChildY"),
    JSON.stringify(refs),
  )
  const blocked = ops.deleteEntityType(m, s, "BaseX")
  assert.equal(blocked.ok, false)
  assert.ok(!blocked.ok && blocked.message.includes("BaseX"))

  // 子类型改回无父后，父类型可删
  s = mk(ops.setEntityTypeParent(s, "ChildY", null))
  const freed = ops.deleteEntityType(withSchema(model, s), s, "BaseX")
  assert.ok(freed.ok, JSON.stringify(freed))
  s = freed.ok ? freed.content : s
  assert.deepEqual(errors(withSchema(model, s)), [])
}
