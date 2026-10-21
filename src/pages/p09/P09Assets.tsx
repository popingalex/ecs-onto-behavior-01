import {
  ArrowLeft,
  Box,
  FileUp,
  GitCommitHorizontal,
  Map as MapIcon,
} from "lucide-react"
import type { WorkbenchContext } from "@/app/useWorkbenchContext"
import type { AssetDef, Route } from "@/core/types"
import ObjectLink from "@/components/domain/ObjectLink"
import Button from "@/components/ui/Button"
import Card, { KeyValue, Notice, PanelHeader } from "@/components/ui/Card"
import { Tag } from "@/components/ui/StatusTag"
import Table, { Td, Th, Tr } from "@/components/ui/Table"
import { useIndex } from "@/data/store"
import { navigate, useRoute } from "@/router/router"
import { useDraftModel } from "@/stores/modelDocuments"
import { formatNumber } from "@/lib/format"

const ASSET_KIND_LABEL: Record<AssetDef["kind"], string> = {
  model3d: "三维模型",
  map: "地图",
  icon: "图标",
}

interface ManifestRow {
  kind: string
  id: string
  version: string
  label: string
  route?: Route
}

/**
 * P09 资产与资源清单。v0.5 模型没有资产目录（规格引用的 mock/06_catalog.json 未提供）；
 * 资产区如实列出旧工作台保留的样例资产（legacy-fixture，不参与 v0.5 校验与执行）。
 * 资源版本清单与空间参考来自当前草稿模型的真实对象。
 */
export default function P09Assets({ ctx: _ctx }: { ctx: WorkbenchContext }) {
  const route = useRoute()
  const index = useIndex()
  const assetId = route.params.assetId
  if (assetId)
    return <AssetDetail asset={index.assets.get(assetId)} id={assetId} />
  return <AssetIndex />
}

/** 资产详情：只有 id / 版本 / 标签 / 类别是真实字段；预览为自绘占位并标注。 */
function AssetDetail({ asset, id }: { asset?: AssetDef ;id: string }) {
  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-6 py-6">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          intent="ghost"
          icon={ArrowLeft}
          onClick={() => navigate({ pageId: "P09", params: {} })}
        >
          资产清单
        </Button>
        <h2 className="text-title font-semibold">{asset?.label ?? id}</h2>
        {asset ? (
          <span className="rounded bg-neutral-soft px-1.5 font-mono text-label text-muted">
            {asset.id}@{asset.version}
          </span>
        ) : null}
        <Tag tone="warning" size="sm">
          旧样例
        </Tag>
      </div>
      {!asset ? (
        <Notice tone="warning">
          资产 {id} 不存在；可能来自过期的链接。
        </Notice>
      ) : (
        <>
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <Card>
              <PanelHeader title="预览" />
              <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-b-ui bg-subtle text-muted">
                <Box size={28} aria-hidden />
                <p className="text-label">自绘占位图 · 未加载真实 3D 资产</p>
                <p className="text-caption text-faint">
                  尺寸 / 轴向 / 包围盒元数据未随样例提供
                </p>
              </div>
            </Card>
            <Card>
              <PanelHeader title="元数据" />
              <dl className="px-4 py-3">
                <KeyValue label="资产" mono>
                  {asset.id}@{asset.version}
                </KeyValue>
                <KeyValue label="名称">{asset.label}</KeyValue>
                <KeyValue label="类别">
                  {ASSET_KIND_LABEL[asset.kind]}
                </KeyValue>
                <KeyValue label="来源">旧工作台样例（legacy-fixture）</KeyValue>
                <KeyValue label="就绪状态">
                  <Tag tone="warning" size="sm">
                    未接入 v0.5 运行链
                  </Tag>
                </KeyValue>
                <KeyValue label="授权">
                  <span className="text-muted">未设置（样例未带授权信息）</span>
                </KeyValue>
              </dl>
            </Card>
          </div>
          <Notice tone="info">
            资产版本固定：场景与运行历史引用 id@version，新版本（如 a3）不会改变已固定引用。
            放置到场景（P07）与引用替换在资产目录接入 v0.5 后生效。
          </Notice>
        </>
      )}
    </div>
  )
}

