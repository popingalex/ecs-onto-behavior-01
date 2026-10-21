import { useMemo } from "react"
import {
  ArrowRight,
  Boxes,
  CirclePlay,
  GitBranch,
  PencilRuler,
  Plus,
  Table2,
  Workflow,
  type LucideIcon,
} from "lucide-react"
import type { GroupId, Route } from "@/core/types"
import Button from "@/components/ui/Button"
import Card, { PanelHeader } from "@/components/ui/Card"
import StatusTag, { Tag } from "@/components/ui/StatusTag"
import Table, { Td, Th, Tr } from "@/components/ui/Table"
import { useIndex } from "@/data/store"
import { cn } from "@/lib/cn"
import { formatLocalStamp, formatSimTime } from "@/lib/format"
import { GROUP_BY_ID } from "@/navigation/groups"
import { PAGE_SPECS } from "@/navigation/pages"
import { REPRESENTATIVE_PATH } from "@/navigation/paths"
import { buildTransitionRoute } from "@/navigation/resolve"
import { findTransition } from "@/navigation/transitions"
import { navigate, useRoute } from "@/router/router"
import {
  documentFacts,
  PUBLISHED,
  saveStatusOf,
  validationStatusOf,
} from "@/stores/draft"
import { useDraftDocuments } from "@/stores/draftRegistry"
import { useBranches, useCommits } from "@/stores/history"

