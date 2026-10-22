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

## ADR-v06-06 地图主角布局（map-protagonist layout）

日期：2026-10-22 ｜ 状态：已落地（P20）

- **宿主边界**：`src/components/domain/MapViewport.tsx` 是地图宿主组件——占满父容器、z-index 底层。本仓库不实现任何 geo 逻辑；geo 由外部独立系统（mas-suite MapEngine）实现，接入位为预留的 `engine: MapEngineMount` prop（mount/unmount 宿主元素），契约见 `mapengine-integration.md`（ADR-v06-03）。接入前挂过渡渲染器 `SpatialViewport`（park-ENU 2D 示意）。
- **地图是主角**：场景/推演页的主区整幅为地图，获取最大可视化空间；不允许固定的左树栏/右检查器/底部 dock 把地图挤成窄条。
- **三选一互斥**：左（对象树）/ 右（检查器）/ 下（实体状态表）三个方向合计最多一个内容面板展开；展开另一个时当前项自动收回为图标。pin（固定展开）同样遵守三选一：pin 一个 = 其他两个只能图标态。状态机为纯函数 reducer（`src/pages/p20/mapLayout.ts`），经 `useViewState` 持久化。
- **临时遮挡与长期悬浮**：内容面板只以悬浮层（absolute + 阴影 + 遮罩，可点遮罩/再点图标/Esc 关闭）临时遮挡地图的一部分。允许长期悬浮在地图上方的只有：小图标工具栏（左/右缘图标栏、底部拉手）、图例 chips、状态徽标——absolute 定位、容器 pointer-events-none、仅控件自身可点。
- **编排层**：同为悬浮物，默认折叠为地图上方一行摘要 chip（批次/System/获准合计），点击展开为悬浮卡片。
- **页面级标记**：地图主角页在 `PAGE_SPECS.layout` 用 `MAP = { tree:false, inspector:false, dock:false, canvas:true }` 脱离通用三栏；WorkspaceShell 全局行为不变，其他页面不受影响。
