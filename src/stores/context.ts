import type { Role } from "@/core/types"
import { createStore, useStore } from "@/lib/store"

/**
 * ContextStore 中不由路由决定的部分：角色、执行者与连接状态。
 * 模式、版本、分支、viewCommit 都从路由派生（见 app/useWorkbenchContext）。
 */
interface ContextState {
  role: Role
  actorId: string
  actorName: string
  connection: "online" | "offline"
}

export const contextStore = createStore<ContextState>({
  role: "modeler",
  actorId: "u-lin",
  actorName: "林工",
  connection: "online",
})

export const ROLE_LABELS: Record<Role, string> = {
  modeler: "建模员",
  director: "导演",
  observer: "观察者",
}

export function setRole(role: Role) {
  contextStore.setState({ role })
}

export function toggleConnection() {
  contextStore.setState((s) => ({
    connection: s.connection === "online" ? "offline" : "online",
  }))
}

export function useRole() {
  return useStore(contextStore, (s) => s.role)
}

export function useConnection() {
  return useStore(contextStore, (s) => s.connection)
}

export function useActorName() {
  return useStore(contextStore, (s) => s.actorName)
}

export function canEdit(role: Role) {
  return role !== "observer"
}
