# 架构决策记录（v0.6）

日期：2026-10-22 ｜ 状态：LOCKED（本轮评审确认）

## ADR-v06-01 React/Figma Make 为当前原型 UI 技术选择

React 19 + Vite + shadcn/ui + React Flow（外层）+ FlowGram（内层）是当前原型实现。**不取消**长期 Rust 共享推演内核与原生/WASM 客户端目标；原型 UI 的可替换边界由 `execution-adapter-boundary.md` 与 `mapengine-integration.md` 固定。

## ADR-v06-02 TS executor 是参考器，不是生产计算核心

浏览器内 TS 串行参考执行器的定位：参考语义、调试器、TS↔Rust 一致性对照来源。不得包装为最终生产内核；性能目标（0.5 s 结算/1 s 播放）不以 TS 小 fixture 结果宣称达成（当前 10,000 实体单轮 690 ms，已登记差距）。

## ADR-v06-03 MapEngine 为独立模块，先契约后接入

场景/地图/3D 归 mas-suite MapEngine。数据/身份/版本边界以 `mapengine-integration.md`（v0.6 草案）为准，接入属 v0.7-C。接入前 P06/P07/P09 保持迁移/入口页。

## ADR-v06-04 v0.6 本地持久化 = IndexedDB 原型级

历史持久化采用 IndexedDB（`src/stores/persistence/`，单事务 facts→marker→head、分支级隔离、schema 版本治理）。这是**本地浏览器原型级**决定；不排除未来正式数据层（PG/SQLite/服务端权威分支，v0.7-B）。草稿（localStorage draftRegistry）与历史（IDB）键空间隔离。

## ADR-v06-05 工具链锁定

- pnpm 经 `corepack pnpm@10.34.3`（.mise.toml 锁定）；React.StrictMode 保持移除（FlowGram 1.0.16 DI 缺陷，重开标准见 `evidence/toolchain/README.md` 与 strictmode-host 最小复现）。
- 写模式 `pnpm format`（oxfmt 0.2.0）保持禁用；只读 `format:check` 可用；重开路径=锁定修复版本（候选 0.74.0）+ 分支全仓回归。
- TanStack Table 已移除（未用依赖）；重新引入条件：出现虚拟滚动/复杂表格交互需求。
