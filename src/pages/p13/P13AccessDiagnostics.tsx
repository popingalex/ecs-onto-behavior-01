import { useMemo } from "react"
import { Crosshair, GitPullRequestArrow, ShieldAlert } from "lucide-react"
import type { WorkbenchContext } from "@/app/useWorkbenchContext"
import Button from "@/components/ui/Button"
import Card, { KeyValue, Notice, PanelHeader, SectionLabel } from "@/components/ui/Card"
import { Tag } from "@/components/ui/StatusTag"
import Table, { Td, Th } from "@/components/ui/Table"
import { navigate, useViewState } from "@/router/router"
import type { PrototypeModel, ScheduleDocument } from "@/schema/model"
import { refKey } from "@/schema/model"
import {
  accessProperty,
  compileSchedule,
  type ConcurrencyNote,
  type SchedulePlan,
} from "@/services/scheduleCompiler"
import { useDraftModel } from "@/stores/modelDocuments"

const LEVEL = {
  conflict: { tone: "danger" as const, label: "写冲突" },
  ordered: { tone: "warning" as const, label: "跨组有序" },
  safe: { tone: "success" as const, label: "可并行" },
}

/** 查询的具体目标实体：按类型与等值条件对世界快照求值（只读试算，不是裁决）。 */
function queryTargets(model: PrototypeModel, queryId: string): string[] {
  const query = model.queries.find((q) => q.id === queryId)
  if (!query) return []
  return model.scene.entities
    .filter((e) => {
      if (e.typeId !== query.typeId) return false
      const value = model.baseWorld.values[e.id]?.[query.condition.propertyId]
      return value === query.condition.value
    })
    .map((e) => e.id)
}

function AccessChips({ paths }: { paths: string[] }) {
  if (paths.length === 0) return <span className="text-caption text-faint">无</span>
  return (
    <div className="flex flex-wrap gap-1">
      {paths.map((p) => (
        <span
          key={p}
          className="rounded bg-neutral-soft px-1.5 py-0.5 font-mono text-caption text-ink-soft"
        >
          {accessProperty(p)}
        </span>
      ))}
    </div>
  )
}

function ConflictDetail({
  note,
  plan,
  schedule,
}: {
  note: ConcurrencyNote
  plan: SchedulePlan
  schedule: ScheduleDocument
}) {
  const groupOf = (systemId: string) =>
    plan.groups.find((g) => g.systems.some((s) => s.systemId === systemId))
      ?.index
  return (
    <Card>
      <PanelHeader
        title="冲突解释"
        meta={<span className="font-mono">{note.id}</span>}
      />
      <div className="px-4 py-3">
        <p className="text-body">{note.message}</p>
        <dl className="mt-2">
          <KeyValue label="属性" mono>
            {note.property}
          </KeyValue>
          <KeyValue label="执行组" mono>
            {note.systems
              .map((s) => `${s}（组 ${groupOf(s) ?? "—"}）`)
              .join(" vs ")}
          </KeyValue>
        </dl>
        <p className="mt-2 text-caption leading-5 text-muted">
          并发分析只看访问声明与 order 边：读取一律落在 previous 视图（基准提交），
          贡献经归约器统一裁决；动态目标集合在运行时才确定，
          本页给出的是声明级诊断，不代表运行时绝对安全。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            intent="ghost"
            icon={Crosshair}
            onClick={() =>
              navigate({ pageId: "P12", params: { scheduleId: schedule.id } })
            }
          >
            定位到 P12 调度
          </Button>
          {note.systems.map((s) => (
            <Button
              key={s}
              size="sm"
              intent="ghost"
              icon={Crosshair}
              onClick={() => navigate({ pageId: "P11", params: { systemId: s } })}
            >
              {s} 的访问声明
            </Button>
          ))}
        </div>
      </div>
    </Card>
  )
}

