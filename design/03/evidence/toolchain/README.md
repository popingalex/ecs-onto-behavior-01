# W5 — 组件、工具链和稳定性（证据与结论）

日期：2026-10-22 ｜ 执行：Kimi Code ｜ 依据：`design/03/01_v06_implementation_plan.md` §9（W5.1–W5.4）
环境：Apple M2 Ultra · 192 GiB RAM · macOS darwin 25.6.0 · Node v22.20.0 · `corepack pnpm@10.34.3`
commit：`f5b1780e488f6bf34c49c0703eafc265690d070a`（含 W1–W5 未提交改动；本批不改业务代码，只加测量/脚本/文档）
浏览器：Kimi Code 桌面内置浏览器（Chromium 内核），视口 1280×720

---

## W5.1 FlowGram 生命周期

### 验证矩阵（dev :8443，`vite dev`）

| 用例 | 结果 |
|---|---|
| 打开 P14（g-cool） | 画布正常渲染（5 节点/4 连线），无白屏。截图 `dev-p14-g-cool-canvas.png` |
| 双击节点库添加节点 | 恰好新增 1 个 `n-min-1`（r1），**无重复回调**；诊断正确报 2 条 INPUT_MISSING |
| 撤销（Ctrl+Z）/ 重做（工具栏） | 撤销/重做各恰好一档，重做恢复 `n-min-1`（r3）无重复实例；删除节点后诊断清零 |
| 卸载/重挂载 P14→P12→P14 ×5 | 5 轮全部正常重挂载（每轮校验「5 个节点 · 4 条连线」），无白屏、无状态错乱 |
| P30 新建程序（dialog overlay）→ P14 | `g-new-1` 空程序正常渲染（0 节点，NO_EFFECT 警告符合预期） |
| program 文档连续切换 g-cool ↔ g-new-1 ×3 | 同页文档切换（`document.clear()` + `fromJSON` 回灌路径）3 轮全部正常，无幻影线、无白屏 |
| 抽屉/overlay 开关 | P15 绑定选择器打开（3/3 候选）→ 取消关闭零副作用（截图 `dev-p15-binding-picker-overlay.png`）；P30 新建 dialog 开/关正常 |
| 撤销重做后保存 → localStorage 探针 | `ecs-workbench.draft.v1:program:g-cool` 恰好 1 键（revision=4，5 节点/4 连线）；`g-new-1` 恰好 1 键；program-index 恰好 1 条。**无重复持久化** |
| HMR（改无关源文件 `StatusTag.tsx` 触发热更新后还原） | 热更新后草稿 r4 完好、画布正常；文件已字节级还原 |
| 整页刷新 | 草稿从 localStorage 恢复（r4 已保存），画布正常 |

### 验证矩阵（preview :4173，`vite build` + `vite preview`）

| 用例 | 结果 |
|---|---|
| 打开 P14（g-cool） | 正常渲染 |
| P14→P12→P14 ×2 | 正常 |
| 整页刷新 | 正常恢复（截图 `preview-p14-after-reload.png`；该 origin localStorage 独立，草稿 r0 属预期） |

### StrictMode 隔离宿主复现（**未改正式入口**）

最小复现宿主：`strictmode-host/`（独立 vite root :8555，仅挂载最小 `FreeLayoutEditorProvider`，错误写入 DOM 取证）。

- `http://localhost:8555/`（StrictMode 开）：**必现** `Error: Ambiguous match found for serviceIdentifier: FlowRendererRegistry`（DI 容器 onInit 阶段抛出），编辑器子树未挂载（即正式入口的「白屏」）。截图 `strictmode-on-flowgram-di-error.png`。
- `http://localhost:8555/?strict=off`（StrictMode 关）：`errors: (none)`，编辑器子树正常挂载。

复现方法：`corepack pnpm@10.34.3 exec vite --config design/03/evidence/toolchain/strictmode-host/vite.config.ts`，开 `/` 与 `/?strict=off` 对照。

