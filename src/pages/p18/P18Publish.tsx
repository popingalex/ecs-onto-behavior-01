import { useMemo, useState } from "react"
import {
  CircleAlert,
  CircleCheck,
  Crosshair,
  PackageCheck,
  Play,
  RefreshCw,
  Save,
  TriangleAlert,
} from "lucide-react"
import type { WorkbenchContext } from "@/app/useWorkbenchContext"
import Button from "@/components/ui/Button"
import Card, { Notice, PanelHeader } from "@/components/ui/Card"
import { Tag } from "@/components/ui/StatusTag"
import Table, { Td, Th } from "@/components/ui/Table"
import { useIndex } from "@/data/store"
import { formatLocalStamp } from "@/lib/format"
import { navigate } from "@/router/router"
import { saveAllDocuments, useDraftDocuments } from "@/stores/draftRegistry"
import {
  modelDocumentIds,
  useDraftModel,
} from "@/stores/modelDocuments"
import { useActorName } from "@/stores/context"
import {
  nextBundleId,
  publishBundle,
  usePublishedBundles,
} from "@/stores/publish"
import { toast } from "@/stores/toast"
import { isNativeMode } from "@/stores/dataSource"
import NativeModelPatch from "./NativeModelPatch"
import {
  currentModelHash,
  diagnosticRoute,
  runIntegrityCheck,
  type IntegrityRun,
} from "./integrity"

/**
 * P18 校验与发布：对全部草稿文档的组合模型跑 checkIntegrity；
 * 错误为 0 且校验未过期才可发布——发布只固定定义（语义哈希清单），不创建模拟 commit。
 */
