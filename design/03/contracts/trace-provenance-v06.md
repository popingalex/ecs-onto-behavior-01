# 追溯字段契约（v0.6 · W3）

来源：`design/03/01_v06_implementation_plan.md` §7.1。实现侧 DTO：`src/services/mock-executor/types.ts`；
执行器：`src/services/mock-executor/executeRound.ts`；不可变存储：`src/stores/trace.ts`（同 id 幂等、只增不改，W4 起 IndexedDB 持久化）。
本文不另造第二套模型：规范英文名词 → 现有字段的映射见核对表，等效字段原样保留。

## 1. 每类记录的最小关联信息（核对表）

| 规范记录 | 规范要求 | 现状字段 | 结论 |
|---|---|---|---|
| Run / Commit | runId | `RunRecord.runId` | 齐备 |
| | branchId | `RunRecord.branchId` | 齐备 |
| | baseCommit | `RunRecord.baseCommit`（世界快照一致性由 `BASE_WORLD_MISMATCH` 强校验） | 齐备 |
| | resultCommit | `RunRecord.resultCommit`（trace store `byCommit` 索引键） | 齐备 |
| | modelBundleId/hash | 等效：`RunRecord.modelVersion`（schemaVersion）+ `inputVersions.schema`（units/entityTypes/components/attributes/templates 语义哈希）。bundle 引用固定在 `RunDef.bundleId`（P19 创建时选定，bundle 本身不可变），record 以语义哈希锚定模型内容 | 等效字段 |
| | scheduleVersion/hash | `RunRecord.scheduleRef`（`id@version`）+ `inputVersions["schedule:<id>"]`（`id@version#hash`） | 齐备 |
| | 模拟时间与输入 | `simTimeBefore/simTimeAfter`；输入 = `inputVersions`（schema/scene/systems 语义哈希 + 每个 `program:<id>` 与 `schedule:<id>` 的 `id@version#hash` + baseCommit） | 齐备 |
| SystemExecution | systemId/version | `systemId`；SystemDefinition 无独立 version 字段，其"版本"由 `inputVersions.systems`（queries+systems+constraints 语义哈希）锚定——任一 System/query/constraint 变化都会改变该哈希 | 等效字段 |
| | queryId/version | 未直接存于 SystemExecution；由 `inputVersions.systems` 哈希锚定的 SystemDefinition.queryRef（`id@version`）关联，哈希可验证任意一份 systems 定义是否即当时版本 | 等效字段（哈希锚定，未内嵌 query 快照） |
| | programId/version | `SystemExecution.programRef`（`id@version`），且 `RoundResult.programs[programRef]` 内嵌执行时程序快照 | 齐备 |
| | entity batch | 每 System×实体一条 SystemExecution（`entityId`）；批次 = 同 systemId 的 execution 集合 + `RunRecord.logicalParallelGroups` | 齐备 |
| | 执行顺序 | `logicalParallelGroups`（并行组→归约→原子提交）+ `NodeExecution.seq`（规范顺序全局递增） | 齐备 |
| | 读取状态/上下文 | `SystemExecution.inputCommit`（= baseCommit）+ 节点级 `inputVersionRefs` | 齐备 |
| NodeExecution | nodeId | `nodeId` + `graphRef`（图版本） | 齐备 |
| | 实际输入/输出 | `inputs`/`outputs`（求值后原始值，EffectRef 输出为效果 id） | 齐备 |
| | 单位/量种 | `outputUnitId`（图快照第一输出端口声明）；完整端口单位由记录内嵌图快照 `programs[graphRef]` 的端口 TypeRef 声明提供（P22 `portUnit` declared 路径） | 齐备 |
| | inputVersionRefs | `inputVersionRefs`（沿数据边传递累积，含 ReadPrevious/ReadSelfPreview 的 `entity.property@baseCommit`） | 齐备 |
| | 顺序 | `seq` | 齐备 |
| | 完成/跳过/错误 | `status:"completed"` 是唯一取值：执行器任一环节失败则整回合失败、不产生半个 RoundResult；停用的 System 不进入执行。语义 = "有记录即完成；失败无记录"，不编造 skipped/error 占位 | 等效语义（单一完成态 + 全或无） |
| EffectRequest | 请求 effectId | `id`（单 Contribute 时 `eff-<entity>-<system>`，多 Contribute 加节点后缀） | 齐备 |
| | 来源 execution/node | `executionId` + `nodeId`（+ `systemId`/`entityId`） | 齐备 |
| | 目标属性 | `propertyId`（Contribute 绑定 root=self 强校验） | 齐备 |
| | 请求量与单位 | `requestedDelta` + `unitId`（图快照 delta 端口声明，缺声明记 null 不回填） | 齐备 |
| ConstraintDecision | decisionId | `id`（共享实体多属性时含 propertyId 后缀） | 齐备 |
| | 约束/归约规则版本 | `constraintRef` = `refKey(constraint)` = `id@version`（归约规则版本内嵌） | 齐备 |
| | group | 等效：裁决组键 = `constraintRef\|entityId\|propertyId`（executeRound 分组键），记录上以 `entityId`+`propertyId`+`constraintRef` 三字段承载 | 等效字段 |
| | 获准/拒绝/部分 | `allocations[].status` = approved/partial/rejected + `approvedDelta` | 齐备 |
| | 比例/额度与理由 | `scale`/`budget`/`candidate`；理由 = `RoundResult.diagnostics`（如 `POSITIVE_DELTA_REJECTED` 带实体化消息） | 齐备 |
| PropertyChange | 对象/属性稳定 ID | `entityId` + `propertyId` | 齐备 |
| | 前后属性版本和值 | `old`/`new`；后版本 `versionId` = `entity.property@resultCommit`；前版本可由 `entity.property@baseCommit` 推导（record 存 baseCommit） | 齐备（前版本为可推导等效） |
| | 提交 ID | 内嵌于 `versionId` 的 `@resultCommit` | 齐备 |
| | effect/decision 来源 | `decisionId` → `ConstraintDecision.allocations[].effectId` → EffectRequest（decision 来源直接，effect 来源经 decision 一跳可达） | 齐备 |
| Graph/Schema snapshot | 运行当时的节点/端口/绑定 | `RoundResult.programs`：执行时程序快照（parameters/nodes/edges，含端口 TypeRef 单位声明），P22 只读展示即消费它 | 齐备 |
| | schema 与单位定义 | 未内嵌快照；由 `inputVersions.schema` 语义哈希锚定（可由不可变 bundle manifest 的 semanticHash 对应）。展示层单位 symbol 取自当前 `index.units`——unitId 来自记录（稳定），symbol 渲染跟随当前定义；种子单位定义不变，异变时属展示层限制而非记录解释错误 | 等效字段（哈希锚定；symbol 渲染为已知展示层限制） |
| DependencyEdge | 实际读取→执行/决策/输出 | `used`（inputVersionRef→executionId）、`proposed`（executionId→decisionId）、`generated`（decisionId→versionId） | 齐备 |

