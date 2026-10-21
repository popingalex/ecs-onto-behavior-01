# 数据拆分、绑定与计算过程契约

## 单一模型来源

读取mock/prototype_seed.v05.json，构建schemaIndex、sceneDraft、logicProgramRegistry、systemRegistry、scheduleRegistry。src/mock/seed.ts停止维护第二套数字；仅保留兼容桥接。repository现有design/mock可作为迁移输入，本轮新文件是六实体的聚焦演示集，不覆盖完整园区策略线。

所有对象都带稳定ID，版本引用在loader规范化；JSON中的id@version解析成ObjectRef。属性类型位于attribute.type，baseWorld已经按组件/模板/实例覆盖物化，不是稀疏override。属性定义、实体值、模板覆盖分库存储：attributeSchemas保存定义；componentSchemas保存成员；sceneDraft.entities保存组件实例和initialOverrides；baseWorld/nextWorld保存运行值。运行时不能修改attributeSchemas。

有效值顺序：显式实例覆盖(含null)→模板覆盖→属性默认。组件未装配时属性不适用；装配可空位置且值null是未设置；[0,0,0]是合法位置。不能只用world.values中是否存在属性推断组件组合。

实体类型支持 parent 继承：EntityTypeDef.parent 指向父类型 id（可空）。子类型的有效装配 = 自身声明 + 父链补充（就近声明优先，必需压过可选）；继承来的必需组件在子类型与实体上同样不可移除。继承环报 ONTOLOGY_CYCLE（error），父类型缺失报 TYPE_REF_MISSING；删除仍被继承的父类型被引用扫描阻止。种子当前不携带 parent 示例。

## 旧数据迁移

|旧来源|问题|本轮处理|
|---|---|---|
|src.seed Combustion / combustion.active|与design FireState/fire.active不同|统一FireState/fire.active，迁移表保留旧key→新key|
|src.seed task.assignment|design使用task.target|核心六实体冷却样例暂不消费任务关系；策略扩展时显式迁移，不静默丢失|
|src.seed SupplyStation/CommandUnit|design为Station/Command|本轮保留Command，补给站不在六实体主线中；完整迁移另列|
|src.seed属性water.remaining.default=10000|design模板为8000、实体另有覆盖|本轮属性/模板默认8000；V01=5500、V02=9000为实例覆盖|
|src.seed实体名/位置与design不同|场景和示意图可能不对应|核心火源以新fixture坐标/名称为准，变更有记录|
|src.seed预写c043结果|无法反映用户修改图|仅作为回放参考，编辑运行从c042动态求值|

迁移不可用显示名匹配。旧binding和graph端口名统一解析，找不到节点/字段时报失效引用；不生成“看起来接上”的新字符串。

## 图文档分离

ScheduleDocument只含system实例、归约/contract、commit和order/effect/product边。LogicGraphDocument含读属性、参数、运算、条件和效果节点及typed ports。EditorLayout独立保存。共享的是对象引用、校验诊断和命令协议，不是同一个节点类型联合表。

FlowGram文档与LogicGraphDocument之间建立encode/decode；React Flow文档与ScheduleDocument之间另建adapter。导出再导入必须保留业务语义、nodeId/portId/binding和版本，不能丢掉单位或读取视图。

## 动态求值必须做什么

mock executor支持拓扑检查、query结果、五种冷却节点、previous/selfPreview封装、effect收集、比例裁决与原子结果。逻辑并行可串行参考执行，但执行组应由schedule推导；order边改变组序，effect边确定归约输入。顺序不改变previous读取。unsupported node/product/循环明确报错。

每次执行重新消费当前保存或明确试算草稿的model/program/schedule，并冻结版本快照。修改maxDropK不允许查一张固定case表猜结果。可以预加载expected_runs做“查看样例”，但“执行当前图”按钮必须调用真实求值适配器，二者分开标注。

## 返回与持久化

返回RoundResult包含下一世界、执行批次、节点轨迹、effect请求、decision、property changes、输入版本依赖。前端先完整存储record及其索引，再更新commit/head；中途失败保持baseCommit。elapsedMs可为null，页面显示“未测量”，不可写虚构耗时。

P20显示概览；P22使用recordId→system execution→entity→node的层级；P23通过effectId连接请求和获准；P24通过属性版本与executionId/decisionId构造来源。筛选变化只改变selector，不改原始记录。缓存键含recordId/branch/commit，不能只按F01索引。

执行中的进度事件为临时UI状态，不是已提交事实。完成前approved/final是pending。记录回看按seq步进，不能把进度光效或setTimeout称为真实断点执行。旧记录绑定旧program版本，不能拿新画布解释旧执行。

## 可复算的主线

本例是同温恒温冷源训练额度模型：单路requested = −min(max(old−20,0), maxDropK)。两个system均读旧值，各有私有preview=old+requested。额度=max(old−20,0)，按比例分配，最终=old+Σapproved。

|实体|旧°C|A请求K|B请求K|A预览°C|A/B获准K|最终°C|
|---|---:|---:|---:|---:|---|---:|
|F01|100|−50|−50|50|−40 / −40|20|
|F02|80|−50|−50|30|−30 / −30|20|
|F03|60|−40|−40|20|−20 / −20|20|

若初温已低于20°C，冷却请求为0，不应因限幅反向升温；约束只限制本轮冷却贡献。

停用B：50/30/20°C。将A最大降温改20K：30/20/20°C。节点输入、请求、获准和final同时变化；不能仅更新最终卡片。

mock/expected_runs.v05.json给出3组预期完整过程。它是本次计划附带的契约样本，尚未接入仓库；其中时间步10秒，elapsedMs未测量。该文件由计划生成脚本按公式计算核对，不证明正式应用执行器已实现。

## 过程UI绑定例

选record-baseline/cool-A/F02：n-old=80°C；n-room=60K；n-cap=50K；n-neg=−50K；n-emit输出eff-F02-cool-A；自身预览30°C；decision-F02比例0.6、获准−30K、最终20°C。选择F01后这些值必须切回100/80/50/−50、预览50、比例0.8、获准−40。

把n-old.value(绝对温度)接到n-emit.delta(温差)必须被拒绝。把cool-B暂存绑定到A输入必须不可选。删除n-neg→n-emit边后显示必需输入缺失并禁止运行。错误实例在mock/error_cases.v05.json。
