# Figma原型施工与验收

## 文件与页组织

Figma文件包含00_Foundations、01_Components、02_Modeling、03_Logic、04_Run、05_Trace、06_PrototypeFlows七组。Frame命名`P22/Debug/F01/Cool-A/Committed`；其他状态另建variant frame，不直接覆盖基准画面。PNG作为参考层锁定，重建可编辑组件；不是把整张PNG当成交互页面。

28个页面以pages文档为布局和行为依据；关键页PNG用于检查空间和数据呈现。画面不覆盖全部错误、弹层、移动和空态，缺图状态按05_ui_states和逐页规格补全，禁止照着成功图推测失败行为。

## 开工顺序

先建色彩、文字、间距和状态变量；完成WorkspaceShell、ContextBar、TypedValue、ObjectLink、Table和Validation；再建system节点、逻辑节点、绑定选择器、贡献行、策略卡和提交选择器。优先完成P03→P05→P07→P12→P14→P15→P18→P20→P22→P23→P24→P26→P27贯通路径。

Figma变量按上下文分组：ctx.mode/branch/commit/entity/system；scenario.case；values.temperatureOld/selfPreview/requested/approved/final；policy.status。变量不能代替结构化mock文件；大表和图用JSON数据填充插件或手动从指定record导入，并标dataKey。

## 必做交互

1. 修改温度属性默认值后保存草稿；发布前校验。
2. 模板“恢复继承”和“设为空”为不同操作；地图显示数量随position=null变化。
3. 外层双击system进入内部图，返回保留画布视角。
4. 绑定选择器展示兼容、量种错误、可空错误及取消保留原值。
5. cooler-B启停改变试算，不只改变开关外观。
6. 推算经过冻结/计算/提交/播放四态；播放暂停后commit不变。
7. 调试切F01/F02/F03，表和端口值联动。
8. 请求贡献→获准贡献→最终值均可追溯。
9. 策略换班的预测、到达、交接和无车失败各有实际画面。
10. 历史查看不改head；从c042新分支重算对比30 K差异。

## 图层与热点

所有热点指向navigation.json中真实目标；禁用控件无热点；未实现真实断点续算保留“待执行器接入”说明。关闭弹层恢复触发点。图连线端点必须落在端口中心，数据边/执行边有图例；不能连到卡片标题假装传递值。

## 逐帧审查表

每个frame标注pageId、caseId、branchId、viewCommit、entityId、systemId及页面规格路径。审查状态与内容是否一致、表格列是否有单位、可见实体数是否正确、颜色是否有文字解释、历史值是否使用旧commit、参数变化后数值是否刷新。

1920×1200是关键画面基准；额外做1440×900工作站版，按面板规则收起/滚动，不等比缩小全文。小屏适配是新增验收，未提供对应画面前不得标已完成。

交付应含可点击链接、组件库、逐页完成清单、全部mock文件、无法实现交互列表。Figma本身不执行仿真；对计算动态行为要求可用前端原型接同一份mock adapter展示，并标明能力范围。