export default function P18Publish(props: { ctx: WorkbenchContext }) {
  // REAL_IMPORT_READ_ONLY:发布页切换为 W1 原生事务化模型补丁面板。
  if (isNativeMode()) return <NativeModelPatch />
  const { ctx: _ctx } = props
  const index = useIndex()
  const model = useDraftModel()
  const docs = useDraftDocuments()
  const actorName = useActorName()
  const published = usePublishedBundles()
  const [run, setRun] = useState<IntegrityRun | null>(null)
  const [publishing, setPublishing] = useState(false)

  // 任何文档语义变化都会改变组合哈希 → 旧校验结果立即过期。
  const liveHash = useMemo(
    () => currentModelHash(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [docs],
  )
  const stale = run !== null && run.modelHash !== liveHash
  const errors = run?.diagnostics.filter((d) => d.severity === "error") ?? []
  const warnings =
    run?.diagnostics.filter((d) => d.severity === "warning") ?? []
  const canPublish = Boolean(run) && !stale && errors.length === 0 && !publishing

  const docIds = modelDocumentIds()
  const seedBundles = [...index.bundles.values()]

  const publish = () => {
    if (!run || stale || errors.length > 0) return
    setPublishing(true)
    const id = nextBundleId([
      ...seedBundles.map((b) => b.id),
      ...published.map((b) => b.id),
    ])
    publishBundle({
      id,
      label: `本地发布 ${id}`,
      revision: published.length + 1,
      createdAt: run.at,
      actorId: actorName,
      modelHash: run.modelHash,
      manifest: docIds.map((documentId) => ({
        documentId,
        semanticHash: docs[documentId]?.semanticHash ?? "unregistered",
        revision: docs[documentId]?.revision ?? 0,
      })),
      warnings: warnings.length,
    })
    setPublishing(false)
    toast(`已发布 ${id}（不可变 · 仅存本浏览器；不产生模拟 commit）`)
  }

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-6 py-6">
      <section>
        <div className="flex items-center gap-2">
          <PackageCheck size={18} className="text-muted" aria-hidden />
          <h2 className="text-title font-semibold">校验与发布</h2>
        </div>
        <p className="mt-1 max-w-[860px] text-body text-muted">
          跨对象语义校验覆盖全部草稿文档；发布产生不可变
          bundle（原型语义：清单持久化在本浏览器，不涉及服务器版本库），
          保存草稿与发布是两个独立动作，保存成功不等于发布成功。
        </p>
      </section>

      <Card>
        <PanelHeader
          title="发布 manifest"
          meta={<span>当前草稿组合 · {docIds.length} 份文档</span>}
          actions={
            <>
              <Button
                size="sm"
                intent="ghost"
                icon={Save}
                onClick={() =>
                  void saveAllDocuments().then((ok) =>
                    toast(ok ? "全部草稿已本地保存" : "部分文档保存失败，见各文档状态"),
                  )
                }
              >
                保存草稿
              </Button>
              <Button
                size="sm"
                icon={RefreshCw}
                onClick={() => setRun(runIntegrityCheck())}
              >
                运行校验
              </Button>
              <Button
                size="sm"
                intent="primary"
                icon={PackageCheck}
                disabled={!canPublish}
                busy={publishing}
                title={
                  !run
                    ? "先运行校验"
                    : stale
                      ? "校验结果已过期，需重新校验"
                      : errors.length > 0
                        ? "错误必须为 0 才可发布"
                        : undefined
                }
                onClick={publish}
              >
                发布版本
              </Button>
              <Button
                size="sm"
                intent="ghost"
                icon={Play}
                onClick={() => navigate({ pageId: "P19", params: {} })}
              >
                启动运行
              </Button>
            </>
          }
        />
        <Table className="min-w-[760px]">
          <thead>
            <tr>
              <Th>文档</Th>
              <Th>语义哈希</Th>
              <Th align="right">修订</Th>
              <Th>状态</Th>
            </tr>
          </thead>
          <tbody>
            {docIds.map((id) => {
              const doc = docs[id]
              const dirty = doc ? doc.contentHash !== doc.savedHash : false
              return (
                <tr key={id}>
                  <Td>
                    <span className="font-mono text-label">{id}</span>
                    <span className="ml-2 text-caption text-muted">
                      {doc?.label ?? "未注册"}
                    </span>
                  </Td>
                  <Td>
                    <span className="font-mono text-caption text-muted">
                      {doc?.semanticHash.slice(0, 16) ?? "—"}
                    </span>
                  </Td>
                  <Td numeric>r{doc?.revision ?? 0}</Td>
                  <Td>
                    {dirty ? (
                      <Tag size="sm" tone="warning">
                        未保存
                      </Tag>
                    ) : (
                      <Tag size="sm" tone="success">
                        已保存
                      </Tag>
                    )}
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </Table>
        <div className="border-t border-line px-4 py-2.5 text-caption text-muted">
          固定引用：model-05 · scene-05 · g-cool@g5 · q-fire@q1 ·
          cooling-floor@c1 · schedule-main@s5（以语义哈希为准，版本号仅展示）。
        </div>
      </Card>

      <Card>
        <PanelHeader
          title="校验诊断"
          meta={
            run ? (
              <>
                <span className="font-mono">
                  {run.modelHash.slice(0, 12)} · {formatLocalStamp(run.at)}
                </span>
                {errors.length > 0 ? (
                  <Tag size="sm" tone="danger" icon={CircleAlert}>
                    {errors.length} 错误
                  </Tag>
                ) : (
                  <Tag size="sm" tone="success" icon={CircleCheck}>
                    0 错误
                  </Tag>
                )}
                {warnings.length > 0 ? (
                  <Tag size="sm" tone="warning" icon={TriangleAlert}>
                    {warnings.length} 警告
                  </Tag>
                ) : null}
                {stale ? (
                  <Tag size="sm" tone="warning">
                    已过期
                  </Tag>
                ) : null}
              </>
            ) : (
              <span>尚未校验</span>
            )
          }
        />
        {stale ? (
          <div className="border-b border-warning-line bg-warning-soft px-4 py-2 text-label text-warning-ink">
            校验后又修改了草稿：结果基于 {run?.modelHash.slice(0, 12)}
            ，当前为 {liveHash.slice(0, 12)}。旧通过状态不可复用，请重新校验。
          </div>
        ) : null}
        {!run ? (
          <p className="px-4 py-4 text-label text-muted">
            点击「运行校验」对全部草稿的组合模型执行 checkIntegrity。
          </p>
        ) : run.diagnostics.length === 0 ? (
          <p className="flex items-center gap-2 px-4 py-4 text-label text-muted">
            <CircleCheck size={16} className="text-success" aria-hidden />
            本次校验没有诊断；警告为 0 时发布不保留附加条件。
          </p>
        ) : (
          <ul className={`divide-y divide-line ${stale ? "opacity-70" : ""}`}>
            {run.diagnostics.map((d) => {
              const target = diagnosticRoute(model, d)
              return (
                <li key={d.id} className="flex items-start gap-3 px-4 py-3">
                  {d.severity === "error" ? (
                    <CircleAlert
                      size={16}
                      className="mt-0.5 shrink-0 text-danger"
                      aria-label="错误"
                    />
                  ) : (
                    <TriangleAlert
                      size={16}
                      className="mt-0.5 shrink-0 text-warning"
                      aria-label="警告"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-body text-ink">{d.message}</p>
                    <p className="mt-0.5 flex flex-wrap gap-x-3 text-caption text-muted">
                      <span className="font-mono">{d.code}</span>
                      {d.objectLabel ? (
                        <span className="font-mono">{d.objectLabel}</span>
                      ) : null}
                    </p>
                  </div>
                  {target ? (
                    <Button
                      size="sm"
                      intent="ghost"
                      icon={Crosshair}
                      onClick={() => navigate(target)}
                    >
                      定位
                    </Button>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Card>
        <PanelHeader
          title="发布包清单"
          meta={<span>不可变 · 无修改入口</span>}
        />
        <Table className="min-w-[860px]">
          <thead>
            <tr>
              <Th>Bundle</Th>
              <Th>来源</Th>
              <Th>模型哈希</Th>
              <Th align="right">文档数</Th>
              <Th>创建</Th>
              <Th align="right">操作</Th>
            </tr>
          </thead>
          <tbody>
            {seedBundles.map((b) => (
              <tr key={b.id}>
                <Td>
                  <span className="font-mono text-label">{b.id}</span>
                  <span className="ml-2 text-caption text-muted">{b.label}</span>
                </Td>
                <Td>
                  <Tag size="sm" tone="neutral">
                    种子旧样例 · r{b.revision}
                  </Tag>
                </Td>
                <Td>
                  <span className="text-caption text-faint">未记录</span>
                </Td>
                <Td numeric>—</Td>
                <Td>
                  <span className="text-caption text-faint">未记录</span>
                </Td>
                <Td numeric>
                  <Button
                    size="sm"
                    intent="ghost"
                    onClick={() =>
                      navigate({ pageId: "P19", params: { bundleId: b.id } })
                    }
                  >
                    用它创建运行
                  </Button>
                </Td>
              </tr>
            ))}
            {published.map((b) => (
              <tr key={b.id}>
                <Td>
                  <span className="font-mono text-label">{b.id}</span>
                  <span className="ml-2 text-caption text-muted">{b.label}</span>
                </Td>
                <Td>
                  <Tag size="sm" tone="success">
                    本地发布 · r{b.revision}
                  </Tag>
                </Td>
                <Td>
                  <span className="font-mono text-caption text-muted">
                    {b.modelHash.slice(0, 12)}
                  </span>
                </Td>
                <Td numeric>{b.manifest.length}</Td>
                <Td>
                  <span className="text-caption text-muted">
                    {formatLocalStamp(b.createdAt)} · {b.actorId}
                  </span>
                </Td>
                <Td numeric>
                  <Button
                    size="sm"
                    intent="ghost"
                    onClick={() =>
                      navigate({ pageId: "P19", params: { bundleId: b.id } })
                    }
                  >
                    用它创建运行
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {published.length === 0 ? (
          <p className="border-t border-line px-4 py-3 text-caption text-muted">
            还没有本地发布的 bundle；校验通过（0 错误）后点「发布版本」创建。
          </p>
        ) : null}
      </Card>

      <Notice tone="info">
        失效绑定、缺资源、类型不符会作为错误阻断发布；revision
        冲突（本地草稿与远端差异）在原型中没有远端来源，未做强制覆盖语义。
      </Notice>
    </div>
  )
}
