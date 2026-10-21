import { useState } from "react"
import { CirclePlay, Lock, Plus, WifiOff } from "lucide-react"
import type { WorkbenchContext } from "@/app/useWorkbenchContext"
import Button from "@/components/ui/Button"
import Card, { Notice, PanelHeader } from "@/components/ui/Card"
import Field, { Select, TextInput } from "@/components/ui/Field"
import { Tag } from "@/components/ui/StatusTag"
import Table, { Td, Th, Tr } from "@/components/ui/Table"
import { useIndex } from "@/data/store"
import { formatSimTime } from "@/lib/format"
import { navigate } from "@/router/router"
import { useConnection, useRole } from "@/stores/context"
import { useBranches, useCommits } from "@/stores/history"
import { usePublishedBundles } from "@/stores/publish"
import {
  createRun,
  useCatalogRuns,
  type CatalogRun,
} from "@/stores/runCatalog"
import { useRunSession } from "@/stores/session"
import { toast } from "@/stores/toast"

const RUNTIME_LABEL = {
  server: "共享运行服务器（权威）",
  "local-worker": "本机 / 浏览器 Worker",
} as const

function RunRow({ runId }: { runId: string }) {
  const index = useIndex()
  const branches = useBranches()
  const commits = useCommits()
  const session = useRunSession(runId)
  const run = index.runs.get(runId)
  if (!run) return null
  const runBranches = Object.values(branches).filter((b) => b.runId === runId)
  const main = runBranches[0]
  const head = main ? commits[main.headCommit] : undefined
  return (
    <Tr
      onSelect={() =>
        navigate(
          { pageId: "P19", params: { runId } },
          { replace: true },
        )
      }
    >
      <Td>
        <div className="font-medium">{run.label}</div>
        <div className="font-mono text-caption text-muted">{run.id}</div>
      </Td>
      <Td>
        <span className="font-mono text-label">{run.bundleId}</span>
      </Td>
      <Td numeric>
        {run.stepSeconds}s / {run.playbackSeconds}s
      </Td>
      <Td>{RUNTIME_LABEL[run.runtime]}</Td>
      <Td>
        {head ? (
          <span className="font-mono text-label">
            {main?.id}@{head.id}
          </span>
        ) : (
          <span className="text-caption text-faint">无分支</span>
        )}
      </Td>
      <Td>
        <Tag size="sm" tone={session.phase === "waitingInputs" ? "neutral" : "primary"}>
          {session.phase === "waitingInputs" ? "等待输入" : session.phase}
        </Tag>
      </Td>
    </Tr>
  )
}

