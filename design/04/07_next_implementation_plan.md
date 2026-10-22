# ecs-onto-behavior-01:v0.7 后续真实系统集成与加固实施计划

> 文档版本:1.0(待源码定位后锁定)
> 编制日期:2026-10-22
> 推荐仓库位置:`design/04/07_next_implementation_plan.md`(先核实同名文件是否已存在)
> 工作台仓库:https://github.com/poppingalex/ecs-onto-behavior-01
> 核心输入:用户上传的 `ecs.01.md`(J3 实跑对照、V7-4 只读切片、V7-3/V7-5 闸门报告)
> 历史基线:新版 `REPORT.md`,报告曾列 `main @ ee2070e`、109 项测试;本次新报告列 125 项测试,但**没有注明最新完整 Git SHA**
> 审计边界:本次尝试 GitHub 页面、API、Raw、`git ls-remote` 未能取得实时源码;具体源码位置、行为和测试数量均**待本地 Agent 独立复验**
> 实施定位:继续让本仓库成为原有推演系统的 ECS 建模、System 编排和真实推演过程分析工作台;不把它扩建为第二套权威推演内核。

## 0. 结论:保留已经完成的内容,转入三个独立工作流

### 0.1 当前可确认的"报告声明"

- J3 从原引擎新建隔离推演并点燃 `tank-1`;6 帧 delta 数量为 `50/30/27/25/23/23`。
- 工作台 `buildRunC` 回放与引擎第 6 帧属性接口:**535/535 项写入值一致**。
- 390 条 delta 的 `source_system_id` 与引擎来源一致。
- 4 处名义差异来自 `attributes?frame=N` 返回 head,而不是历史帧;该端点帧选择能力需要治理。
- 引擎另有 **35,408 项物化默认值**;工作台采用 `UNSET` 不主动回填的表示策略。因此 535/535 不能扩大表述为"全世界所有有效值等价"。
- 在线 18080 服务仍是旧二进制,新会话写 legacy `s_simulation.snapshot` 而非新 `s_simulation_tick`,说明混版本同库是一个实在的运维/迁移风险。
- `field_thermal_live` 在运行时出现但未被旧静态目录收录,目前已被补入 catalog,需进一步形成通用发现机制。
- P12 已有 `NativeExecutionPlan.tsx`,展示 9 阶段 × 17 个静态目录 System;**只读**,原引擎的帧内写传播与工作台 `order-only` 语义不兼容。
- 逐 System 性能曲线未取得;已有服务 `meta.performance` 仅有总量指标,`runtime_trace.jsonl` 未启用。
- V7-3(模型真实写入/发布)和 V7-5(MapEngine 真实挂载)明确为 `NOT_RUN`,且有合理的权限/架构前置条件。
- 报告声明 J0–J6 纵向完成、REAL-18 PASS,但同段又写"REAL-01..12 全 PASS(REAL-06 PARTIAL)";验收统计需更正口径。
- 125 passed / 0 failed、tsc 与 build 通过、P12 浏览器操作通过均由报告陈述,**不是本次独立验证**。

### 0.2 建议把后续分成三条独立工作流

1. **H:历史/状态/原生调度只读可信度加固(立即执行)**
   含历史帧 API 语义、防误读、回放对账、运行时 System 目录、P12 可视化、真实来源与测试证据。
2. **W/X:模型安全写入与 System 可执行映射(条件开放)**
   只有用户明确允许操作隔离引擎和独立数据库,并且原生协议支持版本校验/事务/语义对照后才可正式开发。
3. **G:MapEngine 独立挂载和空间/历史联动(条件开放)**
   先固定宿主协议、来源版本、实体身份和坐标系,再接入 map-engine-v2;不得在工作台里另造 Cesium 地图应用。

**建议首先交付 `v0.7-H`:真实历史重放和原生执行计划"可靠可读"版本。**
v0.7-H 的通过不意味着可编辑原生 System、可写原生模型或已接入地图。

---

## 1. 核心风险排序