### StrictMode 结论

- **上游缺陷仍在**：`@flowgram.ai/free-layout-editor@1.0.16` 的 DI 容器在 React 19 dev 双挂载下重复注册 `FlowRendererRegistry`，必现抛错。
- **当前绕行（正式入口不包 StrictMode）仍必要**：`src/main.tsx` 维持现状；StrictMode 仅影响 dev，生产构建无此行为。
- 版本锁定建议：`@flowgram.ai/free-layout-editor` 已精确锁定 1.0.16（无 `^`），**不要在未重跑本隔离宿主复现前升级或重开 StrictMode**；若上游后续版本修复（可在隔离宿主换版本验证），再评估恢复 StrictMode。重开验收标准：隔离宿主在 StrictMode 下 `errors: (none)` 且编辑器子树挂载。

---

## W5.2 格式化器（oxfmt）

### 事故记录与最小复现

- 既有记录：`design/02/REPORT.md`（「oxfmt 0.2.0 会破坏行内类型字面量」）、`design/02/07_progress.md` M1 节（误运行 `pnpm format` 全仓改写 23 文件，逐一修复后 tsc/test/build 证明语义未变；残留为全仓双引号风格、diff 噪音大）。
- 本批最小复现（/tmp 隔离，未碰仓库）：`oxfmt-fixture.input.ts`（单行内联对象类型字面量 `{ id: string ;version: string }`，即仓库现行风格）。
  - **oxfmt 0.2.0（仓库锁定版）**：输出 `oxfmt-fixture.0.2.0-output.ts` —— 类型成员间的 `;` 被删除，`{ id: string version: string }`，`tsc --noEmit` 报 4 处 `TS1005: ';' expected`，**产出不可编译的 TypeScript**（破坏性确认）。
  - **oxfmt 0.74.0（当前最新，2026-10-19）**：输出 `oxfmt-fixture.0.74.0-output.ts` —— 规范化为 `{ id: string; version: string };`，tsc 干净，语义不变（该特定缺陷已修复）。

### 只读检查与现状

- `package.json` 新增只读脚本 `format:check`（`oxfmt --check`，0.2.0 原生支持，另支持 `--list-different`）。**写模式 `format` 保持原样但不使用。**
- 现状只读检查（`format-check.log`）：**107/217 文件会被 oxfmt 0.2.0 改写**（exit 1）。即仓库当前与格式化器输出刻意不一致——这是事故修复后的既知状态，不是问题回归。
- CI 建议（仓库无 CI 基础设施，落为推荐配置）：流水线执行 `corepack pnpm@10.34.3 run format:check`（只读）+ `tsc --noEmit` + `test` + `build`；**任何写模式格式命令不得进 CI 或默认脚本**。注意现状下 `format:check` 必然失败（见上），在决定升级格式化器之前它只能作为信息项（continue-on-error），不能作为门禁。

### format 结论

- **format（写模式）保持禁用**。oxfmt 0.2.0 已实证产出不可编译代码。
- 重新开放路径（须经特定回归证明）：升级并**精确锁定**新版本（候选 0.74.0，已验证该特定缺陷修复）→ 在分支上全仓写模式运行 → `tsc --noEmit`、`test`、`build` 全绿 + 人工抽查 diff 无语义改动 → 才允许替换 `format` 脚本并将 `format:check` 转为 CI 门禁。升级同时会消除「107 文件不一致」状态（一次性重排，需单独提交窗口）。
- 版本锁定建议：`oxfmt` 当前为 `^0.2.0`，建议改为精确版本（无论留在 0.2.0 还是升级），防止 lockfile 外漂移。

---

## W5.3 TanStack Table 决策

