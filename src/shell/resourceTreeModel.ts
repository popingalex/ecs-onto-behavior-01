import type { BranchDef, CommitDef, GroupId, Route } from "@/core/types"
import type { WorkbenchIndex } from "@/data/index"
import { formatSimTime } from "@/lib/format"
import { routeMatches } from "@/router/route"
import { lineage } from "@/stores/history"

/**
 * C03 ObjectTree 的纯数据层：每组只列对象（类型/组件/属性/模板/实体、查询/System/编排/
 * 程序/约束/策略、各分支提交与事件），动作页（如 P19 新建运行）不进树。
 * 小节标题（「类型」「实体」…）是不可点分组头；点击对象 = 宿主页内选中该对象。
 */
export interface TreeNode {
  id: string
  label: string
  meta?: string
  /** 小节标题没有路由：不可点、不可选中。 */
  route?: Route
  children?: TreeNode[]
}

const leaf = (
  pageId: Route["pageId"],
  params: Record<string, string>,
  label: string,
  meta?: string,
): TreeNode => ({
  id: `${pageId}:${JSON.stringify(params)}`,
  label,
  meta,
  route: { pageId, params },
})

const section = (label: string, children: TreeNode[]): TreeNode => ({
  id: `section:${label}`,
  label,
  children,
})

/** 过滤掉没有对象的小节。 */
const sections = (list: TreeNode[]): TreeNode[] =>
  list.filter((n) => (n.children?.length ?? 0) > 0)

export function buildTree(
  group: GroupId,
  index: WorkbenchIndex,
  branches: BranchDef[],
  commits: Record<string, CommitDef>,
  recordByCommit: Record<string, string>,
): TreeNode[] {
  switch (group) {
    case "project":
      return sections([
        section(
          "运行",
          [...index.runs.values()].map((r) => {
            const own = branches.filter((b) => b.runId === r.id)
            const first = own[0]
            return {
              id: `run:${r.id}`,
              label: r.label,
              meta: r.id,
              route: first
                ? {
                    pageId: "P20" as const,
                    params: {
                      runId: r.id,
                      branchId: first.id,
                      viewCommit: first.headCommit,
                    },
                  }
                : undefined,
              children: own.map((b) =>
                leaf(
                  "P20",
                  { runId: r.id, branchId: b.id, viewCommit: b.headCommit },
                  b.label,
                  b.headCommit,
                ),
              ),
            }
          }),
        ),
      ])
    case "modeling":
      return sections([
        section(
          "类型",
          [...index.classes.values()].map((c) =>
            leaf("P02", { classId: c.id }, c.label, c.id),
          ),
        ),
        section(
          "组件",
          [...index.components.values()].map((c) =>
            leaf(
              "P03",
              { componentId: c.id },
              c.label,
              `${index.propertiesByComponent.get(c.id)?.length ?? 0} 属性`,
            ),
          ),
        ),
        section(
          "属性",
          [...index.properties.values()].map((p) =>
            leaf("P31", { attributeId: p.id }, p.label, p.id),
          ),
        ),
        section(
          "模板",
          [...index.templates.values()].map((t) =>
            leaf("P05", { templateId: t.id }, t.label, t.version),
          ),
        ),
        section(
          "实体",
          [...index.entities.values()].map((e) =>
            leaf("P08", { entityId: e.id }, e.label, e.id),
          ),
        ),
      ])
    case "logic":
      return sections([
        section(
          "查询",
          [...index.queries.values()].map((q) =>
            leaf("P10", { queryId: q.id }, q.label, q.id),
          ),
        ),
        section(
          "System",
          [...index.systems.values()].map((s) =>
            leaf("P11", { systemId: s.id }, s.label, s.id),
          ),
        ),
        section(
          "编排",
          [...index.schedules.values()].map((s) =>
            leaf("P12", { scheduleId: s.id }, s.label, s.id),
          ),
        ),
        section(
          "程序",
          [...index.graphs.values()].map((g) =>
            leaf("P14", { programId: g.id }, g.label, g.version),
          ),
        ),
        section(
          "约束",
          [...index.constraints.values()].map((c) =>
            leaf("P16", { constraintId: c.id }, c.label, c.id),
          ),
        ),
        section(
          "策略",
          [...index.policies.values()].map((p) =>
            leaf("P17", { policyId: p.id }, p.label, p.version),
          ),
        ),
      ])
    case "simulation":
      return sections([
        ...branches.map((b) =>
          section(
            `分支 ${b.id}`,
            lineage(commits, b.headCommit).map((c) =>
              leaf(
                "P26",
                { branchId: b.id, viewCommit: c.id },
                c.id,
                recordByCommit[c.id] ?? formatSimTime(c.simTime),
              ),
            ),
          ),
        ),
        section(
          "事件",
          [...index.events.values()].map((e) =>
            leaf("P25", { eventId: e.id }, e.label, e.id),
          ),
        ),
        section(
          "任务",
          [...index.tasks.values()].map((t) =>
            leaf("P28", { taskId: t.id }, t.label, t.id),
          ),
        ),
      ])
  }
}

function matches(node: TreeNode, query: string): boolean {
  const q = query.toLowerCase()
  return (
    node.label.toLowerCase().includes(q) ||
    Boolean(node.meta?.toLowerCase().includes(q))
  )
}

export interface TreeRow {
  node: TreeNode
  depth: number
}

/** 拍平可见行：小节标题只在有匹配子对象时出现；对象不再嵌套可折叠层级（分支提交除外）。 */
export function flatten(
  nodes: TreeNode[],
  expanded: Set<string>,
  query: string,
  depth = 0,
  out: TreeRow[] = [],
): TreeRow[] {
  for (const node of nodes) {
    const childMatches = node.children?.filter((c) => matches(c, query)) ?? []
    if (query) {
      if (node.route && matches(node, query)) {
        out.push({ node, depth })
      } else if (childMatches.length > 0) {
        out.push({ node, depth })
        flatten(childMatches, expanded, "", depth + 1, out)
      }
      continue
    }
    out.push({ node, depth })
    if (node.children && expanded.has(node.id))
      flatten(node.children, expanded, query, depth + 1, out)
  }
  return out
}

/** 选中态跟随当前路由：对象叶子的路由是当前路由的子集即选中。 */
export function selectedNodeId(nodes: TreeNode[], route: Route): string | null {
  let best: { id: string ;score: number } | null = null
  const visit = (list: TreeNode[]) => {
    for (const n of list) {
      if (n.route && routeMatches(route, n.route)) {
        const score = Object.keys(n.route.params).length
        if (!best || score > best.score) best = { id: n.id, score }
      }
      if (n.children) visit(n.children)
    }
  }
  visit(nodes)
  return best?.id ?? null
}
