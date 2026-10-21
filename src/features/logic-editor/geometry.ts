import type { WorkflowPorts } from "@flowgram.ai/free-layout-editor"
import type { NodeTypeDef } from "@/services/domainBindingService"

/**
 * 节点卡片几何：注册表里的静态端口位置（locationConfig.top）与
 * LogicNodeCard 渲染的行高必须一致，二者都由这里的常量推导。
 */
export const NODE_WIDTH = 240
export const HEADER_HEIGHT = 38
export const SLOT_HEIGHT = 22
export const ROW_HEIGHT = 26
export const BOTTOM_PADDING = 8

export function nodeRowCount(def: NodeTypeDef): number {
  return Math.max(def.inputs.length, def.outputs.length)
}

export function portTop(def: NodeTypeDef, rowIndex: number): number {
  return (
    HEADER_HEIGHT +
    def.slots.length * SLOT_HEIGHT +
    rowIndex * ROW_HEIGHT +
    ROW_HEIGHT / 2
  )
}

export function nodeHeight(def: NodeTypeDef): number {
  return (
    HEADER_HEIGHT +
    def.slots.length * SLOT_HEIGHT +
    nodeRowCount(def) * ROW_HEIGHT +
    BOTTOM_PADDING
  )
}

/** 物料定义 → FlowGram 静态端口（端口集合随物料固定，重定型只改类型不改端口）。 */
export function defaultPortsOf(def: NodeTypeDef): WorkflowPorts {
  return [
    ...def.inputs.map((p, i) => ({
      portID: p.id,
      type: "input" as const,
      location: "left" as const,
      locationConfig: { left: 0, top: portTop(def, i) },
    })),
    ...def.outputs.map((p, j) => ({
      portID: p.id,
      type: "output" as const,
      location: "right" as const,
      locationConfig: { right: 0, top: portTop(def, j) },
    })),
  ]
}
