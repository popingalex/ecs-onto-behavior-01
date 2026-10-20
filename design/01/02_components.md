# 可复用组件规格

所有组件有稳定组件ID；Figma名称与代码ViewModel保持映射。领域组件由基础库组合，不能将第三方画布内部序号用作业务ID。

|ID|组件|输入|输出事件|数据所有权/实现|变体|
|---|---|---|---|---|---|
|C01|WorkspaceShell|mode,role,context,panels|navigate,resize,resetLayout|工作区持有布局；egui_dock负责停靠|edit/run/history；default/compact|
|C02|ContextBar|draftRevision或run/branch/view/head|selectVersion,returnHead,primaryAction|ContextStore；egui基础组件|draft/published/head/history/disconnected|
|C03|ObjectTree|nodes,selectedId,filter,counts|select,open,rename,contextAction|ObjectIndex；egui CollapsingHeader/ScrollArea|asset/entity/execution；empty/loading|
|C04|TypedValueCell|ValueRef,definition,view,provenance|edit,clear,resetInherited,trace|只格式化，不直接写world；egui DragValue/TextEdit|scalar/vector3/matrixRef/null/invalid/provisional|
|C05|PropertyGrid|schema,effectiveValues,overrides|patchDraft,openBinding|SchemaStore+DraftStore；egui_extras TableBuilder|template/entity/multi-select/readonly|
|C06|ObjectLink|objectType,id,version,context|openObject|导航路由统一解析；egui Link/Button|valid/missing/forbidden/readonly|
|C07|GraphCanvas|graph,layout,selection,diagnostics|connect,move,delete,openNode|GraphDocument与布局分离；egui-snarl|schedule/entityLogic/provenance|
|C08|NodeCard|nodeId,type,ports,summary,runState|select,breakpoint,openConfig|NodeDefinition决定端口；SnarlViewer绘制|selected/error/running/waiting/cached|
|C09|BindingPicker|expectedType,scope,binding,previewContext|confirmBinding,cancel|BindingService；egui Modal+树/列表|compatible/incompatible/nullable/stale|
|C10|ValidationList|diagnostics,validationRevision,currentRevision|locate,revalidate|core diagnostics，不在UI复制编译器|error/warning/stale/clear|
|C11|EntityTable|queryResult,columns,commit,selection|sort,filter,select,bulkPatch|WorldSnapshot；TableBody.rows只渲染可见行|editable/readOnly/loading/empty|
|C12|SpatialViewport|renderProjection,camera,selection|pick,transform,place|消费同一权威route/position；Bevy视图适配|edit/run/history/resourcesMissing|
|C13|RunControls|phase,role,head,playbackState|settle,pausePlayback,step,seek|SessionStore与PlaybackStore分开|waiting/frozen/computing/committed/playing/failed|
|C14|CommitSelector|branches,viewCommit,headCommit|select,returnHead,createBranch|HistoryStore；不覆盖分支head|head/historical/checkpointMissing|
|C15|ContributionTable|effectRows,decision,units,context|openExecution,openConstraint|按effectId关联请求/获准；TableBuilder|requested/pending/approved/partial/rejected|
|C16|TraceInspector|executionId,entityId,nodeId,inputs,outputs|stepRecordedTrace,openValueVersion|TraceStore；端口值不读最新world|recorded/pausedLiveUnsupported/failed/noTrace|
|C17|PolicyStatus|instance,coverage,forecast,candidates|openTask,openPolicy,remedy|PolicyStore；预测与事实分别标记|satisfied/unmet/pending/cancelled|
|C18|EventTimeline|events,relations,timeRange,commit|selectEvent,seekRecorded,openTask|EventStore；egui_plot+领域覆盖绘制|prediction/fact/cancelled/missingRelation|
|C19|DiffTable|leftRef,rightRef,alignment,rows|openLeftTrace,openRightTrace|ComparisonService；数值差和来源差并存|changed/equalValueDifferentSource/missing|
|C20|AsyncStatePanel|status,error,retry,contextKey|retry,cancel|所有读组件共用，旧上下文响应被丢弃|loading/empty/error/stale/disconnected|

## 数据所有权与刷新

ContextStore保存当前模式、版本、分支、viewCommit、角色；DraftStore保存草稿和命令栈；WorldSnapshot保存某个不可变提交；TraceStore保存执行记录；SessionStore保存权威会话阶段；PlaybackStore只保存演示时间、速度和相机。所有跨组件选择事件携带objectId和contextKey。

数据读取链：JSON/API → 规范化索引 → 页面selector → ViewModel → 组件。组件事件 → CommandBus → 校验/参考器 → 新草稿或新不可变结果 → selector更新。禁止单元格直接修改已提交世界，也禁止Figma文字作为第二份业务数据。

TypedValueCell示例：`definitionId=thermal.temperature, valueRef=F01.temperature@c042, view=previous`显示100°C；改成`effectId=eff-F01-cool-A, view=selfPreview`显示50°C并带“暂存预览”；`valueRef=F01.temperature@c043, view=final`显示20°C。它们来自不同记录，不是同一个状态标签随意切换。

## 特殊组件的细节

BindingPicker确认前只写局部selection；确认后生成结构化binding并通过单个patch命令更新图。取消不产生历史。候选项显示来源、类型、单位、可空、作用域、读取视图；兼容性依据core返回诊断。上游控制分支内输出不能在分支外伪装为必有变量。

GraphCanvas不拥有执行器。节点位置、缩放、折叠属于layout；节点类型、参数、端口、边语义属于业务图。移动节点可撤销但不能改变计算结果。图中的运行光晕来自trace；不能用光晕本身驱动执行。

ContributionTable左列固定请求与来源，右列显示裁决；尚未裁决时不补0。支持按实体、system、约束组筛选。请求与获准各有单位，候选温度不能与温差混列。显示请求和获准的差额，点击差额可看规则与分配依据。

EventTimeline支持预测线虚线、事实线实线、取消线划除；事件关系显示具名edge kind。提交图、属性来源图、业务事件图是三种不同GraphCanvas配置，各有不同的node/edge schema，不能通过换标题共用同一份数据。

## Figma组件与变量组织

基础组件：Button/Intent={primary,secondary,danger}/State={default,hover,focus,disabled,busy}；Field/Type={text,number,select,quantity,entityRef}/State={default,error,readonly}；Tag/State使用语义名称；Table/Header、Row、Cell由自动布局组成。

领域组件：Domain/TypedValue、Domain/BindingChip、Graph/SystemNode、Graph/LogicNode、Graph/DataVersionNode、Graph/ExecutionNode、Run/CommitContext、Run/ContributionRow、Run/PolicyCard、Run/CommandRow。每个组件带dataKey示例，如`temperature.final`、`effect.approved`，而不是把100°C复制到所有实例。

不新增React组件作为默认交付依赖。若以后批准Web编辑器，则同一组件契约可以映射到Ant Design/FlowGram，但不能据此改变Rust core定义或双端维护范围。
