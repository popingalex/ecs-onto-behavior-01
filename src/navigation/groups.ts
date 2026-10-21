import type { ContextKind, GroupId, PageId } from "@/core/types"

/** 全局功能栏只保留六个主入口；二级对象放进资源树。 */
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
    description: "项目总览与入口",
    shortcut: "Alt+1",
    defaultPage: "P01",
    context: "project",
  },
  {
    id: "modeling",
    label: "建模",
    description: "类型、组件、单位与模板",
    shortcut: "Alt+2",
    defaultPage: "P02",
    context: "asset",
  },
  {
    id: "scene",
    label: "场景",
    description: "场景装配、实体与资产",
    shortcut: "Alt+3",
    defaultPage: "P07",
    context: "asset",
  },
  {
    id: "logic",
    label: "逻辑",
    description: "查询、system、调度与发布",
    shortcut: "Alt+4",
    defaultPage: "P12",
    context: "asset",
  },
  {
    id: "run",
    label: "运行",
    description: "演练运行、调试与裁决",
    shortcut: "Alt+5",
    defaultPage: "P20",
    context: "execution",
  },
  {
    id: "review",
    label: "复盘",
    description: "来源、事件、历史与分支对比",
    shortcut: "Alt+6",
    defaultPage: "P26",
    context: "execution",
  },
]

export const GROUP_BY_ID = Object.fromEntries(
  GROUPS.map((g) => [g.id, g]),
) as Record<GroupId, GroupSpec>
