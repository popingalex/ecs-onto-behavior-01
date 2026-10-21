import { useEffect, useMemo, useRef, useState } from "react"
import {
  GitBranch,
  GitCommitHorizontal,
  GitCompare,
  History,
  RotateCcw,
} from "lucide-react"
import type { WorkbenchContext } from "@/app/useWorkbenchContext"
import Button from "@/components/ui/Button"
import Card, { KeyValue, Notice, PanelHeader } from "@/components/ui/Card"
import Field, { Select, TextInput } from "@/components/ui/Field"
import Modal from "@/components/ui/Modal"
import { Tag } from "@/components/ui/StatusTag"
import Table, { Td, Th } from "@/components/ui/Table"
import TypedValueCell from "@/components/domain/TypedValueCell"
import { useIndex } from "@/data/store"
import { toDisplay } from "@/data/world"
import { formatSimTime } from "@/lib/format"
import { navigate, useViewState } from "@/router/router"
import {
  appendBranch,
  lineage,
  useBranches,
  useCommits,
} from "@/stores/history"
import { useRecordByCommit } from "@/stores/trace"
import { toast } from "@/stores/toast"
import type { BranchDef, CommitDef } from "@/core/types"
import { commitFocusPosition, commitGraphLayout } from "./commitGraphLayout"

const SOURCE_TAG = {
  base: { tone: "neutral" as const, label: "基础世界" },
  "reference-sample": { tone: "warning" as const, label: "参考样例" },
  computed: { tone: "success" as const, label: "当前图求值" },
} as const

const VISIBILITY_LABEL = {
  shared: "共享",
  private: "私有",
  team: "团队",
} as const

/**
 * P26 提交历史与分支：提交 DAG 按分支泳道绘制（跨分支的共同祖先只画在自己的泳道上，
 * 绝不把不同分支的计算合并为同一提交）。选历史提交只改 viewCommit；切分支是显式动作。
 */
