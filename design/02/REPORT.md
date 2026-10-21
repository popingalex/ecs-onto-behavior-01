# 原型整改总报告（ecs-onto-behavior-01）

日期：2026-10-21 ｜ 仓库状态：`main @ 2620768`（GitHub 已推送）｜ 验证：`77 passed / 0 failed`，`vite build` 通过

## 一句话结论

基于 `design/02` 整改计划的全部工作（M0–M5）已完成；随后应验收批评完成补缺批次与 IA v2 导航重构。当前应用是一个**可编辑、可执行、可解释**的 ECS + System 编排原型：四项核心能力（ECS 构建、System 外层调度、System 内部逻辑、计算过程记录）全部真实可用，30 页 + 2 overlay 无占位页。

## 交付内容

### M0–M4 施工（2026-10-20/21）

| 里程碑 | 内容 | 证据 |
|---|---|---|
| M0 基线 | 56 条失效规格路径修复；shadcn/ui + React Flow + FlowGram 真实挂载；种子单源；草稿按 documentId 分离 | `contracts/implementation_tasks.json` |
| M1 ECS 管理 | P02 类型（含 parent 继承）/ P03 组件 / P29 属性 / P05 模板 / P08 实体，CRUD + 搜索 + 引用阻止删除 + 恢复继承≠显式 null | `features/ecs/`，7 测试 |
| M2 内层逻辑 | P14 FlowGram 编辑器（五类物料、°C→K 拒绝、必需连接校验）、P30 程序库、P15 真实绑定候选 | `features/logic-editor/` |
| M3 外层调度 | P10 查询预览（q-fire=3 火源）、P11 System 绑定、P12 React Flow 编排（四种节点、order/effect 边、product 拒绝、成环禁止、计划预览） | `features/schedule-editor/` |
| M4 执行与过程 | 纯 TS mock 执行器（无 setTimeout 冒充）、trace 不可变记录、P22/P23/P24 过程页；P20 真实求值 | `services/mock-executor/` |

数值闭环（测试 + 浏览器双重验证）：基线 F01=100→请求−50/−50→比例0.8→获准−40/−40→最终 **20/20/20**；停用 B → **50/30/20**；A 改 20K → **30/20/20**（F02 比例 0.857）；断必需连接 → `INPUT_MISSING` 拒绝执行且分支头不动。

### M5 验收（2026-10-21）

AC01–AC20：**19 通过 / 1 部分（AC10 浏览器逐帧证据不全，逻辑有单测）/ 0 失败**。逐项结论见 `acceptance/core-journeys.md`，13 张真实截图在 `acceptance/screens/`，组件库三证（源码/交互/产物）见 `acceptance/component-usage.md`。

### 补缺批次

- 实体类型 parent 继承入 v0.5 契约（`schema/inheritance.ts`，成环/缺父校验，P02 可编辑）。
- P22 端口单位改读记录图快照，启发式回落以 ≈ 标注。
- 13 个占位页全部落地：P04 单位约束（沙盒试算与裁决同口径）、P06 场景模板、P07 场景装配、P09 资产清单、P13 访问诊断、P16 归约规则（独立试算）、P17 策略（诚实空态）、P18 校验发布（语义哈希绑定 + 不可变 bundle）、P19 新建运行、P25 事件链、P26 分支泳道 DAG、P27 分支对比（缺值不当 0）、P28 策略监控。

### IA v2 导航重构（2026-10-21，验收批评驱动）

| 批评 | 处理 |
|---|---|
| 动作混进对象树 | P19 移出树，入口为 P01/P20 按钮 |
| 树=导航复制品 | 纯对象树：点击=宿主页内选中；画布页（P12/P26）图中聚焦 |
| 场景组多余 | 整组下线归 mas-suite MapEngine（P06/P07/P09 → 迁移说明页）；P08 并入建模 |
| 只看到 system 内行为层 | P20 首屏=编排层（批次→system 卡→实体矩阵→下钻 P22）；过程页标注第二层 |
| 查属性来回跳页 | P31 属性详情抽屉（overlay 不跳页） |
| 运行/复盘重复、分支占树 | 六组并四组：项目/建模/逻辑/推演；分支归上下文切换器 |

顺带修复：P20 紧凑布局横向错位与垂直重叠（工具栏 flex-wrap + `overflow-clip` 根除焦点拉动）。

## 技术栈与关键决策

- React 19 + Vite 8 + Tailwind v4 + shadcn/ui；外层调度 React Flow（@xyflow/react），内层程序 FlowGram FreeLayoutEditor；草稿/undo/本地恢复自研 `draftRegistry`（按 documentId 分文档、语义哈希不含布局）。
- 执行器为浏览器内纯 TS 串行参考求值，接口（`ExecutionAdapter`）预留 Rust/WASM 替换位；`expected_runs.v05.json` 仅作对照与「查看样例」，不是执行查表。
- 已知取舍：提交历史在会话内存（刷新后计算提交消失，种子保留）；P17/P28 受契约限制只读；TanStack Table 已装未用（如实记录）。

## 工具链须知

- 使用 `corepack pnpm@10.34.3`（`.mise.toml` 锁定；系统 pnpm 12 供应链策略会拒绝本 lockfile；npmmirror 缺 @flowgram.ai tarball，安装加 `--registry=https://registry.npmjs.org/`）。
- **不要运行 `pnpm format`**：oxfmt 0.2.0 会破坏行内类型字面量（已发生过一次全仓事故并修复）。
- `src/main.tsx` 不含 React.StrictMode——刻意为之（FlowGram DI 在 dev 双挂载下必现白屏）。

## 剩余事项（均不阻塞核心闭环）

1. P17/P28 编辑能力：需先扩 v0.5 策略/监控契约。
2. TanStack Table 表格层替换：另立任务决定。
3. AC10 顺序边的浏览器逐帧录屏（逻辑已由单测覆盖）。
4. 正式接入 mas-suite MapEngine / Rust core：不在本原型范围。

## 文档索引

- 进展全程：`design/02/07_progress.md` ｜ 验收：`design/02/acceptance/` ｜ 状态契约：`design/02/contracts/implementation_tasks.json` ｜ 计划原文：`design/02/03_figma_make_tasks.md`