| 等级 | 证据/缺口 | 如果忽略的后果 | 下一步 |
|---|---|---|---|
| P0 | `attributes?frame=N` 被实际观察到始终返回 head | 历史分析使用错误帧数据、误导使用者 | H1:客户端防误用与接口契约治理 |
| P0 | 引擎帧内写传播 vs 工作台 `order-only` | 编辑器编出的图与原引擎运行含义不同 | H3:只读语义声明;X0 语义闸门 |
| P0 | 旧二进制/新 schema 共库,不能随意重启在线服务 | 历史数据/运行日志不一致或迁移风险 | H0:隔离环境/版本审计;禁止线上变更 |
| P1 | 535/535 仅写入值、35408 个默认值另有语义 | "完整世界一致"被错误宣称 | H1:显式值与有效值分层对账 |
| P1 | 390/390 仅验证 `source_system_id` | 来源链误称节点级因果完整 | H2:来源完整度分级和 trace 缺口 |
| P1 | `field_thermal_live` 运行期出现 | 注册目录与实际运行不一致 | H2:registered/observed 动态合并 |
| P1 | P12 浏览器验收无落盘截图 | 难以复核关键界面 | H3:E2E 证据修复 |
| P1 | REAL-06 为 PARTIAL、全 PASS 口径不一致 | 发布统计不可审计 | H0:调整验收状态 |
| P1 | `/cm` 无原子 ModelPatch/baseRevision | 原生模型写入冲突、半提交 | W0:先制定事务协议、模拟负例 |
| P1 | MapEngine Cesium 尚未集成,坐标/实体/版本未定 | 重复地理前端或错误位置/旧历史 | G0:微前端与空间契约 |
| P2 | 无 per-system perf | 缺少真实瓶颈定位 | H4:仅在隔离新二进制启用 TraceRecorder |

---

## 2. 全阶段约束(不可绕过)

### 2.1 运行和安全边界

- **本次任务只是分析与规划,不是新一次真实引擎写入授权。**
- 禁止自动重启现有 18080 服务;报告指出有历史会话,并要求"活推演期间禁重启"。
- 不对现有共享 PG 数据做 schema migration、清理、删除或恢复试验。
- `mas-rust` 不能因为本计划自动被修改;涉及引擎侧改造须单独获得用户授权、隔离实例和独立 PG。
- 首批 H0–H3 应能在**只读源码和已保存的 J3 fixture** 上完成绝大部分验证;不应为了重跑 J3 不断创建新生产会话。
- `MockAdapter`、`RealImport`、`RealConnected` 的运行/结果来源必须可区分;真实数据加载错误时不能悄悄回落到 mock 并显示成真实系统。
- source run/commit/系统 ID/模型版本不得用 IndexedDB 本地缓存键伪装;分支/帧/模拟时刻在 UI 上必须显式显示。
- 新增追溯记录必须来自原系统实际事实或明确可验证的 deltas 重放;不能从末态倒推请求、裁决或节点输入。

### 2.2 System 语义闸门

- 工作台原 mock 语义:默认读取 `State[n]`,自身可有私有暂存,`order` 仅表达先后,归约统一提交。
- 新报告所述原生引擎语义:**同一帧内存在写入传播**。其精确边界(system / stage / pre-post / barrier)待实际源码检查。
- 在未证明无损映射前,`NativeExecutionPlan` 保持**原生只读**;对原生图的增删边、改变 stage、编译与发布按钮必须禁用且说明原因。
- 如果未来需要统一编辑界面,必须引入显式、版本化 `ExecutionSemanticsProfile`,并构建系统级双向 codec + J3 类对照测试;不得把原生阶段边静默翻译成 mock `order`。
- 不支持的 `ReadMode`、effects、reducers、节点、结构/事件操作应**拒绝编译**,不能忽略。

### 2.3 数据语义

- `UNSET`、显式 `null`、`NOT_APPLICABLE`、有效 `0`、`false`、坐标原点分别处理。
- 真实引擎物化默认值 ≠ 原始显式属性写入;必须同时保留 **declared value/effective value/presence/source** 的可辨视图。
- `attributes?frame=N` 若不能返回指定帧,则不可标成"第 N 帧实际状态";可转从记录的 base+delta 重放,或明确报 `FRAME_NOT_SUPPORTED`。
- 每条来源分别标识 provenance 完整级别:仅 delta、System 来源、Effect/Decision、节点实际输入版本;不可只依据 sourceSystemId 就标"完整追溯"。

---

## 3. H0 — 固定代码与运行基线(P0、立即)

**目标:**新报告没有给最新 SHA,125 项测试、P12 浏览器证据和 REAL-06 口径都需要固定到同一版本。

### 操作

1. 本地读取双方 `AGENTS.md`、仓库状态、commit、依赖和当前测试脚本;保存完整 SHA。
2. 以只读方式检查:`design/04/evidence/j3-run-compare/native-run-compare.json`、V7-1 文档 §2、V7-4 实际计划、REAL 接受表、125 项测试结果和编译输出。
3. 检索工作台真实文件(报告称 `pages/p12/NativeExecutionPlan.tsx`;要确认是否位于 `src/pages/p12/`)和 `buildRunC`、RunBundle/FrameReplay、System Catalog 归一化、MapViewport/MapEngineMount。
4. 引擎侧仅**只读**定位:`attributes?frame=N` 处理代码、运行的 build/version 标识、`s_simulation.snapshot` / `s_simulation_tick` 写路径、`system_registry`、TraceRecorder、`/cm`。
5. 确认 `REAL-06 PARTIAL` 的准确剩余项:如果旧验收计划要求 01–12 全 PASS,则更正"v0.7-R 已完全验收"的措辞,或提交有理由、有人确认的验收豁免。
6. 补 P12 已实测但截图未落盘的证据:相同 HEAD、同一场景、9 阶段/17 个注册系统、跳 P11 的真实浏览器截图/录屏、保存 DOM/计划 JSON。

