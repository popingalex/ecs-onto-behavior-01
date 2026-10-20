# 可直接分轮交给Figma Make的任务

这份文件用于当前React仓库的原型开发，不是让Figma重新生成另一套静态网站。每次只执行一个批次；结束时报告实际改动、可点操作、验证结果与剩余缺口，再进入下一批。全部批次已获本次原型整改范围内的施工方向，具体代码实施由使用者交给Figma Make执行。

## 每轮共同约束

- 读取AGENTS.md，保留既有React/Vite/Tailwind结构、路由上下文和稳定对象ID。
- 核心是ECS构建、System外层调度、System内部编辑、计算过程。先做这些，不继续扩充三维装饰或占位页。
- 使用shadcn/ui基础界面、React Flow外层图、FlowGram内层图；图和表单必须可操作并真实读写数据。
- 外层ScheduleDocument、内层LogicGraphDocument、模型schema、场景实体值、运行记录分别存储。
- 输入从本包mock/prototype_seed.v05.json读取；expected_runs仅对照，不作为“执行当前图”的分支查表。
- 不把“显示全部页面名”“登记组件”“toast已保存”“播放节点光效”当成业务实现。
- 不编造正式并发、实测耗时或真实断点能力。当前mock可以串行参考求值，展示逻辑并行计划与已保存轨迹。
- 页面出现“内容待接入”就标未完成；不通过更换标题把占位内容包装成真实编辑器。

## M0 先修复施工输入与组件基线

前置：现有仓库。

执行任务：

1. 先读AGENTS.md和本计划；核对现有路由与对象ID，不重写整个工作台。
2. 修复design/contracts/page_index.json里的失效路径：源码快照中28条均无法匹配磁盘文件，实际文件名已变成Pxx_.md等。按稳定P编号建立正确映射。
3. 使用shadcn官方兼容React19/Tailwind4的安装方式生成组件，替换或薄封装现有Button/Modal/Table/Field；保留项目语义主题。引入TanStack Table、@xyflow/react、FlowGram自由布局和变量/表单所需依赖。不要只写库名。
4. 读取prototype_seed.v05.json并规范化schema/引用，停止维护第二套seed数字。draft按documentId分开，明确本地保存并能刷新恢复。
5. 分别挂载React Flow和FlowGram的最小工作示例，确认拖拽/连线/样式可用后再做业务物料。

重点修改：`package.json`, `src/index.css`, `src/components/ui/*`, `src/data/adapter.ts`, `src/stores/draft.ts`, `design/contracts/page_index.json`。

新增模块：`components.json`, `src/schema/*`, `src/data/mockLoader.ts`, `src/stores/draftRegistry.ts`。

完成标准：

- 能看到实际库组件，不是安装后仍渲染原SVG占位。
- 属性、图和调度三类草稿互不覆盖。
- 页面规格路径扫描不再出现28个失效引用。

本轮结束回传：运行入口、实际文件清单、一条成功路径、一条失败路径、构建/交互证据；未完成项不能写成已完成。

## M1 完成ECS定义与实例的独立管理

前置：M0。

执行任务：

1. P02管理实体类型；P03仅管理组件元数据和属性成员；新增P29独立属性定义管理；P05管理模板覆盖；P08管理场景实体实例和初值。
2. 各页都有可用新建、编辑、删除(含引用阻止)、搜索和详情；新增属性按钮不能继续disabled。
3. 新建Thermal组件→thermal.temperature属性→Fire类型→F01实体。定义的100°C默认和F01实例初值可分别编辑；修改V01水量不能改属性默认、模板或V02。
4. 实体详情以组件为分组，能装配可选组件；必需组件移除报错。恢复继承与显式null分开。

重点修改：`src/pages/p03/*`, `src/pages/registry.ts`, `src/navigation/*`, `src/core/types.ts`。

新增模块：`src/pages/p02/*`, `src/pages/p05/*`, `src/pages/p08/*`, `src/pages/p29/*`, `src/features/ecs/*`。

完成标准：

- 刷新后新建对象还在，并能继续引用。
- P03→P29→引用位置的跳转正确。
- null位置实体仍在表中，原点位置有效。

本轮结束回传：运行入口、实际文件清单、一条成功路径、一条失败路径、构建/交互证据；未完成项不能写成已完成。

## M2 完成System内部逻辑可视化编辑

前置：M1。

执行任务：

1. P30为程序资产库，P14使用FlowGram FreeLayoutEditor，注册ReadPrevious/CoolingRoom/Min/Negate/Contribute五类物料。左库、中画布、右表单、下诊断，各区能调整大小。
2. 支持从节点库拖入、连线/断线、编辑参数、删除、撤销重做、保存加载；不可用的高级节点不要做可点击假实现。
3. 变量候选从schema、参数和当前上游scope生成。明确previous/selfPreview、单位和nullable；binding写入真实LogicGraphDocument。确认后节点表单与端口更新；取消不修改。
4. 错误连接°C→温差K被拒绝并定位原因；删必需连接后校验失败。更改图布局不改变语义hash。

重点修改：`src/pages/overlays/P15BindingPicker.tsx`, `src/services/coreValidation.ts`, `src/pages/registry.ts`。

