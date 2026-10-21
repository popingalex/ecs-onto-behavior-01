import { useMemo, useState } from "react"
import { ArrowUpRight, FlaskConical, Lock, Plus, Scale, Trash2 } from "lucide-react"
import type { WorkbenchContext } from "@/app/useWorkbenchContext"
import Button from "@/components/ui/Button"
import Card, { Notice, PanelHeader, SectionLabel } from "@/components/ui/Card"
import Field, { Select, TextInput } from "@/components/ui/Field"
import Modal from "@/components/ui/Modal"
import { Tag } from "@/components/ui/StatusTag"
import Table, { Td, Th } from "@/components/ui/Table"
import { formatNumber, formatSigned } from "@/lib/format"
import { navigate } from "@/router/router"
import type { ConstraintDef } from "@/schema/model"
import { refKey } from "@/schema/model"
import { executeRound, type RoundResult } from "@/services/mock-executor"
import { compileSchedule } from "@/services/scheduleCompiler"
import { useDraftModel } from "@/stores/modelDocuments"
import { toast } from "@/stores/toast"
import CommitText from "@/features/ecs/CommitText"
import RefsNotice from "@/features/ecs/RefsNotice"
import { applySystemsOp, useReadOnly } from "@/features/ecs/editing"
import {
  createConstraint,
  deleteConstraint,
  updateConstraint,
} from "@/features/ecs/operations"
import { constraintRefs, type RefHit } from "@/features/ecs/refs"

