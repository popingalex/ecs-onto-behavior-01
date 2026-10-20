import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronRight, Search, X } from 'lucide-react'
import type { GroupId, Route } from '@/core/types'
import type { WorkbenchIndex } from '@/data/index'
import { useIndex } from '@/data/store'
import { cn } from '@/lib/cn'
import { GROUP_BY_ID } from '@/navigation/groups'
import { PAGE_SPECS } from '@/navigation/pages'
import { routeMatches } from '@/router/route'
import { navigate, useRoute, useViewState } from '@/router/router'
import { useBranches } from '@/stores/history'
import type { BranchDef } from '@/core/types'

/** C03 ObjectTree：二级对象放在资源树，不扩展全局功能栏。 */
interface TreeNode {
  id: string
  label: string
  meta?: string
  route: Route
  children?: TreeNode[]
}

const page = (pageId: Route['pageId'], params: Record<string, string> = {}, children?: TreeNode[]): TreeNode => ({
  id: `${pageId}:${JSON.stringify(params)}`,
  label: PAGE_SPECS[pageId].title,
  meta: pageId,
  route: { pageId, params },
  children,
})

const leaf = (pageId: Route['pageId'], params: Record<string, string>, label: string, meta?: string): TreeNode => ({
  id: `${pageId}:${JSON.stringify(params)}`,
  label,
  meta,
  route: { pageId, params },
})

function execParams(route: Route): Record<string, string> {
  const out: Record<string, string> = {}
  for (const key of ['runId', 'branchId', 'viewCommit'] as const) if (route.params[key]) out[key] = route.params[key]
  return out
}

function buildTree(group: GroupId, index: WorkbenchIndex, branches: BranchDef[], current: Route): TreeNode[] {
  const branchLeaves = (pageId: Route['pageId']) =>
    branches.map((b) => leaf(pageId, { runId: b.runId, branchId: b.id, viewCommit: b.headCommit }, b.label, b.headCommit))
  const exec = execParams(current)
  switch (group) {
    case 'project':
      return [page('P01'), page('P19'), page('P20', {}, branchLeaves('P20'))]
    case 'modeling':
      return [
        page('P02', {}, [...index.classes.values()].map((c) => leaf('P02', { classId: c.id }, c.label, c.id))),
        page(
          'P03',
          {},
          [...index.components.values()].map((c) =>
            leaf('P03', { componentId: c.id }, c.label, `${index.propertiesByComponent.get(c.id)?.length ?? 0} 属性`),
          ),
        ),
        page('P04'),
        page('P05', {}, [...index.templates.values()].map((t) => leaf('P05', { templateId: t.id }, t.label, t.version))),
      ]
    case 'scene':
      return [
        page('P06', {}, [...index.sceneTemplates.values()].map((t) => leaf('P06', { sceneTemplateId: t.id }, t.label, t.version))),
        page('P07', {}, [...index.scenes.values()].map((s) => leaf('P07', { sceneVersion: s.id }, s.label, s.version))),
        page('P08', {}, [...index.entities.values()].map((e) => leaf('P08', { entityId: e.id }, e.label, e.id))),
        page('P09', {}, [...index.assets.values()].map((a) => leaf('P09', { assetId: a.id }, a.label, a.version))),
      ]
    case 'logic':
      return [
        page('P10', {}, [...index.queries.values()].map((q) => leaf('P10', { queryId: q.id }, q.label, q.id))),
        page('P11', {}, [...index.systems.values()].map((s) => leaf('P11', { systemId: s.id }, s.label, s.id))),
        page('P12', {}, [...index.schedules.values()].map((s) => leaf('P12', { scheduleId: s.id }, s.label))),
        page('P13'),
        page(
          'P14',
          {},
          [...index.systems.values()].map((s) => leaf('P14', { systemId: s.id, graphId: s.graphRef.split('@')[0] }, s.label, s.graphRef)),
        ),
        page('P16', {}, [...index.constraints.values()].map((c) => leaf('P16', { constraintId: c.id }, c.label, c.id))),
        page('P17', {}, [...index.policies.values()].map((p) => leaf('P17', { policyId: p.id }, p.label, p.version))),
        page('P18'),
      ]
    case 'run':
      return [
        page('P19'),
        page('P20', {}, branchLeaves('P20')),
        page('P21'),
        page('P22', exec),
        page('P23', exec),
        page('P28', {}, [...index.tasks.values()].map((t) => leaf('P28', { taskId: t.id }, t.label))),
      ]
    case 'review':
      return [
        page('P24', exec),
        page('P25', {}, [...index.events.values()].map((e) => leaf('P25', { eventId: e.id }, e.label))),
        page('P26', {}, branchLeaves('P26')),
        page('P27', {}, [leaf('P27', { leftCommit: 'c043', rightCommit: 'c043-one-cooler' }, '双路 ↔ 单路冷却', 'c043 ↔ c043-one-cooler')]),
      ]
  }
}

function flatten(nodes: TreeNode[], expanded: Set<string>, query: string, depth = 0, out: Array<{ node: TreeNode; depth: number }> = []) {
  for (const node of nodes) {
    const childMatches = node.children?.some((c) => matches(c, query))
    if (query && !matches(node, query) && !childMatches) continue
    out.push({ node, depth })
    if (node.children && (expanded.has(node.id) || (query && childMatches))) flatten(node.children, expanded, query, depth + 1, out)
  }
  return out
}

