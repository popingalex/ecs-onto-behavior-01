# 原型修改计划

## 1. 四个工作区与对象边界

主导航调整为ECS构建、System编排、System内部逻辑、模拟与过程四个核心区；项目设置与复盘作为辅助入口。保留已有P编号避免旧深链接失效，新增P29属性定义和P30程序库。

|工作区|对象|独立页面|可编辑内容|禁止混入|
|---|---|---|---|---|
|ECS构建|实体类型|P02|类型名、父类、要求组件、关系|某个F01的当前温度|
|ECS构建|组件定义|P03|组件元数据、属性成员、版本、引用|实例值和逐节点程序|
|ECS构建|属性定义|P29新增|类型/形状/量种/单位/可空/默认/写入模式/约束|直接修改运行中F01数值|
|ECS构建|实体模板|P05|组件装配、默认覆盖、来源|当前运行任务状态|
|ECS构建|实体实例|P08|新建/复制/删除、组件实例、场景初始属性值、关系|改PropertyDef冒充改实体值|
|ECS构建|场景装配|P07|空间放置、场景初值、实体选择|替代实体管理器|
|System编排|System定义|P11|queryRef、programRef、参数、启用、访问声明|直接展开一百个运算节点|
|System编排|Schedule|P12|system实例、依赖、归约、提交边界|ReadProperty/Min/Contribute等内部节点|
|System内部逻辑|程序资产|P30新增|程序名称、参数、端口、版本、引用system|调度顺序|
|System内部逻辑|LogicGraph|P14|属性引用、计算、条件、效果、局部协作|其他system未提交状态|
|模拟与过程|运行/执行/裁决|P20/P22/P23|运行控制、计算轨迹、获准贡献|在历史记录中改程序定义|
|复盘|属性来源|P24|属性版本、输入、执行、裁决的只读关系|把时间先后自动当因果|

属性定义本轮采用组件内稳定ID，全局属性页是按componentId筛选的独立管理器。每个属性只属于一个组件；复用优先复用组件。未来若需要跨组件属性库，应单独定义可复用PropertyType，而不是让一个PropertyDef同时属于多个组件。

## 2. ECS管理页面必须真的能建模

### P29 属性定义：独立入口

中部DataTable列：属性名、稳定ID、所属组件、primitive、shape、量种、单位、nullable、默认值、writeMode、约束、版本、引用数。工具栏含新建/搜索/筛选/列配置；右Sheet为属性编辑，删除用AlertDialog展示引用。

新建温度：componentId=Thermal，id=thermal.temperature，f64/scalar，绝对温度/degC，不可空，default=100，贡献写入，reducer=cooling-floor。温差贡献端口使用temperatureDifference/deltaK，不能直接使用绝对温度。

操作必须包括创建、修改、复制、删除未引用草稿属性、引用定位和撤销重做。重命名只改label；改变类型/单位/可空时显示影响列表。被引用属性删除需阻止并列出模板、程序节点和实体数据。

### P03 组件定义

左组件列表，中间组件说明与属性成员表，右组件元数据。属性行打开P29并带componentId/propertyId，而不是在本页重复一套属性编辑器。新增组件后可进入P29创建其属性；已发布模式修改产生草稿版本。成员移除必须经过引用检查。

### P08 实体实例

实体表列id、名称、类型、模板版本、组件数、位置是否设置、初值摘要。新增实体先选类型/模板，再装配组件、编辑场景初值和关系。详情标签为组件、初始属性、关系、模板来源；运行快照另有明确只读模式。

选择V01编辑water.remaining=5500只改变V01场景初值，不改变属性默认值、模板默认或V02。组件实例需要实际成员记录，不通过值对象有没有某个key来猜组件是否存在。可选组件可装卸；类型要求的必需组件移除需报错。

P05模板展示“模式默认→模板覆盖→实例覆盖→有效值”。恢复继承删除override；设为空保存显式null；两者不同。C01无位置在实体表保留；[0,0,0]显示为空间位置，不能被falsey判断过滤。

## 3. P12外层调度：React Flow

顶栏固定“System编排 / schedule-main”，显示调度版本与读取语义。左为已定义system和归约/提交节点库；中央React Flow；右为System配置与访问摘要；下部标签为执行计划、并发分析、诊断。