- 现状：`@tanstack/react-table@8.21.3` 已装未用（`src` 零 import，本批复核确认）；各页表格为 shadcn table + 自绘行，最大表约几十行实体表，无虚拟滚动/列固定/复杂客户端排序过滤需求。
- **决策：移除**。未用依赖是供应链与锁文件负担，且「已装未用」持续制造验收噪音。
- 已执行：`corepack pnpm@10.34.3 remove @tanstack/react-table`（官方 registry，7.7s 完成）→ 锁文件同步 → `install --frozen-lockfile`（up to date）→ `test` 101/0 → `tsc --noEmit` 干净 → `build` 通过。
- 文档同步：`design/02/acceptance/component-usage.md` 的 TanStack 段与结论已改写为「已决策移除」。
- 触发重新引入的条件：≥ 数百行表格且需虚拟滚动，或需列固定/列重排/复杂客户端交互；届时另立任务整体替换表格层。

---

## W5.4 性能与容量基线

测量：`node scripts/perf-baseline.mjs`（新增，驱动 `src/services/mock-executor/perfBaseline.ts`；完整输出 `perf-baseline.log`）。
环境：Apple M2 Ultra · 192 GiB · Node v22.20.0 · commit f5b1780（含未提交改动）· 完整 trace 开启。

| 项 | 样例 | 结果 |
|---|---|---|
| 查询预览 q-fire | 3 实体命中 | 首次 0.042 ms；1000 次平均 0.0007 ms |
| executeRound 参考执行 | 3 实体 × 2 system，200 次 | 平均 0.382 ms，p50 0.360 ms，p95 0.532 ms，max 1.034 ms；单轮 RoundResult 20.0 KiB（30 条节点轨迹） |
| 合成场景求值 | 100 火源（106 实体） | 4.8 ms/轮（3 次平均）；轨迹 1030 节点执行；序列化 642 KiB |
| 合成场景求值 | 1,000 火源（1006 实体） | 41.1 ms/轮；10030 节点执行；6.1 MiB |
| 合成场景求值 | 10,000 火源（10006 实体） | **支持，未触上限**：单轮 690.3 ms；100030 节点执行 / 50015 依赖边；61.3 MiB（stringify 152 ms） |
| trace/持久化写入（W4 基线复跑，`persistence-baseline-rerun.log`） | 100 提交 | 写入共 64 ms（0.6 ms/提交含求值）；体积 2002 KiB（≈2.0 MiB，20 KiB/提交）；纯校验恢复 0.4 ms；冷启动 263 ms（含 260 ms 人工延迟）——与 W4 引用数字一致 |
| P12/P14 画布交互 | 5 节点/4 连线规模 | 主观观察（不做精确帧率测量）：平移/缩放/节点拖拽即时跟手，无可见卡顿；拖拽结束合并为单条撤销记录 |

与长期目标的差距登记（**不以小 fixture 宣布合格**）：
- `0.5 s` 结算：3 实体 0.4 ms、1000 实体 41 ms 远在目标内；**10,000 实体单轮 690 ms 已超 0.5 s**（且单轮 trace 61 MiB 的序列化/持久化成本未计入回放链路）。
- `1 s` 播放：本轮未测回放链路端到端（回放查询/帧调度），仅登记单轮求值与恢复耗时；10 提交恢复 0.2 ms、100 提交 0.4 ms（纯校验）。
- 容量上限：10,000 逻辑实体可求值；更大规模未测，trace 体积随实体数线性增长（≈6 KiB/实体/轮）是当前最显性约束。

---

## 复核记录

| 项 | 结果 |
|---|---|
| `install --frozen-lockfile --registry=https://registry.npmjs.org/` | up to date（TanStack 移除后锁文件一致） |
| `corepack pnpm@10.34.3 test` | **101 passed / 0 failed**（`test-after-changes.log`） |
| `tsc --noEmit` | 干净 |
| `corepack pnpm@10.34.3 build` | 通过（651 ms，仅 chunk 体积提示） |
| 写模式 format | 未运行（纪律遵守） |
| `src/main.tsx` | 未改（StrictMode 维持关闭） |