function matches(node: TreeNode, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  return node.label.toLowerCase().includes(q) || Boolean(node.meta?.toLowerCase().includes(q)) || Boolean(node.children?.some((c) => matches(c, q)))
}

function selectedNodeId(nodes: TreeNode[], route: Route): string | null {
  let best: { id: string; score: number } | null = null
  const visit = (list: TreeNode[]) => {
    for (const n of list) {
      if (n.route.pageId === route.pageId && routeMatches(route, n.route)) {
        const score = Object.keys(n.route.params).length + (n.children ? 0 : 0.5)
        if (!best || score > best.score) best = { id: n.id, score }
      }
      if (n.children) visit(n.children)
    }
  }
  visit(nodes)
  return (best as { id: string } | null)?.id ?? null
}

export default function ResourceTree({ group, onNavigate }: { group: GroupId; onNavigate?: () => void }) {
  const index = useIndex()
  const route = useRoute()
  const branchMap = useBranches()
  const branches = useMemo(() => Object.values(branchMap), [branchMap])
  const nodes = useMemo(() => buildTree(group, index, branches, route), [group, index, branches, route])
  const [collapsed, setCollapsed] = useViewState<string[]>(`tree:${group}:collapsed`, [])
  const [query, setQuery] = useState('')
  const listRef = useRef<HTMLUListElement>(null)

  const expanded = useMemo(() => {
    const set = new Set<string>()
    const visit = (list: TreeNode[]) =>
      list.forEach((n) => {
        if (n.children && !collapsed.includes(n.id)) set.add(n.id)
        if (n.children) visit(n.children)
      })
    visit(nodes)
    return set
  }, [nodes, collapsed])

  const rows = useMemo(() => flatten(nodes, expanded, query.trim()), [nodes, expanded, query])
  const selected = selectedNodeId(nodes, route)

  const toggle = (id: string, open?: boolean) =>
    setCollapsed((prev) => {
      const isOpen = !prev.includes(id)
      const next = open ?? !isOpen
      return next ? prev.filter((x) => x !== id) : [...prev, id]
    })

  const open = (node: TreeNode) => {
    navigate(node.route)
    onNavigate?.()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.nativeEvent.isComposing) return
    const items = listRef.current?.querySelectorAll<HTMLButtonElement>('[data-tree-item]')
    const focus = (n: number) => items?.[Math.max(0, Math.min(rows.length - 1, n))]?.focus()
    const { node } = rows[i]
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      focus(i + 1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      focus(i - 1)
    } else if (e.key === 'ArrowRight' && node.children) {
      e.preventDefault()
      if (!expanded.has(node.id)) toggle(node.id, true)
      else focus(i + 1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      if (node.children && expanded.has(node.id)) toggle(node.id, false)
      else {
        const depth = rows[i].depth
        for (let j = i - 1; j >= 0; j--) if (rows[j].depth < depth) return focus(j)
      }
    }
  }

  return (
    <nav aria-label={`${GROUP_BY_ID[group].label}资源`} className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between px-4">
        <span className="text-body font-semibold text-ink">{GROUP_BY_ID[group].label}</span>
        <span className="text-caption text-muted">{GROUP_BY_ID[group].description}</span>
      </div>
      <div className="px-3 pb-2">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="筛选资源"
            aria-label="筛选资源"
            className="h-8 w-full rounded-ui border border-border bg-subtle pl-8 pr-7 text-label outline-none placeholder:text-faint focus:border-primary focus:bg-surface"
          />
          {query ? (
            <button type="button" aria-label="清除筛选" onClick={() => setQuery('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted hover:bg-hover">
              <X size={14} aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
      <ul ref={listRef} role="tree" aria-label="资源树" className="scroll-thin min-h-0 flex-1 overflow-auto px-2 pb-3">
        {rows.length === 0 ? <li className="px-3 py-6 text-center text-label text-muted">没有匹配“{query}”的资源</li> : null}
        {rows.map(({ node, depth }, i) => {
          const isSelected = node.id === selected
          const isOpen = node.children ? expanded.has(node.id) || Boolean(query) : undefined
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
                onKeyDown={(e) => onKeyDown(e, i)}
                style={{ paddingLeft: 8 + depth * 16 }}
                className={cn(
                  'group flex h-8 w-full items-center gap-1.5 rounded-ui pr-2 text-left text-body transition-colors',
                  isSelected ? 'bg-primary-soft font-medium text-primary-strong' : 'text-ink-soft hover:bg-hover hover:text-ink',
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
                    <ChevronRight size={14} className={cn('transition-transform', isOpen && 'rotate-90')} aria-hidden />
                  </span>
                ) : (
                  <span className="w-5 shrink-0" />
                )}
                <span className="min-w-0 flex-1 truncate">{node.label}</span>
                {spec.kind !== 'page' && depth === 0 ? <span className="shrink-0 text-caption text-faint">{spec.kind === 'modal' ? '弹层' : '抽屉'}</span> : null}
                {node.meta ? (
                  <span className={cn('shrink-0 font-mono text-caption', isSelected ? 'text-primary' : 'text-faint')}>{node.meta}</span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
