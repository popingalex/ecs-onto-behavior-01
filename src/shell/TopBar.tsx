import { Search, Wifi, WifiOff } from "lucide-react"
import type { Role } from "@/core/types"
import { useIndex } from "@/data/store"
import { cn } from "@/lib/cn"
import { navigate } from "@/router/router"
import {
  ROLE_LABELS,
  setRole,
  toggleConnection,
  useActorName,
  useConnection,
  useRole,
} from "@/stores/context"

export default function TopBar() {
  const index = useIndex()
  const role = useRole()
  const connection = useConnection()
  const actor = useActorName()
  return (
    <header className="flex h-12 shrink-0 items-center gap-4 bg-chrome pl-4 pr-3 text-white">
      <button
        type="button"
        onClick={() => navigate({ pageId: "P01", params: {} })}
        className="flex items-center gap-2.5 rounded-ui pr-2"
        aria-label="返回项目总览"
      >
        <span className="grid h-7 w-7 place-items-center rounded-[5px] bg-primary">
          <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
            <path
              d="M3 14.5 8 9.5l3 3 6-7"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="17" cy="5.5" r="1.6" fill="white" />
          </svg>
        </span>
        <span className="text-body font-semibold tracking-wide">
          推演工作台
        </span>
      </button>
      <span className="h-5 w-px bg-chrome-line" aria-hidden />
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-body text-[#dbe5ee]">
          {index.project.label}
        </span>
        <span className="rounded bg-chrome-raised px-1.5 font-mono text-caption text-[#9fb2c4]">
          {index.project.id}
        </span>
      </div>

      <div className="mx-auto hidden w-[380px] max-w-[32vw] md:block">
        <div
          className="flex h-8 items-center gap-2 rounded-ui border border-chrome-line bg-chrome-raised px-3 text-label text-[#8ea3b8]"
          title="全局搜索尚未接入"
        >
          <Search size={15} aria-hidden />
          <span className="flex-1 truncate">搜索对象、页面与提交</span>
          <span className="rounded border border-chrome-line px-1 font-mono text-caption">
            未接入
          </span>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={toggleConnection}
          title="切换模拟连接状态"
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-ui px-2.5 text-label transition-colors",
            connection === "online"
              ? "text-[#b8c7d6] hover:bg-chrome-raised"
              : "bg-danger/90 text-white hover:bg-danger",
          )}
        >
          {connection === "online" ? (
            <Wifi size={15} aria-hidden />
          ) : (
            <WifiOff size={15} aria-hidden />
          )}
          {connection === "online" ? "已连接" : "离线"}
        </button>
        <label className="flex h-8 items-center gap-2 rounded-ui border border-chrome-line bg-chrome-raised pl-2.5 pr-1 text-label text-[#b8c7d6]">
          角色
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            aria-label="切换角色"
            className="h-6 rounded bg-chrome pl-1.5 pr-1 text-label text-white outline-none focus:ring-2 focus:ring-primary"
          >
            {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
        <span
          className="grid h-8 w-8 place-items-center rounded-full bg-[#2f5a73] text-label font-semibold"
          title={actor}
        >
          {actor.slice(0, 1)}
        </span>
      </div>
    </header>
  )
}
