import { useEffect, useRef, type ReactNode } from "react"
import SpatialViewport, { type SpatialItem } from "./SpatialViewport"

/**
 * MapEngine 接入位（预留，未实现）。
 *
 * geo 逻辑由外部独立系统（mas-suite MapEngine）实现，本仓库不写任何 geo 功能；
 * 数据 / 身份 / 版本 / 坐标边界见 design/03/contracts/mapengine-integration.md
 * （ADR-v06-03）。本组件只是宿主边界：占满父容器、z-index 底层。
 * engine 为空时挂过渡渲染器（SpatialViewport，park-ENU 2D 示意）；接入后由
 * engine.mount(host) 在同一宿主边界内接管渲染，业务面板与悬浮物不受影响。
 */
export interface MapEngineMount {
  mount: (host: HTMLElement) => void
  unmount?: () => void
}

/**
 * C12H MapViewport：地图宿主边界组件。场景/推演页的地图永远是主角（最大可视化
 * 空间）；长期悬浮物（图例、状态徽标、小图标工具栏）经 overlays 传入，
 * 容器 pointer-events-none，控件自身恢复 pointer-events。
 */
export default function MapViewport({
  items,
  selectedId,
  onSelect,
  caption,
  engine = null,
  overlays,
}: {
  items: SpatialItem[]
  selectedId?: string
  onSelect?: (id: string) => void
  caption?: string
  engine?: MapEngineMount | null
  overlays?: ReactNode
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const host = hostRef.current
    if (!engine || !host) return
    engine.mount(host)
    return () => engine.unmount?.()
  }, [engine])

  return (
    <div className="absolute inset-0 z-0 overflow-hidden">
      {engine ? (
        <div ref={hostRef} className="h-full w-full" data-mapengine-host="" />
      ) : (
        <SpatialViewport
          items={items}
          selectedId={selectedId}
          onSelect={onSelect}
          caption={caption}
        />
      )}
      {overlays ? (
        <div className="pointer-events-none absolute inset-0 z-10">
          {overlays}
        </div>
      ) : null}
    </div>
  )
}
