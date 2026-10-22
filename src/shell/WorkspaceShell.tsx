import { useEffect, useRef, useState, type ReactNode } from "react"
import { CornerUpLeft, Eye, GitBranchPlus, Lock, WifiOff } from "lucide-react"
import {
  useWorkbenchContext,
  type WorkbenchContext,
} from "@/app/useWorkbenchContext"
import Button from "@/components/ui/Button"
import { cn } from "@/lib/cn"
import { isEditableTarget } from "@/lib/keyboard"
import {
  useViewportWidth,
  viewportTier,
  type ViewportTier,
} from "@/lib/useViewport"
import { GROUPS } from "@/navigation/groups"
import { pageView } from "@/pages/registry"
import {
  navigate,
  rememberScroll,
  recallScroll,
  useCurrentEntry,
  useOverlay,
} from "@/router/router"
import { useConnection, useRole } from "@/stores/context"
import { draftStore, redoDraft, saveDraft, undoDraft } from "@/stores/draft"
import {
  layoutStore,
  resizePanel,
  setFullscreen,
  togglePanel,
  useLayout,
} from "@/stores/layout"
import ContextBar from "./ContextBar"
import FunctionRail from "./FunctionRail"
import Inspector from "./Inspector"
import LeaveGuardDialog from "./LeaveGuardDialog"
import OverlayHost from "./OverlayHost"
import ResizeHandle from "./ResizeHandle"
import ResourceTree from "./ResourceTree"
import RouteGate from "./RouteGate"
import StatusBar from "./StatusBar"
import NativeModeStrip from "@/components/domain/NativeModeStrip"
import Toaster from "./Toaster"
import TopBar from "./TopBar"

/**
 * C01 WorkspaceShell：顶栏 / 功能栏 / 上下文栏 / 资源树 / 主工作区 / 检查器 / 状态栏。
 * 断点：≥1440 标准；1280–1439 紧凑（树 220、检查器 320）；<1280 树与检查器改为浮层。
 */