/** P01 项目总览：资产、运行与最近提交的入口；不在此结算或编辑。 */
export default function P01ProjectOverview() {
  const index = useIndex()
  const route = useRoute()
  const branches = useBranches()
  const commits = useCommits()
  const documentMap = useDraftDocuments()
  const documents = useMemo(() => Object.values(documentMap), [documentMap])

  const go = (action: string) => {
    const t = findTransition("P01", action)
    const target = t ? buildTransitionRoute(route, t) : null
    if (target) navigate(target)
  }

  const recent = useMemo(
    () =>
      Object.values(commits).sort(
        (a, b) => b.round - a.round || a.id.localeCompare(b.id),
      ),
    [commits],
  )
  const branchList = Object.values(branches)

  const stats: Array<{
    group: GroupId
    icon: LucideIcon
    items: Array<[string, number]>
  }> = [
    {
      group: "modeling",
      icon: Boxes,
      items: [
        ["类型", index.classes.size],
        ["组件", index.components.size],
        ["属性", index.properties.size],
        ["实体", index.entities.size],
      ],
    },
    {
      group: "logic",
      icon: Workflow,
      items: [
        ["System", index.systems.size],
        ["查询", index.queries.size],
        ["约束", index.constraints.size],
      ],
    },
    {
      group: "simulation",
      icon: CirclePlay,
      items: [
        ["运行", index.runs.size],
        ["分支", branchList.length],
        ["提交", recent.length],
      ],
    },
  ]

  return (
    // 以主工作区容器宽度（而非视口）决定栏数：资源树/检查器展开时主区可能远窄于视口。
    <div className="@container mx-auto flex w-full max-w-[1440px] flex-col gap-5 px-6 py-6">
      <section className="flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2 text-label text-muted">
            <span className="font-mono">{index.project.id}</span>
            <span>·</span>
            <span>训练规则为虚构示例</span>
          </div>
          <h2 className="text-display font-semibold text-ink">
            {index.project.label}
          </h2>
          <p className="mt-1 max-w-[720px] text-body text-muted">
            {index.project.description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={PencilRuler} onClick={() => go("open-model")}>
            打开类型模型
          </Button>
          <Button icon={Table2} onClick={() => go("edit-scene")}>
            场景实体
          </Button>
          <Button icon={Plus} onClick={() => go("create-run")}>
            新建运行
          </Button>
          <Button
            intent="primary"
            icon={CirclePlay}
            onClick={() => go("open-run")}
          >
            打开主演练
          </Button>
        </div>
      </section>

      <section
        className="grid grid-cols-1 gap-3 @min-[560px]:grid-cols-2 @min-[1120px]:grid-cols-3"
        aria-label="资产概况"
      >
        {stats.map(({ group, icon: Icon, items }) => {
          const spec = GROUP_BY_ID[group]
          return (
            <button
              key={group}
              type="button"
              onClick={() => navigate({ pageId: spec.defaultPage, params: {} })}
              className="group min-w-0 rounded-ui border border-border bg-surface p-4 text-left shadow-card transition-colors hover:border-primary-line"
            >
              <div className="flex items-start gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-ui bg-primary-soft text-primary">
                  <Icon size={17} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-semibold">
                    {spec.label}
                  </span>
                  <span className="block text-caption text-muted">
                    {spec.description}
                  </span>
                </span>
                <ArrowRight
                  size={15}
                  className="mt-0.5 shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                  aria-hidden
                />
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-2">
                {items.map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-caption text-muted">{label}</dt>
                    <dd className="tabular text-title font-semibold text-ink">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </button>
          )
        })}
      </section>

      <div className="grid grid-cols-1 gap-5 @min-[1120px]:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Card>
            <PanelHeader
              title="运行与分支"
              meta={<span>打开时显式携带 runId / branchId / viewCommit</span>}
            />
            <div className="scroll-thin overflow-auto">
              <Table className="min-w-[640px]">
                <thead>
                  <tr>
                    <Th>分支</Th>
                    <Th>运行</Th>
                    <Th>head</Th>
                    <Th align="right">回合</Th>
                    <Th align="right">模拟时间</Th>
                    <Th>可见性</Th>
                    <Th align="right">
                      <span className="sr-only">操作</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {branchList.map((b) => {
                    const head = commits[b.headCommit]
                    const run = index.runs.get(b.runId)
                    const target: Route = {
                      pageId: "P20",
                      params: {
                        runId: b.runId,
                        branchId: b.id,
                        viewCommit: b.headCommit,
                      },
                    }
                    return (
                      <Tr key={b.id} onSelect={() => navigate(target)}>
                        <Td>
                          <div className="flex items-center gap-2">
                            <GitBranch
                              size={14}
                              className="text-muted"
                              aria-hidden
                            />
                            <span className="font-medium">{b.label}</span>
                            <span className="font-mono text-caption text-muted">
                              {b.id}
                            </span>
                          </div>
                        </Td>
                        <Td className="text-ink-soft">{run?.label}</Td>
                        <Td>
                          <span className="font-mono text-label">
                            {b.headCommit}
                          </span>
                        </Td>
                        <Td numeric>{head?.round}</Td>
                        <Td numeric>
                          {head ? formatSimTime(head.simTime) : "—"}
                        </Td>
                        <Td>
                          <Tag
                            size="sm"
                            tone={
                              b.visibility === "shared" ? "primary" : "neutral"
                            }
                          >
                            {b.visibility === "shared"
                              ? "共享"
                              : b.visibility === "team"
                                ? "团队"
                                : "私有"}
                          </Tag>
                        </Td>
                        <Td align="right">
                          <span className="inline-flex items-center gap-1 text-label font-medium text-primary-strong">
                            打开 <ArrowRight size={14} aria-hidden />
                          </span>
                        </Td>
                      </Tr>
                    )
                  })}
                </tbody>
              </Table>
            </div>
          </Card>

          <Card>
            <PanelHeader
              title="最近提交"
              meta={<span>提交不可变；打开历史提交进入只读查看</span>}
            />
            <ul className="divide-y divide-line">
              {recent.map((c) => {
                const branch = branches[c.branchId]
                const isHead = branch?.headCommit === c.id
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() =>
                        navigate({
                          pageId: "P20",
                          params: {
                            runId: c.runId,
                            branchId: c.branchId,
                            viewCommit: c.id,
                          },
                        })
                      }
                      className="flex w-full flex-wrap items-start gap-x-3 gap-y-1 px-4 py-2.5 text-left hover:bg-subtle"
                    >
                      <span
                        className={cn(
                          "mt-[7px] h-2 w-2 shrink-0 rounded-full",
                          isHead ? "bg-success" : "bg-border",
                        )}
                        aria-hidden
                      />
                      {/* 主列可换行；元信息整组放不下时换到下一行，不裁切任何一列。 */}
                      <span className="flex min-w-0 flex-[1_1_260px] flex-wrap items-baseline gap-x-3">
                        <span className="w-[136px] shrink-0 break-all font-mono text-label">
                          {c.id}
                        </span>
                        <span className="min-w-[120px] flex-1 break-words text-body text-ink-soft">
                          {c.summary}
                        </span>
                      </span>
                      <span className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
                        <span className="whitespace-nowrap font-mono text-caption text-muted">
                          {c.branchId}
                        </span>
                        <span className="tabular whitespace-nowrap text-caption text-muted">
                          第 {c.round} 回合 · {formatSimTime(c.simTime)}
                        </span>
                        <span className="flex min-w-[72px] justify-end">
                          {isHead ? (
                            <StatusTag status="head" size="sm" />
                          ) : c.checkpoint ? (
                            <StatusTag status="checkpoint" size="sm" />
                          ) : null}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Card>
            <PanelHeader
              title="资产草稿"
              meta={<span>{documents.length} 个文档 · 各自独立保存与撤销</span>}
            />
            <ul className="divide-y divide-line">
              {documents.map((doc) => {
                const facts = documentFacts(doc)
                return (
                  <li
                    key={doc.documentId}
                    className="flex items-center gap-3 px-4 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-body">{doc.label}</div>
                      <div className="truncate font-mono text-caption text-muted">
                        {doc.documentId} · r{doc.revision}
                        {doc.savedAt
                          ? ` · 本地保存 ${formatLocalStamp(doc.savedAt)}`
                          : " · 已发布基线"}
                      </div>
                      {doc.restore.status === "rejected" ? (
                        <div className="mt-0.5 text-caption text-warning">
                          本地存档未恢复：{doc.restore.reason}
                        </div>
                      ) : null}
                    </div>
                    <StatusTag status={saveStatusOf(facts)} size="sm" />
                    <StatusTag status={validationStatusOf(facts)} size="sm" />
                  </li>
                )
              })}
            </ul>
            <p className="border-t border-line px-4 py-3 text-label text-muted">
              已发布{" "}
              <span className="font-mono text-ink-soft">
                {PUBLISHED.modelVersion}
              </span>{" "}
              · 发布包{" "}
              <span className="font-mono text-ink-soft">
                {PUBLISHED.bundleId}
              </span>
              。保存只写入本浏览器；运行只使用已发布的不可变
              bundle，草稿修改不会进入正在进行的运行。
            </p>
          </Card>

          <Card>
            <PanelHeader
              title="代表性链路"
              meta={<span>{REPRESENTATIVE_PATH.length} 步</span>}
            />
            <ol className="relative px-4 py-3">
              {REPRESENTATIVE_PATH.map((step, i) => {
                const spec = PAGE_SPECS[step.route.pageId]
                return (
                  <li key={`${spec.id}-${i}`} className="relative">
                    {i < REPRESENTATIVE_PATH.length - 1 ? (
                      <span
                        className="absolute left-[11px] top-7 h-[calc(100%-16px)] w-px bg-border"
                        aria-hidden
                      />
                    ) : null}
                    <button
                      type="button"
                      onClick={() => navigate(step.route)}
                      className="group flex w-full items-start gap-3 rounded-ui py-1.5 pr-2 text-left hover:bg-subtle"
                    >
                      <span className="tabular relative z-[1] grid h-6 w-6 shrink-0 place-items-center rounded-full border border-border bg-surface text-caption text-muted group-hover:border-primary group-hover:text-primary">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-caption text-muted">
                            {spec.id}
                          </span>
                          <span className="truncate text-body font-medium text-ink group-hover:text-primary-strong">
                            {spec.title}
                          </span>
                          {spec.kind !== "page" ? (
                            <span className="text-caption text-faint">
                              {spec.kind === "modal" ? "模态" : "抽屉"}
                            </span>
                          ) : null}
                        </span>
                        <span className="block truncate text-caption text-muted">
                          {step.note}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  )
}
