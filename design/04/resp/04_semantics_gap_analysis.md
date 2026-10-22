# 04 语义差异分析(V7-0)

日期:2026-10-22 ｜ 对象:工作台 TS 参考执行器 vs mas-rust 引擎
范围:State[n]/System/效果/提交/值与来源六组差异,每组给出「冲突裁决建议」。

## 1. 执行视图:State[n] 与读写时序

| 维度 | 工作台(mock executor) | 引擎(native) | 引擎(workflow/lc-*) |
|---|---|---|---|
| System 读 | **一律读 baseWorld previous**(executeRound.ts:516,order 边不传播新值;有测试钉死) | 读当前 World(帧内 tracker 隔离:帧首 `clear_trackers`,系统产出经 deferred/flush) | 可配 ReadMode:Original(帧首快照)/Current/Effective(含预写 overlay)(behavior_workflow/io.rs:151-200) |
| 跨 System 传播 | 不传播(整轮冻结) | native 同帧内后续系统可见前序写入(flush 时机=属性写入路径) | overlay 内可见自己的 staged,Original 不可见 |
| 私有暂存 | `scratch.staged`(每 System 私有;ReadSelfPreview=previous+own staged) | 系统私有组件/资源(辐射缓存、ControlledPublishCache);workflow=每帧全新 WorkflowScratch | 同左 |
| 并行 | 逻辑并行组(拓扑分层,串行执行) | 阶段内依赖图波次(真并发调度) | 同左 |

**裁决建议**:FileAdapter 首轮只导入**结果**,不重执行,读时序差异不产生错误数据;但 P12"等效计划"渲染必须把引擎帧内传播标注为「Native 帧内可见性与工作台 order-only 语义不同」(03 文档 system.schedule.write=UNSUPPORTED 的根因)。V7-4 若编译图执行,必须逐系统声明 ReadMode 并在编译诊断中拒绝不可表达的 Original/Effective 混用。

## 2. 值与成员语义

| 语义 | 工作台 | 引擎 | 映射规则(导入方向) |
|---|---|---|---|
| 显式 null | 键存在且值 null(own 判定) | 可写 null 值但与"未写"难区分(动态表缺键) | frame_data 中显式 `null` → EXPLICIT_NULL;键缺失 → UNSET |
| 未装配组件 | componentInstances 不含 → NOT_APPLICABLE | archetype 成员决定 spawn(`has("…")`) | 导入 archetype 成员表;非成员属性 → NOT_APPLICABLE 不显示为 0 |
| 0/false/[0,0,0] | 合法 VALUE | 合法值 | 直传;**任何"缺值→0"回填禁止** |
| 默认/继承 | instance>template>default 三层 | archetype 定义默认+实例覆盖列表 | archetype 默认→AttributeSchema.default;实例覆盖→initialOverrides;templateRef=archetype id(引擎无中间模板层,**template 层留空**) |
| 单位/量种 | TypeRef 强约束+节点级拒绝 | 无 | 见 03 文档映射表;未登记=UNKNOWN,校验跳过且 UI 标注 |
| 温度 vs 温差 | quantityKind 区分(°C 绝对温度/K 温差) | 均为 °C 数值,靠属性名区分(ambient_temperature_c vs Δ) | 映射表逐属性定 quantityKind;ambiguity 时标 UNKNOWN 而非猜 |
| 位置 | park-ENU 米,nullable | [lon,alt,lat] 度(ECEF 投影另算) | 显式转换器+frameId 登记;null 保留不投影 |
| 网格/矩阵块 | 无 | environment 单例网格属性(matrix/grid/contours) | blockRef{nx,ny,cellMeters,bounds,引用运行帧};不展开实体 |

## 3. 效果与裁决语义(最大鸿沟)

- 工作台:唯一写路径 **Contribute→EffectRequest(提案)→ConstraintDecision(比例归约,budget=max(old−floor,0),正增量拒绝,approved/partial/rejected)→原子应用**。请求与获准都是一等记录(P23 可视)。
- 引擎:**无提案协议**。系统直接写 ExtraAttributes(write/write_deferred),帧末 flush + Post 层 delta(delta 带 source_system_id,但只有"最终值"没有"请求值")。多系统同属性冲突无通用裁决器——由系统编排保证互斥(reads/writes 声明+调度);`priority-arbitration` 基础设施系统存在但属内部机制。
- 用户命令侧倒是相反:引擎 CommandLog 有完整请求→合并/冲突/withdraw/accept 记录(带 commandId 幂等),工作台的"命令"只是 P21 队列暂存。

