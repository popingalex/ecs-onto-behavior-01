# W2 — 最终 IA v2 全链路回归验收记录

验收日期：2026-10-22。执行：W2 子代理。
环境：dev server `http://localhost:8443`；桌面浏览器 1440×900 与 1920×1080（**1920×1200 无设备预设，按任务书以 desktop-1920=1920×1080 实测并在此注明**）。
代码：最终 HEAD `f5b1780` + W1/W4 未提交改动（含 P12 白屏修复）原样保留，本轮未改任何业务代码、未提交。
基线：`corepack pnpm@10.34.3 test` **89 passed / 0 failed**；`build` 通过（会话开始与结束各一次）。

## 0. 会前状态与干扰项说明

- 浏览器残留：W1/W4 冒烟提交 c045/c046/c047、分支 branch-order-ab、schedule 草稿 r18（10-22 12:23 本地保存）。P26 状态栏「清空本地历史」仅在持久化失败/回退时可用，正常模式无 UI 清场入口，故回归在残留之上进行，新提交顺延编号（数值判据不变）。
- 会话中本人产生：c048–c051（main/分支推算）、run-local-1（c052/c053）、bundle-local-1、测试属性 thermal.w2probe、测试实体 F04。**清理口径（选择一致）**：测试属性与测试实体已删除并保存（schema r2 / scene r2）；不可变产物（bundle、运行、提交）保留并记录——其中提交历史后因 §3 bug#1 的回退事件在浏览器内消失。

## 1. AC01–AC20 回归表（保留原编号与原结论）

