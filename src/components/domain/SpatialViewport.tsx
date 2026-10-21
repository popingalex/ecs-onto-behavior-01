import { useMemo, useRef, useState } from "react"
import { MapPinOff } from "lucide-react"
import type { Vector3 } from "@/core/types"
import { cn } from "@/lib/cn"
import { formatNumber } from "@/lib/format"

export interface SpatialItem {
  id: string
  label: string
  kind: "fire" | "vehicle" | "station" | "command"
  position: Vector3 | null
  caption?: string
  /** 火源是否活跃；与温度无关。 */
  active?: boolean
}

const KIND = {
  fire: {
    fill: "var(--color-danger-soft)",
    stroke: "var(--color-danger)",
    label: "火源",
  },
  vehicle: {
    fill: "var(--color-primary-soft)",
    stroke: "var(--color-primary)",
    label: "车辆",
  },
  station: {
    fill: "var(--color-success-soft)",
    stroke: "var(--color-success)",
    label: "补给",
  },
  command: {
    fill: "var(--color-purple-soft)",
    stroke: "var(--color-purple)",
    label: "指挥",
  },
} as const

/**
 * C12 SpatialViewport（Bevy 视图的 2D 示意）。坐标为 park-ENU，北向朝上。
 * position = null 不绘制但保留在逻辑与列表中；[0, 0, 0] 是有效位置。
 * 传入 onMove 后可拖动已放置实体（onPointerUp 一次性提交，米坐标）；
 * 传入 onCanvasClick 后点击空白处回报落点（供放置流程使用）。
 */
