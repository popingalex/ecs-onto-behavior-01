# P12 System外层调度

版本：UI 0.4 · 桌面优先 · 1920×1200基准。本文是该页的独立施工依据；公共约定见 ../01_layout_and_interaction.md，组件契约见 ../02_components.md。

## 页面职责与入口

本页负责“System外层调度”。从全局资产/运行导航进入，或按 ../03_navigation.md 中的对象链接进入。入口必须接收 projectId；编辑页带 draftId/revision，运行页带 runId/branchId/viewCommit。不允许靠上一个页面的隐式全局选中值解释数据。

## 区域布局

左256为system/归约/提交节点库；中部画布；右344选中system访问与执行方式；下部264执行计划和诊断。

全局顶栏56、上下文栏48、左功能栏72、底状态栏28。正文剩余区域独立滚动；画布/视口不触发整个页面滚动。左右面板可拖拽，最小220/300；分隔6。1440宽时右检查器收为320，底栏收为220，保留主要字段横向滚动。低于1280显示收起侧栏的单工作区，禁止缩小字体塞满。表头与底部主要操作固定。

## 组件与实际内容

cool-A与cool-B处同一并行组，分别连接reduce-cooling，再到commit；每个system卡片列查询3实体、读previous、输出温差贡献；图例：灰实线执行先后，青实线效果收集，紫虚线显式产物；单纯顺序边不改变读取视图；右侧显示实体/组件/属性访问范围；底部解释“同属性贡献可并行”。

组件按用途复用：WorkspaceShell、ContextBar、ObjectTree、TypedValueCell、ObjectLink、ValidationList；有图的页面再使用GraphCanvas/NodeCard，运行页使用CommitSelector/RunStateBadge。具体组件参数、事件与数据所有权见组件规格。本页不能自绘一套不同行为的单位或对象链接。

## 操作与跳转

拖入已有system；连线时选边语义；双击system→P14；单击归约→P16；计划预览→P13；切换线性布局只重排，不隐式变更语义；切换执行顺序需保存命令；发布→P18。

导航离开有未保存草稿时，提供保存草稿/放弃本次编辑/留在本页。保存失败保持本地编辑态。返回上页恢复筛选、滚动、选中对象与画布视角。Ctrl+S保存当前草稿；Ctrl+Z/Shift+Ctrl+Z只作用当前编辑上下文，输入框内优先文本撤销；Delete只有画布或表行焦点时删除选中项。弹层关闭不自动保存。

## 绑定与更新

03_programs.schedule/system.access；图位置在layouts.json，业务边在schedule；parallelGroups由编译器推导，前端不自行猜测。

读路径的具体JSON Pointer及连接键见 ../contracts/page_bindings.json。加载使用统一五态：loading、ready、empty、error、stale。先取得完整上下文再请求，异步响应携带contextKey；切分支或commit后丢弃旧请求结果。前端缓存key含modelVersion/branchId/commit，禁止只按entityId缓存历史值。

## 错误、权限及边界

执行依赖成环拒绝保存；exclusive与contribution重叠报冲突；未知插件访问范围按保守范围显示串行原因。

历史页与观察者下禁用修改控件并给原因；只读不是隐藏内容。错误反馈定位到字段/端口/对象并保留用户输入。空值用“未设置”，不适用用“—”，等待裁决用“待裁决”；不得把这些值转成0。

## 可执行验收

添加cool-A→cool-B顺序边后拆成两个执行组，但B仍读100°C；不允许把A暂存50°C显示为B输入。

还需检查：刷新后上下文与标题一致；列表与详情使用同一版本；键盘可到达主要操作；颜色之外有文字/图标区分状态；加载失败能重试且不改原状态。关键画面若已提供，见 ../prototypes/；画面是指定数据与状态的参考，不代表全部状态都已绘制。
