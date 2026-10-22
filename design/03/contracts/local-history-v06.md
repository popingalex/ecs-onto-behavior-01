# 本地历史持久化契约（v0.6）

版本：1.0 ｜ 日期：2026-10-22 ｜ 实现：`src/stores/persistence/`（IndexedDB，db `ecs-workbench.history`）

## 范围

本地浏览器原型级历史恢复。不含：服务端权威、多端同步、正式 checkpoint/断点续算、跨设备迁移（导出已实现，导入明确不提供，UI 有说明）。

## 对象与键空间

- 对象存取：`commits` / `worlds` / `records` / `branches` / `heads` / `meta`。
- 隔离：草稿（localStorage `draft/1`）与历史（IDB）互不混用、undo 独立；viewCommit 是纯路由/UI 状态，永不等于 head。
- `meta.historySchemaVersion`：当前版本不符 → 整份拒绝恢复并回退种子 + 诊断（`meta:lastRestore`）。

## 原子性

每次成功结算在同一个 IDB 事务内按序写入：`commits` + `worlds` + `records` → `meta:marker:<commitId>` → `heads[branchId]`。内存顺序：`putRecord`（幂等）→ `persistCommitFacts`（await）→ 成功才更新内存 worlds/head。任一失败：持久层与内存 head 均保持旧值，不产生半个 commit；UI 显示 HISTORY_PERSIST_FAILED 与「重试/清空本地历史（需确认）」。

## 恢复校验

启动时装配：meta 判空 → 首次初始化（种子）或恢复。恢复只暴露「有 marker 且在某一可信 head 谱系内」的提交；其余计为孤儿档案 + 诊断计数。

- **硬回退（整份拒绝 → 种子）**：已知分支链断裂、缺 marker、缺世界快照、持久化分支缺 head 指针、schema 版本不符。
- **分支级隔离**：heads 指向「定义不可考」分支时只隔离该分支（孤儿档案 + 诊断），其余分支正常恢复。
- 目录运行（runCatalog）根提交经 `persistRootCommit` 落 IDB（commit+world+marker 同事务）；`ensureHead` 原子「缺失才写」，绝不覆盖已结算 head。种子不覆盖已有本地世界。

## 引用固定

记录含 inputVersions（schema/scene/systems 语义哈希 + program/schedule `id@version#hash` + baseCommit）与程序快照；bundle/快照缺失时历史显示「不完整」，不得套用最新模型回填。

## 基线（M2 Ultra，Node 22.20.0，commit 见验收文档）

100 提交 ≈ 2.0 MiB（record 含程序快照占 96%）；写入 64 ms；纯恢复校验 0.4 ms；冷启动 ≈ 265 ms（含种子适配器 260 ms 人工延迟）。