**裁决建议**(对齐计划 §5.3 的三选一):选 **③标记不支持** —— 导入运行在 P23 显示 SYSTEM_EFFECT/PROPERTY_DELTA 级事实(哪系统改了哪属性),并明示「原引擎无请求→获准记录,不可逆推 −50/−40」;**绝不**从温差反造 EffectRequest。工作台 mock 的贡献-裁决链继续仅存在于 MOCK_SANDBOX 模式。

## 4. 提交边界与原子性

| 维度 | 工作台 | 引擎 |
|---|---|---|
| 提交单位 | 一次 settle=一个 commit(世界 structuredClone 后原子替换;IDB facts→marker→head 单事务) | 一帧=Pre 层(命令/参数)+系统执行+Post 层(产出);`s_simulation_tick` 一帧一行 append;失败时 tick 中止并写 failed_systems delta(帧内原子,非跨帧事务) |
| head 语义 | 分支 head 指针移动(push-only) | BranchGraph head tick;推帧时 HEAD_CONFLICT 校验(非权威 head 拒绝) |
| 幂等 | idempotencyKey 字段存在 | commandId/requestId/revision 三层幂等(实测代码) |
| 失败路径 | 诊断错误,head 不动 | 帧失败→该帧不产出正常 Post;历史仍记录失败 delta |

**映射**:一引擎帧 ↔ 一工作台 commit(含 Pre/Post 两层 delta 作为 commit 附带变更集);RunBundle.resultCommit=最后一帧;运行失败帧以 failed 标记导入,P20 不显示成功。

## 5. 历史与分支

- 引擎 BranchGraph:fork(source_branch,source_tick) 任意分叉,DAG;PG branches jsonb 节流持久(每 25 帧/fork 时)。工作台:线性 commit 链+分支隔离(fork 自任意 commit)。
- **可无损导入**:fork 点↔工作台分支基点;帧号↔commit 序。**不可反向**:工作台本地新建分支/commit 绝不写回引擎(REAL-12)。
- 续算(restore_from_stage_deltas)是引擎能力;工作台首轮只读回放,UI 文案用「帧回放」不得称「分支续算」。

## 6. 追溯完整度分级对照

| 级别(计划 §4.5) | 工作台现状 | 引擎现状 | 导入后工作台呈现 |
|---|---|---|---|
| NODE_INPUT_VERSION | mock 生成(inputVersionRefs) | ❌ 不存在(native);workflow 有 NodeTrace(节点耗时/触发,非输入版本) | 仅 MOCK_SANDBOX 模式有;真实导入明示缺口 |
| SYSTEM_EFFECT | mock 生成 | ✅ PG 新格式 tick 行(source_system_id+frame_layer);✅ workflow NodeTrace 节点级 | PG 源运行可用;P24 按系统→属性逐层 |
| PROPERTY_DELTA | — | ✅ 磁盘 attribute_deltas.json(无 source) | 磁盘源运行降级为此级 |
| SNAPSHOT_ONLY | — | ✅ frame_data.json 全量帧 | 兜底级(仅状态比对) |
| UNKNOWN | 损坏处理 | legacy snapshot 列旧运行 | 标不可验证 |

**实测佐证**:PG 样例 delta `{"attribute":"casualty_threat/summary","frame_layer":"post","instance_id":"environment","source_system_id":"fire-extinguishing",...}` —— source_system_id 存在但存在**归因粘连**迹象(威胁摘要写挂在灭火系统上下文;ActiveSystemContext 按执行上下文归属)。导入时保留原值并注明「归因=执行上下文,非显式声明」,不做二次清洗。

## 7. 身份与版本

- 引擎包版本五元组:sourceSystemId=mas-rust、sourceRevision=git SHA、sceneVersion=s_scene 行版本(或运行 frame-0 哈希)、runId=simulationId(nanoid21)、branchId+frame。工作台现无此概念 → RunBundle 新增字段,MOCK 数据恒为 `MOCK_SANDBOX`。
- 实体稳定 ID=引擎 InstanceId 原样;工作台 `id@version` 的 version 侧对真实导入固定为导入包 schemaVersion,**不得**用工作台草稿版本号混淆。

## 8. 不可映射清单(明确拒绝项)

1. 引擎帧内写传播 → 工作台 order-only 调度图(拒绝编译,只读渲染)。
2. 请求→获准效果对(引擎无数据,禁止反推)。
3. 输入版本引用(引擎无数据,禁止生成)。
4. cdylib/deno 动态系统内部(P14 只显示 S0 摘要)。
5. 工作台草稿→引擎写回(REAL-18/首轮流以外)。
6. 温度量种歧义属性猜单位(必须 UNKNOWN)。
