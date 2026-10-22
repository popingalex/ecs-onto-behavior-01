# v0.6 实施完成报告（resp）

日期：2026-10-22 ｜ 计划：`design/03/01_v06_implementation_plan.md`（W0–W6）｜ 结果：**v0.6 全部工作包完成，发布决策 GO（限定口径）**

## 一句话结论

在 M0–M5 + IA v2 之上完成 v0.6 增量施工：基线独立复现、AC10 浏览器证据补齐、最终 HEAD 全量回归（AC01–AC20 终态 20/20）、AC06-01–30 逐项 PASS、本地历史 IndexedDB 持久化落地、溯源/单位治理补齐、工具链风险工程化、MapEngine/Rust 契约草案成文。测试中位 101 passed / 0 failed，tsc 干净，build 通过。

## 工作包结果

| 包 | 结果 | 关键产物 |
|---|---|---|
| W0 基线取证 | 完成 | `evidence/baseline.md`、`code-map.md`、`logs/`（HEAD f5b1780、77→101 复现链） |
| W1 AC10 + 执行语义 | 完成 | `evidence/ac10/`（11 图 + README）、`traces/ac10-r2-record.json`；修复 P12 白屏（React Flow 更新深度死循环） |
| W2 IA v2 全量回归 | 完成 | 19+1 回归表、`04_page_capability_matrix.md`（A15/B11/C3/D2/E0）、`evidence/ia-v2/`（27 图）；发现并修复 3 个中级 bug |
| W3 不可变来源 | 完成 | `contracts/trace-provenance-v06.md`、`evidence/provenance/`（v1/v2 两轮 9 图）；traceabilityGaps 等 4 项补缺 |
| W4 本地持久化 | 完成 | `src/stores/persistence/`（IDB 单事务 facts→marker→head、分支级隔离、schema 版本治理）、`contracts/local-history-v06.md`、基线 100 提交 2.0MiB/校验 0.4ms |
| W5 工具链与性能 | 完成 | `evidence/toolchain/`（StrictMode 最小复现、oxfmt 对比实验、性能基线 10k 实体 690ms 登记差距）；TanStack Table 决策移除 |
| W6 集成契约 | 完成 | `contracts/mapengine-integration.md`、`execution-adapter-boundary.md`、`architecture-decisions.md`（均为草案，未接入如实声明） |

## 施工中实测发现并修复的缺陷

1. P12 React Flow 闭包不稳定 → StoreUpdater 更新深度死循环白屏（拖线即崩）。
2. W4 恢复校验误伤合理用户流（发布+新建运行+删属性后整库回退丢历史）；并发修复 `mergeCatalogRuns` 早退潜伏 bug；整库回退改为硬检测保留 + 未知分支隔离。
3. P19 深链不识别本地发布 bundle（resolve 只查种子）。
4. P20 试算失败横幅跨分支/跨修复残留（上下文/编辑变更时自动清理）。
5. 缺 inputVersionRefs 节点曾静默无提示（新增 traceabilityGaps 明示「不可完整追溯」）。
6. 既有 tsc 窄化错误（resourceTreeModel）。

## 验收与发布

- `design/03/03_v06_acceptance.md`：旧 AC 回归 + AC06-01…30 逐项证据索引。
- `design/03/05_release_decision.md`：**GO**，口径限定为「本地浏览器原型通过指定纵向场景与失败路径验收」。
- `design/03/02_verified_code_audit.md`：代码审计与风险定位。

## 残留限制（如实声明，不阻塞发布）

草稿新实体/新属性初值不入执行世界（v0.7）；10k 实体 690ms 超 0.5s 目标不宣称性能；6 个低优先级 UI 遗留；1920×1200 以 1920×1080 替代实测；StrictMode 绕行与 format 禁用维持；历史导出可、导入明确不提供。

## 证据规范符合性

每项验收证据关联 commit SHA、运行环境（M2 Ultra/Node 22.20.0/Chromium 内置浏览器）、日期、场景；机读 trace/plan/record JSON 与截图并存（`evidence/traces/`、各 evidence 子目录）。

## 追加：地图主角布局（2026-10-22，用户指令）

- 新增 `src/components/domain/MapViewport.tsx`：geo 宿主边界组件（geo 逻辑明确归外部 MapEngine，预留 engine 挂载位，本仓库不实现）；过渡渲染器为现有 SpatialViewport。
- P20 重构为地图主角布局：地图满幅主区；左/右/下内容面板三选一互斥展开（pin 也受互斥约束），其余时间以小图标工具栏/图例/摘要 chip 长期悬浮于地图上方；编排层改为可折叠悬浮卡。
- 页面级 `MAP` 布局标记使 P20 脱离通用三栏，其他页面零影响；互斥 reducer 8 测试，合计 109 passed。
- 证据：`design/03/evidence/ia-v2/map-protagonist-*.png`（默认满幅/左面板/右检查器/底部表/编排卡/推算后/1440）。
- ADR-v06-06 已记入 `contracts/architecture-decisions.md`。