## 2. 实际读取依赖 vs 声明读写集合

- **记录只存实际读取**：`NodeExecution.inputVersionRefs` 与 `used` 边是执行时真实发生的读取（沿数据边传递累积）。
- **声明集合不存入 record，但可精确重建**：`compileSchedule(schedule, model)` 的 `PlannedSystem.reads / contributes / exclusive`（来自 SystemDefinition.access 声明，P13 已展示）。record 以 `scheduleRef` + `inputVersions`（含 systems/schedule 语义哈希）锚定重建输入，对同一冻结模型重算 compileSchedule 即得当时的声明集合，可与实际读取比对（声明 ⊇ 实际）。结论：关联信息齐备，**不需改 DTO**。

## 3. 近似 / 事实两态（单位治理）

- **事实（declared）**：端口单位来自记录内嵌图快照的端口 TypeRef 声明；`NodeExecution.outputUnitId`、`EffectRequest.unitId/previewUnitId`、`ConstraintDecision.budgetUnitId/valueUnitId`、`PropertyChange.unitId` 全部在 `executeRound` 内从冻结输入（图快照端口 / 属性定义）取出。
- **近似（heuristic）**：`portUnit()`（`src/pages/p22/traceView.ts`）在端口不在图快照时回落猜测（old/source→degC，其余随节点第一输出单位），返回 `source:"heuristic"`；P22 在端口标签旁渲染 `≈`（title 注明"启发式回落"）。**该状态只存在展示层**：record JSON 没有任何 heuristic 标注，执行器不知道启发式的存在（机读证据 `record-units-sample.json`：全记录无 `heuristic` 字样）。
- **不回填**：图快照端口缺单位声明时，记录字段记 `null`——不拿当前 schema、不拿启发式回填（回归测试 `missingDeclaredUnitStaysNullInRecord`）。契约判定：v0.6 的"不完整状态"由展示层承担（declared-null = 声明无单位，直接无单位渲染；端口缺失 = `≈` 标注）；executeRound 不满足"静默回填"禁令，无需改 DTO。

## 4. 不完整状态语义

- **缺记录**：提交无关联 RoundResult（基准提交/失败回合）时，P22/P23/P24 显示"没有计算过程记录"，明确"不是 0 值"。
- **缺值**：`worldValue`/`toDisplay` 区分 `value`（0/false/[0,0,0] 皆为有效值）、`null`（未设置）、`notApplicable`（未装配）、`unrecorded`（未记录，不当 0）、`pending`（待裁决）、`unknownSource`、`invalid`；P27 对比任一侧非有限数值则差值 `null`（显示"—"）。
- **追溯缺口（W3.5 补缺）**：`traceabilityGaps(record)`（`src/pages/p22/traceView.ts`）审计"图快照里读了 previous 但 inputVersionRefs 为空"的节点；P22 访问日志区与 P24 演化链顶部列出具体 `executionId·nodeId`（及图快照声明的读取属性），明确"不可完整追溯、未编造依赖边"。图快照缺失时无法判定，不算缺口。
- **零净变化**：`final === old` 时不产生 PropertyChange 与 `generated` 边（无新属性版本），但 SystemExecution、EffectRequest（requestedDelta=0）、ConstraintDecision（allocations approvedDelta=0）与 `used`/`proposed` 边全部保留（回归测试 `zeroNetChangeKeepsRequestAndDecisionFacts`、`coldStartRequestsZero`）。

## 5. 不可变性

- trace store：同 recordId 写入幂等忽略；旧记录绑定旧 `inputVersions` 与内嵌程序快照，当前草稿/新执行不改变旧记录（`recordsAreImmutable`）。
- 执行快照：`RoundResult.programs` 内嵌执行时图版本；P22 端口单位与图结构只读消费该快照，旧 schema 单位不被新 schema 重新解释（`historicalUnitsStayWithRecordSnapshot`）。
- 布局与语义分离：布局只改 `EditorLayout`，语义哈希不含布局（`layoutOnlyEditKeepsSemanticHash`）。
- P18 bundle：`publishStore` 只增不改、同 id 幂等，无修改入口（`publishBundleIsImmutableAndIdempotent`）；run 经 `RunDef.bundleId` 引用固定 bundle，不引用草稿对象。