function AssetIndex() {
  const model = useDraftModel()
  const index = useIndex()
  const assets = [...index.assets.values()]

  const frames = [
    ...new Set(
      model.attributes.map((a) => a.type.frameId).filter(Boolean),
    ),
  ] as string[]

  const manifest: ManifestRow[] = [
    ...model.templates.map((t) => ({
      kind: "实体模板",
      id: t.id,
      version: t.version,
      label: t.label,
      route: { pageId: "P05", params: { templateId: t.id } } as Route,
    })),
    ...model.components.map((c) => ({
      kind: "组件模式",
      id: c.id,
      version: c.version,
      label: c.label,
      route: { pageId: "P03", params: { componentId: c.id } } as Route,
    })),
    ...model.queries.map((q) => ({
      kind: "实体查询",
      id: q.id,
      version: q.version,
      label: `${q.typeId} · ${q.condition.propertyId}`,
      route: { pageId: "P10", params: { queryId: q.id } } as Route,
    })),
    ...model.programs.map((p) => ({
      kind: "逻辑程序",
      id: p.id,
      version: p.version,
      label: p.scopeType,
      route: { pageId: "P30", params: {} } as Route,
    })),
    ...model.schedules.map((s) => ({
      kind: "调度",
      id: s.id,
      version: s.version,
      label: `${s.nodes.length} 节点`,
      route: { pageId: "P12", params: { scheduleId: s.id } } as Route,
    })),
    ...model.constraints.map((c) => ({
      kind: "约束",
      id: c.id,
      version: c.version,
      label: `比例分配 · 下限 ${formatNumber(c.floorC)} °C`,
      route: { pageId: "P04", params: { constraintId: c.id } } as Route,
    })),
  ]

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-6 py-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-title font-semibold">资产与资源清单</h2>
          <p className="mt-1 text-body text-muted">
            三维资产、地图与 manifest 版本清单。v0.5
            模型没有资产目录；资产区列出旧工作台保留的样例（不参与校验与执行），
            版本清单来自当前草稿模型。
          </p>
        </div>
        <Button
          intent="primary"
          icon={FileUp}
          disabled
          title="glTF / GLB 导入在原型中未接入；v0.5 模型没有资产目录"
        >
          导入资产
        </Button>
      </div>

      <Card>
        <PanelHeader
          title="三维资产"
          meta={<span className="tabular">{assets.length} 个</span>}
          actions={<Box size={14} className="text-faint" aria-hidden />}
        />
        {assets.length === 0 ? (
          <div className="px-4 py-6 text-body text-muted">
            没有资产。v0.5
            模型不含资产目录（页面规格引用的 mock/06_catalog.json
            未提供），不展示虚构资产。
          </div>
        ) : (
          <Table className="min-w-[860px]">
            <thead>
              <tr>
                <Th className="w-[260px]">资产</Th>
                <Th>格式</Th>
                <Th>版本</Th>
                <Th>来源</Th>
                <Th>就绪状态</Th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <Tr
                  key={a.id}
                  onSelect={() =>
                    navigate({ pageId: "P09", params: { assetId: a.id } })
                  }
                >
                  <Td>
                    <div className="truncate font-medium">{a.label}</div>
                    <div className="truncate font-mono text-caption text-muted">
                      {a.id}
                    </div>
                  </Td>
                  <Td>{ASSET_KIND_LABEL[a.kind]}</Td>
                  <Td className="font-mono text-label text-muted">
                    @{a.version}
                  </Td>
                  <Td className="text-label text-muted">旧工作台样例</Td>
                  <Td>
                    <Tag tone="warning" size="sm">
                      未接入 v0.5 运行链
                    </Tag>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
        <div className="border-t border-line px-4 py-2.5 text-caption text-muted">
          资产为 legacy-fixture 样例：不参与 v0.5 模型校验与执行；修正单位 /
          轴向生成新版本、放置到场景等能力在资产目录接入后生效。
        </div>
      </Card>

      <Card>
        <PanelHeader
          title="空间参考（坐标框）"
          meta={<MapIcon size={14} className="text-faint" aria-hidden />}
        />
        {frames.length === 0 ? (
          <div className="px-4 py-4 text-body text-muted">
            模型没有声明坐标框。
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th className="w-[200px]">坐标框</Th>
                <Th>使用方</Th>
                <Th>说明</Th>
              </tr>
            </thead>
            <tbody>
              {frames.map((f) => (
                <tr key={f}>
                  <Td className="font-mono font-medium">{f}</Td>
                  <Td>
                    {model.attributes
                      .filter((a) => a.type.frameId === f)
                      .map((a) => (
                        <ObjectLink
                          key={a.id}
                          label={a.label}
                          id={a.id}
                          route={{
                            pageId: "P29",
                            params: { attributeId: a.id },
                          }}
                        />
                      ))}
                  </Td>
                  <Td className="text-label text-muted">
                    虚构园区局部米坐标（east / north / up），非真实底图
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card>
        <PanelHeader
          title="资源版本清单（manifest）"
          meta={<span className="tabular">{manifest.length} 项</span>}
          actions={
            <span className="text-caption text-muted">引用按 id@version 固定</span>
          }
        />
        <Table className="min-w-[860px]">
          <thead>
            <tr>
              <Th className="w-[140px]">类别</Th>
              <Th>对象</Th>
              <Th>版本</Th>
              <Th>摘要</Th>
            </tr>
          </thead>
          <tbody>
            {manifest.map((row) => (
              <Tr key={`${row.kind}:${row.id}`}>
                <Td>
                  <Tag size="sm">{row.kind}</Tag>
                </Td>
                <Td>
                  {row.route ? (
                    <ObjectLink id={row.id} route={row.route} />
                  ) : (
                    <span className="font-mono">{row.id}</span>
                  )}
                </Td>
                <Td className="font-mono text-label text-muted">
                  @{row.version}
                </Td>
                <Td className="text-label text-muted">{row.label}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <PanelHeader
            title="授权与版本"
            meta={
              <GitCommitHorizontal size={14} className="text-faint" aria-hidden />
            }
          />
          <dl className="px-4 py-3">
            <KeyValue label="模型契约" mono>
              {model.schemaVersion}
            </KeyValue>
            <KeyValue label="范围说明">{model.scope}</KeyValue>
            <KeyValue label="基础世界" mono>
              {model.baseWorld.commitId}
            </KeyValue>
            <KeyValue label="资产授权">
              <span className="text-muted">
                样例资产未带授权信息；界面组件库许可见仓库说明。
              </span>
            </KeyValue>
          </dl>
        </Card>
        <Card>
          <PanelHeader title="导入任务" meta={<Tag size="sm">0 条</Tag>} />
          <div className="px-4 py-6">
            <Notice tone="info">
              暂无导入任务。导入流水线（解析 / 规范化 / 缩略图 / 可运行资产）
              未在原型中接入；接入前此处不展示模拟任务。
            </Notice>
          </div>
        </Card>
      </div>
    </div>
  )
}
