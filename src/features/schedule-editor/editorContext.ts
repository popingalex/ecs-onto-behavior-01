import { createContext, useContext } from "react"
import type { PrototypeModel } from "@/schema/model"

/** 节点卡片解析显示信息（System 定义、约束）与触发的页面级动作。 */
export interface ScheduleEditorApi {
  model: PrototypeModel
  readOnly: boolean
  /** 双击 System 节点：跳到 P14 对应程序。 */
  openProgram: (systemId: string) => void
  /** 节点上的启用 / 停用开关：改的是 SYSTEMS_DOC，不进调度文档的 undo。 */
  toggleSystem: (systemId: string) => void
}

export const ScheduleEditorContext = createContext<ScheduleEditorApi | null>(
  null,
)

export function useScheduleEditor(): ScheduleEditorApi {
  const api = useContext(ScheduleEditorContext)
  if (!api) throw new Error("ScheduleEditorContext 缺失")
  return api
}
