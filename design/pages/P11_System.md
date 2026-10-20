# P11 System目录与执行绑定

版本：UI 0.4 · 桌面优先 · 1920×1200基准。本文是该页的独立施工依据；公共约定见 ../01_layout_and_interaction.md，组件契约见 ../02_components.md。

## 页面职责与入口

本页负责“System目录与执行绑定”。从全局资产/运行导航进入，或按 ../03_navigation.md 中的对象链接进入。入口必须接收 projectId；编辑页带 draftId/revision，运行页带 runId/branchId/viewCommit。不允许靠上一个页面的隐式全局选中值解释数据。

## 区域布局

左system列表；中部配置表单与参数表；右344访问摘要；下部最近试算。

全局顶栏56、上下文栏48、左功能栏72、底状态栏28。正文剩余区域独立滚动；画布/视口不触发整个页面滚动。左右面板可拖拽，最小220/300；分隔6。1440宽时右检查器收为320，底栏收为220，保留主要字段横向滚动。低于1280显示收起侧栏的单工作区，禁止缩小字体塞满。表头与底部主要操作固定。

## 组件与实际内容

cool-A喷淋冷却、cool-B泡沫冷却，均引用g-cool@g4/q-fire；参数maxDropK=50 K、sourceC=20°C；执行模式实体批处理；查询范围3；每回合连续效果；表单区分图资产版本、绑定查询、参数实例和启用状态。

组件按用途复用：WorkspaceShell、ContextBar、ObjectTree、TypedValueCell、ObjectLink、ValidationList；有图的页面再使用GraphCanvas/NodeCard，运行页使用CommitSelector/RunStateBadge。具体组件参数、事件与数据所有权见组件规格。本页不能自绘一套不同行为的单位或对象链接。

## 操作与跳转

新建system选逻辑图/查询/参数；编辑图→P14保留systemId；查询→P10；禁用cool-B仅改草稿，发布或分支参数操作后才影响运行；访问详情→P13；加入编排→P12。

导航离开有未保存草稿时，提供保存草稿/放弃本次编辑/留在本页。保存失败保持本地编辑态。返回上页恢复筛选、滚动、选中对象与画布视角。Ctrl+S保存当前草稿；Ctrl+Z/Shift+Ctrl+Z只作用当前编辑上下文，输入框内优先文本撤销；Delete只有画布或表行焦点时删除选中项。弹层关闭不自动保存。

## 绑定与更新

03_programs.systems；同一图多system各有参数与私有执行上下文；每回合复用结果仍发出本回合效果，execution/effectId去重。

读路径的具体JSON Pointer及连接键见 ../contracts/page_bindings.json。加载使用统一五态：loading、ready、empty、error、stale。先取得完整上下文再请求，异步响应携带contextKey；切分支或commit后丢弃旧请求结果。前端缓存key含modelVersion/branchId/commit，禁止只按entityId缓存历史值。

## 错误、权限及边界

缺参数、失效图版本或查询类型不匹配阻止发布；禁用被其他节点显式依赖的system显示计划变化。

历史页与观察者下禁用修改控件并给原因；只读不是隐藏内容。错误反馈定位到字段/端口/对象并保留用户输入。空值用“未设置”，不适用用“—”，等待裁决用“待裁决”；不得把这些值转成0。

## 可执行验收

禁用cool-B后试算F01=50°C、F02=30°C、F03=20°C；不能仍展示原20/20/20。

还需检查：刷新后上下文与标题一致；列表与详情使用同一版本；键盘可到达主要操作；颜色之外有文字/图标区分状态；加载失败能重试且不改原状态。关键画面若已提供，见 ../prototypes/；画面是指定数据与状态的参考，不代表全部状态都已绘制。
