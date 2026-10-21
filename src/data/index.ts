import type {
  AssetDef,
  BundleDef,
  ClassDef,
  ComponentDef,
  EntityDef,
  NamedDef,
  PropertyDef,
  QuantityKind,
  QueryDef,
  RunDef,
  SystemDef,
  TemplateDef,
  UnitDef,
  VersionedAsset,
  WorldSnapshot,
} from "@/core/types"
import type { SeedData } from "@/mock/seed"

/**
 * 规范化索引：JSON/API → 索引 → 页面 selector → ViewModel → 组件。
 * 模式层与静态资产不可变；运行历史（分支/提交）的可变部分在 stores/history。
 */
export interface WorkbenchIndex {
  project: SeedData["project"]
  quantities: Map<string, QuantityKind>
  units: Map<string, UnitDef>
  components: Map<string, ComponentDef>
  properties: Map<string, PropertyDef>
  classes: Map<string, ClassDef>
  templates: Map<string, TemplateDef>
  sceneTemplates: Map<string, VersionedAsset>
  scenes: Map<string, VersionedAsset>
  assets: Map<string, AssetDef>
  entities: Map<string, EntityDef>
  queries: Map<string, QueryDef>
  graphs: Map<string, VersionedAsset>
  systems: Map<string, SystemDef>
  schedules: Map<string, NamedDef>
  constraints: Map<string, NamedDef>
  policies: Map<string, VersionedAsset>
  tasks: Map<string, NamedDef>
  events: Map<string, NamedDef>
  bundles: Map<string, BundleDef>
  runs: Map<string, RunDef>
  worlds: Map<string, WorldSnapshot>
  propertiesByComponent: Map<string, PropertyDef[]>
  /** 保留原始种子，供历史 store 初始化。 */
  seed: SeedData
}

function byId<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]))
}

export function buildIndex(seed: SeedData): WorkbenchIndex {
  const propertiesByComponent = new Map<string, PropertyDef[]>()
  for (const property of seed.properties) {
    const list = propertiesByComponent.get(property.componentId) ?? []
    list.push(property)
    propertiesByComponent.set(property.componentId, list)
  }
  return {
    project: seed.project,
    quantities: byId(seed.quantities),
    units: byId(seed.units),
    components: byId(seed.components),
    properties: byId(seed.properties),
    classes: byId(seed.classes),
    templates: byId(seed.templates),
    sceneTemplates: byId(seed.sceneTemplates),
    scenes: byId(seed.scenes),
    assets: byId(seed.assets),
    entities: byId(seed.entities),
    queries: byId(seed.queries),
    graphs: byId(seed.graphs),
    systems: byId(seed.systems),
    schedules: byId(seed.schedules),
    constraints: byId(seed.constraints),
    policies: byId(seed.policies),
    tasks: byId(seed.tasks),
    events: byId(seed.events),
    bundles: byId(seed.bundles),
    runs: byId(seed.runs),
    worlds: new Map(seed.worlds.map((world) => [world.commitId, world])),
    propertiesByComponent,
    seed,
  }
}
