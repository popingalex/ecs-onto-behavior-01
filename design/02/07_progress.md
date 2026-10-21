# 施工进展回传（M0–M4，2026-10-20/21）

本文记录各批次的实际改动、验证结果与剩余缺口。状态机读版见 `contracts/implementation_tasks.json` 的 `status`/`statusNote`。未完成项如实列出，不把页面登记数当完成率。

工具链说明：项目锁定 pnpm 10.34.3（`.mise.toml`），验证命令为 `corepack pnpm@10.34.3 test` / `corepack pnpm@10.34.3 build`（系统 pnpm 12 的供应链策略会拒绝本 lockfile；npmmirror 缺 @flowgram.ai tarball，安装需 `--registry=https://registry.npmjs.org/`）。

## 总览

| 批次 | 状态 | 测试 |
|---|---|---|
| M0 施工输入与组件基线 | done | — |
| M1 ECS 定义与实例管理 | done | 14 passed |
| M2 System 内部逻辑编辑 | done | 20 passed |
| M3 System 定义与外层调度 | done | 25 passed |
| M4 运行与计算过程 | done | 35 passed |
| M5 验收取证 | done（19 通过 / 1 部分 / 0 失败） | — |

最终基线：`35 passed, 0 failed`；`vite build` 通过（仅 chunk 体积提示）。

## M0 收尾

- 修复 `design/01/contracts/page_index.json` 28 条失效路径与 `design/01/file_index.json` 28 条同问题条目（按 `contracts/spec_path_repairs.json` 的 proposedPath），扫描结果 0 失效。
- shadcn/ui、TanStack Table、`@xyflow/react`、FlowGram 此前已安装；React Flow 与 FlowGram 的最小挂载由 M3/M2 的真实页面（P12/P14）承担，不再是孤立 demo。

## M1 ECS 定义与实例独立管理

- 新增 `src/features/ecs/`：五类对象引用扫描（refs.ts）、纯函数 CRUD（operations.ts，`INHERIT` 区分恢复继承与显式 null）、ID 建议、草稿写入辅助；7 个测试用例。
- 新页面：`src/pages/p02/`（实体类型）、`p29/`（独立属性定义）、`p05/`（模板覆盖）、`p08/`（场景实体实例与初值）；`PageId` 扩 P29/P30，导航与 ResourceTree 同步。
- P03 整体迁移到 modelDocuments 栈：「新增属性」已启用、组件 CRUD、搜索、引用阻止删除（删除 `thermal.temperature` 列出 10 处引用并阻止）。
- 验证：新建 Thermal→属性→类型→实体链路可用，保存后刷新恢复；改 V01 水量不影响默认/模板/V02（单测）；null 位置实体仍在表中；必需组件移除报错。
- **偏离**：`EntityTypeDef` 无 `parent` 字段（v0.5 zod 契约不含），P02 的 parent 继承编辑未做，页面已注明；如需支持要先改契约。
- **事故记录**：曾误运行 oxfmt 导致全仓 src 单引号→双引号并重排（23 个文件被误改后已逐一修复，tsc/test/build 证明语义未变）；残留影响是 src 现为双引号风格，diff 噪音大。

## M2 System 内部逻辑可视化编辑

- 新增 `src/features/logic-editor/`：FlowGram `FreeLayoutEditor` 封装，注册 ReadPrevious/CoolingRoom/Min/Negate/Contribute（另含 ReadSelfPreview/Constant/Parameter/IsSome；Branch/Loop/Wait 置灰不造假实现）；左库/中画布/右表单/下诊断四区可调大小。
- 同步架构：LogicGraphDocument 草稿文档为唯一事实来源，FlowGram 是视图层；连线走 `checkEdge`（°C→温差K 拒绝并说明），删必需连接后 `validateProgram` 报 INPUT_MISSING 并定位。
- `src/pages/p14/`（编辑器）、`src/pages/p30/`（程序资产库 + 动态程序文档注册，modelDocuments 支持新建/复制程序）。
- `P15BindingPicker` 重写：删除硬编码候选（含 `n-min.out`），改用 `bindingCandidates`（scope 分组、单位/nullable/previous/selfPreview 标注、不兼容置灰说明）；确认一次 bindInput，取消零副作用。
- 测试覆盖：单位错误连边拒绝、必需连接缺失校验、codec 往返保 nodeId/portId/binding/单位、布局不改语义 hash、候选不依赖硬编码节点 id。
- **注意**：`src/main.tsx` 已移除 React.StrictMode（FlowGram DI 容器在 dev 双挂载下必现白屏）；FlowGram 的 `document.fromJSON` 不销毁已消失的线实体，回灌前需 `document.clear()`（已在封装内处理）。
- **未验证项**：节点库→画布的 HTML5 拖拽路径未做浏览器级验证（双击添加已验证，drop 复用同一代码路径）。

## M3 System 定义与外层调度

- `src/pages/p10/`：查询管理与预览（q-fire 匹配 F01/F02/F03 三个火源）。
- `src/pages/p11/`：System 目录与绑定，详情展示 query、program@版本、参数、读写访问声明；可建/改 cool-A、cool-B（同 g-cool 版本、不同参数）；启用/禁用；删除前引用扫描。
- 新增 `src/features/schedule-editor/`：ScheduleDocument ⇄ React Flow adapter；SystemNode/ReducerNode/ContractNode/CommitNode 四种节点（图中无内层节点）；order/effect 边标签；连线走 `scheduleCompiler.checkConnection`（product 拒绝并说明、成环诊断禁止执行）；计划预览面板展示 compileSchedule 分组（顺序边改变分组但不传新状态）。
- `src/pages/p12/`：React Flow 画布；双击 SystemNode 跳 P14 对应 program，返回保留视图（视口存 layout 文档）。调度与程序独立 document/undo。
- `scheduleCompiler.ts` 本批扩展（+349 行）。
- 测试：adapter 往返、product/成环拒绝、分组随顺序边变化、布局不改语义 hash、调度文档独立性。
- **说明**：本批子代理在回传前被中断，以上结论依据代码与测试核验（25/25 绿），浏览器级交互在收尾冒烟中复核。

