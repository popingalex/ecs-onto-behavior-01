import type { PageId, Route } from "@/core/types"
import { isPageId } from "@/navigation/pages"

/**
 * 逻辑路由：workbench://{project}/{pageId}?k=v。
 * 原生客户端不需要真实 URL；浏览器宿主映射为 hash：#/{pageId}?k=v。
 */
export const DEFAULT_ROUTE: Route = { pageId: "P01", params: {} }

function encodeParams(params: Record<string, string>): string {
  const keys = Object.keys(params)
    .filter((k) => params[k] !== "")
    .sort()
  if (keys.length === 0) return ""
  const search = new URLSearchParams()
  keys.forEach((k) => search.set(k, params[k]))
  return `?${search.toString()}`
}

export function toHash(route: Route): string {
  return `#/${route.pageId}${encodeParams(route.params)}`
}

export function toLogicalUri(projectId: string, route: Route): string {
  return `workbench://${projectId}/${route.pageId}${decodeURIComponent(encodeParams(route.params))}`
}

export function parseHash(hash: string): Route | null {
  const raw = hash.replace(/^#\/?/, "")
  if (!raw) return null
  const [path, query = ""] = raw.split("?")
  if (!isPageId(path)) return null
  const params: Record<string, string> = {}
  new URLSearchParams(query).forEach((value, key) => {
    params[key] = value
  })
  return { pageId: path as PageId, params }
}

/** contextKey：异步响应用它判断是否属于当前上下文，旧上下文响应被丢弃。 */
export function routeKey(route: Route): string {
  return `${route.pageId}${encodeParams(route.params)}`
}

export function sameRoute(a: Route, b: Route): boolean {
  return routeKey(a) === routeKey(b)
}

/** route 是否包含 subset 中的所有参数（资源树选中态判断）。 */
export function routeMatches(route: Route, target: Route): boolean {
  if (route.pageId !== target.pageId) return false
  return Object.entries(target.params).every(([k, v]) => route.params[k] === v)
}
