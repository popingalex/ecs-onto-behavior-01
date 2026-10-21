import assert from "node:assert/strict"
import { baselineModel } from "@/data/mockLoader"
import { resolveInitialValue, valuesEqual } from "@/schema/values"
import {
  createSceneTemplateFromScene,
  instantiateSceneTemplate,
  placeNewEntity,
  sceneSpatialItems,
  setEntityPosition,
  spatialCounts,
} from "../assembly"

/** P07 装配 / 位置编辑与 P06 场景模板：纯函数层，不碰 DraftRegistry。 */

export function positionEditWritesSceneDraft() {
  const model = baselineModel()

  // F01 从 [320,180,0] 移动到原点：原点合法，实体继续可见
  const moved = setEntityPosition(model, model.scene, "F01", [0, 0, 0])
  assert.ok(moved.ok, JSON.stringify(moved))
  const scene = moved.ok ? moved.content : model.scene
  const f01 = scene.entities.find((e) => e.id === "F01")!
  assert.ok(valuesEqual(f01.initialOverrides["position.local"], [0, 0, 0]))
  assert.deepEqual(resolveInitialValue(model, f01, "position.local"), {
    state: "value",
    value: [0, 0, 0],
    source: "instance",
  })
  const item = sceneSpatialItems({ ...model, scene }).find(
    (i) => i.id === "F01",
  )!
  assert.ok(item.position !== null && valuesEqual(item.position, [0, 0, 0]))

  // 清空位置 = 显式 null：实体保留在草稿里，但不再出现在空间计数中
  const cleared = setEntityPosition(model, scene, "F01", null)
  assert.ok(cleared.ok, JSON.stringify(cleared))
  const scene2 = cleared.ok ? cleared.content : scene
  const counts = spatialCounts({ ...model, scene: scene2 })
  assert.deepEqual(counts, { logical: 6, placed: 4 })

  // 非有限坐标与未装配 Position 的实体被拒绝
  assert.equal(
    setEntityPosition(model, model.scene, "F01", [Number.NaN, 0, 0]).ok,
    false,
  )
  assert.equal(
    setEntityPosition(model, model.scene, "F01", [
      0,
      Number.POSITIVE_INFINITY,
      0,
    ]).ok,
    false,
  )
  const noPosition = {
    ...model.scene,
    entities: model.scene.entities.map((e) =>
      e.id === "F01"
        ? {
            ...e,
            componentInstances: e.componentInstances.filter(
              (ci) => ci.schemaRef.id !== "Position"
            ),
          }
        : e,
    ),
  }
  const rejected = setEntityPosition(model, noPosition, "F01", [1, 2, 3])
  assert.equal(rejected.ok, false)
  assert.ok(!rejected.ok && rejected.message.includes("Position"))
}

export function spatialItemsKeepUnplacedEntity() {
  const model = baselineModel()
  const items = sceneSpatialItems(model)
  // C01 无位置：逻辑保留，视图不绘制（position = null），但仍可选中追溯
  const c01 = items.find((i) => i.id === "C01")!
  assert.equal(c01.position, null)
  assert.equal(c01.kind, "command")
  assert.deepEqual(spatialCounts(model), { logical: 6, placed: 5 })
}

export function placeNewEntityAssemblesOptionalPosition() {
  const model = baselineModel()
  // 裸类型放置：Fire 的 Position 是可选组件，放置时自动装配并写入落点
  const placed = placeNewEntity(model, model.scene, {
    id: "F04",
    label: "",
    typeId: "Fire",
    position: [100, 50, 0],
  })
  assert.ok(placed.ok, JSON.stringify(placed))
  const scene = placed.ok ? placed.content : model.scene
  const f04 = scene.entities.find((e) => e.id === "F04")!
  assert.ok(f04.componentInstances.some((ci) => ci.schemaRef.id === "Position"))
  assert.ok(valuesEqual(f04.initialOverrides["position.local"], [100, 50, 0]))
  assert.deepEqual(spatialCounts({ ...model, scene }), { logical: 7, placed: 6 })

  // 类型完全没有 Position 时整体失败，不留半成品实体
  const noPos = {
    ...model,
    entityTypes: model.entityTypes.map((t) =>
      t.id === "Command" ? { ...t, optionalComponentIds: [] } : t,
    ),
  }
  const rejected = placeNewEntity(noPos, model.scene, {
    id: "C02",
    label: "",
    typeId: "Command",
    position: [0, 0, 0],
  })
  assert.equal(rejected.ok, false)
  assert.ok(!rejected.ok && rejected.message.includes("Position"))
  assert.ok(!model.scene.entities.some((e) => e.id === "C02"))
}