画布只允许SystemNode、ReducerNode、ContractNode、CommitNode；调用子调度可后续增加。SystemNode显示query、program版本、实体数量、输出类别与enabled。双击或“编辑内部逻辑”进入P14，携带systemId/programId，返回保留缩放/选中/滚动。

每条边必须有语义：order为执行先后，effect为效果流入归约器，product为显式中间产物。prototype首批实现order/effect；product在未有执行支持时拒绝连接并解释，不能画出来却不执行。

默认两个冷却system同组并行，只读c042并输出私有请求；汇入cooling-floor后提交。增加A→B顺序边后，计划变成两组，但B仍读旧100°C。前端显示“逻辑并行组”，不宣称浏览器mock真正多线程执行。

实现拖拽新增、选中/多选、移动、删除、连接/断开、缩放、MiniMap、导出/导入和保存恢复。读写/访问分析生成解释，不能以边的位置或动画顺序当成数据可见性。

## 4. P14内部程序：FlowGram

顶栏固定“System内部逻辑 / g-cool”，显示当前被哪个system以何参数调用。左物料库，中央FreeLayoutEditor，右节点表单与变量绑定，下部诊断/样本执行。与P12使用不同组件、不同节点注册表、不同documentId和撤销栈。

首批节点：ReadPrevious、ReadSelfPreview、CoolingRoom、Min、Negate、Contribute，加Constant/Parameter和IsSome以展示单位/可空边界。FlowGram负责画布交互、节点表单、变量作用域与输出绑定基础；领域量种、单位、旧状态/暂存视图与贡献语义由DomainBindingService和mock executor补齐。

物料节点必须能拖入、连接、改参数、删除、撤销、保存再加载。节点端口显示类型与单位；输入默认值/上游连接/属性绑定互斥，不能一个输入同时连线和绑定。条件节点明确控制作用域，首次不支持完整循环和长期等待时应禁用并说明。

变量来源是self属性、program参数、有效上游输出、关系路径、局部变量和sim context。候选由schema和当前图生成，禁止硬编码n-min.out。选择F01温度读c042预览100°C；Contribute之后读自身暂存可见50°C；cool-B暂存不可见。

FlowGram设计态变量不是运行事实。变量引擎提供作用域与类型基础，但每次执行的具体值来自NodeExecution。FlowGram图导出需转成独立LogicGraphDocument，执行器不直接依赖画布组件内部对象。

## 5. 组件库使用范围

|位置|实际复用|验收证据|
|---|---|---|
|工作台|shadcn Sidebar/Breadcrumb/Resizable/Tabs/ScrollArea|组件源码和真实import、面板拖动、焦点行为|
|CRUD|shadcn Dialog/Sheet/AlertDialog/Field/Input/Select/Switch|字段校验、取消不保存、删除引用确认|
|列表与矩阵|shadcn Table + TanStack Table|排序、筛选、行选择、列显隐；10k行再按需加Virtual|
|属性/变量选择|shadcn Command/Popover或Dialog+树结构|搜索、类型不兼容原因、键盘确认、结构化binding|
|外层图|@xyflow/react|真正ReactFlow节点/Handle、连接事件、保存导入|
|内层图|FlowGram free-layout-editor及表单/变量能力|真正画布、node registry、表单绑定、scope派生|
|错误反馈|shadcn Alert/Tooltip/Sonner|定位到字段或节点，toast不代替持久诊断|

shadcn/ui是按需生成并纳入项目的组件源码体系，不能要求package.json必须有一个叫shadcn-ui的运行依赖。当前React19/Tailwind4须采用兼容的安装与样式配置，新增components.json；选择一套基础原语，避免Radix/Base UI混搭产生焦点差异。自有领域组件保留，但底层交互用上述成熟组件。

如果FlowGram与当前版本组合出现问题，先记录最小复现并修正配置；不得静默替换成SVG假画布。若确需统一为React Flow，应提供替代影响清单，补齐变量/表单/作用域能力后作为明确技术变更，而不是两个编辑器又退回一套占位UI。

## 6. 计算过程是独立产品能力