/** P13 读写访问与并发诊断：访问矩阵 + 执行组 + 冲突边（compileSchedule 的声明级分析）。 */
export default function P13AccessDiagnostics({
  ctx,
}: {
  ctx: WorkbenchContext
}) {
  const model = useDraftModel()
  const scheduleId = ctx.route.params.scheduleId ?? "schedule-main"
  const schedule = model.schedules.find((s) => s.id === scheduleId)
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
  const [selectedNote, setSelectedNote] = useViewState<string | null>(
    "conflict",
    null,
  )

  if (!schedule || !plan) {
    return (
      <div className="mx-auto w-full max-w-[960px] px-6 py-6">
        <Notice tone="warning">
          调度 <span className="font-mono">{scheduleId}</span>{" "}
          不在当前模型草稿中。
        </Notice>
      </div>
    )
  }

  const note = plan.concurrency.find((n) => n.id === selectedNote) ?? null
  const conflicts = plan.concurrency.filter((n) => n.level === "conflict")
  const reducerOf = (propertyId: string) => {
    const attr = model.attributes.find((a) => a.id === propertyId)
    return attr?.reducerRef ? refKey(attr.reducerRef) : null
  }

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-6 py-6">
      <section>
        <div className="flex items-center gap-2">
          <ShieldAlert size={18} className="text-muted" aria-hidden />
          <h2 className="text-title font-semibold">读写访问与并发诊断</h2>
          <span className="rounded bg-neutral-soft px-1.5 font-mono text-label text-muted">
            {schedule.id}@{schedule.version}
          </span>
          <Tag size="sm" tone={plan.executable ? "success" : "danger"}>
            {plan.executable ? "可执行" : "存在阻断诊断"}
          </Tag>
        </div>
        <p className="mt-1 max-w-[820px] text-body text-muted">
          各 System 的读写集合来自 P11 的访问声明；冲突边由
          compileSchedule 按声明推导。诊断只读：修改访问声明请去 P11，调整调度去
          P12。
        </p>
      </section>

      <Card>
        <PanelHeader
          title="访问矩阵"
          meta={<span className="tabular">{model.systems.length} 个 System</span>}
        />
        <Table className="min-w-[860px]">
          <thead>
            <tr>
              <Th className="w-[180px]">System</Th>
              <Th>读取（previous）</Th>
              <Th>贡献写入</Th>
              <Th>独占写入</Th>
              <Th>归约器</Th>
              <Th>具体目标实体</Th>
            </tr>
          </thead>
          <tbody>
            {model.systems.map((s) => {
              const contributes = s.access.contribute.map(accessProperty)
              const reducers = [
                ...new Set(
                  contributes
                    .map(reducerOf)
                    .filter((r): r is string => Boolean(r)),
                ),
              ]
              const targets = queryTargets(model, s.queryRef.id)
              return (
                <tr key={s.id} className={!s.enabled ? "opacity-60" : undefined}>
                  <Td>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="font-mono text-label text-primary hover:underline"
                        onClick={() =>
                          navigate({
                            pageId: "P11",
                            params: { systemId: s.id },
                          })
                        }
                      >
                        {s.id}
                      </button>
                      {!s.enabled ? (
                        <Tag size="sm" tone="neutral">
                          停用
                        </Tag>
                      ) : null}
                    </div>
                    <div className="text-caption text-muted">
                      {s.label} · {refKey(s.programRef)}
                    </div>
                  </Td>
                  <Td>
                    <AccessChips paths={s.access.readPrevious} />
                  </Td>
                  <Td>
                    <AccessChips paths={s.access.contribute} />
                  </Td>
                  <Td>
                    <AccessChips paths={s.access.exclusive} />
                  </Td>
                  <Td>
                    {reducers.length ? (
                      <span className="font-mono text-caption text-muted">
                        {reducers.join("、")}
                      </span>
                    ) : (
                      <span className="text-caption text-faint">—</span>
                    )}
                  </Td>
                  <Td>
                    {targets.length ? (
                      <span className="font-mono text-label">
                        {targets.join("、")}
                      </span>
                    ) : (
                      <span className="text-caption text-muted">
                        空查询（声明仍然有效）
                      </span>
                    )}
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <PanelHeader
            title="执行组"
            meta={<span>同组并行读同一 previous 视图</span>}
          />
          <div className="flex flex-col gap-2 px-4 py-3">
            {plan.groups.map((g) => (
              <div
                key={g.index}
                className="flex items-center gap-3 rounded-ui border border-line px-3 py-2"
              >
                <span className="w-14 shrink-0 text-label text-muted">
                  组 {g.index}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {g.systems.map((s) => (
                    <Tag
                      key={s.nodeId}
                      size="sm"
                      tone={s.enabled ? "primary" : "neutral"}
                    >
                      {s.systemId}
                    </Tag>
                  ))}
                </div>
              </div>
            ))}
            {plan.groups.length === 0 ? (
              <p className="text-label text-muted">
                调度成环或没有 System 节点，无法分组。
              </p>
            ) : null}
            {plan.orderNotes.map((n) => (
              <p key={n} className="text-caption leading-5 text-muted">
                {n}
              </p>
            ))}
          </div>
        </Card>

        <Card>
          <PanelHeader
            title="并发诊断"
            meta={
              <>
                <span className="tabular">{plan.concurrency.length} 条</span>
                {conflicts.length ? (
                  <Tag size="sm" tone="danger">
                    {conflicts.length} 冲突
                  </Tag>
                ) : (
                  <Tag size="sm" tone="success">
                    无写冲突
                  </Tag>
                )}
              </>
            }
          />
          {plan.concurrency.length === 0 ? (
            <p className="px-4 py-4 text-label text-muted">
              访问集合没有交集，或只有一个启用的 System。
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {plan.concurrency.map((n) => {
                const level = LEVEL[n.level]
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedNote(n.id)}
                      className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-subtle"
                    >
                      <Tag size="sm" tone={level.tone}>
                        {level.label}
                      </Tag>
                      <span className="min-w-0 flex-1 text-label">
                        <span className="font-mono">
                          {n.systems[0]} ↔ {n.systems[1]}
                        </span>
                        <span className="mx-1.5 text-faint">·</span>
                        <span className="font-mono text-muted">
                          {n.property}
                        </span>
                        <span className="mt-0.5 block text-caption text-muted">
                          {n.message}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      {note ? (
        <ConflictDetail note={note} plan={plan} schedule={schedule} />
      ) : null}

      <Card>
        <PanelHeader
          title="调度诊断"
          meta={<span className="tabular">{plan.diagnostics.length} 条</span>}
          actions={
            <Button
              size="sm"
              intent="ghost"
              icon={GitPullRequestArrow}
              onClick={() =>
                navigate({ pageId: "P12", params: { scheduleId: schedule.id } })
              }
            >
              打开 P12 调度画布
            </Button>
          }
        />
        {plan.diagnostics.length === 0 ? (
          <p className="px-4 py-4 text-label text-muted">
            当前调度没有结构或访问诊断。
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {plan.diagnostics.map((d) => (
              <li key={d.id} className="flex items-start gap-3 px-4 py-2.5">
                <Tag
                  size="sm"
                  tone={d.severity === "error" ? "danger" : "warning"}
                >
                  {d.severity === "error" ? "错误" : "警告"}
                </Tag>
                <div className="min-w-0 flex-1">
                  <p className="text-label">{d.message}</p>
                  <p className="mt-0.5 font-mono text-caption text-muted">
                    {d.code}
                    {d.target?.nodeId ? ` · 节点 ${d.target.nodeId}` : ""}
                  </p>
                </div>
                <Button
                  size="sm"
                  intent="ghost"
                  icon={Crosshair}
                  onClick={() =>
                    navigate({
                      pageId: "P12",
                      params: { scheduleId: schedule.id },
                    })
                  }
                >
                  定位
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-line px-4 py-2.5">
          <SectionLabel>边界说明</SectionLabel>
          <p className="mt-1 text-caption leading-5 text-muted">
            查询集不相交时仍可能写同一关联目标——v0.5 只有 q-fire
            一个查询，该类跨查询冲突暂无实例；运行期的动态目标扫描只能做计划试算，
            本页矩阵不替代裁决器。
          </p>
        </div>
      </Card>
    </div>
  )
}