/** P19 新建运行：选 bundle / 模式步长 / 运行位置；创建只登记运行与分支，不自动结算。 */
export default function P19NewRun({ ctx }: { ctx: WorkbenchContext }) {
  const index = useIndex()
  const role = useRole()
  const connection = useConnection()
  const catalog = useCatalogRuns()
  const published = usePublishedBundles()
  const baseWorld = index.seed.worlds[0]

  const runIds = [...index.runs.keys()]
  const selectedRunId = ctx.route.params.runId ?? runIds[0]
  const bundles = [
    ...[...index.bundles.values()].map((b) => ({
      id: b.id,
      label: `${b.id} · ${b.label}（种子旧样例 r${b.revision}）`,
    })),
    ...published.map((b) => ({
      id: b.id,
      label: `${b.id} · ${b.label}（本地发布 r${b.revision}）`,
    })),
  ]

  const [name, setName] = useState("")
  const [bundleId, setBundleId] = useState(
    ctx.route.params.bundleId ?? bundles[0]?.id ?? "",
  )
  const [step, setStep] = useState("10")
  const [playback, setPlayback] = useState("1")
  const [runtime, setRuntime] = useState<"server" | "local-worker">("server")
  const [error, setError] = useState<string | null>(null)

  const readOnly = role === "observer"
  const offline = connection === "offline"

  const submit = () => {
    if (readOnly || offline) return
    const stepSeconds = Number(step)
    const playbackSeconds = Number(playback)
    if (!Number.isFinite(stepSeconds) || stepSeconds <= 0)
      return setError("步长必须是正数")
    if (!Number.isFinite(playbackSeconds) || playbackSeconds <= 0)
      return setError("播放步长必须是正数")
    if (!bundleId) return setError("请选择发布包")
    const entry: CatalogRun = createRun(
      {
        label: name,
        bundleId,
        stepSeconds,
        playbackSeconds,
        runtime,
      },
      baseWorld,
    )
    setError(null)
    setName("")
    toast(
      `已创建运行 ${entry.run.id}（分支 ${entry.branchId}，根提交 ${entry.rootCommit}）；不会自动结算`,
    )
    navigate(
      { pageId: "P19", params: { runId: entry.run.id } },
      { replace: true },
    )
  }

  const catalogEntry = catalog.find((r) => r.run.id === selectedRunId)

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-6 py-6">
      <section>
        <div className="flex items-center gap-2">
          <CirclePlay size={18} className="text-muted" aria-hidden />
          <h2 className="text-title font-semibold">演练创建与运行清单</h2>
        </div>
        <p className="mt-1 max-w-[860px] text-body text-muted">
          选择发布包、模式与步长、运行位置；创建只登记运行与主分支，
          不推进任何回合——进入 P20 后仍停在根提交等待显式推算。
        </p>
      </section>

      {readOnly ? (
        <Notice tone="warning" icon={<Lock size={15} aria-hidden />}>
          观察者为只读角色，不能创建运行。
        </Notice>
      ) : null}
      {offline ? (
        <Notice tone="warning" icon={<WifiOff size={15} aria-hidden />}>
          当前离线：表单保留，但不能创建运行。
        </Notice>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <PanelHeader
            title="运行列表"
            meta={<span className="tabular">{runIds.length} 个</span>}
          />
          <Table className="min-w-[900px]">
            <thead>
              <tr>
                <Th>运行</Th>
                <Th>发布包</Th>
                <Th align="right">步长/播放</Th>
                <Th>运行位置</Th>
                <Th>分支头</Th>
                <Th>状态</Th>
              </tr>
            </thead>
            <tbody>
              {runIds.map((id) => (
                <RunRow key={id} runId={id} />
              ))}
            </tbody>
          </Table>
          {selectedRunId ? (
            <div className="flex items-center gap-3 border-t border-line px-4 py-3">
              <span className="text-label text-muted">
                选中 <span className="font-mono">{selectedRunId}</span>
                {catalogEntry
                  ? ` · 本地创建 ${catalogEntry.createdAt.slice(0, 10)}`
                  : " · 种子运行"}
              </span>
              <EnterRunButton runId={selectedRunId} />
            </div>
          ) : null}
        </Card>

        <Card>
          <PanelHeader title="新建运行" meta={<span>创建后不自动结算</span>} />
          <div className="flex flex-col gap-4 px-4 py-4">
            <Field label="运行名称" hint="留空时使用运行 ID">
              <TextInput
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：夜班冷却演练"
              />
            </Field>
            <Field label="发布包" required hint="运行固定 bundle；本地发布的包也列在这里">
              <Select
                value={bundleId}
                onChange={(e) => setBundleId(e.target.value)}
                options={bundles.map((b) => ({ value: b.id, label: b.label }))}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="回合步长（秒）" required>
                <TextInput
                  value={step}
                  mono
                  onChange={(e) => setStep(e.target.value)}
                />
              </Field>
              <Field label="播放步长（秒）" required>
                <TextInput
                  value={playback}
                  mono
                  onChange={(e) => setPlayback(e.target.value)}
                />
              </Field>
            </div>
            <Field
              label="运行位置"
              required
              hint="分支可见性与计算范围是两回事；本原型两种位置都在本浏览器内求值"
            >
              <Select
                value={runtime}
                onChange={(e) =>
                  setRuntime(e.target.value as "server" | "local-worker")
                }
                options={(
                  Object.entries(RUNTIME_LABEL) as Array<
                    [keyof typeof RUNTIME_LABEL, string]
                  >
                ).map(([value, label]) => ({ value, label }))}
              />
            </Field>
            <Field label="初始提交" hint="基础世界快照的独立克隆；新建时生成">
              <TextInput
                value={`${baseWorld.commitId}（克隆为新根提交）`}
                mono
                readOnly
              />
            </Field>
            {error ? (
              <p role="alert" className="text-label text-danger">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end">
              <Button
                intent="primary"
                icon={Plus}
                disabled={readOnly || offline}
                onClick={submit}
              >
                创建运行
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <Notice tone="info">
        资源检查：原型没有独立资源管线，bundle
        所列定义在本地草稿文档中即时可用；16GB 无独显的性能基线未实测，不提供“性能通过”标签。
        新建运行的数据只保存在本浏览器（localStorage）。
      </Notice>
    </div>
  )
}

function EnterRunButton({ runId }: { runId: string }) {
  const branches = useBranches()
  const branch = Object.values(branches).find((b) => b.runId === runId)
  if (!branch) return null
  return (
    <Button
      size="sm"
      intent="primary"
      className="ml-auto"
      onClick={() =>
        navigate({
          pageId: "P20",
          params: {
            runId,
            branchId: branch.id,
            viewCommit: branch.headCommit,
          },
        })
      }
    >
      进入 P20（停在 head，等待推算）
    </Button>
  )
}
