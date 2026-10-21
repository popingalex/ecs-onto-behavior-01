import assert from "node:assert/strict"
import { buildIndex } from "@/data/index"
import { loadSeed } from "@/mock/seed"
import { loadPrototype } from "@/data/mockLoader"
import { systemNodeForFocus } from "@/features/schedule-editor/focus"
import { PAGE_SPECS } from "@/navigation/pages"
import {
  commitFocusPosition,
  commitGraphLayout,
} from "@/pages/p26/commitGraphLayout"
import {
  buildTree,
  flatten,
  selectedNodeId,
  type TreeNode,
} from "@/shell/resourceTreeModel"

/** IA v2 对象树：树只列对象（动作页不进树），点击 = 宿主页内选中。 */

const allRoutes = (nodes: TreeNode[]): string[] =>
  nodes.flatMap((n) => [
    ...(n.route ? [n.route.pageId] : []),
    ...allRoutes(n.children ?? []),
  ])

const seedParts = () => {
  const seed = loadSeed()
  return {
    index: buildIndex(seed),
    branches: seed.branches,
    commits: Object.fromEntries(seed.commits.map((c) => [c.id, c])),
  }
}

export function treeListsObjectsNotActions() {
  const { index, branches, commits } = seedParts()
  const groups = ["project", "modeling", "logic", "simulation"] as const
  for (const group of groups) {
    const pages = allRoutes(buildTree(group, index, branches, commits, {}))
    assert.ok(
      !pages.includes("P19"),
      `${group} 树不应出现动作页 P19，实际：${pages.join("、")}`,
    )
    // 已下线的场景页不进树
    for (const retired of ["P06", "P07", "P09"])
      assert.ok(!pages.includes(retired), `${group} 树不应出现 ${retired}`)
  }
}

export function modelingTreeListsEntities() {
  const { index, branches, commits } = seedParts()
  const tree = buildTree("modeling", index, branches, commits, {})
  const labels = tree.map((n) => n.label)
  assert.deepEqual(labels, ["类型", "组件", "属性", "模板", "实体"])
  // 小节标题是不可点分组头
  for (const section of tree) assert.equal(section.route, undefined)
  const entities = tree.find((n) => n.label === "实体")!
  assert.ok(entities.children!.length > 0)
  const first = entities.children![0]
  assert.equal(first.route?.pageId, "P08")
  assert.ok(first.route?.params.entityId, "实体叶子应携带 entityId")
  // 属性叶子打开抽屉（P31 overlay），不替换底层页面
  const props = tree.find((n) => n.label === "属性")!
  assert.equal(props.children![0].route?.pageId, "P31")
}

export function simulationTreeListsBranchCommits() {
  const { index, branches, commits } = seedParts()
  const main = branches.find((b) => b.id === "main")!
  const tree = buildTree("simulation", index, branches, commits, {
    [main.headCommit]: "record-head",
  })
  const mainSection = tree.find((n) => n.label === "分支 main")!
  assert.ok(mainSection.children!.length > 0, "main 分支应列出提交")
  const head = mainSection.children![0]
  assert.equal(head.route?.pageId, "P26")
  assert.equal(head.route?.params.branchId, "main")
  assert.equal(
    head.route?.params.viewCommit,
    main.headCommit,
    "提交叶子应携带 viewCommit",
  )
  // 有过程记录的提交显示 recordId
  assert.equal(head.meta, "record-head")
}

export function selectionFollowsRoute() {
  const { index, branches, commits } = seedParts()
  const tree = buildTree("modeling", index, branches, commits, {})
  const entityId = [...index.entities.keys()][0]
  const selected = selectedNodeId(tree, {
    pageId: "P08",
    params: { entityId },
  })
  assert.ok(selected?.startsWith("P08:"), `应选中实体叶子，实际 ${selected}`)
}

export function flattenKeepsSectionHeaders() {
  const { index, branches, commits } = seedParts()
  const tree = buildTree("modeling", index, branches, commits, {})
  const expanded = new Set(tree.map((n) => n.id))
  const rows = flatten(tree, expanded, "")
  const sections = rows.filter((r) => !r.node.route)
  assert.ok(sections.length >= 5, "无筛选时小节标题全部可见")
  const filtered = flatten(tree, expanded, "zzz-no-match")
  assert.equal(filtered.length, 0, "无匹配时连小节标题也不显示")
}

export function groupReassignment() {
  assert.equal(PAGE_SPECS.P08.group, "modeling", "P08 实体表并入建模")
  for (const id of ["P19", "P20", "P22", "P24", "P26", "P28"] as const)
    assert.equal(PAGE_SPECS[id].group, "simulation", `${id} 应属推演组`)
  assert.equal(PAGE_SPECS.P31.kind, "drawer")
  assert.equal(PAGE_SPECS.P31.group, "modeling")
}

export function retiredPagesMarked() {
  // 渲染映射（pageView → RetiredPage）依赖 React/router，SSR 测试环境无 window；
  // 这里锁定数据契约：retired 标记是 pageView 选择迁移说明页的唯一依据。
  for (const id of ["P06", "P07", "P09"] as const)
    assert.equal(PAGE_SPECS[id].retired, true, `${id} 应标记 retired`)
  assert.equal(PAGE_SPECS.P08.retired, undefined)
  assert.equal(PAGE_SPECS.P20.retired, undefined)
}

export function scheduleFocusResolvesSystemNode() {
  const model = loadPrototype().model
  const schedule = model.schedules.find((s) => s.id === "schedule-main")!
  const nodeId = systemNodeForFocus(schedule, "cool-A")
  assert.ok(nodeId, "cool-A 应能定位到调度节点")
  const node = schedule.nodes.find((n) => n.id === nodeId)!
  assert.equal(node.type, "SystemNode")
  assert.equal(systemNodeForFocus(schedule, "no-such-system"), null)
  assert.equal(systemNodeForFocus(schedule, undefined), null)
}

export function commitFocusResolvesGraphPosition() {
  const { branches, commits } = seedParts()
  const layout = commitGraphLayout(branches, commits)
  const p = commitFocusPosition(layout, "c043")
  assert.ok(p, "c043 应在提交图中有位置")
  assert.ok(p!.x > 0 && p!.y > 0)
  assert.equal(commitFocusPosition(layout, "no-such-commit"), null)
  assert.equal(commitFocusPosition(layout, undefined), null)
}