export default function WorkspaceShell() {
  const ctx = useWorkbenchContext()
  const width = useViewportWidth()
  const tier = viewportTier(width)
  const layout = useLayout((s) => s)
  const overlay = useOverlay()
  const [floating, setFloating] = useState<"tree" | "inspector" | null>(null)
  const { spec } = ctx
  const view = pageView(spec.id)

  // 页面切换时关闭窄屏浮层；离开画布页时退出全屏。
  useEffect(() => {
    setFloating(null)
    if (!spec.layout.canvas && layoutStore.getState().fullscreen)
      setFullscreen(false)
  }, [ctx.contextKey, spec.layout.canvas])

  useShortcuts({
    ctx,
    floating,
    closeFloating: () => setFloating(null),
    overlayOpen: Boolean(overlay),
  })

  const narrow = tier === "narrow"
  const fullscreen = layout.fullscreen && spec.layout.canvas
  const showTree =
    spec.layout.tree &&
    !fullscreen &&
    (narrow ? floating === "tree" : layout.treeOpen)
  const showInspector =
    spec.layout.inspector &&
    !fullscreen &&
    (narrow ? floating === "inspector" : layout.inspectorOpen)
  const treeWidth =
    tier === "compact" ? Math.min(layout.treeWidth, 220) : layout.treeWidth
  const inspectorWidth =
    tier === "compact"
      ? Math.min(layout.inspectorWidth, 320)
      : layout.inspectorWidth

  const toggleTree = () =>
    narrow
      ? setFloating((f) => (f === "tree" ? null : "tree"))
      : togglePanel("treeOpen")
  const toggleInspector = () =>
    narrow
      ? setFloating((f) => (f === "inspector" ? null : "inspector"))
      : togglePanel("inspectorOpen")

  const Main = view.Main
  const PageInspector = view.Inspector

  return (
    <div className="flex h-screen min-w-[960px] flex-col overflow-hidden bg-bg text-ink">
      <a
        href="#workbench-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[70] focus:rounded-ui focus:bg-surface focus:px-3 focus:py-2"
      >
        跳到主工作区
      </a>
      <TopBar />
      <NativeModeStrip />
      <div className="flex min-h-0 flex-1">
        <FunctionRail active={ctx.group.id} />
        <div className="flex min-w-0 flex-1 flex-col">
          <ContextBar
            ctx={ctx}
            tier={tier}
            treeOpen={narrow ? floating === "tree" : layout.treeOpen}
            inspectorOpen={
              narrow ? floating === "inspector" : layout.inspectorOpen
            }
            fullscreen={fullscreen}
            onToggleTree={toggleTree}
            onToggleInspector={toggleInspector}
            onToggleFullscreen={() => setFullscreen(!fullscreen)}
          />
          <Banners ctx={ctx} />
          <div className="relative flex min-h-0 flex-1">
            {narrow && floating ? (
              <div
                className="absolute inset-0 z-20 bg-[rgb(22_42_64/0.16)]"
                onClick={() => setFloating(null)}
                aria-hidden
              />
            ) : null}
            {showTree ? (
              <Panel
                side="left"
                width={treeWidth}
                floating={narrow}
                tier={tier}
              >
                <ResourceTree
                  group={ctx.group.id}
                  onNavigate={narrow ? () => setFloating(null) : undefined}
                />
                {!narrow ? (
                  <ResizeHandle
                    side="right"
                    value={treeWidth}
                    label="调整资源树宽度"
                    onChange={(v) => resizePanel("treeWidth", v)}
                  />
                ) : null}
              </Panel>
            ) : null}
            <MainArea fill={Boolean(view.fill)} ctx={ctx}>
              <RouteGate ctx={ctx}>
                <Main ctx={ctx} />
              </RouteGate>
            </MainArea>
            {showInspector ? (
              <Panel
                side="right"
                width={inspectorWidth}
                floating={narrow}
                tier={tier}
              >
                {!narrow ? (
                  <ResizeHandle
                    side="left"
                    value={inspectorWidth}
                    label="调整检查器宽度"
                    onChange={(v) => resizePanel("inspectorWidth", v)}
                  />
                ) : null}
                <Inspector ctx={ctx}>
                  {PageInspector ? (
                    <RouteGate ctx={ctx}>
                      <PageInspector ctx={ctx} />
                    </RouteGate>
                  ) : null}
                </Inspector>
              </Panel>
            ) : null}
          </div>
        </div>
      </div>
      <StatusBar ctx={ctx} tier={tier} width={width} />
      <OverlayHost />
      <LeaveGuardDialog />
      <Toaster />
    </div>
  )
}

function Panel({
  side,
  width,
  floating,
  tier,
  children,
}: {
  side: "left" | "right"
  width: number
  floating: boolean
  tier: ViewportTier
  children: ReactNode
}) {
  return (
    <div
      style={{ width: floating ? Math.min(width, 360) : width }}
      data-tier={tier}
      className={cn(
        "relative flex shrink-0 flex-col bg-surface",
        side === "left" ? "border-r border-border" : "border-l border-border",
        floating &&
          cn(
            "absolute inset-y-0 z-30 shadow-pop",
            side === "left" ? "left-0" : "right-0",
          ),
      )}
    >
      {children}
    </div>
  )
}

/** 主工作区：普通页由此滚动并按条目记住滚动位置；画布页自行管理全高布局。 */
function MainArea({
  fill,
  ctx,
  children,
}: {
  fill: boolean
  ctx: WorkbenchContext
  children: ReactNode
}) {
  const entry = useCurrentEntry()
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = recallScroll(entry.token, "main")
  }, [entry.token])
  return (
    <main
      id="workbench-main"
      ref={ref}
      aria-label={`${ctx.spec.id} ${ctx.spec.title}`}
      onScroll={(e) =>
        rememberScroll(entry.token, "main", e.currentTarget.scrollTop)
      }
      className={cn(
        "relative min-w-0 flex-1",
        // 画布页用 clip 而不是 hidden：clip 不是滚动容器，溢出内容被裁切，
        // 不会被焦点 reveal / scrollIntoView 横向拉动导致整列错位。
        fill ? "flex flex-col overflow-clip" : "scroll-thin overflow-auto",
      )}
    >
      {children}
    </main>
  )
}