### 建议的只读命令(按本地路径和 package scripts 修正)

```bash
git status --short
git rev-parse HEAD
git log -5 --oneline --decorate
git show --no-patch --format=fuller HEAD
git grep -n "NativeExecutionPlan\|buildRunC\|field_thermal_live\|MapEngineMount" -- src design
git grep -n "attributes\|s_simulation_tick\|TraceRecorder\|system_registry" -- .
```

确认实际测试脚本后使用锁定的 `corepack pnpm@10.34.3` 执行 tsc、测试和 Vite 构建;**不要运行已知危险的写模式 `pnpm format`**。

### H0 验收

- `AUD-01`:完整 SHA、工作区差异、依赖版本、运行命令、测试结果一致。
- `AUD-02`:实际源码路径与报告描述相符或明确记录差异。
- `AUD-03`:REAL-06 的 PARTIAL 状态有具体缺口和后续通过条件。
- `AUD-04`:P12 截图/DOM 证据与固定 HEAD 对应。
- `AUD-05`:引擎在线版本、旧/新数据库写路径与隔离/禁止重启说明落档。

**本阶段交付:**`source-audit.md`、`verified-baseline.md`、`real-acceptance-reconciliation.md`、固定 SHA 的截图/日志。

---

## 4. H1 — 历史帧接口防误用与世界值双层对账(P0)

### 4.1 将 `frame` 参数视为需要验证的契约

新报告指出 `attributes?frame=1/2/6` 均返回 `tick=6`。这既是接口语义缺口,也是分析工具的**数据真实性问题**。

**工作台侧可立即做的事情:**

- 所有获取"历史帧属性"的逻辑先检查响应所标明的 `resolvedFrame`/`tick` 是否匹配请求帧。
- 如后端不提供 resolvedFrame,不能仅凭参数存在认为可取历史;应显式宣告该 endpoint 仅提供 head,历史帧只走重放器。
- 使用现有 J3 的 base+有序 delta 重放获得帧态;保存 sourceRevision、baseFrame、delta 范围、replayPolicy、checksum/记录 ID。
- 分支与帧切换时按 `sourceSystemId + simulationId + executionId + branch + frame + modelRevision` 等语义上下文建缓存键,丢弃过期异步响应。
- 对没有完整增量、缺序列或版本不匹配的帧,显示"无法可靠恢复",不能拿最新值填空。

**引擎侧需要后续审议的修复之一:**

- 真实支持按帧解析/回放并返回 requested/resolved frame;或
- 明确拒绝历史帧查询(400/明确错误),并提供 head-only API。

不得继续静默忽略 `frame`。引擎 API 改动属于**需单独授权的后端任务**。

### 4.2 两层值对账

必须把上一轮的 535/535 与 35,408 个默认值放到不同的对账集合:

1. `ExplicitWrittenValues`:来自原生 delta/写入属性集合;现有 535/535 应在固定 fixture 上再次可重现。
2. `EffectiveRuntimeValues`:加入 type/component/template 默认规则后的有效世界(可能包括数万物化默认值)。
3. `ValuePresence`:显式值 / 继承 / UNSET / 不适用 / null;两端可有不同内部存储形式,但必须在**明确语义视图**下比较。
4. `SourceVersion`:仅明确有版本/来源的值才能逐条核对 provenance;不为物化默认值虚构某次 System 写入。

当源系统与工作台的有效值视图无法无损对照时,记录"表示差异/待契约决议",不能一键 `fillDefault` 伪装相等。

### H1 验收

- `FRAME-01`:对已有 J3 fixture,`frame=1/2/6` 的请求不再被 UI 误当成后端返回的真实历史帧;历史显示来自有证据的 delta 重放。
- `FRAME-02`:缺 delta、丢帧、乱序、重复 delta、错误 branch/sourceRevision 都有诊断并拒绝虚假帧态。
- `FRAME-03`:535/535 写入值可重现;默认值集合单独统计,禁止宣传成全世界值全等。
- `FRAME-04`:旧帧 `tank-1` 温度演化的来源、路径、时间定位一致,不取最新值覆盖过去。
- `FRAME-05`:空值、继承、默认值、原点和缺来源不混淆。
- `FRAME-06`:接口未支持历史帧时,UI 能明确展示"由 delta 重放",而不是"引擎 HTTP 历史帧"。

