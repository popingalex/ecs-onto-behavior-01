# 06 集成决策(V7-0)

日期:2026-10-22 ｜ 依据:02-05 文档 ｜ 全部 decisionStatus=PROPOSED(待用户批准)

## 1. 集成方式裁决

| 候选 | 判定 | 理由 |
|---|---|---|
| **A. 离线 FileAdapter** | **✅ 首选(本轮裁定)** | 样例 B/C 磁盘工件自包含;不启动引擎即可完成 J0–J6 只读验收;版本/校验和可控 |
| B. 本地服务 API(NativeAdapter) | 第二批评估 | 引擎 API 稳定可读(`/sim/:id`、`/branch/:b/deltas`、`/attribute-definitions`、`/api/v2/…/branches`);但首切片无需进程耦合;多人/生产实例在跑,避免审计轮干扰 |
| C. 进程/插件/共享内核 | 暂不 | WASM kernel crate 存在但面向前端播放;工作台嵌入无确凿收益 |
| D. 直读数据库 | 仅导出动作用 | SELECT 只读导出样例 C 的 tick 行;运行时不把 PG 当适配层 |

## 2. 首个实现切片(V7-1)

**目标**:把样例 A(scene+schema)+样例 B(运行)导入工作台,P02/P03/P29/P05/P08/P10/P11/P12/P20/P22 以真实数据显示,全程 REAL_IMPORT_READ_ONLY 模式,无 mock 回退。

**新增(不动既有语义)**:

1. `src/services/nativeImport/`(新目录):
   - `modelPackage.ts`:fixtures/shared+chem-roaded+PG 场景行 → PrototypeModel DTO 归一化(archetype→EntityType、组件→ComponentSchema、实例覆盖→initialOverrides;单位映射表+UNKNOWN 策略;网格属性→blockRef 元数据)。
   - `runBundle.ts`:运行目录(frame_data/attribute_deltas/meta/execution.log)→ RunBundle{sourceSystemId:"mas-rust", sourceRevision, runId, branchId, frames, traceCompleteness:"PROPERTY_DELTA"|"SYSTEM_EFFECT"};帧→commit 映射(一帧一 commit,Pre/Post 附带)。
   - `capabilityManifest.ts`:静态能力声明(schemaRead=converted、entityWrite=unsupported、traceNode=unsupported…)。
2. `ExecutionAdapter` 注册表增加第三个适配器 `readOnlyImportAdapter`(不 settle:返回诊断 `REAL_READ_ONLY`,防止任何写路径假装执行)。
3. 数据源标识:`MOCK_SANDBOX | REAL_IMPORT_READ_ONLY` 贯穿 StatusBar/P20/P22 页头;导入失败显式红条(禁 F01/F02/F03 顶替,REAL-07)。
4. IndexedDB:真实导入缓存独立 store 前缀 `native:`,与本地草稿历史隔离;页面显示「本地缓存,非源系统权威」(REAL-12)。

**不改动**:mock executor、draftRegistry、既有页面结构、IndexedDB 既有 6 store、MapViewport(保持回落渲染)。

## 3. 最小接口契约(候选,随 PR 定稿)

```text
NativeModelPackage v0.1(目录或单 JSON)
  manifest{sourceSystemId, sourceRevision(git SHA), sceneVersion, schemaVersion, exportedAt, checksums[]}
  capability{...同上静态声明}
  schemaCatalog{entityTypes[](含组件成员), components[](含属性默认值)}
  scene{instances[{id, name, archetype, attributes[{path, value}]}]}
NativeRunBundle v0.1
  manifest{...同上 + runId, branchId, baseFrame, frameCount, traceCompleteness}
  frames[{frame, layer, sourceSystemId?, deltas[{instanceId, attribute, value}], meta{perf, instanceCount}}]
  snapshots{frame0: 全量 frame_data 引用}
  sourceIdentityMap[{nativeId=InstanceId(原样), workbenchRef=id@importVersion, reverse:必填}]
```

要点:实体稳定 ID=引擎 InstanceId 零转换;`sourceRevision` 必填;traceCompleteness 由来源自动定级(PG 源→SYSTEM_EFFECT,磁盘源→PROPERTY_DELTA);无请求→获准对、无 inputVersionRefs 字段(缺即不造)。

## 4. 语义决策记录(对齐 04 文档裁决)

| 决策 | 选择 |
|---|---|
| 引擎帧内写传播 vs 工作台 order-only | 不编译,只读渲染等效计划+差异标注 |
| 效果对缺失 | P23 降级 SYSTEM/PROPERTY 级,禁止反推 |
| 单位未知 | quantityKind=UNKNOWN,校验豁免+UI 标注,不猜 |
| 一帧=一 commit | 是;运行失败帧标 failed 不显示成功 |
| 工作台缓存 vs 源权威 | 源权威=引擎 PG/工件;缓存只读可清 |
| MapEngine | V7-5;首轮 SpatialViewport 回落够用 |

## 5. 风险与对策

| 风险 | 等级 | 对策 |
|---|---|---|
| 真实导入失败静默回落 mock | 高(验收杀手) | 导入层无 fallback 分支;e2e 负例:删工件→必须红条 |
| 属性路径无 schema 声明(动态属性) | 中 | 归一化器收集未知路径→"未声明属性"清单,不丢弃不杜撰 |
| 网格块尺寸(contours JSON 每帧 ~96KB) | 中 | blockRef+按需加载;P20 只显示摘要 |
| source_system_id 归因粘连 | 低 | 保留原值+UI 注明来源=执行上下文 |
| 两工程并行演进(引擎 HEAD 会前移) | 中 | manifest 钉 sourceRevision;导入器对未知 schemaVersion 拒绝 |
| 双人/多角色命令语义引入 | 低 | 首轮不导入 CommandLog(留 V7-2 可选) |

## 6. 后续批次顺序建议(对计划 §13 的落定)

1. **V7-1**(首个 PR,见 first_pr_proposal.md):FileAdapter+真实 ECS 只读。
2. **V7-2**:RunBundle+P20/P22/P24 真实运行;样例 C(SYSTEM_EFFECT)+P26 分支只读;J0–J6 闭环取证。
3. V7-3(编辑发布)/V7-4(图编译,lc-* workflow 为映射目标)/V7-5(挂 map-engine-v2):按能力闸门另行报批。
4. 加固轮:REAL-13..18 按范围裁剪。

## 7. 三个决定性问题的回答(计划 §14)

1. **原系统可否无损提供模型/场景身份与 schema?** 可以:InstanceId 同构+PG/fixture 双源 schema;无损度除单位(UNKNOWN 策略)与 presence 推导(规则固定)外无损失。
2. **可否提供一次可复现真实运行?** 可以:样例 B 自包含 10 帧;样例 C 17 帧 SYSTEM_EFFECT 级;重放路径代码级存在。
3. **哪些 System/追溯是真事实、哪些只能黑盒/降级?** 真事实:系统目录+reads/writes、PG delta 的 system 归因、workflow NodeTrace、per-frame perf。黑盒:native 系统内部、cdylib。降级:请求→获准、输入版本引用(不存在,禁止伪造)。
