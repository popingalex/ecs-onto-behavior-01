import { applyDraftCommand } from '@/stores/draft'
import { contextStore } from '@/stores/context'
import { toast } from '@/stores/toast'

/**
 * CommandBus：组件事件 → 权限/上下文检查 → DraftStore 或运行命令服务。
 * 禁止组件直接修改已提交世界。
 */
export type DraftInput = { type: string; label: string; targetId: string; patch: Record<string, unknown> }

export const commandBus = {
  draft(input: DraftInput): boolean {
    if (contextStore.getState().role === 'observer') {
      toast('观察者为只读角色，修改未写入草稿', 'warning')
      return false
    }
    applyDraftCommand(input)
    return true
  },
}