---

## 5. H2 — 运行时 System Catalog 和来源能力登记(P1)

### 5.1 静态目录与运行期系统分开

当前报告的 P12 静态系统目录为 **9 阶段 × 17 系统**,但实跑还观测到 `field_thermal_live`。

实现 `SystemCatalogView`(命名示意,沿用已有 CatalogService/DTO),至少包含:

```text
systemId
nativeSystemId / stableMapping
displayName
source: REGISTERED | OBSERVED_RUNTIME | IMPORTED_LEGACY
stageId/phaseId (unknown 则保留 UNKNOWN)
observedAtRun / firstObservedFrame
registryRevision / engineBuildId
confidence: DECLARED | OBSERVED | INFERRED
programRepresentation: OPAQUE_NATIVE | MAPPED_NATIVE | COMPILED_GRAPH
```

合并顺序先以原生系统 ID 与版本判断同一实体,再应用别名/映射;未知 runtime 系统自动进入"运行期发现"分组,不因缺静态条目从来源图或 P11/P12 消失。**不能推测它一定属于哪个 stage**。

### 5.2 来源级别不应混在一个"通过"里

至少区分:

- `SNAPSHOT_ONLY`:只有状态。
- `PROPERTY_DELTA`:有增量与变化实体/属性。
- `SYSTEM_SOURCE`:有 `source_system_id`,但缺实际输入属性版本。
- `EFFECT_DECISION`:有请求、获准与裁决事实。
- `NODE_INPUT_VERSION`:可追到节点输入版本。

报告的 390/390 应标记为 `SYSTEM_SOURCE` 层的核对;**不能因此升级为 NODE_INPUT_VERSION**。

### H2 验收

- `CAT-01`:已注册 17 个系统与运行时新增系统在 P11/P12 和真实运行记录中可区分。
- `CAT-02`:未知系统不丢失、不会被错误连接到现存系统或静态阶段。
- `CAT-03`:390/390 运行来源系统 ID 仍一致;缺 node reads 时页面显示具体缺失层级。
- `CAT-04`:相同 systemId 不同 engineBuild、programVersion 时不会串档。
- `CAT-05`:catalog 通过动态导入/运行事件更新,新增运行系统无需改硬编码数组。

---

## 6. H3 — 原生执行计划只读分析增强(P1)

### 6.1 界面必须分清两套计划

- **本地示例计划**:React Flow + 独立调度语义,`State[n]`、order-only、mock executor。
- **原生引擎计划**:报告描述原引擎 9 阶段,存在帧内写传播;来自 `system_registry`,目前不支持由 P12 反向改写。

P12 应增加可读的"来源/执行语义/可编辑性"标识:

```text
Plan Source: Native Engine / Local Sandbox
Mode: Read-only / Editable Local
Engine Build / Registry Revision
Read Visibility: Frame-propagated / Round snapshot / Unknown
Stages / Systems / Observed-runtime Systems
Last Run ID / available trace levels
```

对原生 System 双击可进入 P11 的**真实原生元数据和可支持的参数摘要**;不自动把原生函数打开成五节点 FlowGram 画布。

### 6.2 语义兼容表(正式可编译前必须完成)

| 项目 | 工作台 mock | 原生引擎 | 处理 |
|---|---|---|---|
| 读世界 | 旧 `State[n]` | 据报告帧内可读到传播写入 | 必须精确定位阶段/屏障,禁止静默同义 |
| 顺序边 | 先后,不传写入 | 调度先后可能产生新值可见 | 单独 `ReadVisibility` 语义 |
| 贡献/赋值 | 私有效果→归约 | 待源码核对原生写路径 | 缺失则拒绝编译 |
| 统一提交 | 回合边界 | 待核对 stage/tick/commit | 对齐 checkpoint/阶段 |
| 执行记录 | mock node trace | 当前 real system/delta | UI 分级追溯 |

**第一批仅做只读映射。**完整 V7-4(编辑/双向编解码器/真实执行)需等待 X 任务闸门,不应由 H3 顺带完成。

### H3 验收

- `PLAN-01`:原生 9 阶段、17 registered systems 可加载;运行期发现的系统单独呈现。
- `PLAN-02`:点击真实 System 正确定位 P11 同一 ID/版本,不打开伪 FlowGram 内部图。
- `PLAN-03`:编辑/连边/发布原生计划入口在不兼容时明确禁用,无"可保存但无法执行"的假实现。
- `PLAN-04`:重新补齐**落盘的**浏览器截图、DOM/plan JSON 与完整 SHA。
- `PLAN-05`:在不同 run/branch/frame 切换下,计划来源与状态上下文不串。

---

## 7. H4 — TraceRecorder 与逐 System 性能(条件性工程任务)