export default function P26History({ ctx }: { ctx: WorkbenchContext }) {
  const index = useIndex()
  const branches = useBranches()
  const commits = useCommits()
  const { branch, viewCommit } = ctx
  const [creatingFrom, setCreatingFrom] = useState<CommitDef | null>(null)
  const [compareLeft, setCompareLeft] = useViewState<string>("left", "")
  const [compareRight, setCompareRight] = useViewState<string>("right", "")

  const branchList = useMemo(
    () =>
      Object.values(branches).sort((a, b) =>
        a.id === "main" ? -1 : b.id === "main" ? 1 : a.id.localeCompare(b.id),
      ),
    [branches],
  )
  const currentLine = useMemo(
    () => (branch ? new Set(lineage(commits, branch.headCommit).map((c) => c.id)) : new Set<string>()),
    [commits, branch],
  )

  if (!branch) return null

  const selectCommit = (commit: CommitDef) => {
    // 只看本分支谱系内的提交：仅移动 viewCommit，不改 branchId、不动 head。
    navigate(
      {
        pageId: "P26",
        params: { branchId: branch.id, viewCommit: commit.id },
      },
      { replace: true },
    )
  }
  const switchBranch = (b: BranchDef) =>
    navigate({
      pageId: "P26",
      params: { branchId: b.id, viewCommit: b.headCommit },
    })

  return (
    <div className="flex h-full min-h-0">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-surface">
        <div className="flex h-10 shrink-0 items-center border-b border-line px-3 text-label font-semibold">
          分支
        </div>
        <ul className="scroll-thin min-h-0 flex-1 overflow-auto py-1">
          {branchList.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => switchBranch(b)}
                className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-subtle ${
                  b.id === branch.id ? "bg-primary-soft/60" : ""
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <GitBranch size={13} className="text-muted" aria-hidden />
                  <span className="font-mono text-label">{b.id}</span>
                  <Tag size="sm" tone={b.visibility === "shared" ? "primary" : "neutral"}>
                    {VISIBILITY_LABEL[b.visibility]}
                  </Tag>
                </span>
                <span className="pl-5 text-caption text-muted">
                  {b.label} · head{" "}
                  <span className="font-mono">{b.headCommit}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className="scroll-thin min-w-0 flex-1 overflow-auto">
        <div className="flex min-h-full flex-col gap-4 p-4">
          <section className="flex flex-wrap items-center gap-2">
            <History size={18} className="text-muted" aria-hidden />
            <h2 className="text-title font-semibold">提交历史与分支</h2>
            <span className="font-mono text-label text-muted">{branch.id}</span>
            {viewCommit && viewCommit.id !== branch.headCommit ? (
              <>
                <Tag size="sm" tone="warning">
                  历史查看 · {viewCommit.id}
                </Tag>
                <Button
                  size="sm"
                  intent="ghost"
                  icon={RotateCcw}
                  onClick={() =>
                    navigate(
                      {
                        pageId: "P26",
                        params: {
                          branchId: branch.id,
                          viewCommit: branch.headCommit,
                        },
                      },
                      { replace: true },
                    )
                  }
                >
                  回到最新（{branch.headCommit}）
                </Button>
              </>
            ) : null}
            <span className="ml-auto text-caption text-muted">
              点提交只改 viewCommit；比较：
              {compareLeft || "未选左"} ↔ {compareRight || "未选右"}
            </span>
            <Button
              size="sm"
              intent="secondary"
              icon={GitCompare}
              disabled={!compareLeft || !compareRight}
              onClick={() =>
                navigate({
                  pageId: "P27",
                  params: {
                    leftCommit: compareLeft,
                    rightCommit: compareRight,
                  },
                })
              }
            >
              去 P27 对比
            </Button>
          </section>

          <Card className="overflow-hidden">
            <PanelHeader
              title="提交图"
              meta={<span>泳道 = 分支 · 横轴 ≈ 模拟时刻</span>}
            />
            <CommitGraph
              branches={branchList}
              commits={commits}
              currentBranch={branch}
              currentLine={currentLine}
              viewCommit={viewCommit}
              onSelect={selectCommit}
              onSwitchBranch={switchBranch}
            />
          </Card>

          {viewCommit ? (
            <CommitDetail
              commit={viewCommit}
              branch={branch}
              onBranchFrom={() => setCreatingFrom(viewCommit)}
              onCompare={(side) => {
                if (side === "left") setCompareLeft(viewCommit.id)
                else setCompareRight(viewCommit.id)
              }}
            />
          ) : (
            <Notice tone="info">
              在图上或分支谱系中选择一个提交查看摘要与变化。
            </Notice>
          )}
        </div>
      </div>

      {creatingFrom ? (
        <CreateBranchModal
          from={creatingFrom}
          runId={branch.runId}
          existing={Object.keys(branches)}
          onClose={() => setCreatingFrom(null)}
        />
      ) : null}
    </div>
  )
}

function CommitGraph({
  branches,
  commits,
  currentBranch,
  currentLine,
  viewCommit,
  onSelect,
  onSwitchBranch,
}: {
  branches: BranchDef[]
  commits: Record<string, CommitDef>
  currentBranch: BranchDef
  currentLine: Set<string>
  viewCommit: CommitDef | null
  onSelect: (commit: CommitDef) => void
  onSwitchBranch: (branch: BranchDef) => void
}) {
  const { rows, pos, width, height } = useMemo(
    () => commitGraphLayout(branches, commits),
    [branches, commits],
  )
  const scrollRef = useRef<HTMLDivElement>(null)

  // 路由 viewCommit → 图中聚焦：滚动到该提交进入视野（高亮由选中态圆环承担）。
  useEffect(() => {
    const container = scrollRef.current
    const p = commitFocusPosition(
      commitGraphLayout(branches, commits),
      viewCommit?.id,
    )
    if (!container || !p) return
    container.scrollTo({
      left: Math.max(0, p.x - container.clientWidth / 2),
      top: Math.max(0, p.y - 80),
      behavior: "smooth",
    })
  }, [branches, commits, viewCommit?.id])

  return (
    <div className="scroll-thin overflow-auto" ref={scrollRef}>
      <svg
        width={Math.max(width, 560)}
        height={height}
        role="img"
        aria-label="提交 DAG"
        className="block"
      >
        {rows.map((r) => (
          <text
            key={`lane-${r.branch.id}`}
            x={10}
            y={r.y + 4}
            className="fill-[#5b6b7c] text-[11px]"
            fontFamily="monospace"
          >
            {r.branch.id}
          </text>
        ))}
        {Object.values(commits).map((c) => {
          const from = c.parentId ? pos.get(c.parentId) : undefined
          const to = pos.get(c.id)
          if (!from || !to) return null
          return (
            <line
              key={`edge-${c.id}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="#b8c7d6"
              strokeWidth={1.5}
            />
          )
        })}
        {rows.flatMap((r) =>
          r.commits.map((c) => {
            const p = pos.get(c.id)!
            const isHead = branches.some((b) => b.headCommit === c.id)
            const selected = viewCommit?.id === c.id
            const inLine = currentLine.has(c.id)
            const otherBranch = c.branchId !== currentBranch.id
            return (
              <g
                key={c.id}
                transform={`translate(${p.x}, ${p.y})`}
                onClick={
                  inLine
                    ? () => onSelect(c)
                    : otherBranch
                      ? () =>
                          onSwitchBranch(
                            branches.find((b) => b.id === c.branchId)!,
                          )
                      : undefined
                }
                className={inLine || otherBranch ? "cursor-pointer" : undefined}
                role={inLine || otherBranch ? "button" : undefined}
                aria-label={`提交 ${c.id}`}
              >
                {!(inLine || otherBranch) ? (
                  <title>
                    样例提交 {c.id} 不在分支 {currentBranch.id} 的当前谱系内
                  </title>
                ) : null}
                <circle
                  r={selected ? 10 : 8}
                  fill={
                    c.source === "computed"
                      ? "#1f7a5c"
                      : c.source === "reference-sample"
                        ? "#b07817"
                        : "#5b6b7c"
                  }
                  stroke={selected ? "#0e7490" : "white"}
                  strokeWidth={selected ? 3 : 2}
                  opacity={inLine ? 1 : 0.55}
                />
                <text
                  y={-16}
                  textAnchor="middle"
                  className="fill-[#1d2b3a] text-[11px]"
                  fontFamily="monospace"
                >
                  {c.id}
                </text>
                <text
                  y={24}
                  textAnchor="middle"
                  className="fill-[#5b6b7c] text-[10px]"
                >
                  {formatSimTime(c.simTime)}
                </text>
                {isHead ? (
                  <text
                    y={38}
                    textAnchor="middle"
                    className="fill-[#1f7a5c] text-[10px]"
                  >
                    head
                  </text>
                ) : null}
              </g>
            )
          }),
        )}
      </svg>
      <div className="border-t border-line px-4 py-2 text-caption text-muted">
        点击本分支谱系内的提交只移动 viewCommit；点击其他分支的提交会先显式切到该分支（branchId
        才变化）。半透明的样例提交不在任何分支头的当前谱系内，只展示不可选。
      </div>
    </div>
  )
}

function CommitDetail({
  commit,
  branch,
  onBranchFrom,
  onCompare,
}: {
  commit: CommitDef
  branch: BranchDef
  onBranchFrom: () => void
  onCompare: (side: "left" | "right") => void
}) {
  const index = useIndex()
  const commits = useCommits()
  const record = useRecordByCommit(commit.id)
  const world = index.worlds.get(commit.id)
  const parent = commit.parentId ? commits[commit.parentId] : undefined
  const parentWorld = parent ? index.worlds.get(parent.id) : undefined
  const source = SOURCE_TAG[commit.source]

  const changes: Array<{
    entityId: string
    propertyId: string
    before: ReturnType<typeof toDisplay>
    after: ReturnType<typeof toDisplay>
  }> = []
  if (world && parentWorld) {
    for (const [entityId, values] of Object.entries(world.values)) {
      const prev = parentWorld.values[entityId] ?? {}
      for (const propertyId of new Set([
        ...Object.keys(values),
        ...Object.keys(prev),
      ])) {
        const a = prev[propertyId]
        const b = values[propertyId]
        if (JSON.stringify(a) !== JSON.stringify(b))
          changes.push({
            entityId,
            propertyId,
            before: toDisplay(a, parentWorld.commitId),
            after: toDisplay(b, world.commitId),
          })
      }
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <PanelHeader
          title={`提交 ${commit.id} 的变化`}
          meta={
            parent
              ? <span>相对父提交 {parent.id}</span>
              : <span>根提交 · 无父</span>
          }
        />
        {changes.length === 0 ? (
          <p className="px-4 py-4 text-label text-muted">
            {parent
              ? "与父提交相比没有世界值变化（或快照未记录）。"
              : "根提交没有父；完整快照见 P20 实体表。"}
          </p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>实体.属性</Th>
                <Th align="right">父提交值</Th>
                <Th align="right">本提交值</Th>
              </tr>
            </thead>
            <tbody>
              {changes.map((ch) => (
                <tr key={`${ch.entityId}.${ch.propertyId}`}>
                  <Td>
                    <span className="font-mono text-label">
                      {ch.entityId}.{ch.propertyId}
                    </span>
                  </Td>
                  <Td numeric>
                    <TypedValueCell value={ch.before} />
                  </Td>
                  <Td numeric>
                    <TypedValueCell value={ch.after} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card>
        <PanelHeader
          title="提交摘要"
          meta={<Tag size="sm" tone={source.tone}>{source.label}</Tag>}
        />
        <dl className="px-4 py-3">
          <KeyValue label="提交" mono>
            {commit.id}
          </KeyValue>
          <KeyValue label="分支" mono>
            {commit.branchId}
            {commit.branchId !== branch.id ? `（当前在 ${branch.id}）` : ""}
          </KeyValue>
          <KeyValue label="父提交" mono>
            {commit.parentId ?? "无（根）"}
          </KeyValue>
          <KeyValue label="回合 / 时刻" mono>
            第 {commit.round} 回合 · {formatSimTime(commit.simTime)}
          </KeyValue>
          <KeyValue label="检查点">
            {commit.checkpoint ? "有检查点，可续算" : "无独立检查点"}
          </KeyValue>
          <KeyValue label="过程记录" mono>
            {record ? record.record.id : "无（基准或未结算）"}
          </KeyValue>
          <KeyValue label="摘要">{commit.summary}</KeyValue>
        </dl>
        <div className="flex flex-wrap gap-2 border-t border-line px-4 py-3">
          <Button size="sm" intent="ghost" icon={GitBranch} onClick={onBranchFrom}>
            从此建立分支
          </Button>
          <Button size="sm" intent="ghost" onClick={() => onCompare("left")}>
            设为对比左
          </Button>
          <Button size="sm" intent="ghost" onClick={() => onCompare("right")}>
            设为对比右
          </Button>
        </div>
        <p className="border-t border-line px-4 py-2.5 text-caption leading-5 text-muted">
          历史提交只读：在其上不能直接推算（BASE_NOT_HEAD
          守卫）；续算请先「从此建立分支」。分享只修改分支可见性，需显式操作（原型未提供）。
        </p>
      </Card>
    </div>
  )
}

function CreateBranchModal({
  from,
  runId,
  existing,
  onClose,
}: {
  from: CommitDef
  runId: string
  existing: string[]
  onClose: () => void
}) {
  const [id, setId] = useState("")
  const [label, setLabel] = useState("")
  const [visibility, setVisibility] = useState<BranchDef["visibility"]>("private")
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    const clean = id.trim()
    if (!/^[A-Za-z][A-Za-z0-9._-]*$/.test(clean))
      return setError("分支 ID 只能包含字母、数字、点、下划线与连字符，并以字母开头")
    if (existing.includes(clean)) return setError(`分支 ${clean} 已存在`)
    appendBranch({
      id: clean,
      runId,
      label: label.trim() || clean,
      baseCommit: from.parentId,
      headCommit: from.id,
      visibility,
    })
    toast(`已建立分支 ${clean}（head 固定为 ${from.id}）；不影响其他分支`)
    onClose()
    navigate({
      pageId: "P26",
      params: { branchId: clean, viewCommit: from.id },
    })
  }

  return (
    <Modal
      title={`从 ${from.id} 建立分支`}
      subtitle="分支头固定为该提交；之后的推算只前进新分支"
      onClose={onClose}
      footer={
        <>
          <Button intent="ghost" onClick={onClose}>
            取消
          </Button>
          <Button intent="primary" onClick={submit}>
            建立分支
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 px-5 py-4">
        <Field label="分支 ID" required hint="例如 branch-one-cooler">
          <TextInput value={id} mono onChange={(e) => setId(e.target.value)} />
        </Field>
        <Field label="显示名" hint="留空时使用 ID">
          <TextInput value={label} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        <Field label="可见性" hint="分享是显式操作；默认私有">
          <Select
            value={visibility}
            onChange={(e) =>
              setVisibility(e.target.value as BranchDef["visibility"])
            }
            options={(
              Object.entries(VISIBILITY_LABEL) as Array<
                [BranchDef["visibility"], string]
              >
            ).map(([value, l]) => ({ value, label: l }))}
          />
        </Field>
        {error ? (
          <p role="alert" className="text-label text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  )
}
