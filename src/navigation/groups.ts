import type { ContextKind, GroupId, PageId } from "@/core/types"

/** 全局功能栏只保留四个主入口；二级对象放进资源树。 */
export interface GroupSpec {
  id: GroupId
  label: string
  description: string
  shortcut: string
  defaultPage: PageId
  context: ContextKind
}

export const GROUPS: GroupSpec[] = [
  {
    id: "project",
    label: "项目",
    description: "项目总览与运行入口",
    shortcut: "Alt+1",
    defaultPage: "P01",
    context: "project",
  },
  {
    id: "modeling",
    label: "建模",
    description: "类型、组件、单位、模板与实体",
    shortcut: "Alt+2",
    defaultPage: "P02",
    context: "asset",
  },
  {
    id: "logic",
    label: "逻辑",
    description: "查询、system、编排与发布",
    shortcut: "Alt+3",
    defaultPage: "P12",
    context: "asset",
  },
  {
    id: "simulation",
    label: "推演",
    description: "运行编排、裁决、历史与复盘",
    shortcut: "Alt+4",
    defaultPage: "P20",
    context: "execution",
  },
]

export const GROUP_BY_ID = Object.fromEntries(
  GROUPS.map((g) => [g.id, g]),
) as Record<GroupId, GroupSpec>
