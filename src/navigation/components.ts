import type { ComponentId } from "@/core/types"

/** 02_components.md 组件清单（ID 与 Figma 名称、egui 实现映射保持一致）。 */
export interface ComponentSpec {
  id: ComponentId
  name: string
  label: string
  owner: string
}

export const COMPONENT_SPECS: Record<ComponentId, ComponentSpec> = {
  C01: {
    id: "C01",
    name: "WorkspaceShell",
    label: "工作区外壳",
    owner: "布局 · egui_dock",
  },
  C02: {
    id: "C02",
    name: "ContextBar",
    label: "上下文栏",
    owner: "ContextStore",
  },
  C03: { id: "C03", name: "ObjectTree", label: "对象树", owner: "ObjectIndex" },
  C04: {
    id: "C04",
    name: "TypedValueCell",
    label: "类型化值单元",
    owner: "只格式化，不写 world",
  },
  C05: {
    id: "C05",
    name: "PropertyGrid",
    label: "属性表格",
    owner: "SchemaStore + DraftStore",
  },
  C06: {
    id: "C06",
    name: "ObjectLink",
    label: "对象链接",
    owner: "导航路由统一解析",
  },
  C07: {
    id: "C07",
    name: "GraphCanvas",
    label: "图画布",
    owner: "GraphDocument / 布局分离",
  },
  C08: {
    id: "C08",
    name: "NodeCard",
    label: "节点卡片",
    owner: "NodeDefinition 决定端口",
  },
  C09: {
    id: "C09",
    name: "BindingPicker",
    label: "绑定选择器",
    owner: "BindingService",
  },
  C10: {
    id: "C10",
    name: "ValidationList",
    label: "诊断列表",
    owner: "core diagnostics",
  },
  C11: {
    id: "C11",
    name: "EntityTable",
    label: "实体表",
    owner: "WorldSnapshot",
  },
  C12: {
    id: "C12",
    name: "SpatialViewport",
    label: "空间视口",
    owner: "Bevy 视图适配",
  },
  C13: {
    id: "C13",
    name: "RunControls",
    label: "运行控制",
    owner: "SessionStore / PlaybackStore",
  },
  C14: {
    id: "C14",
    name: "CommitSelector",
    label: "提交选择器",
    owner: "HistoryStore",
  },
  C15: {
    id: "C15",
    name: "ContributionTable",
    label: "贡献表",
    owner: "effectId 关联",
  },
  C16: {
    id: "C16",
    name: "TraceInspector",
    label: "轨迹检查器",
    owner: "TraceStore",
  },
  C17: {
    id: "C17",
    name: "PolicyStatus",
    label: "策略状态",
    owner: "PolicyStore",
  },
  C18: {
    id: "C18",
    name: "EventTimeline",
    label: "事件时间轴",
    owner: "EventStore",
  },
  C19: {
    id: "C19",
    name: "DiffTable",
    label: "差异表",
    owner: "ComparisonService",
  },
  C20: {
    id: "C20",
    name: "AsyncStatePanel",
    label: "异步状态面板",
    owner: "所有读组件共用",
  },
}
