import { House, Table2, ExternalLink, CirclePlay } from "lucide-react"
import type { WorkbenchContext } from "@/app/useWorkbenchContext"
import Button from "@/components/ui/Button"
import Card, { PanelHeader } from "@/components/ui/Card"
import { navigate } from "@/router/router"

/**
 * 已下线页面的迁移说明：场景 / 地图 / 3D 能力整组迁移到 mas-suite 的 MapEngine，
 * 本工作台不再承载。深链到这些页时显示该说明，而不是空白占位页。
 */
export default function RetiredPage({ ctx }: { ctx: WorkbenchContext }) {
  const { spec } = ctx
  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4 px-6 py-12">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-neutral-soft text-muted">
          <ExternalLink size={20} aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded bg-neutral-soft px-1.5 font-mono text-label text-muted">
              {spec.id}
            </span>
            <h2 className="text-title font-semibold text-ink">
              {spec.title}已下线
            </h2>
          </div>
          <p className="mt-1 text-body text-muted">
            场景、地图与三维资产能力已整组迁移到 mas-suite 的 MapEngine
            （外部系统），本工作台只保留建模、逻辑与推演。实体清单与状态检查仍在
            P08，演练运行与复盘在推演组。
          </p>
        </div>
      </div>
      <Card>
        <PanelHeader
          title="去向"
          meta={<span>显式跳转，不自动改写链接</span>}
        />
        <div className="flex flex-wrap gap-2 px-4 py-4">
          <Button
            icon={Table2}
            onClick={() => navigate({ pageId: "P08", params: {} })}
          >
            实体表（P08）
          </Button>
          <Button
            icon={CirclePlay}
            onClick={() => navigate({ pageId: "P20", params: {} })}
          >
            推演工作台（P20）
          </Button>
          <Button
            intent="ghost"
            icon={House}
            onClick={() => navigate({ pageId: "P01", params: {} })}
          >
            项目总览
          </Button>
        </div>
      </Card>
    </div>
  )
}
