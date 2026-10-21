import { Inbox } from "lucide-react"
import type { RunCommandStatus } from "@/core/types"
import Button from "@/components/ui/Button"
import { Tag } from "@/components/ui/StatusTag"
import { Drawer } from "@/components/ui/Modal"
import type { Route } from "@/core/types"
import { closeOverlay } from "@/router/router"
import { useRunCommands } from "@/stores/commandQueue"

const STATUS: Record<RunCommandStatus, {
  label: string
  tone: "neutral" | "primary" | "success" | "danger"
}> = {
  pending: { label: "待处理", tone: "neutral" },
  accepted: { label: "已接受", tone: "primary" },
  applied: { label: "已生效", tone: "success" },
  rejected: { label: "已拒绝", tone: "danger" },
}

/** P21 运行命令队列（抽屉）：命令生命周期与幂等键；关闭后回到触发点。 */
export default function P21CommandQueue({ route }: { route: Route }) {
  const commands = useRunCommands()
  const list = [...commands].reverse()
  return (
    <Drawer
      title="运行命令队列"
      subtitle={
        route.params.baseCommit ? (
          <span className="font-mono">基准 {route.params.baseCommit}</span>
        ) : undefined
      }
      onClose={() => closeOverlay({ kind: "cancel" })}
      footer={
        <Button
          intent="secondary"
          onClick={() => closeOverlay({ kind: "cancel" })}
        >
          关闭
        </Button>
      }
    >
      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
          <Inbox size={22} className="text-faint" aria-hidden />
          <p className="text-body font-medium">暂无运行命令</p>
          <p className="text-label text-muted">
            在演练运行工作台点击“推算下一回合”后，命令会以幂等键进入队列。
          </p>
          {route.params.commandType ? (
            <p className="mt-2 text-caption text-muted">
              请求的命令类型{" "}
              <span className="font-mono">{route.params.commandType}</span>{" "}
              尚未接入创建表单。
            </p>
          ) : null}
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {list.map((c) => (
            <li key={c.commandId} className="px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="font-medium">{c.type}</span>
                <Tag size="sm" tone={STATUS[c.status].tone}>
                  {STATUS[c.status].label}
                </Tag>
                <span className="ml-auto font-mono text-caption text-muted">
                  {c.commandId}
                </span>
              </div>
              <dl className="mt-1.5 grid grid-cols-[72px_1fr] gap-x-2 gap-y-0.5 text-caption">
                <dt className="text-muted">基准提交</dt>
                <dd className="font-mono">{c.baseCommit}</dd>
                <dt className="text-muted">幂等键</dt>
                <dd className="break-all font-mono">{c.idempotencyKey}</dd>
                <dt className="text-muted">执行者</dt>
                <dd className="font-mono">{c.actorId}</dd>
              </dl>
              {c.message ? (
                <p className="mt-1.5 text-caption text-danger">{c.message}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  )
}
