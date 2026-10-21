import type { ScheduleDocument } from "@/schema/model"

/** P12 路由聚焦：systemId 参数 → 画布上的 SystemNode 节点 id（找不到为 null，不静默落到别的节点）。 */
export function systemNodeForFocus(
  schedule: ScheduleDocument,
  systemId: string | undefined,
): string | null {
  if (!systemId) return null
  const node = schedule.nodes.find(
    (n) => n.type === "SystemNode" && n.systemRef === systemId,
  )
  return node?.id ?? null
}
