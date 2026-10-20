# Mock数据、参考计算与页面数据绑定

## 文件职责

|文件|用途|可编辑性|
|---|---|---|
|01_model.json|量种、单位、属性模式、类型、关系、模板、约束|作为建模草稿初始输入|
|02_world.json|c042旧世界，8实体、策略、时间队列、随机状态|每个case复制后修改|
|03_programs.json|实体查询、5类节点、图边、常量绑定、system、外层图、补给提案|参考器实际读取参数与节点|
|04_cases.json|6条可重复业务变体及patch|增删测试变体|
|05_ui_states.json|loading/empty/error/stale/只读/观察者/断线|只改变UI状态，不伪造成功提交|
|06_catalog.json|资产、manifest、命令、访问诊断|UI目录和演示错误来源|
|07_history.json|唯一提交ID、父引用、分支、运行引用|由参考结果构建|
|08_journeys.json|操作脚本、入口、预期结果|Figma连线验收依据|
|runs/*.json|实际计算结果、贡献、trace、事件、任务、检查点|由simulate.py生成，不手工改数字|

所有文件UTF-8、JSON标准格式。量值metadata在模式层复用，不在每个数值复制单位和约束。UI selector根据property definition包装ValueRef。mock原始实体使用便于阅读的temperature/water/position短字段，contracts/field_map.json明确映射到稳定属性ID，正式API可使用列式typed buffers。

## 主业务数据

8实体包含3火源、3车、1补给站、1指挥单元。C01.position=null，因此7个有空间表现；其逻辑仍存在。F03未发现但active=true，q-fire仍选中它；持续保障样例只针对F01，不假称全园区火源已保障。

V01水箱10000 L，初水5500 L，耗水100 L/s。V02初水9000 L，从局部[240,180,0]沿40 m路线在4 s到达[280,180,0]处置点；火源F01位于[320,180,0]，明确保留40 m作业距离。10秒回合内，V01耗400 L，V02交接后耗600 L。温度降到20°C不自动熄灭，active字段在本样例保持true。

## 执行顺序与能力范围

1. 读取c042，按case patch构建独立输入。patch以inputPatch保存，是共同基准c042之后的分支干预输入，不会修改共同历史。
2. 按q-fire选择3火源，对每个启用system执行五节点图。节点端口值进入trace。
3. 各system只读旧温度并形成请求，私有预览不相互可见。
4. 按entity/constraint分组，计算可降温额度与比例，生成获准贡献、最终温度及依赖。
5. 独立策略模块从旧车辆事实预测阈值、选择合格车辆，生成领域事件子步和实际耗水。该模块是mock领域逻辑，不宣称通用行为图执行器。
6. 输出单个不可变结果；不同case使用唯一commit。独立补给试算只展示资源分配，不混入本回合状态。

参考器真实执行ReadPrevious、CoolingRoom、Min、Negate、Contribute。暂不支持任意节点类型、通用控制流、脚本、真正并发、图循环、真实断点续算或生产数据库事务。unsupported node报错，不能默默跳过。外层运行当前为固定贡献模式，不宣称执行任意schedule的控制语义。UI规格要求的其余能力由正式core实现。

## 页面绑定与事件契约

contracts/page_bindings.json列出28页的JSON Pointer；components.json列组件属性与事件；navigation.json列跳转参数。组件先用contextKey选择数据，再按稳定ID连接：entityId、propertyId、systemId、nodeId、executionId、effectId、constraintId、commitId。

例：P22选择F01/cool-A后，trace.executionId连接exec-F01-cool-A；effect.executionId连接该执行；temperature.entityId连接F01。approved来自裁决，final来自temperatures；绝不拿selfPreview覆盖final。P24依赖边指向c042输入版本与对应case输出commit，不指向当前最新值。

草稿修改用`{commandId,baseRevision,targetId,patch}`；运行操作用`{commandId,idempotencyKey,baseCommit,actorId,type,args}`。参考模拟器的case patch是UI开发便捷入口，不等于已实现完整命令服务器。06_catalog.commands仅用于队列状态展示。

## 六种结果

|case|F01/F02/F03最终°C|V01末水L|策略|
|---|---|---:|---|
|baseline|20/20/20|5100|满足|
|one-cooler|50/30/20|5100|满足|
|no-replacement|20/20/20|4500|未满足|
|lower-power|30/20/20|5100|满足|
|contract-competition|20/20/20|5100|主回合满足；独立补给800/400 L|
|missing-position|20/20/20|4500|二车无位置被排除，未满足|

Figma可以用这些结果建立变体，但数值由参考器生成。真正可交互原型前端改参数后需重新运行selector/参考器或Rust mock adapter，不能只播放固定成功图。

## 重现与验证

在本包根目录执行`python reference/simulate.py --all`与`python reference/validate.py`。脚本只使用Python标准库。qa报告列出实际通过的检查与故意造错验证；不把这些结果转写成Rust/WASM一致性或性能结论。
