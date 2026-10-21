import { Activity, ArrowUpRight, CircleDashed } from "lucide-react"
import type { WorkbenchContext } from "@/app/useWorkbenchContext"
import Button from "@/components/ui/Button"
import Card, { KeyValue, Notice, PanelHeader, SectionLabel } from "@/components/ui/Card"
import { Tag } from "@/components/ui/StatusTag"
import Table, { Td, Th } from "@/components/ui/Table"
import TypedValueCell from "@/components/domain/TypedValueCell"
import { useIndex } from "@/data/store"
import { toDisplay } from "@/data/world"
import { formatSimTime } from "@/lib/format"
import { navigate } from "@/router/router"
import { useBranches, useCommits } from "@/stores/history"
import { useStore } from "@/lib/store"
import { traceStore } from "@/stores/trace"
import { useMemo } from "react"

/**
 * P28 持续策略与任务监控：覆盖区间、候选与补救任务在 v0.5 没有执行/记录来源，
 * 本页展示真实存在的部分（策略资产条目、trace 中是否有策略事件、候选车辆的
 * 当前世界读数），其余以空态说明，不编造监控数据。
 */
export default function P28PolicyMonitor({ ctx }: { ctx: WorkbenchContext }) {
  const index = useIndex()
  const branches = useBranches()
  const commits = useCommits()
  const recordOrder = useStore(traceStore, (s) => s.order)
  const recordMap = useStore(traceStore, (s) => s.records)
  const records = useMemo(
    () => recordOrder.map((id) => recordMap[id]).filter(Boolean),
    [recordOrder, recordMap],
  )

  const policies = [...index.policies.values()]
  const instanceKey =
    ctx.route.params.instanceKey ??
    (policies[0] ? `${policies[0].id}@${policies[0].version}` : "")
  const policy = policies.find(
    (p) => `${p.id}@${p.version}` === instanceKey,
  )

  // 候选资源读数：当前各分支 head 世界里的泡沫车水量（世界快照，不是策略评估）。
  const headWorld = (() => {
    const main = branches["main"]
    const head = main ? commits[main.headCommit] : undefined
    return head ? index.worlds.get(head.id) : undefined
  })()
  const candidates = [...index.entities.values()].filter(
    (e) => e.classId === "FoamTruck",
  )

  // trace 中不存在策略 / 任务事件：v0.5 记录只有结算、裁决与提交。
  const policyEvents = records.filter((r) =>
    r.diagnostics.some((d) => d.code.includes("POLICY")),
  )

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-6 py-6">
      <section>
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-muted" aria-hidden />
          <h2 className="text-title font-semibold">持续策略与任务监控</h2>
        </div>
        <p className="mt-1 max-w-[860px] text-body text-muted">
          策略覆盖区间、候选排除原因与补救任务。预测与事实分开标记；
          没有记录来源的区块保持空态。
        </p>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <Card>
          <PanelHeader
            title="策略实例与目标"
            meta={<span className="tabular">{policies.length} 个</span>}
          />
          <ul className="divide-y divide-line">
            {policies.map((p) => {
              const key = `${p.id}@${p.version}`
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        { pageId: "P28", params: { instanceKey: key } },
                        { replace: true },
                      )
                    }
                    className={`flex w-full flex-col gap-0.5 px-4 py-2.5 text-left hover:bg-subtle ${
                      key === instanceKey ? "bg-primary-soft/60" : ""
                    }`}
                  >
                    <span className="font-mono text-label">{key}</span>
                    <span className="text-caption text-muted">
                      {p.label} · 目标：未在 v0.5 记录
                    </span>
                  </button>
                </li>
              )
            })}
            {policies.length === 0 ? (
              <li className="px-4 py-3 text-label text-muted">没有策略实例。</li>
            ) : null}
          </ul>
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <PanelHeader
              title={policy ? policy.label : "策略实例"}
              meta={<span className="font-mono">{instanceKey}</span>}
              actions={
                <Button
                  size="sm"
                  intent="ghost"
                  icon={ArrowUpRight}
                  onClick={() =>
                    navigate({
                      pageId: "P17",
                      params: policy ? { policyId: policy.id } : {},
                    })
                  }
                >
                  策略定义（P17）
                </Button>
              }
            />
            <div className="px-4 py-3">
              <dl>
                <KeyValue label="覆盖时间带">
                  <span className="text-muted">
                    无记录：v0.5 执行器不评估持续策略，回合记录中没有覆盖区间。
                  </span>
                </KeyValue>
                <KeyValue label="策略事件">
                  {policyEvents.length > 0 ? (
                    <span className="font-mono">{policyEvents.length} 条</span>
                  ) : (
                    <span className="text-muted">
                      0 条（trace 中只有结算 / 裁决 / 提交三类记录）
                    </span>
                  )}
                </KeyValue>
                <KeyValue label="状态">
                  <Tag size="sm" tone="neutral" icon={CircleDashed}>
                    待评估（pending）
                  </Tag>
                </KeyValue>
              </dl>
            </div>
          </Card>

          <Card>
            <PanelHeader
              title="候选资源（世界快照读数）"
              meta={
                <span>
                  主分支 head {headWorld ? `@${headWorld.commitId}` : "未记录"} ·
                  非策略评估结果
                </span>
              }
            />
            <Table>
              <thead>
                <tr>
                  <Th>车辆</Th>
                  <Th align="right">剩余水量</Th>
                  <Th align="right">容量</Th>
                  <Th>合格性</Th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((e) => {
                  const remaining = headWorld?.values[e.id]?.["water.remaining"]
                  const capacity = headWorld?.values[e.id]?.["water.capacity"]
                  return (
                    <tr key={e.id}>
                      <Td>
                        <span className="font-mono text-label">{e.id}</span>
                        <span className="ml-2 text-caption text-muted">
                          {e.label}
                        </span>
                      </Td>
                      <Td numeric>
                        <TypedValueCell
                          value={toDisplay(remaining, headWorld?.commitId)}
                          unit={index.units.get("L") ?? null}
                        />
                      </Td>
                      <Td numeric>
                        <TypedValueCell
                          value={toDisplay(capacity, headWorld?.commitId)}
                          unit={index.units.get("L") ?? null}
                        />
                      </Td>
                      <Td>
                        <span className="text-caption text-muted">
                          未评估：水量下限等策略条件未入库（见 P17）
                        </span>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          </Card>

          <Card>
            <PanelHeader title="补救任务" />
            <div className="flex flex-col gap-2 px-4 py-3 text-label text-muted">
              <p>
                补救任务与派遣在 v0.5 没有任务模型；旧样例任务{" "}
                <span className="font-mono">
                  {[...index.tasks.keys()].join("、") || "（无）"}
                </span>
                {" "}保留在资产索引中，没有路线 / 进度 / 等待 / 取消状态可读。
              </p>
              <p>
                任务「仅 accepted」时只能显示等待，不能显示到达；当前没有任务记录，
                也不存在空候选的缓存结果——候选新增时应触发重匹配，本页每次按当前
                head 重新读取。
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  intent="ghost"
                  onClick={() =>
                    navigate({
                      pageId: "P21",
                      params: {
                        baseCommit: commits[branches["main"]?.headCommit ?? ""]
                          ? branches["main"].headCommit
                          : "",
                      },
                    })
                  }
                >
                  运行命令队列（P21）
                </Button>
                <Button
                  size="sm"
                  intent="ghost"
                  icon={ArrowUpRight}
                  onClick={() => navigate({ pageId: "P25", params: {} })}
                >
                  事件链（P25）
                </Button>
              </div>
            </div>
          </Card>

          <Notice tone="info">
            预测线 / 实际线的区分依赖策略评估记录；v0.5 基线回合（
            {formatSimTime(420)} → {formatSimTime(430)}
            ）不包含策略子步，本页不绘制覆盖时间带。
          </Notice>
        </div>
      </div>
    </div>
  )
}
