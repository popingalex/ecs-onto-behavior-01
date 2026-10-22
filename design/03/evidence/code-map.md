# W0 代码定位表（功能 → 真实文件 → 状态）

日期：2026-10-22 ｜ HEAD `f5b1780` ｜ 状态词：已确认（代码+测试/浏览器证据）/ 部分 / 未证实

## 核心域

| 功能域 | 真实文件 | 状态 |
|---|---|---|
| ECS 定义/实例/继承/null/引用约束 | `src/features/ecs/`（refs/operations/ids/editing/adapters + `__tests__`）、`src/schema/inheritance.ts`、`src/schema/model.ts`、`src/schema/parse.ts` | 已确认（单测覆盖引用阻止/分层/null/继承） |
| FlowGram 内层编辑 P14/P15/P30 | `src/features/logic-editor/`（LogicCanvas/LogicNodeCard/NodeForm/DiagnosticsDock/programFile/editorContext）、`src/pages/p14/`、`src/pages/p30/`、`src/pages/overlays/P15BindingPicker.tsx`、`src/services/domainBindingService.ts`、`src/services/logicGraphCodec.ts` | 已确认（浏览器冒烟 + 单测） |
| React Flow 外层调度 P10/P11/P12 | `src/features/schedule-editor/`（ScheduleEditor/ScheduleCanvas/nodes/codec/ops/PlanPanel/focus）、`src/pages/p10|p11|p12/`、`src/services/scheduleCompiler.ts` | 已确认 |
| 执行器与失败路径 | `src/services/mock-executor/`（executeRound/types/index + `__tests__`）、`src/services/executionAdapter.ts`（mockExecutorAdapter 默认 / referenceAdapter 样例） | 已确认 |
| 草稿/文档/undo | `src/stores/draftRegistry.ts`、`src/stores/modelDocuments.ts`（composeModel、program/schedule 动态注册） | 已确认 |
| 会话/trace/branch | `src/stores/session.ts`（相位机/守卫）、`src/stores/trace.ts`（不可变 record）、`src/stores/history.ts`（commit/branch/谱系，**会话内存**）、`src/stores/publish.ts`、`src/stores/runCatalog.ts` | 部分（history/trace 仅会话内存 → W4） |
| 运行/过程页 P20/P22–P27/P31 | `src/pages/p20/`（含 orchestration.ts/OrchestrationPanel）、`p22/`（traceView + portUnit）、`p23/`、`p24/`、`p25/`、`p26/`（commitGraphLayout）、`p27/`、`src/pages/overlays/P31AttributeDetail.tsx` | 已确认 |
| IA v2 导航 | `src/core/types.ts`（GroupId 4 值）、`src/navigation/groups.ts|pages.ts`、`src/shell/resourceTreeModel.ts`、`src/shell/ResourceTree.tsx`、`src/pages/RetiredPage.tsx` | 已确认 |
| 历史验收资料 | `design/02/acceptance/`（core-journeys/component-usage/screens 13 张）、`design/02/contracts/implementation_tasks.json`（M0–M5 done）、`design/02/07_progress.md`、`design/02/REPORT.md` | 已确认 |

## 扫描复核（`rg` 定位，不作完备性证据）

- `ExecutionAdapter|INPUT_MISSING|read_previous|order|effect|product`：命中集中在 `src/services/mock-executor/`、`scheduleCompiler.ts`、`domainBindingService.ts` —— 与报告口径一致。
- `PagePlaceholder`：仅 `src/pages/PagePlaceholder.tsx` 定义与 registry 回落逻辑；无任何页面路由回落（P06/P07/P09 走 RetiredPage）。
- `TODO|not implemented|未接入`：命中集中在 P09 资产导入禁用说明、搜索框「未接入」标注等诚实空态，无假实现。
- `StrictMode`：仅 `src/main.tsx` 注释说明刻意移除（FlowGram DI 冲突）。

## 未证实/缺失（进入对应 W 批次）

- AC10（A→B 顺序边后 B 仍读旧值）的**浏览器证据** → W1。
- commit/trace/branch 刷新持久化 → W4（`history.ts`/`trace.ts` 纯内存）。
- 1440×900 与 1920×1200 双视口系统回归（1920×1200 未做过）→ W2。
- MapEngine / Rust-WASM 契约 → W6（当前无任何接入代码）。
