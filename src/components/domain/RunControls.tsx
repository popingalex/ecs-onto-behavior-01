import { Pause, Play, StepForward } from "lucide-react"
import type { BranchDef, RunDef } from "@/core/types"
import type { StatusKey } from "@/core/status"
import Button, { IconButton } from "@/components/ui/Button"
import StatusTag from "@/components/ui/StatusTag"
import { canEdit, useConnection, useRole } from "@/stores/context"
import { togglePlaybackPause, usePlayback } from "@/stores/playback"
import { settleRound, useRunSession } from "@/stores/session"

/**
 * C13 RunControls：SessionStore（权威阶段）与 PlaybackStore（演示）分开。
 * 历史查看下禁止续算；暂停只影响播放。
 */
export default function RunControls({
  run,
  branch,
  isHistory,
  modelView,
}: {
  run: RunDef
  branch: BranchDef
  isHistory: boolean
  /** 试算输入版本：saved（默认）/ draft 草稿试算快照。 */
  modelView?: "saved" | "draft"
}) {
  const session = useRunSession(run.id)
  const role = useRole()
  const connection = useConnection()
  const paused = usePlayback((s) => s.paused)
  const progress = usePlayback((s) => s.progress)

  const phaseStatus: StatusKey =
    session.phase === "playing" && paused ? "playbackPaused" : session.phase
  const busy = session.phase !== "waitingInputs"
  const reason = !canEdit(role)
    ? "观察者为只读角色"
    : isHistory
      ? "历史查看只读：请回到最新或从此提交建分支"
      : connection === "offline"
        ? "离线时不能提交回合"
        : undefined

  return (
    <div className="flex items-center gap-2">
      <StatusTag status={phaseStatus} />
      {session.phase === "playing" ? (
        <div className="flex items-center gap-2">
          <div
            className="h-1.5 w-20 overflow-hidden rounded-full bg-neutral-soft"
            role="progressbar"
            aria-label="演示进度"
            aria-valuenow={Math.round(progress * 100)}
          >
            <div
              className="h-full bg-primary transition-[width]"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <IconButton
            icon={paused ? Play : Pause}
            label={paused ? "继续播放" : "暂停播放（不改变提交）"}
            onClick={togglePlaybackPause}
          />
        </div>
      ) : null}
      <Button
        intent="primary"
        icon={StepForward}
        busy={busy && session.phase !== "playing"}
        disabled={Boolean(reason) || busy}
        title={
          reason ??
          `基于 ${branch.headCommit} 冻结输入并推算下一回合（步长 ${run.stepSeconds} s · ${
            modelView === "draft" ? "草稿试算快照" : "已保存模型"
          }）`
        }
        onClick={() =>
          settleRound(run.id, branch.id, branch.headCommit, { modelView })
        }
      >
        推算下一回合
      </Button>
    </div>
  )
}
