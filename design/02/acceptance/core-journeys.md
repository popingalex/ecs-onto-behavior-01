# 核心旅程验收记录（AC01–AC20）

验收日期：2026-10-21。环境：dev server `http://localhost:8443`（`corepack pnpm@10.34.3 dev`），桌面浏览器（1280×720 与 1440×900 两档）。验收前已清空浏览器 localStorage 回到种子基线。截图在 `screens/`。测试基线：`corepack pnpm@10.34.3 test` 35 passed / `build` 通过。

| 编号 | 结果 | 证据与说明 |
|---|---|---|
| AC01 组件与属性独立 | 通过 | P29 独立属性 CRUD（`screens/p29-attributes.png`）；P03 只管组件与成员、新增属性挂为成员；两页不重复编辑同一对象 |
| AC02 定义与实例值独立 | 通过 | P08 改 F01 初温不影响 F02/默认/模板（单测 `overrideLayeringIsolation`）；引用 ID 不变 |
| AC03 模板覆盖 | 通过 | P05/P08「恢复继承」（INHERIT 删键）与「显式 null」两个独立操作；恢复后回模板 8000；显式 null 仅 nullable 允许 |
| AC04 组件实例 | 通过 | P08 装配/卸载可选组件生效；移除 Fire 必需 Thermal 被阻止（「Thermal 是 Fire 的必需组件」）；组件组合看 componentInstances 不猜值 key |
| AC05 无位置实体 | 通过 | P08（`screens/p08-entities.png`）与 P20 均列出「C01 园区指挥单元 · 未定位」；[0,0,0] 合法（单测 `nullPositionSemantics`） |
| AC06 内部图编辑 | 通过 | P14 从空程序 g-new-1 拖入/双击建节点、连线、保存、刷新恢复（Batch C 冒烟 + 本轮复验）；`screens/p14-graph.png`；库拖入路径本轮意外触发一次并成功建节点 |
| AC07 单位错误 | 通过 | °C 候选在 K 端口上下文中置灰并给原因（「量种不同：温度 °C 不能直接作为温差 K…」`screens/error-unit-mismatch.png`）；画布拖线拒绝（Batch C 冒烟两次未建边）+ 单测 `unitMismatchEdgeRejected` |
| AC08 动态变量 | 通过 | P29 新增 `thermal.demoacc` 后出现在 P15 候选（见 `screens/p15-binding.png` 中「self.thermal.demoacc · 验收演示属性」）；确认写真实 binding、取消零副作用 |
| AC09 外层编排 | 通过 | P12 仅四种外层节点（System/归约器/合同裁决/原子提交），无内层节点；`screens/p12-schedule.png`；双击 System 跳 P14（`ScheduleEditor.tsx:73` + 冒烟） |
| AC10 调度与读取视图 | 部分通过 | 计划预览正确展示并行组与「顺序边不传新状态」说明（`screens/ac20-p12-1440x900.png`）；A→B 顺序边后分组变化有单测（`scheduleGroupingFollowsOrderEdges`），浏览器端加边操作未逐帧录屏 |
| AC11 基线计算 | 通过 | c042→c044 当前图求值：F01/F02/F03=20/20/20；P22 记录回看 1/30（6 实体执行 × 5 节点）；6 请求、3 裁决、3 变更（`screens/p22-node-trace.png`） |
| AC12 过程切实体 | 通过 | P22 cool-A×F01：100/50/−50/−40/20；切 F02 节点端口同步为 80/30/−50/−30/20（Batch E 冒烟 + 本轮基线复核） |
| AC13 禁用系统 | 通过 | P11 停用 cool-B（草稿）→ P20 草稿试算 c044：50/30/20（`screens/ac13-one-cooler-50-30-20.png`）；旧基线记录不被覆盖（trace 不可变，单测 `recordsAreImmutable`） |
| AC14 参数实际生效 | 通过 | P11 改 cool-A maxDropK=20（草稿）→ branch-lower-power c042→c045：30/20/20（`screens/ac14-lower-power-30-20-20.png`）；P23 同步显示 A 请求 −20K、F02 比例 0.857 |
| AC15 缺输入失败 | 通过 | 删除 le4（n-neg→n-emit）后 P14 诊断 `INPUT_MISSING n-emit.delta`（`screens/error-missing-input-p14.png`）；P20 草稿试算被拒「未产生任何结果，分支头保持 c042」（`screens/error-missing-input.png`） |
| AC16 裁决可解释 | 通过 | P23 decision-F01：请求 −50K、比例 0.8、获准 −40K（`screens/p23-decisions.png`）；effectId 点击跳回 P22 对应 execution/node（Batch E 冒烟） |
| AC17 来源版本固定 | 通过 | P24 显示 F01 输入版本 @c042、固定图版本 g-cool@g5（`screens/p24-provenance.png`）；改当前草稿参数后回看 c044 记录数值不变（Batch E 冒烟 + 单测） |
| AC18 持久化与历史 | 通过 | program/schedule/ECS 草稿各自独立（draftRegistry 分 documentId）；保存刷新恢复（各批冒烟）；历史提交只读、viewCommit 不改 head（本轮误触 c042 历史查看时推算按钮正确禁用「历史查看只读」） |
| AC19 组件库真实使用 | 通过 | 见 `component-usage.md`（源码 import + 运行交互 + 保存产物三项） |
| AC20 核心页登记与布局 | 通过 | P29→P03→P08→P14→P11→P12→P20→P22→P23→P24 全部真实页面，无 PagePlaceholder；1440×900 主操作可达（`screens/ac20-p12-1440x900.png` 标准布局·1440px；`screens/p15-binding.png` 同为 1440×900）；1280×720 紧凑布局全程可操作 |

