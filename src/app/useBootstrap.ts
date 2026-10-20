import { useEffect } from 'react'
import { PAGE_SPECS } from '@/navigation/pages'
import { navigate, openOverlay, routerStore, setLeaveGuard } from '@/router/router'
import { discardDraft, isDirty, saveDraft } from '@/stores/draft'
import { loadWorkbench } from '@/data/store'

/** 应用启动：加载数据、注册离开守卫、把弹层深链接还原为“底层页面 + 弹层”。 */
export function useBootstrap() {
  useEffect(() => {
    void loadWorkbench()

    // 带未保存草稿从资产页进入执行页：提示运行只使用已发布 bundle。
    setLeaveGuard((from, to) => {
      if (!isDirty()) return null
      if (PAGE_SPECS[from.pageId].context !== 'asset' || PAGE_SPECS[to.pageId].context !== 'execution') return null
      return {
        reason: '有未保存的草稿修改',
        detail: '运行只使用已发布的不可变 bundle，草稿修改不会进入运行。离开前可以先保存草稿，或放弃这些修改。',
        save: saveDraft,
        discard: discardDraft,
      }
    })

    const s = routerStore.getState()
    const route = s.entries[s.index].route
    if (PAGE_SPECS[route.pageId].kind !== 'page') {
      const returnPage = route.params.returnPage
      const base = returnPage && returnPage in PAGE_SPECS && PAGE_SPECS[returnPage as keyof typeof PAGE_SPECS].kind === 'page' ? returnPage : 'P01'
      navigate({ pageId: base as keyof typeof PAGE_SPECS, params: {} }, { replace: true })
      openOverlay(route)
    }
    return () => setLeaveGuard(null)
  }, [])
}
