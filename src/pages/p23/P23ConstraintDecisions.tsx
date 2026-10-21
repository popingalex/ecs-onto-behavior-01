import { ArrowUpRight, Layers, Scale } from "lucide-react"
import type { WorkbenchContext } from "@/app/useWorkbenchContext"
import Button from "@/components/ui/Button"
import Card, { KeyValue, Notice, PanelHeader, SectionLabel } from "@/components/ui/Card"
import { Tag } from "@/components/ui/StatusTag"
import TypedValueCell from "@/components/domain/TypedValueCell"
import { useIndex } from "@/data/store"
import { formatNumber, formatSigned } from "@/lib/format"
import { navigate } from "@/router/router"
import { useRecordByCommit } from "@/stores/trace"

const ALLOCATION_STATUS = {
  approved: { tone: "success" as const, label: "全额获准" },
  partial: { tone: "warning" as const, label: "按比例限幅" },
  rejected: { tone: "danger" as const, label: "已拒绝" },
}

/** P23 联合约束与贡献裁决：effectId 连接 requested→approved→final 与比例；未裁决不补 0。 */
export default function P23ConstraintDecisions({
  ctx,
}: {
  ctx: WorkbenchContext
}) {
  const index = useIndex()
  const { viewCommit, route } = ctx
  const record = useRecordByCommit(viewCommit?.id)

  if (!viewCommit) return null
  if (!record) {
    return (
      <div className="mx-auto w-full max-w-[960px] px-6 py-6">
        <Notice tone="info">
          提交 <span className="font-mono">{viewCommit.id}</span>{" "}
          没有裁决记录：基准提交或失败的回合不产生 decision，获准值不会以 0 占位。
        </Notice>
      </div>
    )
  }

  const unitOf = (id: string | null) => (id ? (index.units.get(id) ?? null) : null)
  const gotoNode = (effectId: string) => {
    const e = record.effectRequests.find((x) => x.id === effectId)
    if (!e) return
    navigate({
      pageId: "P22",
      params: {
        runId: record.record.runId,
        branchId: record.record.branchId,
        viewCommit: record.record.resultCommit,
        systemId: e.systemId,
        entityId: e.entityId,
        nodeId: e.nodeId,
      },
    })
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] px-6 py-6">
      <div className="mb-4 flex items-center gap-3">
        <Scale size={18} className="text-muted" aria-hidden />
        <h1 className="text-body-lg font-semibold">联合约束与贡献裁决</h1>
        <span className="font-mono text-label text-muted">
          {record.record.id}
        </span>
        <Tag
          size="sm"
          tone={record.origin === "computed" ? "success" : "warning"}
        >
          {record.origin === "computed" ? "当前图求值" : "参考样例 · 非当前图计算"}
        </Tag>
        <Tag size="sm" tone="neutral">
          第二层 · system 内行为
        </Tag>
        <Button
          size="sm"
          intent="ghost"
          icon={Layers}
          onClick={() =>
            navigate({
              pageId: "P20",
              params: {
                runId: record.record.runId,
                branchId: record.record.branchId,
                viewCommit: record.record.resultCommit,
              },
            })
          }
        >
          返回编排层
        </Button>
        <span className="ml-auto text-label text-muted">
          额度 = max(旧值 − 冷源下限, 0)，按 |请求| 比例分配；裁决前的获准值显示“待裁决”，不补 0。
        </span>
      </div>

      {record.decisions.length === 0 ? (
        <Notice tone="info">本回合没有任何贡献进入裁决（可能没有启用的 System）。</Notice>
      ) : null}

      <div className="space-y-4">
        {record.decisions.map((d) => {
          const highlighted = route.params.decisionId === d.id
          return (
            <Card
              key={d.id}
              className={highlighted ? "ring-2 ring-primary-soft" : undefined}
            >
              <PanelHeader
                title={
                  <span className="font-mono text-label">
                    {d.id} · {d.entityId}.{d.propertyId}
                  </span>
                }
                meta={
                  <>
                    <span className="font-mono">{d.constraintRef}</span>
                    <Tag size="sm" tone="neutral">
                      proportional
                    </Tag>
                  </>
                }
                actions={
                  <Button
                    size="sm"
                    intent="ghost"
                    icon={ArrowUpRight}
                    onClick={() =>
                      navigate({
                        pageId: "P24",
                        params: {
                          runId: record.record.runId,
                          branchId: record.record.branchId,
                          viewCommit: record.record.resultCommit,
                          entityId: d.entityId,
                          propertyId: d.propertyId,
                          decisionId: d.id,
                        },
                      })
                    }
                  >
                    属性来源
                  </Button>
                }
              />
              <div className="grid grid-cols-2 gap-x-8 border-b border-line px-4 py-3 md:grid-cols-5">
                <KeyValue label="旧值">
                  <TypedValueCell
                    align="left"
                    value={{
                      state: "value",
                      value: d.old,
                      commitId: record.record.baseCommit,
                    }}
                    unit={unitOf(d.valueUnitId)}
                    showCommit
                  />
                </KeyValue>
                <KeyValue label="额度">
                  <span className="tabular">
                    {formatNumber(d.budget)} {d.budgetUnitId === "deltaK" ? "K" : ""}
                  </span>
                </KeyValue>
                <KeyValue label="比例">
                  <span className="tabular">{formatNumber(d.scale)}</span>
                </KeyValue>
                <KeyValue label="候选(不限幅)">
                  <span className="tabular">
                    {formatNumber(d.candidate)} °C
                  </span>
                </KeyValue>
                <KeyValue label="最终">
                  <TypedValueCell
                    align="left"
                    value={{
                      state: "value",
                      value: d.final,
                      commitId: record.record.resultCommit,
                    }}
                    unit={unitOf(d.valueUnitId)}
                    showCommit
                  />
                </KeyValue>
              </div>
              <table className="w-full text-label">
                <thead>
                  <tr className="border-b border-line text-left text-caption text-muted">
                    <th className="px-4 py-2 font-medium">效果（effectId）</th>
                    <th className="px-3 py-2 font-medium">System</th>
                    <th className="px-3 py-2 font-medium text-right">请求</th>
                    <th className="px-3 py-2 font-medium text-right">暂存预览</th>
                    <th className="px-3 py-2 font-medium text-right">获准</th>
                    <th className="px-3 py-2 font-medium">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {d.allocations.map((a) => {
                    const e = record.effectRequests.find(
                      (x) => x.id === a.effectId,
                    )
                    const status = ALLOCATION_STATUS[a.status]
                    return (
                      <tr
                        key={a.effectId}
                        className="border-b border-line last:border-0"
                      >
                        <td className="px-4 py-1.5">
                          <button
                            type="button"
                            className="font-mono text-label text-primary hover:underline"
                            title="定位到 P22 的发出节点与其固定图版本"
                            onClick={() => gotoNode(a.effectId)}
                          >
                            {a.effectId}
                          </button>
                        </td>
                        <td className="px-3 py-1.5 font-mono text-muted">
                          {e?.systemId ?? "—"}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          {e ? (
                            <TypedValueCell
                              value={{
                                state: "requested",
                                value: e.requestedDelta,
                              }}
                              unit={unitOf(e.unitId)}
                            />
                          ) : (
                            <TypedValueCell value={{ state: "unrecorded" }} />
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          {e?.selfPreview !== null &&
                          e?.selfPreview !== undefined ? (
                            <TypedValueCell
                              value={{
                                state: "selfPreview",
                                value: e.selfPreview,
                              }}
                              unit={unitOf(e.previewUnitId)}
                            />
                          ) : (
                            <TypedValueCell value={{ state: "unrecorded" }} />
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular">
                          {formatSigned(a.approvedDelta)} K
                        </td>
                        <td className="px-3 py-1.5">
                          <Tag size="sm" tone={status.tone}>
                            {status.label}
                          </Tag>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Card>
          )
        })}
      </div>

      <div className="mt-6">
        <SectionLabel>未被裁决的请求</SectionLabel>
        {record.effectRequests.filter(
          (e) =>
            !record.decisions.some((d) =>
              d.allocations.some((a) => a.effectId === e.id),
            ),
        ).length === 0 ? (
          <p className="mt-1 text-label text-muted">
            所有效果请求都已进入裁决。
          </p>
        ) : (
          <ul className="mt-1 space-y-1">
            {record.effectRequests
              .filter(
                (e) =>
                  !record.decisions.some((d) =>
                    d.allocations.some((a) => a.effectId === e.id),
                  ),
              )
              .map((e) => (
                <li
                  key={e.id}
                  className="flex items-center gap-2 text-label text-muted"
                >
                  <span className="font-mono">{e.id}</span>
                  <TypedValueCell value={{ state: "pending" }} align="left" />
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  )
}