**统计：通过 19，部分通过 1（AC10 浏览器逐帧证据不全，逻辑有单测覆盖），失败 0。**

## 逐步复现 ① 从创建对象到运行追溯

1. P29「新建属性」→ 创建属性（如 thermal.demoacc，标量 f64）→ 保存。
2. P03 → Thermal 组件 → 挂为成员；或新建组件并添加成员。
3. P02 → 确认 Fire 类型装配 Thermal（必需组件移除被阻止）。
4. P08 → 新建/查看 F01 实体，初值覆盖编辑（来源标签 实例/模板/默认）。
5. P30/P14 → 打开 g-cool：五节点链 ReadPrevious→CoolingRoom→Min→Negate→Contribute；P15 绑定候选实时来自 schema。
6. P11 → cool-A/cool-B 绑定 g-cool@g5、q-fire、maxDropK=50；P12 → 外层调度：两 System 并行组 → cooling-floor 归约 → commit；计划预览「可执行」。
7. P20（main@c042）→「推算下一回合」（已保存模型）→ c044，F01/F02/F03=20/20/20。
8. P22（record-c044 → cool-A → F01 → n-neg）看端口值与贡献矩阵；P23 看裁决比例；P24 看输入版本来源并跳回 P22 节点。

## 逐步复现 ② 参数改变引起结果变化

1. P11 → cool-A → 参数 maxDropK 填 20 回车（草稿 r1 未保存）。
2. P20 → 切到分支「A 降为 20 K 试算」（head c042）→ 开「草稿试算」→ 推算。
3. 结果 c045：F01 30（−70）、F02 20（−60）、F03 20（−40）。
4. 对照基线 c044（maxDropK=50）：20/20/20，请求 −50/−50、比例 0.8；新记录请求变为 A=−20/B=−50、F02 比例 0.857。
5. 两组记录并存互不覆盖（P22 切换 record 查看）。

## 已知偏离（不计失败）

- EntityTypeDef 无 parent 字段，P02 继承编辑未做（需先改 v0.5 契约）。
- P22 只读节点图为自绘 SVG（未嵌 FlowGram 编辑器），端口单位映射为启发式。
- 提交历史为会话内存，刷新后计算提交消失（种子提交保留）；这是原型取舍，非缺陷。
- AC17 中 c043 为参考样例提交（reference-sample），真实计算提交从 c044 起。
