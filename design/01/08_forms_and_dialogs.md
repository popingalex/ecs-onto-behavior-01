# 表单、弹层与字段施工清单

本文件补充逐页规格中的创建/修改操作。所有默认值为mock初始建议；保存前仍需统一core校验。模态默认560宽，属性/关系编辑可760宽；绑定选择器按P15。提交按钮固定底部，错误在字段旁，失败保留输入。

## D01 新建类型 · P02

|字段key|标签|控件|默认值|校验/选项|
|---|---|---|---|---|
|id|稳定key|text|""|必填；ASCII key；项目唯一|
|name|显示名|text|""|必填，≤80字|
|parent|父类型|typeRef|null|不可循环|

提交事件：`CreateType`。结果：创建草稿后选中新类型。取消只关闭本地表单，不执行命令。

## D02 新增属性 · P03

|字段key|标签|控件|默认值|校验/选项|
|---|---|---|---|---|
|id|属性ID|text|""|组件内唯一，发布后不重用|
|shape|值形状|select|"scalar"|必选；scalar,vector3,matrixRef|
|primitive|基础类型|select|"f64"|shape和类型兼容；f64,i64,bool,string,EntityRef|
|unitId|单位|unitRef|"degC"|量种兼容|
|nullable|允许无值|switch|false|bool|
|default|默认值|typedValue|100|不可空字段必须有效|
|writeMode|写入方式|select|"contribution"|必须与属性归约契约一致；configuration,exclusive,contribution,contract|

提交事件：`AddProperty`。结果：新增未发布模式，不能回写运行。取消只关闭本地表单，不执行命令。

## D03 关系定义 · P02

|字段key|标签|控件|默认值|校验/选项|
|---|---|---|---|---|
|id|关系key|text|""|唯一|
|source|源类型|typeRef|"FoamTruck"|必有|
|target|目标类型|typeRef|"Fire"|必有|
|cardinality|基数|select|"0..1"|支持约定集合；0..1,1,0..*,1..*|
|onDelete|目标删除|select|"restrict"|运行结构操作要显式裁决；restrict,clearRef,cascadeDefined|

提交事件：`AddRelation`。结果：预览现有实例是否违反基数。取消只关闭本地表单，不执行命令。

## D04 位置与空值 · P07

|字段key|标签|控件|默认值|校验/选项|
|---|---|---|---|---|
|frameId|坐标系|select|"park-ENU"|必须与scene一致|
|position|东/北/高|vector3|[320, 180, 0]|三个有限数；m|
|clear|未设置|explicitNull|false|仅nullable允许；不删除实体|

提交事件：`SetScenePosition`。结果：空间投影与实体表同步；单一撤销步骤。取消只关闭本地表单，不执行命令。

## D05 模板实例化 · P05

|字段key|标签|控件|默认值|校验/选项|
|---|---|---|---|---|
|template|模板版本|templateRef|"tpl-foam@t3"|固定版本|
|name|实体名|text|"新泡沫车"|必填|
|placement|位置|vector3|null|null合法，原点合法|
|overrides|属性覆盖|propertyGrid|{}|基于definition校验|

提交事件：`InstantiateTemplate`。结果：新稳定entityId；保留覆盖来源。取消只关闭本地表单，不执行命令。

## D06 查询条件 · P10

|字段key|标签|控件|默认值|校验/选项|
|---|---|---|---|---|
|classId|类型|typeRef|"Fire"|必有|
|groups|条件|conditionBuilder|[{"property": "active", "op": "eq", "value": true}]|AND/OR有类型；缺位置显式处理|
|view|读取视图|select|"previous"|默认previous|
|sort|排序|select|"id"|稳定排序|

提交事件：`SaveQuery`。结果：预览三实体；保存版本才更新引用。取消只关闭本地表单，不执行命令。

## D07 System绑定 · P11

|字段key|标签|控件|默认值|校验/选项|
|---|---|---|---|---|
|id|System ID|text|"cool-A"|唯一|
|graphRef|逻辑版本|graphRef|"g-cool@g4"|已存在|
|queryId|实体查询|queryRef|"q-fire"|类型兼容|
|maxDropK|最大降温|quantity|50|≥0；deltaK|
|sourceC|冷源温度|quantity|20|degC绝对温度|
|enabled|启用|switch|true|bool|

提交事件：`UpdateSystem`。结果：显示计划变化，发布后或分支覆盖才影响运行。取消只关闭本地表单，不执行命令。

## D08 图连线 · P14