/** P16 联合约束与归约规则：约束配置（SYSTEMS_DOC 草稿）+ 归约路由 + 独立试算（不写入世界）。 */
export default function P16Contracts({ ctx }: { ctx: WorkbenchContext }) {
  const model = useDraftModel()
  const readOnly = useReadOnly()
  const constraintId = ctx.route.params.constraintId ?? model.constraints[0]?.id
  const constraint = model.constraints.find((c) => c.id === constraintId)
  const [creating, setCreating] = useState(false)
  const [blocked, setBlocked] = useState<{
    message: string
    refs?: RefHit[]
  } | null>(null)

  const schedule = model.schedules.find((s) => s.id === "schedule-main")
  const plan = useMemo(
    () =>
      schedule
        ? compileSchedule(schedule, {
            systems: model.systems,
            constraints: model.constraints,
            attributes: model.attributes,
            baseCommit: model.baseWorld.commitId,
          })
        : null,
    [schedule, model],
  )

  const patch = (
    label: string,
    body: Partial<Pick<ConstraintDef, "floorC" | "domain" | "unsupported">>,
  ) => {
    if (!constraint) return
    const result = applySystemsOp(label, (c) =>
      updateConstraint(c, constraint.id, body),
    )
    if (!result.ok) toast(result.message)
  }

  const remove = () => {
    if (!constraint) return
    const result = applySystemsOp(`删除约束 ${constraint.id}`, (c) =>
      deleteConstraint(model, c, constraint.id),
    )
    if (!result.ok) {
      setBlocked({ message: result.message, refs: result.refs })
      return
    }
    toast(`已删除约束 ${constraint.id}`)
    navigate({ pageId: "P16", params: {} })
  }

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-6 py-6">
      <section className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Scale size={18} className="text-muted" aria-hidden />
            <h2 className="text-title font-semibold">联合约束与归约规则</h2>
          </div>
          <p className="mt-1 max-w-[820px] text-body text-muted">
            额度分配规则与失败策略在此定义；获准值只能由裁决输出，请求超额度时按比例限幅并明示比例——不做默默限幅。
          </p>
        </div>
        <Button
          intent="primary"
          icon={Plus}
          disabled={readOnly}
          onClick={() => setCreating(true)}
        >
          新建约束
        </Button>
      </section>

      {readOnly ? (
        <Notice tone="warning" icon={<Lock size={15} aria-hidden />}>
          观察者为只读角色，约束配置不可编辑。
        </Notice>
      ) : null}
      {blocked ? (
        <RefsNotice message={blocked.message} refs={blocked.refs} />
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Card>
          <PanelHeader
            title="约束与协作组"
            meta={<span className="tabular">{model.constraints.length} 个</span>}
          />
          <ul className="divide-y divide-line">
            {model.constraints.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      { pageId: "P16", params: { constraintId: c.id } },
                      { replace: true },
                    )
                  }
                  className={`flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-subtle ${
                    c.id === constraint?.id ? "bg-primary-soft/60" : ""
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-label">
                      {c.id}@{c.version}
                    </span>
                    <span className="block text-caption text-muted">
                      {c.strategy} · 下限 {formatNumber(c.floorC)} °C
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {model.constraints.length === 0 ? (
              <li className="px-4 py-3 text-label text-muted">没有约束。</li>
            ) : null}
          </ul>
          {plan ? (
            <div className="border-t border-line px-4 py-3">
              <SectionLabel className="mb-1.5">归约节点（调度中）</SectionLabel>
              <ul className="space-y-1.5">
                {plan.reducers.map((r) => (
                  <li key={r.nodeId} className="text-label">
                    <button
                      type="button"
                      className="font-mono text-primary hover:underline"
                      onClick={() =>
                        navigate({
                          pageId: "P12",
                          params: { scheduleId: "schedule-main" },
                        })
                      }
                    >
                      {r.nodeId}
                    </button>
                    <span className="ml-2 text-caption text-muted">
                      {r.type === "ReducerNode" ? "归约器" : "合同裁决"} →{" "}
                      {r.constraint}
                    </span>
                  </li>
                ))}
                {plan.reducers.length === 0 ? (
                  <li className="text-caption text-faint">
                    调度中没有归约节点
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}
        </Card>

        {constraint ? (
          <ConstraintDetail
            key={constraint.id}
            constraint={constraint}
            readOnly={readOnly}
            onPatch={patch}
            onRemove={remove}
            planReducers={
              plan?.reducers.filter((r) => r.constraint === refKey(constraint)) ??
              []
            }
          />
        ) : (
          <Card>
            <p className="px-4 py-6 text-label text-muted">
              请选择左侧约束，或新建一个。
            </p>
          </Card>
        )}
      </div>

      <TrialPanel />

      {creating ? (
        <CreateConstraintModal
          existing={model.constraints.map((c) => c.id)}
          onClose={() => setCreating(false)}
        />
      ) : null}
    </div>
  )
}

function ConstraintDetail({
  constraint,
  readOnly,
  onPatch,
  onRemove,
  planReducers,
}: {
  constraint: ConstraintDef
  readOnly: boolean
  onPatch: (
    label: string,
    body: Partial<Pick<ConstraintDef, "floorC" | "domain" | "unsupported">>,
  ) => void
  onRemove: () => void
  planReducers: Array<{
    nodeId: string
    type: "ReducerNode" | "ContractNode"
    inputs: Array<{ systemId: string ;properties: string[] }>
  }>
}) {
  const model = useDraftModel()
  const consumers = model.attributes.filter(
    (a) => a.reducerRef && a.reducerRef.id === constraint.id,
  )
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Card>
        <PanelHeader
          title={`${constraint.id}@${constraint.version}`}
          meta={<Tag size="sm" tone="primary">{constraint.strategy}</Tag>}
          actions={
            <Button
              size="sm"
              intent="danger-ghost"
              icon={Trash2}
              disabled={readOnly}
              onClick={onRemove}
            >
              删除约束
            </Button>
          }
        />
        <div className="grid max-w-3xl grid-cols-2 gap-4 px-4 py-4">
          <CommitText
            label="冷却下限 floorC（°C）"
            value={String(constraint.floorC)}
            readOnly={readOnly}
            required
            mono
            error={
              !Number.isFinite(Number(constraint.floorC))
                ? "下限必须是有限数值"
                : null
            }
            onCommit={(v) => {
              const n = Number(v)
              if (!Number.isFinite(n)) {
                toast(`下限 ${v} 不是有限数值，未入库`)
                return
              }
              onPatch(`${constraint.id} · 下限`, { floorC: n })
            }}
          />
          <CommitText
            label="适用域 domain"
            value={constraint.domain}
            readOnly={readOnly}
            required
            mono
            error={!constraint.domain.trim() ? "适用域不能为空" : null}
            onCommit={(v) => onPatch(`${constraint.id} · 适用域`, { domain: v })}
          />
        </div>
        <div className="border-t border-line px-4 py-4">
          <CommitText
            label="不支持的输入（失败策略）"
            value={constraint.unsupported}
            readOnly={readOnly}
            mono
            onCommit={(v) =>
              onPatch(`${constraint.id} · 失败策略`, { unsupported: v })
            }
          />
          <p className="mt-2 text-caption leading-5 text-muted">
            超出适用域的输入（如混合冷源温度、正向加热贡献、关联资源效果）不做默认缩放，
            裁决会拒绝而不是默默限幅；库存不足按 partial 明示，不显示为成功。
          </p>
        </div>
      </Card>

      <Card>
        <PanelHeader
          title="参与角色与提案字段"
          meta={<span>使用该约束归约的贡献属性</span>}
        />
        {consumers.length === 0 ? (
          <p className="px-4 py-4 text-label text-muted">
            没有属性的 reducerRef 指向该约束。
          </p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>贡献属性</Th>
                <Th>写入方式</Th>
                <Th>参与 System</Th>
              </tr>
            </thead>
            <tbody>
              {consumers.map((a) => {
                const systems = model.systems.filter((s) =>
                  s.access.contribute.includes(`self.${a.id}`),
                )
                return (
                  <tr key={a.id}>
                    <Td>
                      <button
                        type="button"
                        className="font-mono text-label text-primary hover:underline"
                        onClick={() =>
                          navigate({
                            pageId: "P29",
                            params: { attributeId: a.id },
                          })
                        }
                      >
                        {a.id}
                      </button>
                      <span className="ml-2 text-caption text-muted">
                        {a.label}
                      </span>
                    </Td>
                    <Td>
                      <Tag size="sm" tone="primary">
                        {a.writeMode}
                      </Tag>
                    </Td>
                    <Td>
                      {systems.length ? (
                        systems.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            className="mr-2 font-mono text-label text-primary hover:underline"
                            onClick={() =>
                              navigate({
                                pageId: "P11",
                                params: { systemId: s.id },
                              })
                            }
                          >
                            {s.id}
                          </button>
                        ))
                      ) : (
                        <span className="text-caption text-faint">无</span>
                      )}
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        )}
        {planReducers.length > 0 ? (
          <div className="border-t border-line px-4 py-3">
            <SectionLabel className="mb-1.5">分配规则（归约输入）</SectionLabel>
            {planReducers.map((r) => (
              <p key={r.nodeId} className="text-label text-muted">
                {r.nodeId}：{r.inputs
                  .map((i) => `${i.systemId}（${i.properties.join("、") || "无属性"}）`)
                  .join("；") || "没有 System 流入"}
              </p>
            ))}
          </div>
        ) : null}
      </Card>
    </div>
  )
}

/** 独立试算：对当前草稿在基础世界上同步求值一回合；结果只展示，不写入任何存储。 */
function TrialPanel() {
  const model = useDraftModel()
  const [trial, setTrial] = useState<
    { ok: true ;result: RoundResult } | { ok: false ;messages: string[] } | null
  >(null)

  const run = () => {
    const outcome = executeRound({
      model,
      world: model.baseWorld,
      runId: "trial",
      branchId: "trial",
      baseCommit: model.baseWorld.commitId,
      stepSeconds: 10,
      recordId: "trial-record",
      resultCommitId: "trial-commit",
    })
    setTrial(
      outcome.ok
        ? { ok: true, result: outcome.result }
        : { ok: false, messages: outcome.diagnostics.map((d) => d.message) },
    )
  }

  return (
    <Card>
      <PanelHeader
        title="独立试算"
        meta={<span>当前草稿 × 基础世界 {model.baseWorld.commitId} · 不写入当前世界</span>}
        actions={
          <Button size="sm" icon={FlaskConical} onClick={run}>
            试算一回合
          </Button>
        }
      />
      {!trial ? (
        <p className="px-4 py-4 text-label text-muted">
          试算结果只在本面板展示；正式裁决记录见 P23（按提交查阅）。
        </p>
      ) : !trial.ok ? (
        <div className="px-4 py-3">
          <Notice tone="danger">
            试算未产生结果：{trial.messages.join("；")}
          </Notice>
        </div>
      ) : trial.result.decisions.length === 0 ? (
        <p className="px-4 py-4 text-label text-muted">
          本回合没有任何贡献进入裁决（可能没有启用的 System）。
        </p>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>目标</Th>
              <Th align="right">旧值</Th>
              <Th align="right">额度</Th>
              <Th align="right">比例</Th>
              <Th align="right">最终</Th>
              <Th>获准明细</Th>
            </tr>
          </thead>
          <tbody>
            {trial.result.decisions.map((d) => (
              <tr key={d.id}>
                <Td>
                  <span className="font-mono text-label">
                    {d.entityId}.{d.propertyId}
                  </span>
                </Td>
                <Td numeric>{formatNumber(d.old)} °C</Td>
                <Td numeric>{formatNumber(d.budget)} K</Td>
                <Td numeric>{formatNumber(d.scale)}</Td>
                <Td numeric>{formatNumber(d.final)} °C</Td>
                <Td>
                  <span className="text-caption text-muted">
                    {d.allocations
                      .map(
                        (a) =>
                          `${a.effectId.split(":").pop()} ${formatSigned(a.approvedDelta)} K（${a.status}）`,
                      )
                      .join("；")}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <div className="flex gap-2 border-t border-line px-4 py-3">
        <Button
          size="sm"
          intent="ghost"
          icon={ArrowUpRight}
          onClick={() =>
            navigate({ pageId: "P23", params: { viewCommit: "c043" } })
          }
        >
          查看样例裁决（P23）
        </Button>
        <Button
          size="sm"
          intent="ghost"
          icon={ArrowUpRight}
          onClick={() => navigate({ pageId: "P28", params: {} })}
        >
          长协作任务监控（P28）
        </Button>
      </div>
    </Card>
  )
}

function CreateConstraintModal({
  existing,
  onClose,
}: {
  existing: string[]
  onClose: () => void
}) {
  const [id, setId] = useState("")
  const [floorC, setFloorC] = useState("20")
  const [domain, setDomain] = useState("")
  const [unsupported, setUnsupported] = useState("")
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    const n = Number(floorC)
    const result = applySystemsOp(`新建约束 ${id}`, (c) =>
      createConstraint(c, { id, floorC: n, domain, unsupported }),
    )
    if (!result.ok) {
      setError(result.message)
      return
    }
    toast(`已创建约束 ${id}@c1`)
    onClose()
    navigate({ pageId: "P16", params: { constraintId: id } })
  }

  return (
    <Modal
      title="新建约束"
      subtitle="策略固定为 proportional（v0.5 唯一归约策略）"
      onClose={onClose}
      footer={
        <>
          <Button intent="ghost" onClick={onClose}>
            取消
          </Button>
          <Button intent="primary" onClick={submit}>
            创建
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 px-5 py-4">
        <Field label="约束 ID" required hint="例如 cooling-floor">
          <TextInput value={id} mono onChange={(e) => setId(e.target.value)} />
        </Field>
        <Field label="冷却下限 floorC（°C）" required>
          <TextInput
            value={floorC}
            mono
            onChange={(e) => setFloorC(e.target.value)}
          />
        </Field>
        <Field label="适用域 domain" required>
          <TextInput value={domain} onChange={(e) => setDomain(e.target.value)} />
        </Field>
        <Field label="不支持的输入（失败策略）">
          <TextInput
            value={unsupported}
            onChange={(e) => setUnsupported(e.target.value)}
          />
        </Field>
        {existing.includes(id) ? (
          <p role="alert" className="text-label text-danger">
            约束 {id} 已存在
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-label text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  )
}
