import type { RunCommand } from "@/core/types"
import { createId } from "@/lib/id"
import { createStore, useStore } from "@/lib/store"

/** 运行命令生命周期（P21 展示）。同一幂等键在未结束前只登记一次。 */
export const commandQueueStore = createStore<{ commands: RunCommand[] }>({
  commands: [],
})

export function enqueueRunCommand(
  input: Omit<RunCommand, "commandId" | "status" | "createdAt">,
): RunCommand {
  const existing = commandQueueStore
    .getState()
    .commands.find(
      (c) =>
        c.idempotencyKey === input.idempotencyKey &&
        (c.status === "pending" || c.status === "accepted"),
    )
  if (existing) return existing
  const command: RunCommand = {
    ...input,
    commandId: createId("cmd"),
    status: "pending",
    createdAt: Date.now(),
  }
  commandQueueStore.setState((s) => ({ commands: [command, ...s.commands] }))
  return command
}

export function updateRunCommand(
  commandId: string,
  patch: Partial<RunCommand>,
) {
  commandQueueStore.setState((s) => ({
    commands: s.commands.map((c) =>
      c.commandId === commandId ? { ...c, ...patch } : c,
    ),
  }))
}

export function useRunCommands() {
  return useStore(commandQueueStore, (s) => s.commands)
}
