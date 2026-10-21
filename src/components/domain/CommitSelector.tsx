import { useMemo } from "react"
import { GitBranch, GitCommitHorizontal } from "lucide-react"
import type { BranchDef, CommitDef } from "@/core/types"
import Dropdown from "@/components/ui/Dropdown"
import { formatSimTime } from "@/lib/format"
import { lineage, useBranches, useCommits } from "@/stores/history"

/**
 * C14 CommitSelector：选择提交只改 viewCommit，不覆盖分支 head；
 * 切换分支是显式动作，才改变 branchId。
 */
export default function CommitSelector({
  runId,
  branch,
  viewCommit,
  onSelectCommit,
  onSelectBranch,
}: {
  runId: string
  branch: BranchDef
  viewCommit: CommitDef | null
  onSelectCommit: (commitId: string) => void
  onSelectBranch: (branchId: string) => void
}) {
  const branches = useBranches()
  const commits = useCommits()
  const runBranches = useMemo(
    () => Object.values(branches).filter((b) => b.runId === runId),
    [branches, runId],
  )
  const line = useMemo(
    () => lineage(commits, branch.headCommit),
    [commits, branch.headCommit],
  )

  return (
    <div className="flex items-center gap-1.5">
      <Dropdown
        ariaLabel="切换分支"
        value={branch.id}
        width={280}
        onChange={onSelectBranch}
        renderValue={
          <span className="flex items-center gap-1.5">
            <GitBranch size={15} className="text-muted" aria-hidden />
            <span className="font-mono text-label">{branch.id}</span>
          </span>
        }
        options={runBranches.map((b) => ({
          value: b.id,
          label: (
            <span className="flex flex-col">
              <span className="font-mono text-label">{b.id}</span>
              <span className="text-caption text-muted">{b.label}</span>
            </span>
          ),
          meta: <span className="font-mono">head {b.headCommit}</span>,
        }))}
      />
      <Dropdown
        ariaLabel="选择查看的提交"
        value={viewCommit?.id ?? ""}
        width={360}
        onChange={onSelectCommit}
        renderValue={
          <span className="flex items-center gap-1.5">
            <GitCommitHorizontal size={15} className="text-muted" aria-hidden />
            <span className="font-mono text-label">
              {viewCommit?.id ?? "选择提交"}
            </span>
            {viewCommit && viewCommit.id === branch.headCommit ? (
              <span className="rounded bg-success-soft px-1 text-caption text-success">
                head
              </span>
            ) : viewCommit ? (
              <span className="rounded bg-warning-soft px-1 text-caption text-warning-ink">
                历史
              </span>
            ) : null}
          </span>
        }
        options={line.map((c) => ({
          value: c.id,
          label: (
            <span className="flex flex-col">
              <span className="flex items-center gap-2">
                <span className="font-mono text-label">{c.id}</span>
                {c.id === branch.headCommit ? (
                  <span className="rounded bg-success-soft px-1 text-caption text-success">
                    head
                  </span>
                ) : null}
                {c.branchId !== branch.id ? (
                  <span className="text-caption text-muted">
                    来自 {c.branchId}
                  </span>
                ) : null}
              </span>
              <span className="truncate text-caption text-muted">
                {c.summary}
              </span>
            </span>
          ),
          meta: (
            <span className="tabular">
              第 {c.round} 回合 · {formatSimTime(c.simTime)}
            </span>
          ),
        }))}
      />
    </div>
  )
}