export default function SpatialViewport({
  items,
  selectedId,
  onSelect,
  onMove,
  onCanvasClick,
  caption,
}: {
  items: SpatialItem[]
  selectedId?: string
  onSelect?: (id: string) => void
  onMove?: (id: string, east: number, north: number) => void
  onCanvasClick?: (east: number, north: number) => void
  caption?: string
}) {
  const placed = items.filter(
    (i): i is SpatialItem & { position: Vector3 } => i.position !== null,
  )
  const unplaced = items.filter((i) => i.position === null)

  const box = useMemo(() => {
    const xs = placed.map((i) => i.position[0])
    const ys = placed.map((i) => i.position[1])
    const minX = Math.min(0, ...xs) - 40
    const maxX = Math.max(100, ...xs) + 60
    const minY = Math.min(0, ...ys) - 40
    const maxY = Math.max(100, ...ys) + 50
    return { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY }
  }, [placed])

  // 北向朝上：SVG y = maxY - north
  const sx = (x: number) => x - box.minX
  const sy = (y: number) => box.maxY - y

  // 拖动：指针 → viewBox 坐标 → 米坐标；提交四舍五入到 0.1 m。
  const svgRef = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<{ id: string ;east: number ;north: number } | null>(null)
  const dragStart = useRef<{ clientX: number ;clientY: number ;moved: boolean } | null>(null)
  const suppressClick = useRef(false)
  const toMeters = (clientX: number, clientY: number) => {
    const svg = svgRef.current
    const ctm = svg?.getScreenCTM()
    if (!svg || !ctm) return null
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse())
    return { east: p.x + box.minX, north: box.maxY - p.y }
  }
  const round = (v: number) => Math.round(v * 10) / 10
  // 在同一位置的多个实体做轻微错位，避免完全重叠（仅显示层）。
  const offsets = useMemo(() => {
    const seen = new Map<string, number>()
    const out = new Map<string, number>()
    for (const i of placed) {
      const key = i.position.join(",")
      const n = seen.get(key) ?? 0
      seen.set(key, n + 1)
      out.set(i.id, n)
    }
    return out
  }, [placed])

  return (
    <div className="canvas-grid relative h-full min-h-[240px] w-full overflow-hidden bg-[#f6f9fb]">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${box.w} ${box.h}`}
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label={caption ?? "空间视图"}
      >
        {onCanvasClick ? (
          <rect
            x={0}
            y={0}
            width={box.w}
            height={box.h}
            fill="transparent"
            style={{ cursor: "crosshair" }}
            aria-label="放置落点"
            onClick={(e) => {
              const m = toMeters(e.clientX, e.clientY)
              if (m) onCanvasClick(round(m.east), round(m.north))
            }}
          />
        ) : null}
        {/* 园区轮廓（示意） */}
        <rect
          x={sx(90)}
          y={sy(290)}
          width={360}
          height={230}
          rx={8}
          fill="white"
          fillOpacity={0.55}
          stroke="var(--color-border)"
          strokeDasharray="4 4"
        />
        <text x={sx(98)} y={sy(278)} fontSize={9} fill="var(--color-faint)">
          园区边界 · park-ENU
        </text>
        {/* 原点 */}
        <g opacity={0.7}>
          <line
            x1={sx(0) - 6}
            y1={sy(0)}
            x2={sx(0) + 6}
            y2={sy(0)}
            stroke="var(--color-muted)"
            strokeWidth={1}
          />
          <line
            x1={sx(0)}
            y1={sy(0) - 6}
            x2={sx(0)}
            y2={sy(0) + 6}
            stroke="var(--color-muted)"
            strokeWidth={1}
          />
          <text
            x={sx(0) + 6}
            y={sy(0) + 12}
            fontSize={8}
            fill="var(--color-muted)"
          >
            (0, 0)
          </text>
        </g>
        {placed.map((item) => {
          const k = KIND[item.kind]
          const n = offsets.get(item.id) ?? 0
          const dragging = drag?.id === item.id
          const px = dragging ? drag.east : item.position[0]
          const py = dragging ? drag.north : item.position[1]
          const x = sx(px) + n * 18
          const y = sy(py) + n * 18
          const selected = item.id === selectedId
          return (
            <g
              key={item.id}
              role={onSelect ? "button" : undefined}
              tabIndex={onSelect ? 0 : undefined}
              aria-label={`${item.id} ${item.label}`}
              opacity={dragging ? 0.75 : 1}
              onPointerDown={(e) => {
                if (!onMove || e.button !== 0) return
                dragStart.current = {
                  clientX: e.clientX,
                  clientY: e.clientY,
                  moved: false,
                }
                e.currentTarget.setPointerCapture?.(e.pointerId)
              }}
              onPointerMove={(e) => {
                const start = dragStart.current
                if (!onMove || !start) return
                if (
                  !start.moved &&
                  Math.hypot(e.clientX - start.clientX, e.clientY - start.clientY) < 4
                )
                  return
                start.moved = true
                suppressClick.current = true
                const m = toMeters(e.clientX, e.clientY)
                if (m) setDrag({ id: item.id, east: m.east, north: m.north })
              }}
              onPointerUp={(e) => {
                const start = dragStart.current
                if (!onMove || !start) return
                dragStart.current = null
                if (!start.moved) return
                const m = toMeters(e.clientX, e.clientY)
                setDrag(null)
                if (m) onMove(item.id, round(m.east), round(m.north))
              }}
              onClick={() => {
                if (suppressClick.current) {
                  suppressClick.current = false
                  return
                }
                onSelect?.(item.id)
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  onSelect?.(item.id)
                }
              }}
              className={cn(
                onSelect && "cursor-pointer outline-none",
                onMove && "cursor-grab active:cursor-grabbing",
              )}
            >
              {selected ? (
                <circle
                  cx={x}
                  cy={y}
                  r={17}
                  fill="none"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                />
              ) : null}
              {item.kind === "fire" ? (
                <>
                  {item.active ? (
                    <circle
                      cx={x}
                      cy={y}
                      r={13}
                      fill={k.stroke}
                      opacity={0.12}
                    />
                  ) : null}
                  <circle
                    cx={x}
                    cy={y}
                    r={9}
                    fill={k.fill}
                    stroke={k.stroke}
                    strokeWidth={1.5}
                    strokeDasharray={item.active ? undefined : "2 2"}
                  />
                  <path
                    d={`M${x} ${y - 5} c3 3 4 5 2.5 7.5 a3 3 0 0 1 -5 0 c-1 -2 0 -3.5 1 -4.5 c0 1.5 1 2 1.5 2 c0 -2 -0.5 -3.5 0 -5`}
                    fill={k.stroke}
                  />
                </>
              ) : (
                <rect
                  x={x - 9}
                  y={y - 9}
                  width={18}
                  height={18}
                  rx={item.kind === "station" ? 9 : 4}
                  fill={k.fill}
                  stroke={k.stroke}
                  strokeWidth={1.5}
                />
              )}
              <text
                x={x}
                y={y + (item.kind === "fire" ? 3.5 : 3)}
                fontSize={item.kind === "fire" ? 0 : 7.5}
                fontWeight={600}
                textAnchor="middle"
                fill={k.stroke}
              >
                {item.kind === "fire" ? "" : item.id}
              </text>
              <text
                x={x + 14}
                y={y - 2}
                fontSize={9}
                fontWeight={600}
                fill="var(--color-ink)"
              >
                {item.kind === "fire" ? item.id : item.label}
              </text>
              {item.caption ? (
                <text
                  x={x + 14}
                  y={y + 9}
                  fontSize={8}
                  fill="var(--color-muted)"
                  className="tabular"
                >
                  {item.caption}
                </text>
              ) : null}
            </g>
          )
        })}
        {/* 比例尺 100 m */}
        <g transform={`translate(${box.w - 120}, ${box.h - 16})`}>
          <line
            x1={0}
            y1={0}
            x2={100}
            y2={0}
            stroke="var(--color-ink-soft)"
            strokeWidth={1.5}
          />
          <line x1={0} y1={-3} x2={0} y2={3} stroke="var(--color-ink-soft)" />
          <line
            x1={100}
            y1={-3}
            x2={100}
            y2={3}
            stroke="var(--color-ink-soft)"
          />
          <text
            x={50}
            y={-5}
            fontSize={8}
            textAnchor="middle"
            fill="var(--color-ink-soft)"
          >
            {formatNumber(100)} m
          </text>
        </g>
        <g transform={`translate(${box.w - 18}, 18)`}>
          <path d="M0 -9 L5 5 L0 2 L-5 5 Z" fill="var(--color-ink-soft)" />
          <text
            x={0}
            y={15}
            fontSize={8}
            textAnchor="middle"
            fill="var(--color-ink-soft)"
          >
            N
          </text>
        </g>
      </svg>

      <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-1.5">
        {caption ? (
          <span className="rounded-ui bg-surface/90 px-2 py-1 text-caption font-medium text-ink-soft shadow-card">
            {caption}
          </span>
        ) : null}
        {(Object.keys(KIND) as Array<keyof typeof KIND>).map((k) => (
          <span
            key={k}
            className="flex items-center gap-1 rounded-ui bg-surface/90 px-2 py-1 text-caption text-muted shadow-card"
          >
            <span
              className="h-2.5 w-2.5 rounded-sm border"
              style={{ background: KIND[k].fill, borderColor: KIND[k].stroke }}
            />
            {KIND[k].label}
          </span>
        ))}
      </div>

      {unplaced.length ? (
        <div className="absolute bottom-3 left-3 flex max-w-[60%] items-center gap-2 rounded-ui border border-border bg-surface/95 px-2.5 py-1.5 text-caption text-muted shadow-card">
          <MapPinOff size={13} aria-hidden />
          未定位 {unplaced.length}：
          {unplaced.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => onSelect?.(u.id)}
              className="font-mono text-ink-soft underline-offset-2 hover:underline"
            >
              {u.id} {u.label}
            </button>
          ))}
          <span className="text-faint">（逻辑保留，视图不绘制）</span>
        </div>
      ) : null}
    </div>
  )
}