ExecutionAdapter输入至少含baseWorld、modelBundle、ScheduleDocument、system参数和LogicGraph版本，不再只传baseCommit查预置结果。实现浏览器可运行的纯TS mock executor；保留适配接口以后换Rust/WASM。fixture只用于初始化和对照，参数修改必须触发实际求值。

结果返回：nextWorld、RunRecord、SystemExecution[]、NodeExecution[]、EffectRequest[]、ConstraintDecision[]、PropertyChange[]、DependencyEdge[]、diagnostics。先缓存完整结果，再一次更新branch head；计算失败不生成新commit。动画读取已提交结果，不能决定业务状态。

### P20运行

提供初始化到c042、输入操作、一次回合计算、1秒演示。运行区增加“本次结算”入口，显示system数、实体批次、效果请求数、裁决组、变更数以及runRecordId，点击进入P22。本轮优先计算与数据台，地图可复用已有示意视图。

### P22过程调试

上方run/branch/baseCommit/resultCommit/system/entity选择器；左system及实体批次树；中部P14同版本程序的只读FlowGram视图；右节点输入输出与来源版本；底部执行日志、属性访问和贡献矩阵。执行记录按seq步进，节点状态ready/running/completed/skipped/cached/error明确；当前原型提供记录回看，不冒称真实断点暂停续算。

矩阵固定列：实体、旧值、本system暂存、请求贡献、获准贡献、最终值。F01=100/50/−50/−40/20；F02=80/30/−50/−30/20；F03=60/20/−40/−20/20。切实体时所有面板切到同一executionId；不把F01端口值复用到F02。

### P23裁决

显示旧100°C、候选0°C(未提交)、额度80K、比例0.8、A/B获准−40K、最终20°C。分组内请求与获准同时存在；裁决未发生时获准/最终为pending，而不是0。点击贡献回到对应system/entity/node执行；点击最终属性进入P24。

### P24来源

数据版本节点、执行活动节点、裁决活动节点分开。旧温度@c042→两次程序执行→归约→新温度@c043，边有used/proposed/generated语义。来源链只使用保存的输入版本，不从最新实体状态补值。

## 7. 草稿、保存与状态隔离

将单一model-draft拆为按documentId管理的DraftRegistry。每个schema/scene/program/schedule有自己的revision、savedRevision、validatedRevision、undo/redo和保存key。一次编辑事务只进一套权威命令历史；FlowGram内置历史通过adapter与CommandBus对齐，不能Ctrl+Z同时回滚两套状态。

route保存pageId + contextKind + objectId + documentVersion；运行另带runId/branchId/viewCommit/recordId/executionId。P12返回P14只改变编辑上下文，不误改当前run。prototype保存可用localStorage或IndexedDB，必须标本地保存；当前saveDraft仅内存标记，不能继续以“已保存”暗示刷新后存在。

## 8. 实施文件与顺序

|批次|修改现有文件|新增模块|退出条件|
|---|---|---|---|
|M0 组件/数据基线|package.json、index.css、core/types、data/adapter、stores/draft|components.json、schema/、mockLoader、draftRegistry|两套图依赖可挂载；单一mock与草稿刷新恢复|
|M1 ECS闭环|P03、P03Inspector、registry、navigation|p02/p05/p08/p29、EntityEditor、ComponentMembership、AttributeForm|从空白建组件/属性/实体，值和定义互不串改|
|M2 内部程序|P15、coreValidation、CommandBus|p14、p30、logicEditor/、bindingService、graphCodec|五节点图从编辑到保存恢复；单位/可空/作用域拒绝错误|
|M3 System调度|navigation/registry、SystemDef|p10/p11/p12、scheduleEditor/、planCompiler|两system+归约+提交；顺序/并行与读取视图正确|
|M4 计算与记录|executionAdapter、session、data/index|mockExecutor/、traceStore、p22/p23/p24|改图/参数实际改变结果，完整过程可跳回节点|
|M5 连贯验收|runView、P20、路由/保存入口|acceptance/场景脚本与证据|按05_acceptance走完，不以页面登记数代替完成|

非本轮主线：复杂GIS/3D导入、自然语言生成、完整策略编辑、跨分支合并、多人服务器、生产Rust调度器。保留入口和数据契约即可，不挤占四项核心原型工作。