export function sceneTemplateRoundTrip() {
  const model = baselineModel()
  const created = createSceneTemplateFromScene(
    model.scene,
    { id: "tpl-park", label: "园区场景模板" },
    () => false,
    "2026-10-21T00:00:00.000Z",
  )
  assert.ok(created.ok, JSON.stringify(created))
  const tpl = created.ok ? created.content : null
  assert.ok(tpl)
  assert.equal(tpl!.version, "s1")
  assert.equal(tpl!.sourceSceneId, "scene-05")
  assert.equal(tpl!.roles.length, 6)
  const v01 = tpl!.roles.find((r) => r.roleId === "V01")!
  assert.equal(v01.templateRef?.id, "tpl-foam")
  assert.equal(v01.overrides["water.remaining"], 5500)

  // 空模板不能实例化
  const empty = instantiateSceneTemplate(model, model.scene, {
    ...tpl!,
    roles: [],
  })
  assert.equal(empty.ok, false)

  // 实例化：生成全新 entityId（不复用角色 id），覆盖逐项生效
  const placed = instantiateSceneTemplate(model, model.scene, tpl!)
  assert.ok(placed.ok, JSON.stringify(placed))
  const scene = placed.ok ? placed.content : model.scene
  assert.equal(scene.entities.length, 12)
  const newIds = scene.entities
    .slice(6)
    .map((e) => e.id)
  assert.ok(newIds.every((id) => !tpl!.roles.some((r) => r.roleId === id)))
  // 新泡沫车沿用 tpl-foam 模板：容量走模板默认 10000，水量是角色快照 5500/9000
  const trucks = scene.entities.slice(6).filter((e) => e.typeId === "FoamTruck")
  assert.equal(trucks.length, 2)
  for (const t of trucks) {
    assert.equal(t.templateRef?.id, "tpl-foam")
    assert.deepEqual(resolveInitialValue(model, t, "water.capacity"), {
      state: "value",
      value: 10000,
      source: "template",
    })
  }
  assert.ok(
    valuesEqual(
      trucks[0].initialOverrides["water.remaining"] as never,
      5500 as never,
    ),
  )
  // 无模板角色（C01）的可选组件装配也被还原：新指挥单元带 Position 且未放置
  const newCommand = scene.entities.slice(6).find((e) => e.typeId === "Command")!
  assert.ok(
    newCommand.componentInstances.some((ci) => ci.schemaRef.id === "Position"),
  )
  assert.deepEqual(resolveInitialValue(model, newCommand, "position.local"), {
    state: "value",
    value: null,
    source: "instance",
  })
  // 源场景实体不被实例化修改
  assert.equal(
    model.scene.entities.find((e) => e.id === "V01")!
      .initialOverrides["water.remaining"],
    5500,
  )
}

export function sceneTemplateIdValidation() {
  const model = baselineModel()
  assert.equal(
    createSceneTemplateFromScene(
      model.scene,
      { id: "", label: "" },
      () => false,
      "2026-10-21T00:00:00.000Z",
    ).ok,
    false,
  )
  assert.equal(
    createSceneTemplateFromScene(
      model.scene,
      { id: "9bad", label: "" },
      () => false,
      "2026-10-21T00:00:00.000Z",
    ).ok,
    false,
  )
  assert.equal(
    createSceneTemplateFromScene(
      model.scene,
      { id: "tpl-park", label: "" },
      () => true,
      "2026-10-21T00:00:00.000Z",
    ).ok,
    false,
  )
}
