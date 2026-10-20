import { Boxes, CirclePlay, FolderKanban, Map as MapIcon, RotateCcw, ScanSearch, Workflow, type LucideIcon } from 'lucide-react'
import type { GroupId } from '@/core/types'
import { cn } from '@/lib/cn'
import { GROUPS } from '@/navigation/groups'
import { navigate } from '@/router/router'
import { resetLayout } from '@/stores/layout'
import { toast } from '@/stores/toast'

export const GROUP_ICONS: Record<GroupId, LucideIcon> = {
  project: FolderKanban,
  modeling: Boxes,
  scene: MapIcon,
  logic: Workflow,
  run: CirclePlay,
  review: ScanSearch,
}

/** 全局功能栏：只保留六个主入口。 */
export default function FunctionRail({ active }: { active: GroupId }) {
  return (
    <nav aria-label="功能入口" className="flex w-[72px] shrink-0 flex-col items-center border-r border-border bg-surface py-2">
      <ul className="flex w-full flex-col gap-1 px-2">
        {GROUPS.map((group) => {
          const Icon = GROUP_ICONS[group.id]
          const selected = group.id === active
          return (
            <li key={group.id}>
              <button
                type="button"
                aria-current={selected ? 'page' : undefined}
                title={`${group.label} · ${group.description}（${group.shortcut}）`}
                onClick={() => navigate({ pageId: group.defaultPage, params: {} })}
                className={cn(
                  'relative flex h-[60px] w-full flex-col items-center justify-center gap-1 rounded-ui text-caption transition-colors',
                  selected ? 'bg-primary-soft font-semibold text-primary-strong' : 'text-muted hover:bg-hover hover:text-ink',
                )}
              >
                {selected ? <span className="absolute -left-2 top-3 bottom-3 w-[3px] rounded-r bg-primary" aria-hidden /> : null}
                <Icon size={20} strokeWidth={selected ? 2.2 : 1.8} aria-hidden />
                {group.label}
              </button>
            </li>
          )
        })}
      </ul>
      <button
        type="button"
        title="重置面板布局"
        aria-label="重置面板布局"
        onClick={() => {
          resetLayout()
          toast('面板布局已恢复默认', 'info')
        }}
        className="mt-auto flex h-10 w-10 items-center justify-center rounded-ui text-faint hover:bg-hover hover:text-ink"
      >
        <RotateCcw size={17} aria-hidden />
      </button>
    </nav>
  )
}
