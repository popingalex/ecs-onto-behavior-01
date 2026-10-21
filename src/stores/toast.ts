import { createId } from "@/lib/id"
import { createStore, useStore } from "@/lib/store"

/** 全局 toast 只做确认，不承担唯一错误解释。 */
export interface Toast {
  id: string
  message: string
  tone: "success" | "info" | "warning"
}

export const toastStore = createStore<{ toasts: Toast[] }>({ toasts: [] })

export function toast(message: string, tone: Toast["tone"] = "success") {
  const id = createId("toast")
  toastStore.setState((s) => ({
    toasts: [...s.toasts.slice(-3), { id, message, tone }],
  }))
  setTimeout(() => dismissToast(id), 3200)
}

export function dismissToast(id: string) {
  toastStore.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
}

export function useToasts() {
  return useStore(toastStore, (s) => s.toasts)
}
