import AsyncStatePanel from "@/components/domain/AsyncStatePanel"
import { useBootstrap } from "@/app/useBootstrap"
import { loadWorkbench, useDataStatus } from "@/data/store"
import WorkspaceShell from "@/shell/WorkspaceShell"

/**
 * 推演建模与运行工作台（React 原型）。
 * 数据：DataAdapter → WorkbenchIndex；导航：集中页面注册表 + 跳转表；动态行为：统一 mock adapter。
 */
export default function App() {
  useBootstrap()
  const status = useDataStatus()
  if (status === "ready") return <WorkspaceShell />
  return (
    <div className="flex h-screen items-center justify-center bg-bg">
      {status === "error" ? (
        <AsyncStatePanel
          status="error"
          title="工作台数据加载失败"
          description="mock 数据适配器未能返回项目索引。"
          onRetry={() => void loadWorkbench()}
        />
      ) : (
        <AsyncStatePanel
          status="loading"
          title="正在加载项目"
          description="读取模型、场景、程序与运行历史"
        />
      )}
    </div>
  )
}
