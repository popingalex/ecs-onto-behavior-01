import { CircleDashed, Lock, Target } from "lucide-react"
import type { WorkbenchContext } from "@/app/useWorkbenchContext"
import Button from "@/components/ui/Button"
import Card, { KeyValue, Notice, PanelHeader, SectionLabel } from "@/components/ui/Card"
import { Tag } from "@/components/ui/StatusTag"
import { useIndex } from "@/data/store"
import { migrationOf } from "@/mock/legacy"
import { navigate } from "@/router/router"

const GROUPS: ReadonlyArray<{
  key: string
  title: string
  body: string
  queryLink?: boolean
}> = [
  {
    key: "activate",
    title: "采用与激活",
    body: "激活条件（如“火源发现且未熄灭”）在 v0.5 契约中没有策略结构字段承载；q-fire 查询（fire.active = true）是目前唯一真实的条件来源。",
    queryLink: true,
  },
  {
    key: "sustain",
    title: "持续目标",
    body: "最低合格数、水量下限等字段未入库。v0.5 世界只有车辆的 water.remaining / water.capacity 读数，没有策略评估把它们解释为“合格”。",
  },
  {
    key: "preempt",
    title: "提前修复",
    body: "阈值预测与接替派遣不在本轮执行范围；没有预测事件记录，预计触及阈值的时刻不会被计算或缓存。",
  },
  {
    key: "terminate",
    title: "终止与交接",
    body: "终止条件（火源熄灭或撤销）与交接规则无契约字段；撤销应产生新操作而非删除历史——该语义在 P21 命令队列层面保留。",
  },
] as const

/**
 * P17 持续策略定义：种子只有 legacy-fixture 的 policy-cover@p2（id/version/label），
 * v0.5 契约没有结构化策略字段——本页如实展示资产条目并标注各分组的未入库状态，不编造字段。
 */
export default function P17Policies({ ctx }: { ctx: WorkbenchContext }) {
  const index = useIndex()
  const policies = [...index.policies.values()]
  const policyId = ctx.route.params.policyId ?? policies[0]?.id
  const policy = policies.find((p) => p.id === policyId)

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-6 py-6">
      <section>
        <div className="flex items-center gap-2">
          <Target size={18} className="text-muted" aria-hidden />
          <h2 className="text-title font-semibold">持续策略定义</h2>
        </div>
        <p className="mt-1 max-w-[820px] text-body text-muted">
          持续策略的目标、最低合格数、水量下限与交接条件。当前 v0.5
          模型只登记了策略资产条目，结构化定义尚未入库。
        </p>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card>
          <PanelHeader
            title="策略资产"
            meta={<span className="tabular">{policies.length} 个</span>}
          />
          <ul className="divide-y divide-line">
            {policies.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      { pageId: "P17", params: { policyId: p.id } },
                      { replace: true },
                    )
                  }
                  className={`flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-subtle ${
                    p.id === policy?.id ? "bg-primary-soft/60" : ""
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-body font-medium">{p.label}</span>
                    <span className="block font-mono text-caption text-muted">
                      {p.id}@{p.version}
                    </span>
                  </span>
                  <Tag size="sm" tone="neutral">
                    旧样例
                  </Tag>
                </button>
              </li>
            ))}
            {policies.length === 0 ? (
              <li className="px-4 py-3 text-label text-muted">
                没有策略资产。
              </li>
            ) : null}
          </ul>
        </Card>

        {policy ? (
          <div className="flex min-w-0 flex-col gap-4">
            <Card>
              <PanelHeader
                title={policy.label}
                meta={
                  <span className="font-mono">
                    {policy.id}@{policy.version}
                  </span>
                }
              />
              <div className="px-4 py-3">
                <Notice tone="info" icon={<CircleDashed size={15} aria-hidden />}>
                  {migrationOf(policy.id)?.note ??
                    "该策略不在 v0.5 核心模型内。"}
                  自然语言输入只应生成待审结构化草稿，运行不依赖
                  LLM；当前没有可编辑的策略文档，下列分组为规格语义的占位说明。
                </Notice>
                <dl className="mt-3">
                  <KeyValue label="目标" mono>
                    未记录（规格示例为 F01；v0.5 没有策略→目标绑定字段）
                  </KeyValue>
                  <KeyValue label="最低合格数" mono>
                    未记录（minCount=1 表示“至少 1”，不是“恰好 1”）
                  </KeyValue>
                  <KeyValue label="水量下限" mono>
                    未记录（规格示例为 ≥50%；当前世界可读数见 P28）
                  </KeyValue>
                  <KeyValue label="交接条件" mono>
                    未记录
                  </KeyValue>
                </dl>
              </div>
            </Card>

            <Card>
              <PanelHeader
                title="结构分组"
                meta={<span>规格语义 · 未入库</span>}
              />
              <div className="grid grid-cols-1 gap-3 px-4 py-4 md:grid-cols-2">
                {GROUPS.map((g) => (
                  <section
                    key={g.key}
                    className="rounded-ui border border-line bg-subtle px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <SectionLabel>{g.title}</SectionLabel>
                      <Tag size="sm" tone="neutral">
                        未入库
                      </Tag>
                    </div>
                    <p className="mt-1 text-caption leading-5 text-muted">
                      {g.body}
                    </p>
                    {g.queryLink ? (
                      <Button
                        size="sm"
                        intent="ghost"
                        className="mt-1.5"
                        onClick={() =>
                          navigate({ pageId: "P10", params: { queryId: "q-fire" } })
                        }
                      >
                        查看 q-fire 查询（P10）
                      </Button>
                    ) : null}
                  </section>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 border-t border-line px-4 py-3">
                <Button
                  size="sm"
                  intent="ghost"
                  disabled
                  title="v0.5 没有策略草稿文档，不能模拟安装"
                >
                  <Lock size={13} aria-hidden className="mr-1" />
                  模拟安装（不可用）
                </Button>
                <Button
                  size="sm"
                  intent="ghost"
                  onClick={() => navigate({ pageId: "P18", params: {} })}
                >
                  去 P18 校验与发布
                </Button>
                <Button
                  size="sm"
                  intent="ghost"
                  onClick={() =>
                    navigate({
                      pageId: "P28",
                      params: { instanceKey: `${policy.id}@${policy.version}` },
                    })
                  }
                >
                  已运行实例监控（P28）
                </Button>
              </div>
            </Card>
          </div>
        ) : (
          <Card>
            <p className="px-4 py-6 text-label text-muted">请选择左侧策略。</p>
          </Card>
        )}
      </div>
    </div>
  )
}
