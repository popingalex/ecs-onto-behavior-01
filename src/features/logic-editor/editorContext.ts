import { createContext, useContext } from "react"

/** 节点库拖入画布的 dataTransfer 类型。 */
export const LOGIC_NODE_MIME = "application/x-logic-node"

/** 画布 / 节点卡片 / 节点表单共享的编辑器动作；实现集中在 LogicEditor。 */
export interface LogicEditorApi {
  programId: string
  readOnly: boolean
  /** 打开 P15 为输入端口选来源；确认后由这里写一次 bindInput / connect。 */
  openInputPicker: (nodeId: string, portId: string) => void
  /** 打开 P15 为槽位（属性 / 目标属性）选绑定。 */
  openSlotPicker: (nodeId: string, slotId: string) => void
  /** 请求画布选中并聚焦一个节点（诊断定位用）。 */
  focusNode: (nodeId: string) => void
}

export const LogicEditorContext = createContext<LogicEditorApi | null>(null)

export function useLogicEditor(): LogicEditorApi {
  const api = useContext(LogicEditorContext)
  if (!api) throw new Error("LogicEditorContext 缺失")
  return api
}