### 7.1 为什么暂不能直接做

本次报告明确指出正在运行的 18080 服务是旧二进制,不能擅自重启;它也没有输出逐 System stats,`runtime_trace.jsonl` 未启用。

此任务需要**与真实引擎团队/用户协调**,不是工作台单独修改前端可解决的缺口。

### 7.2 正的正确实验环境

必须先取得:

1. 用户对**隔离引擎实例**的实际运行授权;
2. 独立端口、独立 PG(不复用正在承载历史会话的库)、隔离场景/资源副本;
3. 确认含 TraceRecorder 的新二进制构建 ID、schema migration、回滚方案;
4. 监控输出格式与开销上限,避免强制在生产逐节点记录所有细节;
5. 同一个固定 fixture(优先重放已保存 J3 数据)上的 native/trace/工作台对照。

### 7.3 期望记录(由源系统能力决定)

```text
runId, frame/tick, phaseId, systemId, engineBuildId,
start/end/duration, entityBatchCount, diagnostics, traceCompleteness,
source model/scene revisions,
(如果源系统确实提供)actual read version refs / effect refs
```

技术性能 span 可以独立于业务来源 DAG。**不能用 per-system duration 当属性因果依赖。**

### H4 验收

- `TRACE-01`:隔离新二进制运行,旧服务未重启、旧 DB 未改变。
- `TRACE-02`:真实系统级耗时来自 TraceRecorder,而非前端估算或均分总耗时。
- `TRACE-03`:System ID/阶段/运行版本与 P12 目录对应,未知 runtime ID 可解释。
- `TRACE-04`:开启/关闭 trace 的成本有可比较数据。
- `TRACE-05`:缺 trace 时显示"当前引擎未提供此指标",不得画假性能曲线。

---

## 8. W0/W1 — ModelPatch 安全编辑与发布(闸门未开)

### 8.1 暂不开启的原因

报告指出 `/cm` 是模型 CRUD 直写,缺 `baseRevision` 乐观并发检查;工作台此前遵守对 `mas-rust` 零改动规则。目前 **V7-3 NOT_RUN 是正确状态**,不是验收失败。

**不得使用"先写后校验"的生产协议。**即使为了快速施工,也必须把失败回滚、引用一致性和提交原子性放在前面。

### 8.2 可以立即完成的无写入准备

- 根据已有 `draftRegistry`、`baseVersion` 和字段变更集合制定 `ModelPatch` DTO;
- 在工作台侧添加纯本地 `patch preview`、结构/单位/引用预校验;
- 明确原生/工作台 object ID 的双向映射、ID 生成与删除引用限制;
- 写出 `dryRun`/`apply`/`revert proposal` 契约和错误码;
- 设计并实现**不触碰引擎 DB**的模拟服务契约测试;
- 保持所有真实模型仍为只读,UI 可编辑的本地草稿与原生发布态必须可区分。

建议候选协议(**并非当前真实接口**):

```json
{
  "patchId": "proposal-001",
  "sourceSystemId": "native-engine",
  "targetSceneId": "scene-id",
  "expectedRevision": "rev-before-edit",
  "idempotencyKey": "unique-operation-key",
  "operations": [
    {
      "op": "replace",
      "entityId": "native-entity-id",
      "componentId": "native-component-id",
      "attributeId": "native-attribute-id",
      "newValue": 25,
      "unit": "degC"
    }
  ]
}
```

真实协议必须由引擎侧定义原子事务、版本冲突、引用校验、授权和回滚语义,不直接套用这份示例。

### 8.3 解锁 V7-3 的硬条件

- [ ] 用户明确允许写**隔离引擎/独立 PG**,明确目标目录与环境;
- [ ] 代码明确具备原子 `dryRun/validate/apply` 或经过审议的等价事务协议;
- [ ] `expectedRevision` 不一致时拒绝,返回可定位的冲突;
- [ ] 操作具有幂等键,重复提交不会重复创建或扣减;
- [ ] Schema/组件/模板/实体引用及值语义完整校验;
- [ ] 失败和进程中断不出现部分发布,成功返回新的原生 revision;
- [ ] 真实业务模型历史不因草稿修改被偷偷覆盖。

### W 验收

- `WRITE-01`:同 revision dryRun 给出准确变更集,**未修改引擎世界**。
- `WRITE-02`:并发冲突返回 `REVISION_CONFLICT`;不覆盖其他修改。
- `WRITE-03`:无效类型/单位/引用/delete 受阻。
- `WRITE-04`:部分操作失败时全部回滚;查询原引擎无半完成数据。
- `WRITE-05`:相同 idempotencyKey 重试不产生重复写入。
- `WRITE-06`:成功返回 source revision,工作台不把本地 draftId 冒充正式源版本。
- `WRITE-07`:旧场景、旧版本运行/历史仍能还原。
- `WRITE-08`:任何写入先由用户授权环境与操作范围,本计划不自动触发。

