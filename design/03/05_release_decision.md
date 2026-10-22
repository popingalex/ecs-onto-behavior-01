# v0.6 发布决策

日期：2026-10-22 ｜ 决策：**GO — 按限定口径发布 v0.6**

## 发布口径（严格限定）

> 「ECS + 双层 System + 动态参考执行 + 溯源/分支浏览的**本地浏览器原型**，通过指定纵向场景与失败路径验收。」

不得表述为：完整仿真平台 / Rust/WASM 生产内核 / 已验证 0.5 秒结算或千人性能 / 已接入 MapEngine。

## 门禁核对（§13.2 合并条件）

| 条件 | 结果 |
|---|---|
| 真实 HEAD、构建/测试重现、数量透明 | ✓ f5b1780 + 施工改动；101 passed / 0 failed；tsc 干净；日志在 evidence/logs/ |
| AC01–AC20 最终 HEAD 全量回归 | ✓ 20/20（AC10 由 W1 补齐浏览器证据） |
| AC06-01–30 逐项结果，门槛项全 PASS | ✓（见 03_v06_acceptance.md；AC06-24 的 1920 档为 1920×1080 如实注明） |
| A→B order 不透传暂存；三组冷却数字；断边失败原子性 | ✓ 单测 + 浏览器 + 机读 trace 三重证据 |
| IA v2 两层下钻/对象树/P31/分支/双视口 | ✓ |
| 当前图/已发布 bundle/历史图单位绑定/输入版本不串档 | ✓（W3 + trace-provenance 契约） |
| 本地提交/trace/分支刷新可恢复；故障不动旧 head | ✓（W4 + bug 修复后用户流复测） |
| 工具链风险有最小复现/回归/缓解 | ✓（StrictMode 宿主复现、oxfmt 对比实验、锁版） |
| 页面能力 A/B/C/D 透明；MapEngine/Rust 未误报完成 | ✓（04_page_capability_matrix.md，E0；契约均为草案） |

## 已修复的 v0.6 期缺陷（施工中实测发现）

1. P12 React Flow 更新深度死循环白屏（W1 修复）。
2. W4 恢复校验误伤合理用户流 + mergeCatalogRuns 早退潜伏 bug + 整库回退株连（修复为根提交落库 + 分支级隔离）。
3. P19 深链不识别本地发布 bundle。
4. P20 试算失败横幅跨分支/跨修复残留。
5. W3 追溯缺口：缺 inputVersionRefs 节点曾静默（新增 traceabilityGaps 明示）。
6. 既有 tsc 错误（resourceTreeModel selectedNodeId 窄化）。

## 残留限制（发布时如实声明）

- 草稿新实体/新属性初值不进入执行世界（契约缺口，v0.7）。
- 10,000 实体单轮 690 ms 超 0.5 s 目标；性能不做合格宣称。
- 6 个低优先级 UI 遗留（W2 清单）；1920×1200 未实测（1920×1080 替代）。
- React.StrictMode 上游缺陷未愈，绕行维持；写模式 format 维持禁用。
- 本地历史不提供导入/跨设备迁移（导出已实现并有 UI 说明）。

## v0.7 契约审议清单（非本轮完成）

ExecutionAdapter/Rust-WASM 对照（execution-adapter-boundary.md）、MapEngine 接入（mapengine-integration.md）、服务端权威分支（v0.7-B）、策略/监控新契约（v0.7-D，P17/P28 升级）、容量指标（v0.7-E）。
