import { OVERLAY_VIEWS } from '@/pages/registry'
import { useOverlay } from '@/router/router'

/** P15 模态 / P21 抽屉：不替换底层页面，关闭后焦点回到触发控件。 */
export default function OverlayHost() {
  const overlay = useOverlay()
  if (!overlay) return null
  const View = OVERLAY_VIEWS[overlay.route.pageId]
  if (!View) return null
  return <View key={overlay.token} route={overlay.route} />
}
