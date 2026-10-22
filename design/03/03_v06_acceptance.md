# v0.6 验收记录（旧 AC 回归 + AC06-01…30）

日期：2026-10-22 ｜ 验收 HEAD：`f5b1780` + 工作区 W1–W5 改动（见 release_decision 的最终 SHA）｜ 环境：macOS（M2 Ultra · 192 GiB）、Node v22.20.0、`corepack pnpm@10.34.3`、内置浏览器（Chromium）、dev server :8443

## 旧 AC01–AC20 回归（W2，最终 IA v2）

**19 PASS / 1 PARTIAL（AC10→已由 W1 补齐为 PASS，见下）/ 0 FAIL**，无原通过现失败的回归。逐项表与 27 张证据见 `evidence/ia-v2/README.md`。

AC10 更新：W1 已补上完整浏览器证据（A→B 顺序边后 B 的 read_previous 仍为 100°C，三重证据：P22 截图、机读 trace、executor 单测 `orderEdgeKeepsPreviousReads`）。**AC01–AC20 终态：20/20 PASS。**

## AC06-01…30

| ID | 事项 | 结果 | 证据 |
|---|---|---|---|
| AC06-01 | 实际源码基线 | PASS | `evidence/baseline.md`（HEAD 全 SHA、干净工作区、环境） |
| AC06-02 | 测试/构建重现 | PASS | `evidence/logs/w0-test.log`（77→施工后 101 passed/0 failed）、`w0-build.log` |
| AC06-03 | 顺序边读旧状态 | PASS | `evidence/ac10/07-p22-r2-coolB-F01-still-100.png`、`traces/ac10-r2-record.json`、单测 orderEdgeKeepsPreviousReads |
| AC06-04 | 外层计划真实变化 | PASS | R1 `[A,B]` 并行 → R2 `[A]→[B]`（traces/ac10-r2-record.json 计划对照） |
| AC06-05 | 基线动态结果 | PASS | 20/20/20、F01 −50/−50、0.8、−40/−40（evidence/ac10/、ia-v2/） |
| AC06-06 | 停用 B | PASS | 50/30/20，3 entity / 15 node execution（W2 c049、单测 oneCoolerRound） |
| AC06-07 | 改参数 20K | PASS | 30/20/20、F02 ratio=6/7≈0.857（W2 c050、单测 lowerPowerRound） |
| AC06-08 | 缺输入失败 | PASS | INPUT_MISSING、head 不动、无孤立成功记录、P21 rejected（evidence/ac10/09、11） |
| AC06-09 | 无效图拒绝 | PASS | 成环/product/°C→K 诊断且不提交（单测 + W2 TYPE_MISMATCH 复核） |
| AC06-10 | 图与数据真实耦合 | PASS | W2 §6.3 新属性贯通；不支持运算正确拒绝；草稿新实体不入执行世界如实暴露（契约缺口 D 类） |
| AC06-11 | 文档隔离 | PASS | program/schedule/schema/scene 独立文档/undo/保存（draftRegistry 测试） |
| AC06-12 | IA v2 树语义 | PASS | 对象树点击=同页选中/图中聚焦（evidence/ia-v2/） |
| AC06-13 | P20 外层首屏 | PASS | 批次→System→实体矩阵→P22 下钻（evidence/ia-v2/、ac10/06） |
| AC06-14 | P31 属性抽屉 | PASS | 不跳页/不丢上下文（evidence/ia-v2/） |
| AC06-15 | 分支上下文隔离 | PASS | 含 bug3（错误横幅残留）修复后复核（evidence/ia-v2/bug3-*） |
| AC06-16 | 旧程序回看 | PASS | R1/R2 两轮：v1 参数/值/单位不受 v2 影响（evidence/provenance/w32-*） |
| AC06-17 | 历史输入版本 | PASS | P24 inputVersionRefs 定位（evidence/provenance/） |
| AC06-18 | 缺单位/来源 | PASS | traceabilityGaps 补缺：不可完整追溯节点明示；≈ 只在展示层不写回（contracts/trace-provenance-v06.md、record-units-sample.json） |
| AC06-19 | null/0/缺值/原点 | PASS | P27 缺值不当 0、pending 不补 0、C01 未定位可见（W2/W3 抽查） |
| AC06-20 | 发布/语义哈希 | PASS | 仅布局不变哈希；改 binding/参数校验过期（单测 + P18 过期机制） |
| AC06-21 | 刷新后提交恢复 | PASS | R1 刷新后 P22 可回看（evidence/persistence/01） |
| AC06-22 | 刷新后分支恢复 | PASS | A/B head/共同祖先/DAG 正确（evidence/persistence/02、03） |
| AC06-23 | 持久化写失败 | PASS | 故障注入旧 head 不变、孤儿不暴露、显式错误可恢复（zzPersistence 11+3 例） |
| AC06-24 | IA 视口与焦点 | PASS | 1440×900 与 1920×1080（无 1920×1200 预设，如实注明）无裁切/重叠（evidence/ia-v2/） |
| AC06-25 | 编辑器重挂载 | PASS | P14 卸载/重挂载 ×5、文档切换 ×3、无白屏/重复回调/重复持久化（evidence/toolchain/） |
| AC06-26 | 可复现工具链 | PASS | 锁版 pnpm、format:check 只读、oxfmt 缺陷最小复现与候选修复版本（evidence/toolchain/） |
| AC06-27 | 页面能力分类 | PASS | A15 · B11 · C3 · D2 · E0（04_page_capability_matrix.md） |
| AC06-28 | MapEngine 边界 | PASS | contracts/mapengine-integration.md（草案，未接入如实声明） |
| AC06-29 | Core Adapter 边界 | PASS | contracts/execution-adapter-boundary.md + trace-provenance-v06.md |
| AC06-30 | 证据归属 | PASS | 本文逐项含 SHA/环境/日期；证据目录按 ac10/ia-v2/provenance/persistence/toolchain 归档 |

## 旅程复核

- J1（编辑→运行→追溯）：W2 §6.3 + ac10 全程覆盖，PASS。
- J2（结果→来源）：W3 P27→P24→P23→P22 链路保留 branch/commit/execution/entity/node ID，PASS。
- J3（拒绝/错误/恢复）：无效单位、断必需端口、成环、存储失败、程序版本缺失、MapEngine 未连接（RetiredPage 迁移说明），PASS。

## 限制与如实标注

- AC06-24 的 1920 档实测为 1920×1080（浏览器无 1920×1200 预设）。
- AC06-10 的「草稿新实体/新属性初值进入执行世界」为契约级缺口（D 类）：三条路径（草稿试算/已保存模型/新建运行）只认已提交世界，P18 以 BASE_WORLD_MISMATCH 警告暴露——列入 v0.7。
- 10,000 实体单轮 690 ms 超 0.5 s 目标；性能不作合格宣称（evidence/toolchain/）。
- 测试 profile 浏览器残留（本地历史/草稿）与仓库无关，可一键清空。