---

## 9. X0/X1 — 原生 System 可视化编辑与编译(后续闸门)

### 9.1 先定义可支持的范围

- S0 原生黑盒 System:可见、可查询、可分析运行记录;不承诺内部 FlowGram 可编辑。
- S1 参数化 System:可编辑引擎原生允许的配置和参数,但保留未知字段与版本。
- S2 可编译图程序:只有存在双向无损 codec、真实执行计划/验证协议时开放。

### 9.2 必须形成 `ExecutionSemanticsProfile`

候选字段(最终按真实源码决定):

```text
engineBuildId
planVersion
readVisibility: ROUND_SNAPSHOT | FRAME_PROPAGATED | PHASE_SNAPSHOT | UNKNOWN
stageBarriers
systemOrdering
effectKinds
reductionAndConflictRules
commitBoundary
queryMembershipTiming
supportsIntermediateProduct
supportsProgramGraphCompilation
```

没有明确的值不能填写编造的默认值,也不能把全部 `order` 边当成可传播中间结果的依赖边。

### 9.3 编译/回写门槛

1. 原生计划→类型化 IR→原生计划 的无损往返比较;
2. 布局修改不改变语义哈希;
3. 每条边、阶段屏障、绑定、参数、类型化效果都有原生目标;
4. 原生程序/配置在变更后通过原生验证器;
5. 固定 fixture 上重复 J3 同类双侧对拍,除被授权变更的语义外均一致;
6. 不可映射时中断部署并标记具体 stage/system/node/field。

**在 X0 未通过前,保持现有原生计划只读是正确行为。**

---

## 10. G0/G1 — MapEngine 微前端与历史空间联动(闸门未开)

### 10.1 正确架构

真实地理模块是报告所称 `mas-suite/map-engine-v2`(Cesium)。工作台应复用其现有展示与资源管理能力,**不要把另一个完整 Cesium 应用打包进本仓库以形成第二套地理工作台**。

首先比较:
- iframe/独立微前端(优先评估,隔离依赖);
- 模块联邦或现有宿主插件接口(如果源代码已有稳定机制);
- 直接嵌入 MapEngine V2(仅性能/状态管理确有收益且维护成本可控时选择)。

该选择是待审的架构决定,不是已经完成的实现。

### 10.2 一份协议必须解决的六个问题

1. **Entity identity**:原生 entityId ↔ 工作台 entityId ↔ 地图 featureId。
2. **坐标语义**:报告称真实经纬度在 `transform/position Vec3`,但仅看 `Vec3` 不足以证明三个数就是 lon/lat/height;必须核对坐标系、轴顺序、单位、ENU/地理坐标、高程基准和高度采样策略。
3. **时间/分支**:`sceneVersion + simulationId + runId + branchId + frame/viewCommit` 与地图状态绑定。
4. **选中联动**:P20 选实体→地图定位;地图点选→P20/P22/P24 选实体/属性/记录。
5. **权威运动**:路线/位置/到达来自原系统,地图只插值、展示;不能以地图画出的路径替代业务路径。
6. **失败与离线**:MapEngine 未启动、资源失效、无位置实体、权限/跨源错误均有明确降级。

### 10.3 最小挂载协议(示意,不是现有 API)

```text
HOST -> MAP:
  INIT(protocolVersion, allowedCapabilities, context)
  LOAD_SCENE(sceneId, sceneRevision)
  SET_VIEW_TIME(simulationId, branchId, frame/commit)
  SELECT_ENTITY(entityId, correlationId)

MAP -> HOST:
  READY(protocolVersion, capabilities)
  ENTITY_SELECTED(nativeEntityId, correlationId)
  SCENE_LOADED(sceneId, revision)
  VIEW_CHANGED(camera, context)
  ERROR(code, context)
```

跨 iframe 时校验 origin/发送方身份/协议版本,消息带相关 ID、当前上下文和异常处理;不得使用不受限制的跨源信任或让旧帧消息覆盖新分支选择。

### 10.4 可以在无真实 MapEngine 环境先做的任务

- 建 `MapEngineMount` 的接口/状态机规范;
- 用不含 Cesium 的协议测试替身验证 handshake、选择回路、历史时刻更新;
- P20 保留当前地图宿主作为 `NOT_CONNECTED` 状态;
- 将位置类型补充明确的 coordinateFrame,而不把 `Vec3` 直接显示为经纬度;
- 真正装载 MapEngine V2 仍须经过用户/相关工程的集成批准和契约评审。

### G 验收

