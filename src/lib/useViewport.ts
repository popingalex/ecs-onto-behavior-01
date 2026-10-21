import { useEffect, useState } from "react"

export function useViewportWidth(): number {
  const [width, setWidth] = useState(() => window.innerWidth)
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])
  return width
}

/** 断点：≥1440 标准；1280–1439 紧凑（树 220 / 检查器 320）；<1280 面板收起为浮层。 */
export type ViewportTier = "standard" | "compact" | "narrow"

export function viewportTier(width: number): ViewportTier {
  if (width < 1280) return "narrow"
  if (width < 1440) return "compact"
  return "standard"
}