## M4 运行与完整计算过程

- 新增 `src/services/mock-executor/`：纯 TS 同步求值器（无任何 setTimeout）。完整性检查 → compileSchedule 推导执行组 → 逐 System validateProgram → query 求值 → 分组串行执行（同组读同一旧值，顺序不改 previous）→ 五类节点求值 → effect 收集 → 比例裁决 → 原子返回 RoundResult（recordId/inputVersions/batches/nodeTraces/effectRequests/decisions/changes/nextWorld，elapsedMs=null 显示「未测量」）。
- `executionAdapter.ts`：新增 `mockExecutorAdapter`（默认，label 标注「串行参考求值（当前图）」）；`referenceAdapter` 仅服务「查看样例」并明确标注非当前图计算。
- `session.ts`：成功路径先写 trace store 再更新 commit/head（source='computed'）；失败保留 baseCommit。新增 `src/stores/trace.ts` 不可变记录（recordId/branch/commit 索引）。
- 新页面：`p22/`（recordId→system→entity→node 联动，只读图 + 端口值 + 访问日志 + 贡献矩阵，步进标「记录回看」）、`p23/`（requested→approved→final 与比例，未裁决不补 0）、`p24/`（属性演化链与输入来源，可跳回 P22 固定图版本）。P20 增加提交来源标注与「已保存模型/草稿试算」切换。
- 数值验收（测试 + 浏览器）：基线 F01=100/50/−50/−40/20；停用 B=50/30/20；A 改 20K=30/20/20；初温<20°C 请求为 0 不反向升温；循环/product/断必需连接 → 诊断报错不产结果；旧记录不随草稿修改变化。
- **偏离**：种子分支头改为 c042（原样例提交当头会让 BASE_NOT_HEAD 守卫永远挡住真实推算；样例提交保留供 P27/查看样例）。
- **简化**：P22 只读节点图为自绘 SVG（未嵌 FlowGram）；端口单位映射为启发式（主干五节点场景正确）。

## 收尾冒烟（2026-10-21，dev server :8443，桌面浏览器）

- 失败路径：P20 推算时检测到草稿断线（`INPUT_MISSING n-min-1.b`），未产生结果、分支头保持 c042 ✓。
- 修复链路冒烟：P14 诊断「定位」选中问题节点 → P15 绑定选择器（候选按 scope 分组，°C/bool/vector3 不兼容项置灰并给原因）绑定 `maxDropK` → 保存 ✓。
- 成功路径：清空本测试浏览器 profile 的 localStorage 回到种子基线后，P20 推算 c042→c044（当前图求值）；P22 节点轨迹 n-old=100 / n-room=80 / n-cap b=50 → 50 / n-neg=−50，贡献矩阵 F01 请求 −50/−50、比例 0.8、获准 −80、最终 20 °C（F02 0.6/−60/20，F03 0.5/−40/20），与 04 契约及 expected_runs 完全一致 ✓。
- 曾发现测试 profile 内残留的冒烟草稿（n-cap.b 被改接 room）导致请求 −80K——执行器忠实执行了「当前图」，非执行器缺陷；已通过清空该 profile localStorage 恢复种子基线。用户自己的浏览器不受影响。

## M5 验收取证（2026-10-21）

- AC01–AC20 逐项浏览器验收：**通过 19 / 部分通过 1（AC10 加顺序边的浏览器逐帧证据不全，分组逻辑有单测）/ 失败 0**。逐项结论与两段逐步复现见 `acceptance/core-journeys.md`。
- 13 张真实应用截图在 `acceptance/screens/`：8 核心页（P29/P08/P12/P14/P15/P22/P23/P24）+ 单位错误与缺输入阻止运行 + AC13/AC14 试算结果 + 1440×900 布局。曾发现 p15-binding 与 error-unit-mismatch 同图重复，已重新裁出独立的单位错误证据图。
- 组件库三证核对见 `acceptance/component-usage.md`：React Flow / FlowGram / shadcn / resizable-panels 真实使用；**TanStack Table 已安装但零 import**，如实记为未兑现。
- 验收中发现的环境事实（非缺陷）：提交历史在会话内存，整页刷新后计算提交消失；P11 数字输入需回车提交草稿；Vite 对 `public/`/`.*tmp*` 写入会触发整页重载，打断文件选择对话框。

## 剩余缺口（下一轮）

1. ~~**M5 验收取证**~~（已完成，见上）。
2. M1 偏离：实体类型 parent 继承（需先改 v0.5 契约）。
3. P22 端口单位启发式映射的完整化。
4. TanStack Table 已装未用：表格层是否替换另立任务。
5. 占位页：P04/P06/P07/P09/P13/P16–P19/P25–P28 仍回落 PagePlaceholder（非核心）。
6. 工具链：建议团队统一 `corepack pnpm@10.34.3` 或安装 mise；不要运行 `pnpm format`（oxfmt 0.2.0 有破坏性行为）。