新增模块：`src/pages/p14/*`, `src/pages/p30/*`, `src/features/logic-editor/*`, `src/services/domainBindingService.ts`, `src/services/logicGraphCodec.ts`。

完成标准：

- 导出再导入保留nodeId/portId/binding/单位。
- 不存在n-min.out等硬编码候选依赖。
- P12不在这里复用内部运算节点注册表。

本轮结束回传：运行入口、实际文件清单、一条成功路径、一条失败路径、构建/交互证据；未完成项不能写成已完成。

## M3 完成System定义及外层调度

前置：M2。

执行任务：

1. P11创建cool-A和cool-B，绑定同一个g-cool版本、q-fire和不同参数。P10查询预览匹配3火源。
2. P12使用React Flow的SystemNode/ReducerNode/ContractNode/CommitNode。两个System输出到cooling-floor再提交；图中不出现ReadPrevious/Min/Contribute内部节点。
3. 支持拖入、连接、删除、启用/禁用、保存加载和计划预览。order边和effect边有标签；不支持product时拒绝并说明。
4. 双击System跳到P14对应program，返回保留P12视图；增添A→B顺序边后计划分组变化，但B仍读旧状态。

重点修改：`src/core/types.ts`, `src/navigation/*`, `src/pages/registry.ts`。

新增模块：`src/pages/p10/*`, `src/pages/p11/*`, `src/pages/p12/*`, `src/features/schedule-editor/*`, `src/services/scheduleCompiler.ts`。

完成标准：

- 调度和程序有独立document/schema/undo。
- 成环显示诊断，不能执行。
- System详情展示query、program、参数与访问声明，而不是只放标题。

本轮结束回传：运行入口、实际文件清单、一条成功路径、一条失败路径、构建/交互证据；未完成项不能写成已完成。

## M4 让当前图运行并记录完整计算过程

前置：M3。

执行任务：

1. 实现纯TS mock executor，输入当前model+scene+program+system参数+schedule，支持本例五节点与比例冷却裁决。不能用hardcoded case切换替代执行当前图。
2. 返回RoundResult完整产物；先保存trace/decision/change再更新commit。失败保留baseCommit；模拟step=10秒，演示1秒，不能用setTimeout当计算。
3. P22从recordId/system/entity/node联动只读图、端口值、访问日志和贡献矩阵；记录步进不标成真实断点续算。
4. P23展示requested→approved→final与比例；P24展示不可变输入版本和执行来源；点击结果能定位执行节点与其固定图版本。
5. 完成三组动态试算：两路50K、停用B、A改20K。若输入不合法显示诊断，不要仍播放预置成功。

重点修改：`src/services/executionAdapter.ts`, `src/stores/session.ts`, `src/data/index.ts`, `src/pages/p20/*`。

新增模块：`src/services/mock-executor/*`, `src/stores/trace.ts`, `src/pages/p22/*`, `src/pages/p23/*`, `src/pages/p24/*`。

完成标准：

- 基线F01为100/50/−50/−40/20。
- 禁用B得到50/30/20；A改20K得到30/20/20。
- 旧记录不随当前图参数修改而变化。

本轮结束回传：运行入口、实际文件清单、一条成功路径、一条失败路径、构建/交互证据；未完成项不能写成已完成。

## M5 按核心闭环验收并交付证据

前置：M4。

执行任务：

1. 执行05_acceptance.md，每个步骤保留截图/录屏或可复现说明。核心页不得再回落PagePlaceholder。
2. 交付真实应用画面：属性管理、实体编辑、外层调度、内部编辑、变量绑定、节点过程、联合裁决、属性来源。补一组单位错误和失败状态。
3. 按源码import、运行交互和保存产物三项说明第三方库使用；组件库安装成功不等于业务完成。
4. 验证1440×900不裁切主要操作，1920×1200信息完整；运行目标实机性能另列，不用原型截图宣布通过。

重点修改：`src/pages/registry.ts`, `src/pages/PagePlaceholder.tsx`, `src/navigation/paths.ts`。

新增模块：`acceptance/core-journeys.md`, `acceptance/component-usage.md`, `acceptance/screens/*`。

完成标准：

- 四项核心功能可连续完成，跨页数据与选中上下文一致。
- 构建通过及浏览器交互证据齐备。
- 未实现项逐项列出，不把页面登记数或链接数当完成率。

本轮结束回传：运行入口、实际文件清单、一条成功路径、一条失败路径、构建/交互证据；未完成项不能写成已完成。

## Figma设计画板组织

Foundations与shadcn组件；ECS：P02/P03/P29/P05/P08；调度：P11/P12；程序：P30/P14/P15；过程：P20/P22/P23/P24。P12和P14不得是同一Frame换标题，画布左库和右检查器应明显不同。

每个画板标pageId、documentId、modelVersion；过程页额外标recordId/baseCommit/resultCommit/systemId/entityId。成功/空态/错误/只读单独变体；单位错误端口、属性被引用不能删除、缺失输入阻止运行必须有画面与实际行为。

关键图应来自完成后的应用截图，并与mock数值核对。PNG参考层可保留，但需要重建可编辑组件和真实图交互，不能把旧PNG整张贴入应用当页面。
