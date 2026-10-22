# ecs-onto-behavior-01 汇总报告

日期：2026-10-22 ｜ 仓库：`main @ ee2070e`（GitHub 已推送）｜ 验证：**109 passed / 0 failed** · tsc 干净 · `vite build` 通过

## 一句话结论

ECS 本体编辑 + 双层 System 编排 + 动态参考执行 + 溯源/分支浏览的**本地浏览器原型**已完成：从 v0.5 整改（M0–M5）到 v0.6 加固（W0–W6）再到地图主角布局，30 页 + 3 overlay 无占位页，AC01–AC20 与 AC06-01–30 全部通过，历史本地持久化可恢复，地图组件作为场景/推演页主角的宿主边界已就位（geo 逻辑归外部 MapEngine）。

## 阶段总览

| 阶段 | 日期 | 内容 | 结果 |
|---|---|---|---|
| M0–M4 施工 | 10-20/21 | ECS 管理（P02/P03/P05/P08/P29）、FlowGram 内层（P14/P30/P15）、React Flow 外层（P10/P11/P12）、mock 执行器与过程页（P20/P22/P23/P24） | 35 测试 |
| M5 验收 | 10-21 | AC01–AC20 首验：19 通过/1 部分/0 失败；13 张截图 | design/02/acceptance/ |
| 补缺 | 10-21/22 | 类型 parent 继承、P22 端口单位、13 个占位页全部落地 | 66 测试 |
| IA v2 | 10-21 | 四组导航（项目/建模/逻辑/推演）、纯对象树、推演两层（编排层→节点级）、P31 属性抽屉、场景组下线归 MapEngine | 77 测试 |
| v0.6 W0–W6 | 10-22 | 基线复现、AC10 补证、全量回归（AC 终态 20/20 + AC06-01–30 全 PASS）、IndexedDB 历史持久化、溯源治理、工具链与性能基线、MapEngine/Rust 契约 | 101 测试 |
| 地图主角 | 10-22 | MapViewport 宿主组件（geo 不实现、预留 MapEngine 接入位）；P20 地图满幅、左/右/下面板三选一互斥、其余图标栏/图例/悬浮卡 | 109 测试 |

## 核心能力（全部浏览器实测）

- **ECS 构建**：类型/组件/属性/模板/实体分层管理，CRUD + 引用阻止删除 + 恢复继承≠显式 null + parent 继承。
- **System 外层调度（第一层）**：React Flow 编排（System/归约/合同/提交四种节点，order/effect 边，product 拒绝，成环禁止）；P20 首屏编排层：批次→system 卡→实体矩阵。
- **System 内部行为（第二层）**：FlowGram 五节点程序编辑，°C→K 单位拒绝，必需连接校验，P15 动态绑定候选；P22 节点级过程下钻。
- **计算过程**：纯 TS 参考执行器真实求值（非查表）；三组试算实测——基线 20/20/20（请求−50/比例0.8/获准−40）、停用B 50/30/20、A改20K 30/20/20（F02 比例 6/7）；断必需连接 INPUT_MISSING 拒绝执行、head 不动。
- **溯源与历史**：record 绑定 inputVersions + 程序快照；旧记录不随草稿变；缺来源明示「不可完整追溯」；提交/trace/分支 IndexedDB 持久化，刷新可恢复，故障不动旧 head（100 提交 2.0MiB/校验 0.4ms）。

## 关键数字

- 测试：**109 passed / 0 failed**（M0 时 6 → 全程净增 103）
- 验收：AC01–AC20 **20/20**；AC06-01–30 **30/30**；页面能力 A15/B11/C3/D2/**E0**
- 性能基线（M2 Ultra）：executeRound 3 实体均值 0.382ms/p95 0.532ms；10,000 实体单轮 690ms（超 0.5s 目标，如实登记不宣称性能合格）
- 证据：60+ 张真实浏览器截图、机读 trace/plan JSON，按 ac10/ia-v2/provenance/persistence/toolchain 归档于 `design/03/evidence/`

## 施工中实测发现并修复的缺陷（13 项，择要）

1. P12 React Flow 闭包死循环白屏（拖线即崩）— 修复。
2. W4 恢复校验误伤合理用户流（整库回退丢历史）+ mergeCatalogRuns 早退潜伏 bug — 修复为根提交落库 + 分支级隔离。
3. P19 深链不识别本地 bundle；P20 失败横幅跨上下文残留 — 修复。
4. 缺 inputVersionRefs 节点静默 — 新增 traceabilityGaps 明示。
5. FlowGram 1.0.16 DI × StrictMode 必现白屏 — 最小复现留存，绕行维持（重开有验收标准）。
6. oxfmt 0.2.0 破坏行内类型字面量 — 最小复现 + 候选修复版本 0.74.0 验证；写模式 format 维持禁用。

## 架构决策（现行）

React 原型 UI（不取消 Rust 长期目标）；TS executor 是参考器非生产内核；MapEngine 独立模块先契约后接入（`design/03/contracts/`）；本地持久化 IndexedDB 原型级（不排除未来 PG/服务端）；地图主角布局（ADR-v06-06：宿主组件、三选一互斥、悬浮/图标栏规则）；pnpm corepack 10.34.3 锁定、StrictMode 绕行、写模式 format 禁用、TanStack Table 移除。

## 残留限制（如实声明）

草稿新实体/新属性初值不入执行世界（v0.7）；P17/P28 受契约只读；6 个低优先级 UI 遗留；1920×1200 以 1920×1080 替代实测；历史可导出不可导入（不可跨设备迁移）；MapEngine 与 Rust/WASM 未接入（契约草案已备）。

## 文档地图

- 本报告：`design/REPORT.md`
- v0.6 完成报告/验收/发布决策：`design/03/resp/00_v06_completion_report.md`、`design/03/03_v06_acceptance.md`、`design/03/05_release_decision.md`
- 契约：`design/03/contracts/`（mapengine-integration / execution-adapter-boundary / local-history-v06 / trace-provenance-v06 / architecture-decisions）
- 过程档案：`design/02/07_progress.md`、`design/02/REPORT.md`（v0.5 阶段）、`design/02/acceptance/`
- 计划原文：`design/02/03_figma_make_tasks.md`（M0–M5）、`design/03/01_v06_implementation_plan.md`（W0–W6）

## 工具链须知

`corepack pnpm@10.34.3`（装依赖用官方 registry）；**不要运行写模式 `pnpm format`**；`src/main.tsx` 无 StrictMode 是刻意绕行；dev server :8443。
