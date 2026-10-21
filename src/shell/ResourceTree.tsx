import { useMemo, useRef, useState, type KeyboardEvent } from "react"
import { ChevronRight, Search, X } from "lucide-react"
import type { GroupId } from "@/core/types"
import { useIndex } from "@/data/store"
import { cn } from "@/lib/cn"
import { GROUP_BY_ID } from "@/navigation/groups"
import { PAGE_SPECS } from "@/navigation/pages"
import { navigate, useRoute, useViewState } from "@/router/router"
import { useBranches, useCommits } from "@/stores/history"
import { useStore } from "@/lib/store"
import { traceStore } from "@/stores/trace"
import {
  buildTree,
  flatten,
  selectedNodeId,
  type TreeNode,
} from "./resourceTreeModel"

/** C03 ObjectTree：树只列对象；点击对象 = 宿主页内选中（同页聚焦），动作入口在页面工具栏。 */
export default function ResourceTree({
  group,
  onNavigate,
}: {
  group: GroupId
  onNavigate?: () => void
}) {
  const index = useIndex()
  const route = useRoute()
  const branchMap = useBranches()
  const commits = useCommits()
  const recordByCommit = useStore(traceStore, (s) => s.byCommit)
  const branches = useMemo(() => Object.values(branchMap), [branchMap])
  const nodes = useMemo(
    () => buildTree(group, index, branches, commits, recordByCommit),
    [group, index, branches, commits, recordByCommit],
  )
  const [collapsed, setCollapsed] = useViewState<string[]>(
    `tree:${group}:collapsed`,
    [],
  )
  const [query, setQuery] = useState("")
  const listRef = useRef<HTMLUListElement>(null)

  const expanded = useMemo(() => {
    const set = new Set<string>()
    const visit = (list: TreeNode[]) =>
      list.forEach((n) => {
        // 小节标题（无路由）恒展开；只有对象自身的子层级可折叠。
        if (n.children && (!n.route || !collapsed.includes(n.id)))
          set.add(n.id)
        if (n.children) visit(n.children)
      })
    visit(nodes)
    return set
  }, [nodes, collapsed])

  const rows = useMemo(
    () => flatten(nodes, expanded, query.trim()),
    [nodes, expanded, query],
  )
  /** 键盘导航只覆盖可点行（小节标题不可聚焦）。 */
  const focusable = useMemo(() => rows.filter((r) => r.node.route), [rows])
  const focusIndexOf = useMemo(() => {
    const map = new Map<string, number>()
    focusable.forEach((r, i) => map.set(r.node.id, i))
    return map
  }, [focusable])
  const selected = selectedNodeId(nodes, route)

  const toggle = (id: string, open?: boolean) =>
    setCollapsed((prev) => {
      const isOpen = !prev.includes(id)
      const next = open ?? !isOpen
      return next ? prev.filter((x) => x !== id) : [...prev, id]
    })

  const open = (node: TreeNode) => {
    if (!node.route) return
    navigate(node.route)
    onNavigate?.()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, fi: number) => {
    if (e.nativeEvent.isComposing) return
    const items =
      listRef.current?.querySelectorAll<HTMLButtonElement>("[data-tree-item]")
    const focus = (n: number) =>
      items?.[Math.max(0, Math.min(focusable.length - 1, n))]?.focus()
    const { node } = focusable[fi]
    if (e.key === "ArrowDown") {
      e.preventDefault()
      focus(fi + 1)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      focus(fi - 1)
    } else if (e.key === "ArrowRight" && node.children) {
      e.preventDefault()
      if (!expanded.has(node.id)) toggle(node.id, true)
      else focus(fi + 1)
    } else if (e.key === "ArrowLeft") {
      e.preventDefault()
      if (node.children && expanded.has(node.id)) {
        toggle(node.id, false)
        return
      }
      const row = rows.findIndex((r) => r.node.id === node.id)
      const depth = rows[row].depth
      for (let j = row - 1; j >= 0; j--) {
        if (rows[j].depth < depth) {
          const parent = focusIndexOf.get(rows[j].node.id)
          if (parent !== undefined) return focus(parent)
          return
        }
      }
    }
  }

  return (
    <nav
      aria-label={`${GROUP_BY_ID[group].label}资源`}
      className="flex h-full flex-col"
    >
      <div className="flex h-12 shrink-0 items-center justify-between px-4">
        <span className="text-body font-semibold text-ink">
          {GROUP_BY_ID[group].label}
        </span>
        <span className="text-caption text-muted">
          {GROUP_BY_ID[group].description}
        </span>
      </div>
      <div className="px-3 pb-2">
        <div className="relative">
          <Search
            size={15}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint"
            aria-hidden
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="筛选对象"
            aria-label="筛选对象"
            className="h-8 w-full rounded-ui border border-border bg-subtle pl-8 pr-7 text-label outline-none placeholder:text-faint focus:border-primary focus:bg-surface"
          />
          {query ? (
            <button
              type="button"
              aria-label="清除筛选"
              onClick={() => setQuery("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted hover:bg-hover"
            >
              <X size={14} aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
      <ul
        ref={listRef}
        role="tree"
        aria-label="对象树"
        className="scroll-thin min-h-0 flex-1 overflow-auto px-2 pb-3"
      >
        {rows.length === 0 ? (
          <li className="px-3 py-6 text-center text-label text-muted">
            没有匹配“{query}”的对象
          </li>
        ) : null}
        {rows.map(({ node, depth }) => {
          if (!node.route) {
            return (
              <li key={node.id} role="presentation">
                <div
                  style={{ paddingLeft: 8 + depth * 16 }}
                  className="flex h-7 items-center pr-2 text-caption font-semibold uppercase tracking-wide text-faint"
                >
                  <span className="min-w-0 flex-1 truncate">{node.label}</span>
                  <span className="shrink-0 tabular">
                    {node.children?.length ?? 0}
                  </span>
                </div>
              </li>
            )
          }
          const fi = focusIndexOf.get(node.id) ?? 0
          const isSelected = node.id === selected
          const isOpen = node.children
            ? expanded.has(node.id) || Boolean(query)
            : undefined
          const spec = PAGE_SPECS[node.route.pageId]
          return (
            <li key={node.id} role="none">
              <button
                type="button"
                role="treeitem"
                data-tree-item
                aria-selected={isSelected}
                aria-expanded={isOpen}
                aria-level={depth + 1}
                onClick={() => open(node)}
                onKeyDown={(e) => onKeyDown(e, fi)}
                style={{ paddingLeft: 8 + depth * 16 }}
                className={cn(
                  "group flex h-8 w-full items-center gap-1.5 rounded-ui pr-2 text-left text-body transition-colors",
                  isSelected
                    ? "bg-primary-soft font-medium text-primary-strong"
                    : "text-ink-soft hover:bg-hover hover:text-ink",
                )}
              >
                {node.children ? (
                  <span
                    role="presentation"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggle(node.id)
                    }}
                    className="-ml-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-faint hover:bg-border/60 hover:text-ink"
                  >
                    <ChevronRight
                      size={14}
                      className={cn(
                        "transition-transform",
                        isOpen && "rotate-90",
                      )}
                      aria-hidden
                    />
                  </span>
                ) : (
                  <span className="w-5 shrink-0" />
                )}
                <span className="min-w-0 flex-1 truncate">{node.label}</span>
                {spec.kind !== "page" ? (
                  <span className="shrink-0 text-caption text-faint">
                    {spec.kind === "modal" ? "弹层" : "抽屉"}
                  </span>
                ) : null}
                {node.meta ? (
                  <span
                    className={cn(
                      "shrink-0 font-mono text-caption",
                      isSelected ? "text-primary" : "text-faint",
                    )}
                  >
                    {node.meta}
                  </span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