| 编号 | 原结论 | 本次结论 | 证据 / 说明 | 差异原因 |
|---|---|---|---|---|
| AC01 组件与属性独立 | 通过 | **PASS** | P29 建 thermal.w2probe（量种/单位/nullable/默认值/写入方式；贡献写入强制归约契约）→ P03 Thermal 成员 2 项 → 清理回 5 属性 | 无 |
| AC02 定义与实例值独立 | 通过 | **PASS** | 单测 `overrideLayeringIsolation`（89/0 内）；P08 来源标签（实例覆盖/默认）复核 | 无 |
| AC03 模板覆盖 | 通过 | **PASS** | F01.temperature 恢复继承：3→2 项覆盖、来源回「默认」；显式 null 仅 nullable 可点（temperature/active 置灰） | 无 |
| AC04 组件实例 | 通过 | **PASS** | 移除 Thermal 被阻止：「Thermal 是 Fire 的必需组件，不能从实体 F01 移除」 | 无 |
| AC05 无位置实体 | 通过 | **PASS** | P08 C01「未放置」；P20 实体表 C01「未定位」行 + 视口注记「逻辑保留，视图不绘制」 | 无 |
| AC06 内部图编辑 | 通过 | **PASS**（带注） | M5 原证据 + 本轮 P14 画布拖放/缩放/双击库项路径入口、P30 程序库、实时诊断均正常；未重做空程序建节点连线（像素级拖拽受限，见 AC10） | 无实质差异 |
| AC07 单位错误 | 通过 | **PASS** | 新证据 `ac07-p15-unit-mismatch-greyed.png`：n-room.source(°C) 下 w2probe(K) 置灰「量种不同」、bool/vector3/暂存视图各有原因；图级 TYPE_MISMATCH 边变红 | 无 |
| AC08 动态变量 | 通过 | **PASS** | `ac08-p15-w2probe-candidate.png`：w2probe 保存后动态出现在 P15 候选（4/4 可用）；取消零副作用 | 无 |
| AC09 外层编排 | 通过 | **PASS** | P12 白屏修复后渲染正常（两视口）；仅四种外层节点；双击 System 跳 P14?programId=g-cool ✓ | 无 |
| AC10 调度与读取视图 | 部分通过 | **PARTIAL** | 计划预览并行组 ✓、顺序边不传新状态说明 ✓；浏览器端拖线加边多次未命中句柄（工具限制），未获新证据；单测 `scheduleGroupingFollowsOrderEdges` 在 89/0 内 | 保持原结论 |
| AC11 基线计算 | 通过 | **PASS** | 两次复核：残留态 c047→c048 20/20/20；种子态（§3 事件后）**c042→c044 原编号复现** 20/20/20，`ac11-p20-c044-rerun-1920x1080.png`；P22 1/30、6 请求 3 裁决 3 变更 | commit id 顺移（残留），数值不变 |
| AC12 过程切实体 | 通过 | **PASS** | record-c044：cool-A×F01 100/50/−50/−40/20；F02 80/30/−50/−30/20；两视口 `ac12-p22-record-c044-*.png` | 无 |
| AC13 禁用系统 | 通过 | **PASS** | cool-B 停用（草稿）→ branch-one-cooler 草稿试算 → c049：50/30/20；编排层仅剩 cool-A；`ac13-one-cooler-c049-50-30-20.png` | commit id 顺移 |
| AC14 参数实际生效 | 通过 | **PASS** | cool-A maxDropK=20（草稿）→ branch-lower-power → c050：30/20/20；P23 A 请求 −20K 全额获准、F02 比例 0.857 按比例限幅；`ac14-*.png` ×2 | commit id 顺移 |
| AC15 缺输入失败 | 通过 | **PASS**（带注） | 本轮以 TYPE_MISMATCH 复核同一拒绝通道：「共 2 个错误；未产生任何结果，分支头保持 c051」`s63-p20-type-mismatch-refused.png`；INPUT_MISSING 用 M5 原证据 + 单测 | 拒绝类别不同，通道相同 |
| AC16 裁决可解释 | 通过 | **PASS** | c044 decision-F01：请求 −50K、比例 0.8、获准 −40K；c050 全额/限幅两态 | 无 |
| AC17 来源版本固定 | 通过 | **PASS** | `ac17-p24-provenance-c044.png`：输入版本 @c042、固定图 g-cool@g5（不随草稿变化）、依赖边指向输入版本 | 无 |
| AC18 持久化与历史 | 通过 | **PASS**（带注） | 保存→刷新恢复（schedule r18、schema/scene r1/r2、提交「已恢复 7 提交」）；历史只读、viewCommit 不动 head；LeaveGuard 拦截脏草稿离开 ✓；**但 W4 恢复存在失败回退情形，见 §3 bug#1** | 新增 bug#1 |
| AC19 组件库真实使用 | 通过 | **PASS** | 依据 `design/02/acceptance/component-usage.md`（源码 import + 交互 + 产物三项），本轮各页组件与原登记一致 | 无 |
| AC20 核心页登记与布局 | 通过 | **PASS** | 走查 P29→P03→P08→P14→P11→P12→P20→P22→P23→P24 全部真实页面；另扫 P01/P02/P04/P05/P06/P07/P09/P10/P13/P16/P17/P19/P25/P26/P27/P28/P30 及 3 overlay，**全库无 PagePlaceholder**（P31 深链契约卡见 §3 bug#8） | 无 |

**统计：PASS 19（含 3 条带注）· PARTIAL 1（AC10，与原结论一致）· FAIL 0。无原通过现失败的回归。**

## 2. 重点导航路径（§6.2）逐项

