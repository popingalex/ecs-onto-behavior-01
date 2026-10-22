import { useState } from "react"
import { Cpu, Database, Wifi, WifiOff } from "lucide-react"
import type { WorkbenchContext } from "@/app/useWorkbenchContext"
import { useIndex } from "@/data/store"
import { cn } from "@/lib/cn"
import type { ViewportTier } from "@/lib/useViewport"
import { toLogicalUri } from "@/router/route"
import { useRunCommands } from "@/stores/commandQueue"
import { ROLE_LABELS, useConnection, useRole } from "@/stores/context"
import {
  clearLocalHistory,
  usePersistenceStatus,
} from "@/stores/persistence/historyPersistence"
import { settleRound, useExecutionAdapterLabel } from "@/stores/session"
import { toast } from "@/stores/toast"

const TIER_LABEL: Record<ViewportTier, string> = {
  standard: "标准布局",
  compact: "紧凑布局",
  narrow: "窄屏浮层",
}

export default function StatusBar({
  ctx,
  tier,
  width,
}: {
  ctx: WorkbenchContext
  tier: ViewportTier
  width: number
}) {
  const index = useIndex()
  const connection = useConnection()
  const role = useRole()
  const adapter = useExecutionAdapterLabel()
  const commands = useRunCommands()
  const pending = commands.filter(
    (c) => c.status === "pending" || c.status === "accepted",
  ).length
  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-border bg-surface px-3 text-caption text-muted">
      <span
        className={cn(
          "flex items-center gap-1.5",
          connection === "offline" && "font-medium text-danger",
        )}
      >
        {connection === "online" ? (
          <Wifi size={12} aria-hidden />
        ) : (
          <WifiOff size={12} aria-hidden />
        )}
        {connection === "online" ? "核心服务已连接" : "离线 · 草稿仅保存在本地"}
      </span>
      <span className="flex items-center gap-1.5">
        <Cpu size={12} aria-hidden />
        {adapter}
      </span>
      <PersistenceIndicator />
      <span>
        命令队列 <span className="tabular text-ink-soft">{pending}</span> 待处理
        / {commands.length}
      </span>
      <span>{ROLE_LABELS[role]}</span>
      <span className="ml-auto hidden truncate font-mono lg:inline">
        {toLogicalUri(index.project.id, ctx.route)}
      </span>
      <span className="tabular shrink-0">
        {TIER_LABEL[tier]} · {width}px
      </span>
      <span className="shrink-0">React 原型 · 生产实现 Rust / egui</span>
    </footer>
  )
}

/**
 * 本地历史持久化状态（W4）：恢复计数 / 内存模式 / 失败警示。
 * 失败或回退种子时给出「重试 / 清空本地历史（需确认）」动作。
 */
function PersistenceIndicator() {
  const persistence = usePersistenceStatus()
  const [confirmingClear, setConfirmingClear] = useState(false)

  const label =
    persistence.storageKind === "memory"
      ? "本地历史 · 内存模式（不持久化）"
      : persistence.mode === "restored"
        ? `本地历史 · 已恢复 ${persistence.restoredCommits} 提交${
            persistence.orphanFacts > 0
              ? ` · ${persistence.orphanFacts} 条孤儿未暴露`
              : ""
          }`
        : persistence.mode === "first-init"
          ? "本地历史 · 已初始化"
          : persistence.mode === "rejected-version"
            ? "本地历史 · 版本不符，已回退种子"
            : persistence.mode === "fallback-seed"
              ? "本地历史 · 校验失败，已回退种子"
              : "本地历史 · 加载中"
  const degraded =
    persistence.mode === "rejected-version" ||
    persistence.mode === "fallback-seed"

  const retry = () => {
    const failed = persistence.failure?.settle
    if (failed) void settleRound(failed.runId, failed.branchId, failed.baseCommit)
  }
  const clear = async () => {
    setConfirmingClear(false)
    const result = await clearLocalHistory()
    toast(
      result.ok
        ? "已清空本地历史；当前会话保留到刷新，之后按首次初始化（种子）启动"
        : `清空本地历史失败：${result.message}`,
    )
  }

  return (
    <span
      className={cn(
        "flex items-center gap-1.5",
        (persistence.failure || degraded) && "font-medium text-danger",
      )}
      title={persistence.diagnostics.join("\n") || undefined}
    >
      <Database size={12} aria-hidden />
      {persistence.failure
        ? `持久化失败：${persistence.failure.message}`
        : label}
      {persistence.failure?.settle ? (
        <button
          type="button"
          className="underline underline-offset-2 hover:text-ink"
          onClick={retry}
        >
          重试
        </button>
      ) : null}
      {persistence.failure || degraded ? (
        confirmingClear ? (
          <>
            <button
              type="button"
              className="underline underline-offset-2 hover:text-ink"
              onClick={() => void clear()}
            >
              确认清空
            </button>
            <button
              type="button"
              className="underline underline-offset-2 hover:text-ink"
              onClick={() => setConfirmingClear(false)}
            >
              取消
            </button>
          </>
        ) : (
          <button
            type="button"
            className="underline underline-offset-2 hover:text-ink"
            onClick={() => setConfirmingClear(true)}
          >
            清空本地历史
          </button>
        )
      ) : null}
    </span>
  )
}
