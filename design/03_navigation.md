# 页面跳转与上下文契约

路由是客户端内部逻辑路由，原生版不要求真实URL。示例：`workbench://park/run/run-main/branch/main/commit/c043/trace/F01/thermal.temperature`。浏览器宿主可映射hash；统一参数结构不变。P15模态与P21抽屉不替换底层页面。

|源页|用户动作|目标|必带参数|
|---|---|---|---|
|P01|open-model|P02|classId=Fire|
|P01|edit-scene|P07|sceneVersion=scene-04|
|P01|open-run|P20|runId=run-main, branchId=main, viewCommit=c043|
|P01|create-run|P19|bundle=model-04|
|P02|edit-component|P03|componentId=Thermal|
|P02|open-instance|P08|classId=Fire|
|P03|unit-settings|P04|propertyId=thermal.temperature|
|P03|locate-reference|P14|graphId=g-cool, nodeId=n-old|
|P04|try-constraint|P23|mode=sandbox, constraintId=cooling-floor|
|P05|instantiate|P07|templateId=tpl-foam, version=t3|
|P05|component|P03|componentId=Water|
|P06|instantiate|P07|sceneTemplateId=tpl-park|
|P06|schedule|P12|scheduleId=schedule-main|
|P07|entity-list|P08|entityId=F01|
|P07|asset|P09|assetId=asset-truck, version=a2|
|P07|schedule|P12|scheduleId=schedule-main|
|P07|validate|P18|draftId=scene-draft|
|P08|trace-property|P24|entityId=F01, propertyId=thermal.temperature, viewCommit=c043|
|P08|task|P28|taskId=task-replace-V02|
|P09|place-asset|P07|assetId=asset-truck, version=a2|
|P10|bind-property|P15|expectedType=bool, returnPage=P10|
|P10|bind-system|P11|queryId=q-fire|
|P10|open-result|P08|queryId=q-fire, viewCommit=c042|
|P11|edit-graph|P14|systemId=cool-A, graphId=g-cool|
|P11|query|P10|queryId=q-fire|
|P11|schedule|P12|systemId=cool-A|
|P11|access|P13|systemId=cool-A|
|P12|open-system|P14|systemId=cool-A, graphId=g-cool|
|P12|open-reducer|P16|constraintId=cooling-floor|
|P12|diagnostics|P13|scheduleId=schedule-main|
|P12|publish|P18|draftId=schedule-draft|
|P13|locate-node|P14|nodeId=n-emit, systemId=cool-A|
|P13|locate-edge|P12|edgeId=conflict-edge|
|P14|bind|P15|nodeId=n-emit, portId=delta, expectedType=deltaK, returnPage=P14|
|P14|try-run|P22|mode=sandbox, systemId=cool-A, entityId=F01|
|P14|publish|P18|draftId=graph-draft|
|P15|confirm|return|returnToken, structuredBinding|
|P15|cancel|return|returnToken, unchanged=true|
|P16|try|P23|mode=sandbox, constraintId=refill|
|P16|system|P11|systemId=cool-A|
|P17|target-query|P10|queryId=q-fire|
|P17|bind|P15|expectedType=ratio, returnPage=P17|
|P17|install|P21|commandType=InstallPolicy, policyVersion=p2|
|P17|monitor|P28|instanceKey=policy-cover@p2:F01|
|P18|fix-unit|P14|nodeId=n-emit, portId=delta|
|P18|published|P19|bundleId=bundle-04|
|P19|start|P20|runId=run-main, branchId=main, viewCommit=c042|
|P20|queue|P21|baseCommit=c043|
|P20|debug|P22|runId=run-main, branchId=main, viewCommit=c043|
|P20|trace|P24|entityId=F01, propertyId=thermal.temperature, viewCommit=c043|
|P20|history|P26|branchId=main, viewCommit=c043|
|P20|policy|P28|instanceKey=policy-cover@p2:F01|
|P21|close|return|returnToken|
|P22|decision|P23|entityId=F01, constraintId=cooling-floor, viewCommit=c043|
|P22|trace|P24|entityId=F01, propertyId=thermal.temperature, viewCommit=c043|
|P23|execution|P22|entityId=F01, executionId=exec-F01-cool-A, systemId=cool-A|
|P23|value|P24|entityId=F01, propertyId=thermal.temperature, viewCommit=c043|
|P23|compare|P27|leftCommit=c043, rightCommit=c043-one-cooler|
|P24|execution|P22|executionId=exec-F01-cool-A, entityId=F01|
|P24|decision|P23|constraintId=cooling-floor, entityId=F01|
|P24|event-link|P25|entityId=F01|
|P25|task|P28|taskId=task-replace-V02|
|P25|value|P24|entityId=V01, propertyId=water.remaining, viewCommit=c043|
|P25|branch|P26|branchId=main|
|P26|compare|P27|leftCommit=c043, rightCommit=c043-one-cooler|
|P26|return-head|P20|branchId=main, viewCommit=c043|
|P27|left-trace|P24|branchId=main, viewCommit=c043, entityId=F01|
|P27|right-trace|P24|branchId=branch-one-cooler, viewCommit=c043-one-cooler, entityId=F01|
|P28|definition|P17|policyId=policy-cover, version=p2|
|P28|event|P25|eventId=evt-handoff|
|P28|remedy|P21|commandType=DispatchReplacement|

## 全局入口

contracts/navigation_tree.json列出六组入口及全部页面，P15/P21为上下文弹层。全局入口进入页面时仍需先选择所需资产或运行，不自动以当前最新值解释历史。

## 状态与返回

每次导航先生成returnToken，保存来源路由、筛选、选中对象、滚动、画布缩放与相机。点击浏览器/客户端返回均恢复该状态。打开另一个commit的来源记录采用显式上下文跳转，不将headCommit一起修改。关闭弹层只销毁局部状态。

保存草稿后返回与放弃修改后返回有不同结果；失败时留在原页。历史下点击编辑创建新草稿或从此分支，不能原地覆盖。P26选择历史提交仅改变viewCommit；只有明确切分支才改变branchId。

深链接目标不存在时显示对象类型、原ID、原commit和回来源按钮；不得自动跳到同名最新对象。上下文缺失先展示选择器，不能拿“最新”填补历史查询。

## 非页面状态机

草稿：dirty→saving→saved→validating→valid或invalid；修改任何依赖后valid→stale；发布使用已校验revision创建不可变bundle。运行：waitingInputs→frozen→computing→committing→committed→playing→waitingInputs；失败回到原head并保留诊断。演示暂停只作用PlaybackStore，不改变已提交commit。

P22轨迹步进属于记录查看状态，不等于正在运行的执行器断点。真实断点需要execution handle、暂停检查点和继续协议，当前交付不冒充实现。