| 项 | 结果 | 证据 |
|---|---|---|
| 对象树非菜单：同页选中 | PASS | P11 树点 cool-B → `P11?systemId=cool-B` 页内选中不跳页；P08 树点 F01 同 |
| 树点击定位图节点（P12/P26 宿主） | PASS | P12 双击 System 下钻 P14；P26 提交选择只改 viewCommit（横幅明示 head 不变） |
| 无上下文时明确反馈 | PASS | P24 无参 →「需要选择上下文…不会默认取最新」+ 显式选择器；P19 深链失效对象 →「目标对象不存在」不跳同名最新 |
| P19 动作入口、树无「新建」 | PASS | 新建运行仅从 P01/P18/P19 按钮；对象树仅对象（分支/事件/任务/类型/组件/属性/模板/实体/System/查询/编排/程序/约束/策略） |
| P08 归建模后可搜索/引用/查询/执行 | PASS | 搜索 C01=1/6；P10/P11/P20 均引用实体；执行覆盖 F01–F03 |
| P06/P07/P09 迁移说明、不计场景能力 | PASS | 三页 RetiredPage：「整组迁移到 mas-suite 的 MapEngine（外部系统）」+ 去向；不计入能力矩阵 A/B |
| P20 两层下钻一致性 | PASS | 编排层卡片 →「cool-A × 实体」矩阵 →「节点级（P22）→」携带 recordId/systemId/entityId/viewCommit 到 P22；P23/P24 与 record/实体选择一致 |
| P31 抽屉不丢上下文 | PASS | P08 上开/切/关抽屉，URL 与选中实体不变；宿主不替换 |
| 历史只读与建模可编辑不混淆 | PASS | 历史横幅「历史只读，不能续算」；推算按钮在历史视图禁用 |
| 分支 A/B 切换不串值 | PASS（1 例例外） | main→branch-lower-power：viewCommit=c050、previous=c042、F01=30 °C、裁决数据均随分支正确切换；**例外：试算失败横幅跨分支残留（§3 bug#3）** |

## 3. §6.3 数据贯通结果与发现的 bug

### 贯通链结论

P29 新属性 → P03 成员 → P08 生效值/新实体（保存+刷新恢复）→ P15 动态候选 → P14 绑定/校验 → P20 执行（由当前图与世界产生）→ P22–P24 来源 → 删除被引用对象受阻：**逐环验证通过**。
执行器对新属性的**正确拒绝**验证通过：°C 端口绑 K 属性在 P15 置灰、图级 TYPE_MISMATCH 诊断、P20 试算拒绝且分支头不动（不造假、不放行）。

**契约级缺口（D，如实记录，不计失败）**：草稿新增实体（F04）与新属性初值**不能进入执行世界**——草稿试算、已保存模型推算、发布 bundle→新建运行三条路径的执行世界都只来自已提交 commit（新运行根 = c042 克隆）；q-fire 匹配 = scene.entities ∩ baseWorld 已提交值。P10 预览与 P18 校验（6 条 BASE_WORLD_MISMATCH 警告）均如实标注该语义，系统未假装一致。证据：`s63-p20-c051-draft-no-f04.png`、`s63-run-local-1-c053-no-f04.png`。后续责任：v0.7-A/B（世界物化/初值入库语义）。

### 发现的 bug（仅记录，未改代码）

| # | 严重度 | 现象 | 证据 |
|---|---|---|---|
| 1 | 中高 | **W4 恢复失败回退种子致会话历史丢失**：产生提交 c048–c053 + 发布 bundle + 新建运行 + 删除测试属性/实体并保存后，整页刷新 →「本地历史 · 校验失败，已回退种子」，全部计算提交消失（回退本身安全、给清空入口，但「发布→运行→删属性→刷新」为合理用户流，恢复校验应兼容或给出精确诊断） | `w4-restore-failure-fallback-seed-1920.png` |
| 2 | 中 | **P19 深链不识别本地发布 bundle**：P18「用它创建运行」→ P19?bundleId=bundle-local-1 显示「目标对象不存在」；页内选择器实际包含该包，手选可正常创建 | `bug-p19-bundle-local-1-not-found.png` |
| 3 | 中 | **P20 试算失败横幅跨分支/跨修复残留**：main@c051 的 TYPE_MISMATCH 横幅在切到 branch-lower-power@c050 后仍显示（引用 c051），撤销修复草稿后也不清除 | `bug-p20-stale-error-banner-cross-branch.png` |
| 4 | 中低 | **P14 文档级「校验通过」戳与实时程序诊断矛盾**：诊断 1 错误（TYPE_MISMATCH）时顶栏仍盖「校验通过」；执行/发布门不受影响（P20 拒绝、P18 校验见错误类） | `s63-p14-type-mismatch-but-toplevel-pass.png` |
| 5 | 低 | **P14 视口/缩放操作污染草稿修订**：打开、缩动画布即累计 r1…r7 未保存修订（无语义编辑），脏指示噪音 | `p14-narrow-canvas-before-reset.png` |
| 6 | 低 | **P14 在 1440×900 默认布局画布过窄**（检查器展开 ~230px、收起 ~340px，五节点链需缩放平移）；1920×1080 正常 | `p14-narrow-canvas-before-reset.png` vs `p14-graph-full-1920x1080.png` |
| 7 | 极低 | P23 决策卡统计行在 1440 拥挤断字（"8 0 K" 竖排） | `ac14-p23-c050-decisions.png` |
| 8 | 低 | P31 深链（无宿主页）显示契约卡而非抽屉；正常入口（对象树抽屉）无问题 | 文本快照 |
| 9 | 低 | 对象树计数不随草稿即时更新（新增 w2probe 期间树仍显示 属性 5 / 热状态 1 属性，P03 页内列表正确） | 文本快照 |