- `MAP-01`:初始化协议版本、允许来源、错误降级正确。
- `MAP-02`:ECS 选中和地图点选同一稳定实体 ID,避免循环选择事件。
- `MAP-03`:null 无位置实体不画地图标记但仍在逻辑列表;原点是合法位置。
- `MAP-04`:旧 frame/branch 不得展示当前最新位置;过期响应被忽略。
- `MAP-05`:坐标转换使用明确 frame/单位/高程约定,控制点核对而非肉眼猜。
- `MAP-06`:未接入真实 MapEngine 不显示"地图已集成"状态。

---

## 11. 推荐的 PR/施工批次

| 批次 | 代码/文档范围 | 是否可以立即开始 | 进入/退出条件 |
|---|---|---|---|
| PR-0 | H0 真实 SHA、测试、文件定位、REAL-06/P12 证据 | **可以** | 无写入,审计记录齐全 |
| PR-1 | H1 历史帧契约、防 head 冒充、delta replay/默认值对账 | **可以** | 历史帧/缺值负例全部通过 |
| PR-2 | H2 Catalog 动态发现与 provenance 等级 | **可以** | 17 静态+runtime ID 不丢、390 来源对拍 |
| PR-3 | H3 P12 原生只读展示、语义差异与 E2E 证据 | **可以** | 原生画布不可误编辑、录屏可复核 |
| PR-4 | H4 独立新二进制 TraceRecorder + 性能 | **需授权隔离引擎** | 活服务未动、真实 per-System 记录 |
| PR-5 | W0 ModelPatch DTO/前端本地草稿、mock 协议测试 | **可先只做无写入部分** | 不触及原生数据库 |
| PR-6 | W1 引擎事务验证+真实模型发布 | **需用户授权、独立 PG、原生协议** | 并发/幂等/回滚/引用测试通过 |
| PR-7 | X0 IR/语义兼容诊断、原生只读编解码 | **可先做规范和无写入验证** | 双向无损或者准确拒绝 |
| PR-8 | X1 真 System 图编译/部署 | **需原生引擎写入/执行授权** | 原生和编译执行对拍通过 |
| PR-9 | G0 Map 宿主协议与替身测试 | **可先做无地图版本** | 握手/上下文/安全测试通过 |
| PR-10 | G1 MapEngine V2 真实集成 | **需接口评审/地图工程可用** | 真实地图历史/实体/坐标联动 |

**推荐先合并 PR-0 ~ PR-3,再决定 PR-4、PR-6、PR-8、PR-10 的次序。**这些阶段可以独立验收;不要为了凑"完整 v0.8"而把地图、正式执行器、模型写入混在一次大 PR 里。

---

## 12. 增补验收矩阵 REAL-NEXT

| ID | 关注点 | 成功判据 | 主要证据 |
|---|---|---|---|
| N-01 | 最新代码与运行版本 | HEAD SHA、engineBuildId、测试/构建可复现 | logs |
| N-02 | REAL-06 状态 | 明确 PARTIAL 缺口并重新判定或正规豁免 | acceptance |
| N-03 | 末帧写入值 | 535/535 在同一 J3 fixture 可复现 | compare JSON |
| N-04 | 来源标识 | 390/390 `source_system_id` 可复现,不夸为节点因果 | source JSON |
| N-05 | 帧参数安全 | 请求 frame=N 不会静默显示 head | 负例/UI |
| N-06 | delta 重放 | 6 帧数据完整、有序、可检验版本/分支 | replay tests |
| N-07 | 默认值表示 | 35,408 默认值与显式写入集合分开,不静默回填 | mapping diff |
| N-08 | 运行时 System | `field_thermal_live` 与 registered catalog 分开且不丢失 | registry JSON |
| N-09 | 原生 P12 只读 | 9 阶段/17 注册系统;不兼容图不允许编译 | E2E screenshot |
| N-10 | 旧/新二进制 | 线上服务不重启、不做数据库迁移;版本路径清晰 | runbook |
| N-11 | TraceRecorder | 独立新二进制真实每 System 耗时,可无记录降级 | trace/perf log |
| N-12 | provenance 分级 | 缺节点输入版本标明缺口,不造因果边 | traceability test |
| N-13 | 模型变更预览 | ModelPatch validate/dryRun 不写原生模型 | negative tests |
| N-14 | 乐观锁/幂等 | revision 冲突拒绝、同幂等键不重复写 | isolated engine |
| N-15 | 失败原子性 | 多操作发布失败全部回滚 | isolated DB diff |
| N-16 | 原生图兼容 | Frame-propagated 与 order-only 冲突能被准确诊断 | semantic tests |
| N-17 | IR 无损往返 | 真支持的系统可双向编解码,不支持即拒绝 | codec diff |
| N-18 | 地图挂载协议 | 版本/来源校验,旧响应不污染新分支 | bridge test |
| N-19 | 空间权威 | 坐标、原点、null、高程与场景版本正确 | fixture/cp checks |
| N-20 | 真实地图联动 | 选中/定位/历史回放与原生实体版本一致 | E2E video |
| N-21 | 安全边界 | 不自动写 mas-rust/共享 PG,不重启活服务 | audit log |
| N-22 | 版本和证据归属 | 每个 PASS 有 commit SHA、场景、run、测试数据 | evidence index |

