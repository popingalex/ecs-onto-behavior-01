# 仓库实际状态与整改依据

源码：https://github.com/popingalex/ecs-onto-behavior-01  
检查基准：main / `112e7eadd81d259c141883f17a411c07b7300aba`，提交时间 2026-10-20T05:52:08Z。本轮取得公开源码快照并静态检查；未运行该React应用，因此交互表现与构建结果属于待验证项。结论不依赖仓库页面标题或历史截图。

## 核心结论

当前主要交付是工作台外壳、路由与少数示例页。缺失的关键不只是菜单分类，还包括可编辑的图文档和能返回执行过程的计算适配器。把占位页换成漂亮截图也无法完成需求。

|证据|发现|源码入口|必须改变|
|---|---|---|---|
|A01|P12/P14/P22/P23核心界面没有实现登记：主页面只有P01/P03/P20；P15/P21为弹层；其他页回退占位|[src/pages/registry.ts](https://github.com/popingalex/ecs-onto-behavior-01/blob/112e7eadd81d259c141883f17a411c07b7300aba/src/pages/registry.ts#L24)|实现专用页面后登记，不以导航可达算完成|
|A02|画布区域仅为空布局占位：GraphCanvas只是占位文字，未挂载图编辑库|[src/pages/PagePlaceholder.tsx](https://github.com/popingalex/ecs-onto-behavior-01/blob/112e7eadd81d259c141883f17a411c07b7300aba/src/pages/PagePlaceholder.tsx#L1)|P12和P14分别挂载真实画布，提供增删连线和保存|
|A03|未接入目标组件与图编辑库：运行依赖仅React、ReactDOM、lucide-react；基础UI为自绘Tailwind封装|[package.json](https://github.com/popingalex/ecs-onto-behavior-01/blob/112e7eadd81d259c141883f17a411c07b7300aba/package.json#L1)|接入shadcn/ui源码与实际图编辑器，不只改视觉样式|
|A04|属性新增操作不可用：新增属性按钮disabled，页面只有组件索引及属性列表/有限字段编辑|[src/pages/p03/P03ComponentSchema.tsx](https://github.com/popingalex/ecs-onto-behavior-01/blob/112e7eadd81d259c141883f17a411c07b7300aba/src/pages/p03/P03ComponentSchema.tsx#L124)|新增独立属性管理P29，完成CRUD和引用定位|
|A05|运行数据仍来自独立seed：seedDataAdapter复制seed；未使用design/mock定义作为唯一业务输入|[src/data/adapter.ts](https://github.com/popingalex/ecs-onto-behavior-01/blob/112e7eadd81d259c141883f17a411c07b7300aba/src/data/adapter.ts#L1)|建立规范化模型与单一mock loader，消除字段漂移|
|A06|逻辑图和调度仅保存名称/版本：graphs使用VersionedAsset，schedules使用NamedDef；缺少节点/边/端口/绑定的领域模型|[src/core/types.ts](https://github.com/popingalex/ecs-onto-behavior-01/blob/112e7eadd81d259c141883f17a411c07b7300aba/src/core/types.ts#L87)|引入LogicGraphDocument与ScheduleDocument，layout另存|
|A07|结算适配器没有计算与过程产物：仅查预置Map；源码只见registerPrecomputedRound定义未见调用，缺失时返回REFERENCE_RESULT_MISSING|[src/services/executionAdapter.ts](https://github.com/popingalex/ecs-onto-behavior-01/blob/112e7eadd81d259c141883f17a411c07b7300aba/src/services/executionAdapter.ts#L15)|用可执行mock adapter按当前草稿求值，返回状态、trace、贡献和裁决|
|A08|变量候选硬编码且绑定未落到图文档：候选使用示意字符串；BindPort写入通用overlay，缺图数据读取链|[src/pages/overlays/P15BindingPicker.tsx](https://github.com/popingalex/ecs-onto-behavior-01/blob/112e7eadd81d259c141883f17a411c07b7300aba/src/pages/overlays/P15BindingPicker.tsx#L22)|从schema/上游作用域生成候选，绑定写入LogicGraphDocument并影响求值|
|A09|快照和过程类型不完整：有commit和world、DisplayValue；没有RunRecord/SystemExecution/NodeExecution/DecisionDTO|[src/core/types.ts](https://github.com/popingalex/ecs-onto-behavior-01/blob/112e7eadd81d259c141883f17a411c07b7300aba/src/core/types.ts#L153)|为计算过程建立独立DTO和store，P22/P23/P24共享记录|
|A10|两套业务字典已经出现差异：seed与design/mock在实体名、FireState/Combustion、Station/SupplyStation、task目标key、水量默认/站库存等处不一致|[src/mock/seed.ts](https://github.com/popingalex/ecs-onto-behavior-01/blob/112e7eadd81d259c141883f17a411c07b7300aba/src/mock/seed.ts#L80)|用显式迁移表统一，差异清单逐项裁定，禁止静默覆盖|

## 对用户观察的精确解释

实体与属性并非完全没有类型区分：源码已有EntityDef、PropertyDef、WorldSnapshot，但没有对应完整管理界面。P03将组件选择与属性编辑合在一起；实体管理P08仍是占位，新增属性按钮不可用。需要补齐“定义”和“实例值”的独立操作面。

外层与内层在路由上已有P12/P14两个名字，但二者都未实现，因此不能说运行中存在一个已完成却混用的图编辑器。应分别实现两种语义的编辑器，不能继续复用同一个占位模板。

仓库有自绘Button/Table/Modal等基础组件，不等同于“完全没有组件”。问题是未接入用户要求的成熟组件体系，也没有真正的节点画布。shadcn/ui需要检查生成的组件源码、基础依赖和使用路径，不能只凭package.json中是否出现shadcn这个名字判断。

运行页有快照展示、阶段状态、只读和播放边界，可保留。但执行适配器返回类型只有commit/world，不能承载节点计算轨迹、贡献请求或裁决。预置结果的注册函数在本次源码检索中只有定义，未见启动调用；缺结果时按代码会返回REFERENCE_RESULT_MISSING，尚未实机点击验证。

## 保留与改造

保留工作台上下文、历史路由、离开确认、TypedValueCell显示语义、CommandBus意图和播放/提交分离的设计。将基础控件逐个替换或适配为shadcn/ui；将全局单一draft overlay拆为以documentId隔离的资产草稿。保留明确只读边界，不因换库重写整个外壳。

核心页不能出现“规划组件”“出口跳转”“规格待接入”作为主要业务内容。这些信息移到开发验收面板。暂未建设的非核心页可保留明确未实现状态，不计入完成率。

## 一致性风险

src/mock/seed.ts与design/mock是两份不同业务字典。例如FireState与Combustion、task.target与task.assignment、Station与SupplyStation不能靠显示名自动匹配。实体名和位置也已有漂移，补给站水量在不同样例中的业务定位不一致。以v0.5原型输入为新的演示基准，迁移时列出每项差异和映射，保留稳定ID，不将改名当作创建新实体。

本轮审计只定位UI原型缺口；不据此否定Rust推演架构，不把静态检查当成性能或模型可信度认证。

## 施工资料路径缺陷

对design/contracts/page_index.json逐项检查，28条file路径全部未匹配磁盘文件。示例：索引为pages/P01_项目与版本总览.md，实际是pages/P01_.md；P14实际为P14_System.md。规格内容在源码中存在，但链接失效。不能把“按旧路径找不到”解释成用户没有提供。

contracts/spec_path_repairs.json逐项列出原路径、实际文件及修复建议。M0先修复索引或统一ASCII文件名，并同步所有交叉引用。