function Banners({ ctx }: { ctx: WorkbenchContext }) {
  const role = useRole()
  const connection = useConnection()
  const { mode, viewCommit, headCommit, branch, route } = ctx
  const banners: ReactNode[] = []
  if (mode === "history" && viewCommit && headCommit && branch) {
    banners.push(
      <Strip key="history" tone="warning" icon={<Eye size={15} aria-hidden />}>
        <span className="min-w-0 flex-1 truncate">
          正在查看历史提交{" "}
          <span className="font-mono font-medium">{viewCommit.id}</span>（第{" "}
          {viewCommit.round} 回合）。分支{" "}
          <span className="font-mono">{branch.id}</span> 的 head 为{" "}
          <span className="font-mono">{headCommit.id}</span>
          ；历史只读，不能续算。
        </span>
        <Button
          size="sm"
          intent="ghost"
          icon={GitBranchPlus}
          disabled
          title="从历史提交建立分支：尚未接入"
        >
          从此提交建分支
        </Button>
        <Button
          size="sm"
          icon={CornerUpLeft}
          onClick={() =>
            navigate(
              {
                ...route,
                params: { ...route.params, viewCommit: headCommit.id },
              },
              { replace: true },
            )
          }
        >
          回到最新
        </Button>
      </Strip>,
    )
  }
  if (role === "observer") {
    banners.push(
      <Strip
        key="observer"
        tone="neutral"
        icon={<Lock size={15} aria-hidden />}
      >
        观察者：只读查看。草稿编辑与运行命令已禁用。
      </Strip>,
    )
  }
  if (connection === "offline") {
    banners.push(
      <Strip
        key="offline"
        tone="danger"
        icon={<WifiOff size={15} aria-hidden />}
      >
        已离线：保存与回合提交不可用，草稿保留在本地；分支 head 不会改变。
      </Strip>,
    )
  }
  return banners.length ? <div className="shrink-0">{banners}</div> : null
}

function Strip({
  tone,
  icon,
  children,
}: {
  tone: "warning" | "neutral" | "danger"
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex min-h-10 items-center gap-3 border-b px-4 py-1.5 text-label",
        tone === "warning" &&
          "border-warning-line bg-warning-soft text-warning-ink",
        tone === "neutral" && "border-border bg-neutral-soft text-ink-soft",
        tone === "danger" && "border-danger-line bg-danger-soft text-danger",
      )}
    >
      <span className="shrink-0">{icon}</span>
      {children}
    </div>
  )
}

/** 全局快捷键：Alt+1…4 切换功能入口；Ctrl+Z / Ctrl+Shift+Z / Ctrl+S 草稿；Esc 关闭浮层 / 退出全屏。 */
function useShortcuts({
  ctx,
  floating,
  closeFloating,
  overlayOpen,
}: {
  ctx: WorkbenchContext
  floating: string | null
  closeFloating: () => void
  overlayOpen: boolean
}) {
  const state = useRef({ ctx, floating, closeFloating, overlayOpen })
  state.current = { ctx, floating, closeFloating, overlayOpen }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing) return
      const s = state.current
      const mod = e.ctrlKey || e.metaKey
      if (e.altKey && !mod && /^Digit[1-4]$/.test(e.code)) {
        e.preventDefault()
        const group = GROUPS[Number(e.code.slice(5)) - 1]
        if (group) navigate({ pageId: group.defaultPage, params: {} })
        return
      }
      if (s.overlayOpen) return
      if (
        mod &&
        e.key.toLowerCase() === "s" &&
        s.ctx.spec.context === "asset"
      ) {
        e.preventDefault()
        if (draftStore.getState().dirty) void saveDraft()
        return
      }
      if (isEditableTarget(e.target)) return
      if (
        mod &&
        e.key.toLowerCase() === "z" &&
        s.ctx.spec.context === "asset"
      ) {
        e.preventDefault()
        if (e.shiftKey) redoDraft()
        else undoDraft()
        return
      }
      if (
        mod &&
        e.key.toLowerCase() === "y" &&
        s.ctx.spec.context === "asset"
      ) {
        e.preventDefault()
        redoDraft()
        return
      }
      if (e.key === "Escape") {
        if (s.floating) s.closeFloating()
        else if (layoutStore.getState().fullscreen) setFullscreen(false)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])
}