验收状态统一为 `PASS / FAIL / PARTIAL / NOT_RUN / NOT_APPLICABLE`,带可机读证据。真实运行相关测试必须引用真正的 source run ID、模型版本和 sourceSystem,不允许从样例测试直接推断。

---

## 13. 可提交给本地 Agent 的实施包要求

建议在仓库**核对现有目录后**建立(仅作为目标结构):

```text
design/04/
  07_next_implementation_plan.md
  next/
    00_verified_baseline.md
    01_history_frame_contract.md
    02_effective_value_comparison.md
    03_runtime_system_catalog.md
    04_native_execution_semantics.md
    05_trace_recorder_isolation.md
    06_model_patch_protocol.md
    07_mapengine_mount_contract.md
    08_acceptance_real_next.md
    09_release_decision.md
  evidence/
    j3-run-compare/                # 保留已有文件,勿改历史事实
    next-baseline/
    history-frame/
    runtime-catalog/
    native-plan/
    trace-isolated/
    modelpatch-isolated/
    map-bridge/
```

任何已有正式规范/代码文件优先**原位扩展**,避免另建两套相互冲突的领域 DTO 或运行记录。报告中的 `design/04/evidence/j3-run-compare/native-run-compare.json` 作为只读黄金对照数据,禁止为了通过测试更改原始数据。

每个 PR 必须说明:

```text
fullCommitSha
changeScope (Workbench / Isolated Engine / Docs Only)
engineBuildId (if applicable)
baselineFixtureId / sourceRunId
changedFiles and reason
semanticCompatibility
testCommand and actual results
browserEvidence (if UI)
dataDiff / traceRefs
knownLimitations
rollbackPlan
authorization and environmentScope
```

---

## 14. 不应在这一阶段重复开展的工作

- 不再补几十个页面或重做 P12/P14 的编辑器基础;
- 不应以 P12 "读到了 9×17 个节点"为依据,直接宣布 System 图能编辑并编译;
- 不因为每 System trace 缺失就重启正在运行的线上服务;
- 不使用 `/cm` 直写后校验作为安全模型发布的默认方案;
- 不把引擎的 `attributes?frame=N` 当作可用历史 API;
- 不因为 `390/390 source_system_id` 一致而宣称节点级读取依赖与业务因果链完整;
- 不把 `transform/position Vec3` 自动解释成经纬度+海拔;
- 不在工作台中重新造第二套 Cesium 地图前端;
- 不以 TS mock 结果替代真实引擎的执行结果;
- 不在没有用户授权时写原生模型、运行生产任务或更改共享 PG。

---

## 15. 发布口径、关键路径和最终建议

### 推荐的近期发布目标:`v0.7-H`(只读集成可信度加固)

必须满足:

- [ ] H0 最新源码/报告证据完成对应,REAL-06 的 PARTIAL 有完整说明;
- [ ] H1 历史帧误读被阻止,六帧 replay 和显式/默认值比较可复验;
- [ ] H2 原生注册系统和运行期观测系统被正确标识,source id 不丢;
- [ ] H3 P12 只读语义兼容声明和截图/E2E 完整;
- [ ] J3 现有 fixture 的末帧 535/535、来源 390/390 被复核;
- [ ] 未触碰共享 DB、未擅自重启活服务;
- [ ] 每项验收状态和证据范围透明。

**此版本可以声称**:"工作台对已导入的真实引擎运行具备可复查的属性/来源对账、历史帧重放、原生 System 计划只读分析。"

**不得声称**:"模型可安全发布到原系统""可视化图可执行于原生引擎""地图已经真实接入""全节点因果追溯已完成"。

### 随后的并行准入决策

- **V7-W(安全编辑)**:以用户隔离写入授权、事务化 ModelPatch 与冲突测试为硬条件;
- **V7-X(原生 System 编译)**:以真实 `ExecutionSemanticsProfile`、双向 codec 和引擎对拍为硬条件;
- **V7-G(空间联动)**:以独立 MapEngine 宿主协议、空间权威/版本映射与审议通过的微前端接入为硬条件;
- **V7-T(逐 System 真实统计)**:以隔离新二进制+独立数据库和 TraceRecorder 有效输出为硬条件。

**实施顺序建议:先证据与语义,后写入与地图;先原生真实数据只读正确,后打开可编辑部署权限。**
