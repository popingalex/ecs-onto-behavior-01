import { Ban, CircleCheck, CircleAlert, Layers } from "lucide-react"
import { Tag } from "@/components/ui/StatusTag"
import type { SchedulePlan } from "@/services/scheduleCompiler"

/** 计划预览：compileSchedule 的并行分组、归约路由、顺序说明与诊断。 */
export default function PlanPanel({ plan }: { plan: SchedulePlan }) {
  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <section className="flex items-center gap-2">
        {plan.executable ? (
          <Tag tone="success">
            <CircleCheck size={12} aria-hidden />
            可执行
          </Tag>
        ) : (
          <Tag tone="danger">
            <Ban size={12} aria-hidden />
            禁止执行
          </Tag>
        )}
        <span className="text-caption text-muted">
          {plan.executable
            ? "无 error 级诊断"
            : "存在 error 级诊断，修复前不能执行"}
        </span>
      </section>

      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-label font-semibold text-ink">
          <Layers size={13} aria-hidden className="text-muted" />
          逻辑并行组
        </h3>
        {plan.groups.length === 0 ? (
          <p className="text-caption text-muted">
            没有可分组 System（成环或调度为空）。
          </p>
        ) : (
          <ol className="flex flex-col gap-1.5">
            {plan.groups.map((g) => (
              <li
                key={g.index}
                className="rounded-ui border border-line bg-subtle px-3 py-2"
              >
                <div className="text-caption text-muted">
                  组 {g.index}
                  {g.systems.length > 1 ? "（并行）" : ""}
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {g.systems.map((s) => (
                    <Tag
                      key={s.nodeId}
                      size="sm"
                      tone={s.enabled ? "primary" : "neutral"}
                    >
                      {s.systemId}
                      {s.after.length ? ` ← ${s.after.join("、")}` : ""}
                    </Tag>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-label font-semibold text-ink">归约与提交</h3>
        {plan.reducers.length === 0 ? (
          <p className="text-caption text-muted">没有归约器 / 合同裁决节点。</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {plan.reducers.map((r) => (
              <li
                key={r.nodeId}
                className="rounded-ui border border-line bg-subtle px-3 py-2 text-caption"
              >
                <div className="font-medium text-ink">
                  {r.type === "ReducerNode" ? "归约器" : "合同裁决"}{" "}
                  <span className="font-mono text-muted">{r.constraint}</span>
                  {r.strategy ? (
                    <Tag size="sm" tone="primary" className="ml-1.5">
                      {r.strategy}
                    </Tag>
                  ) : null}
                </div>
                <div className="mt-1 text-muted">
                  {r.inputs.length === 0
                    ? "没有 System 效果流入"
                    : r.inputs
                        .map(
                          (i) =>
                            `${i.systemId}（${i.properties.join("、") || "无匹配属性"}）`,
                        )
                        .join("；")}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1.5 text-caption text-muted">
          原子提交：{plan.commitNodeId ?? "缺失"}
        </p>
      </section>

      {plan.orderNotes.length > 0 ? (
        <section>
          <h3 className="mb-2 text-label font-semibold text-ink">
            顺序边的可见性
          </h3>
          <ul className="flex flex-col gap-1.5">
            {plan.orderNotes.map((note, i) => (
              <li
                key={i}
                className="rounded-ui border border-warning-line bg-warning-soft px-3 py-2 text-caption leading-5 text-warning-ink"
              >
                {note}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {plan.concurrency.length > 0 ? (
        <section>
          <h3 className="mb-2 text-label font-semibold text-ink">访问分析</h3>
          <ul className="flex flex-col gap-1.5">
            {plan.concurrency.map((c) => (
              <li
                key={c.id}
                className="rounded-ui border border-line bg-subtle px-3 py-2 text-caption leading-5"
              >
                <Tag
                  size="sm"
                  tone={
                    c.level === "conflict"
                      ? "danger"
                      : c.level === "ordered"
                        ? "warning"
                        : "success"
                  }
                >
                  {c.level === "conflict"
                    ? "冲突"
                    : c.level === "ordered"
                      ? "有序"
                      : "可并行"}
                </Tag>{" "}
                <span className="font-mono">{c.systems.join(" × ")}</span> ·{" "}
                <span className="font-mono">{c.property}</span>
                <div className="mt-0.5 text-muted">{c.message}</div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {plan.diagnostics.length > 0 ? (
        <section>
          <h3 className="mb-2 text-label font-semibold text-ink">诊断</h3>
          <ul className="flex flex-col gap-1.5">
            {plan.diagnostics.map((d) => (
              <li
                key={d.id}
                className={`flex items-start gap-2 rounded-ui border px-3 py-2 text-caption leading-5 ${
                  d.severity === "error"
                    ? "border-danger-line bg-danger-soft text-danger"
                    : "border-warning-line bg-warning-soft text-warning-ink"
                }`}
              >
                <CircleAlert size={13} className="mt-[2px] shrink-0" aria-hidden />
                <div>
                  <span className="font-mono">{d.code}</span>
                  <div>{d.message}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