|字段key|标签|控件|默认值|校验/选项|
|---|---|---|---|---|
|sourceNode|来源节点|nodeRef|"n-neg"|存在|
|sourcePort|来源端口|portRef|"delta"|输出端口|
|targetNode|目标节点|nodeRef|"n-emit"|存在|
|targetPort|目标端口|portRef|"delta"|输入端口；唯一生产者|
|edgeKind|边语义|select|"data"|不能用样式替代语义；data,control,product|

提交事件：`ConnectPorts`。结果：类型/单位/可空/作用域检查失败不写入。取消只关闭本地表单，不执行命令。

## D09 变量绑定 · P15

|字段key|标签|控件|默认值|校验/选项|
|---|---|---|---|---|
|root|来源|select|"self"|当前作用域可见；self,parameter,upstream,relation,local,context|
|propertyId|属性|propertyRef|"thermal.temperature"|稳定ID|
|view|读取视图|select|"previous"|selfPreview仅本上下文；previous,selfPreview|
|snapshotMode|引用/快照|select|"valueAtEvaluation"|EntityRef不得伪装为位置快照；entityRef,valueAtEvaluation|

提交事件：`SetBinding`。结果：一次patch，取消无变化。取消只关闭本地表单，不执行命令。

## D10 额度分配 · P16

|字段key|标签|控件|默认值|校验/选项|
|---|---|---|---|---|
|constraintId|约束|constraintRef|"cooling-floor"|固定版本|
|strategy|分配规则|select|"proportional"|必须显式选择；proportional,priorityThenStableId,solverPlugin|
|linkedEffects|关联效果|mapping|[]|缺映射不得宣称守恒|
|failure|失败策略|select|"rejectRound"|不可默默限幅；rejectRound,explicitProjection|

提交事件：`UpdateConstraint`。结果：重验引用system，运行不改旧版本。取消只关闭本地表单，不执行命令。

## D11 持续策略 · P17

|字段key|标签|控件|默认值|校验/选项|
|---|---|---|---|---|
|target|目标|entityRef|"F01"|Fire且未熄灭|
|minCount|最低合格数|integer|1|≥1|
|waterMin|水量下限|ratio|0.5|[0,1]；UI显示50%|
|allowMoving|前往可计覆盖|switch|true|bool|
|handoff|交接条件|select|"arrival"|显式业务选择；arrival,taskAccepted|
|terminate|终止|select|"fireExtinguished"|不得由温度阈值自动猜测|

提交事件：`SavePolicy`。结果：首次安装时匹配已存在火源。取消只关闭本地表单，不执行命令。

## D12 发布 · P18

|字段key|标签|控件|默认值|校验/选项|
|---|---|---|---|---|
|revision|当前修订|readonly|12|等于validatedRevision|
|summary|发布说明|text|"冷却与接替演练"|必填|
|warnings|警告确认|checklist|[]|保留原诊断|

提交事件：`PublishBundle`。结果：成功返回bundleId；失败不切P19。取消只关闭本地表单，不执行命令。

## D13 运行创建 · P19

|字段key|标签|控件|默认值|校验/选项|
|---|---|---|---|---|
|bundleId|发布包|bundleRef|"bundle-04"|资源齐备|
|mode|模式|select|"turn"|RTS后续，不混用时钟|
|stepSeconds|模拟步长|quantity|10|>0；s|
|playbackSeconds|演示时长|quantity|1|>0；s|
|runtime|运行位置|select|"server"|插件能力匹配；server,local-worker|

提交事件：`CreateRun`。结果：创建后c042待操作，不自动结算。取消只关闭本地表单，不执行命令。

## D14 个人分支 · P26

|字段key|标签|控件|默认值|校验/选项|
|---|---|---|---|---|
|baseCommit|分叉提交|readonly|"c042"|检查点可续算|
|name|分支名|text|"个人冷却试算"|必填|
|visibility|可见性|select|"private"|默认仅自己；private,team|
|runtime|运行位置|select|"local-worker"|与可见性无关；local-worker,server|
|scope|推演范围|readonly|"full-world"|局部查看不等于裁掉依赖|

提交事件：`CreateBranch`。结果：新分支头指向c042，后续独立提交。取消只关闭本地表单，不执行命令。

## D15 分支对比 · P27

|字段key|标签|控件|默认值|校验/选项|
|---|---|---|---|---|
|leftCommit|左侧提交|commitRef|"c043"|存在|
|rightCommit|右侧提交|commitRef|"c043-one-cooler"|存在|
|alignment|对齐依据|select|"simTime"|显示具体时刻；simTime,round|
|metrics|指标|multiSelect|["thermal.temperature", "water.remaining"]|单位与量种兼容|

提交事件：`CompareBranches`。结果：缺值显示未记录，不当作0。取消只关闭本地表单，不执行命令。