## 4. 双视口结果（§6.4）

| 视口 | 结果 | 证据 |
|---|---|---|
| 1440×900 | 关键控件可用；P14 窄画布（bug#6）、P23 拥挤（bug#7）两例布局注记；P08 实体详情主区有横向滚动 | `p01-overview-1440x900.png`、`ac09-p12-schedule-1440x900.png`、`ac11-p20-c048-rerun-1440x900.png`、`ac12-p22-record-c044-1440x900.png`、`p31-drawer-over-p08-1440x900.png` 等 |
| 1920×1080（代 1920×1200） | P20 工具栏单行不溢出；P12/P14/P22/P26/P31 无裁切重叠；画布拖放/缩放/撤销/刷新正常 | `ac11-p20-c044-rerun-1920x1080.png`、`ac09-p12-schedule-1920x1080.png`、`p14-graph-full-1920x1080.png`、`ac12-p22-record-c044-1920x1080.png`、`p26-history-1920x1080.png`、`p31-drawer-1920x1080.png` |

状态可辨识性：空态（P28 无记录区块）、失败态（TYPE_MISMATCH 横幅 + P21 已拒绝命令）、历史只读、未保存/已保存/已发布、草稿试算/已保存模型模式均有区分表现；overlay 关闭未见快捷键误触。

## 5. 证据清单

| 文件 | 内容 |
|---|---|
| `p01-overview-1440x900.png` | IA v2 四组导航 + P01 |
| `p20-c047-baseline-1440x900.png` / `ac11-p20-c048-rerun-1440x900.png` | AC11 残留态复核 |
| `ac11-p20-c044-rerun-1920x1080.png` | AC11 种子态原编号复现 |
| `ac12-p22-record-c044-1440x900.png` / `ac12-p22-record-c044-1920x1080.png` | AC12/AC16/AC17 记录回看 |
| `ac13-one-cooler-c049-50-30-20.png` | AC13 |
| `ac14-lower-power-c050-30-20-20.png` / `ac14-p23-c050-decisions.png` | AC14 |
| `ac17-p24-provenance-c044.png` | AC17 |
| `ac09-p12-schedule-1440x900.png` / `ac09-p12-schedule-1920x1080.png` | AC09/AC10 |
| `ac08-p15-w2probe-candidate.png` / `ac07-p15-unit-mismatch-greyed.png` | AC08/AC07 + §6.3 |
| `s63-p29-delete-blocked-references.png` | 删除被引用对象受阻 |
| `s63-p14-type-mismatch-but-toplevel-pass.png` | bug#4 |
| `s63-p20-type-mismatch-refused.png` | 执行正确拒绝（AC15 通道） |
| `s63-p20-c051-draft-no-f04.png` / `s63-run-local-1-c053-no-f04.png` | §6.3 契约缺口 |
| `p31-drawer-over-p08-1440x900.png` / `p31-drawer-1920x1080.png` | P31 抽屉两视口 |
| `p21-command-queue-drawer.png` | P21 命令生命周期 |
| `p26-history-1920x1080.png` / `p14-graph-full-1920x1080.png` | P26/P14 1920 |
| `p14-narrow-canvas-before-reset.png` | bug#6 |
| `bug-p19-bundle-local-1-not-found.png` / `bug-p20-stale-error-banner-cross-branch.png` / `w4-restore-failure-fallback-seed-1920.png` | bug#2/#3/#1 |
