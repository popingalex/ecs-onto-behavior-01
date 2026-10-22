# 02 双工程只读审计(V7-0)

日期:2026-10-22 ｜ 性质:**只读审计**(未修改两工程任何源文件、未写数据库、未触发推演、未提交/推送)
审计人:本地 Agent(ZCode)

## 0. 审计范围与工程身份

| 工程 | 本地根目录 | HEAD | 工作区状态 |
|---|---|---|---|
| 工作台 `ecs-onto-behavior-01` | `/Users/alexxu/workspace/simulation/202605/ecs-onto-behavior-01` | `773b450`(比报告基线 `ee2070e` 多 2 个 docs 提交) | 干净,仅未跟踪 `design/04/` |
| 原有推演系统(后端) | `/Users/alexxu/workspace/simulation/202605/mas-rust` | `65c7f96` | 干净(0 修改) |
| 原有推演系统(前端) | `/Users/alexxu/workspace/simulation/202605/mas-suite/mas-refactor`(pnpm+turbo monorepo) | 非 git 仓(快照目录) | 只读 |

**位置勘误(重要)**:需求文档假设前端在 `mas-rust/mas-refactor`;实际该路径只剩 `data/logs/access.log`。真正的前端 monorepo 在 `mas-suite/mas-refactor`(含 `apps/sim-studio-new`、`apps/data-admin`、`apps/reporting` + `packages/map-engine-v2`、`packages/data-engine` 等)。历史记忆中的 "mas-refactor 前端" 即此仓。

**数据库(只读 SELECT 核验)**:`postgres://localhost:5432/sim_2601` 在线。`s_scene` 2 行(chem-evacuation 9 实例 / chem-roaded 93 实例)、`s_simulation` 555 行、`s_simulation_tick` 首查 17 行/复査 40 行(**活库**,分组 3 个运行:4blIyLeuvJG-71gggXWcn 11 / l-UBeZ4_pIMx3jTE4K4WB 23 / BRqKqNSE_OLcdg1Cz9568 6,均有新 append-only 格式 delta 含 source_system_id)。

**独立复验**:工作台测试在本机重跑 `corepack pnpm@10.34.3 test` → **109 passed / 0 failed**,与 v0.6 报告声明一致(HEAD `773b450`)。

---

## 1. 工作台 ecs-onto-behavior-01(架构与源码定位)

技术栈:React 19 + Vite 8 + TS 5.7 + Tailwind 4;`@xyflow/react` 12.12(外层 P12)、`@flowgram.ai/free-layout-editor` 1.0.16(内层 P14)、zod 4.6.7。无路由库(hash 自研路由)、无 redux/zustand/idb 依赖(自研 external store `src/lib/store.ts:13-36` + 原生 IndexedDB 封装)。

### 1.1 模块地图

| 能力 | 实现位置(文件:行) |
|---|---|
| 领域模型 DTO(唯一权威) | `src/schema/model.ts`(TypeRef 含 `quantityKind/unitId/frameId` :23-30;SystemDefinition.access :146-154;ScheduleDocument :156-180;PrototypeModel :217-233) |
| 值语义(默认/继承/显式 null/装配) | `src/schema/values.ts:4-72`(instance>template>default;`own` 判定显式 null);显示态 9 值 `src/core/types.ts:176-194` |
| parent 继承/环检测 | `src/schema/inheritance.ts:14-100` |
| seed 解析+完整性校验 | `src/schema/parse.ts:71-620`(Zod) |
| 草稿文档注册 | `src/stores/draftRegistry.ts`(473 行;per-documentId 隔离、undo/redo、semanticHash、localStorage) |
| 执行适配器接口 | `src/services/executionAdapter.ts:36-40`(`ExecutionAdapter.settle`);现仅 2 实现:mockExecutor :90-157、reference :159-175 |
| TS 参考执行器 | `src/services/mock-executor/executeRound.ts:462-690`(整轮 settle,无单步;全 System 读 baseWorld previous 视图 :516;contribute→比例裁决→原子提交) |
| 调度编译/校验 | `src/services/scheduleCompiler.ts`(order-only、product 拒绝 :44-45/270-279、环检测 :190-215/356-367、并行分层 :369-415) |
| 逻辑图绑定/单位校验 | `src/services/domainBindingService.ts`(9 可用节点类型 :181-331;°C→K 拒绝 :94-104;查询 `queryMatches` :1348-1365) |
| trace/provenance DTO | `src/services/mock-executor/types.ts`(RunRecord :13-30、NodeExecution.inputVersionRefs :45-62、RoundResult.programs 快照 :118-132) |
| 溯源缺口明示 | `src/pages/p22/traceView.ts:64-93`(traceabilityGaps) |
| 本地历史持久化 | `src/stores/persistence/`(IDB `ecs-workbench.history` 6 store;facts→marker→head 单事务 :307-332;导出 `history-package/1` :435-454,**导入明确不提供**) |
| 地图宿主 | `src/components/domain/MapViewport.tsx:1-65`(`MapEngineMount` 挂载位,**当前从未传入 engine**;回落 SpatialViewport 平面示意) |
| 页面注册 | `src/core/types.ts:6` + `src/navigation/pages.ts:37-399`;P01–P31(含 3 retired:P06/P07/P09) |
| 数据流 | adapter facade:`src/data/adapter.ts:14-21` → `src/data/store.ts` → `buildIndex`,页面统一 `useIndex()`/`useDraftModel()`,非逐页解析 |
| 测试 | 自研 runner `scripts/test.mjs`(每个导出函数=1 测试);22 文件/109 测试,无 DOM 渲染测试 |

### 1.2 关键事实(与集成相关)

- **无真实引擎适配器、无 `sourceSystemId/sourceRevision` 字段、无 capability manifest**(grep 全仓为零;契约里只有未来形状建议 `design/03/contracts/mapengine-integration.md:41`)。
- Commit 不按内容寻址:顺序 id `c0xx` + append-only store + 分支 head 指针(`src/stores/history.ts:13-70`);内容哈希(FNV-1a `src/lib/hash.ts`)仅用于草稿脏检查与 inputVersions。
- `exclusive`/`contract` 写模式在 schema 中声明并校验,但 mock 执行器只实现 contribute→比例裁决→原子提交一条路径。
- 无 RNG/seed;确定性串行执行。
- P10 查询条件固定 `op:"eq"` + `readView:"previous"`(schema Zod literal 钉死);无动态发现新实体/组件。
- 历史导出格式 `history-package/1` 仅导出不导入;程序文档有 JSON 导入导出(`src/services/documentFile.ts:15-92`)。
- AGENTS.md 是 Figma Make 脚手架模板,无业务约束;业务契约在 `design/02|03/contracts/`(5 份,见 §1.1)。

---

## 2. 原有推演系统 mas-rust(架构与源码定位)

### 2.1 crates 拓扑

| crate | 角色 |
|---|---|
| `crates/server`(`mas-bevy-server`,axum,:18080) | HTTP/WS 全路由、多人房间+CommandLog、播放、MCP/VLM、CM 代理(`crates/server/src/app.rs:167-1295`) |
| `crates/runtime` | 仿真核心:bevy_ecs World、系统实现、system_registry+调度、workflow(低代码)引擎、deno 脚本、cdylib 动态系统、计划执行、路网、provider 同步、逐帧工件 |
| `crates/schema` | PG 持久化+DTO(sea-orm,`s_*` 表;SceneBundle=运行装配唯一入口 `crates/schema/src/dto.rs:246-271`) |
| `crates/history` | HistoryStore trait、内存+快照、BranchGraph DAG、RocksDB 后端 |
| `crates/kernel/*`(6 子 crate) | 播放内核族(无 Bevy/DB):simulation-store/query/codec(MCB1 二进制列)/browser-wasm/render-projection |
| `crates/bench` | 场景导出器 `export_scene`、HTTP 对拍 `chemical_fire_rescue_http` 等基准 |
| 其余 | `slice_baker`(瓦片切片)、`recon`(场景重建域)、`script-spike` |

前端为独立 monorepo(见 §3),经 Vite 代理 `/sim /cm /api /ws /assets` → 18080。

### 2.2 实体/属性模型

- **真 ECS(bevy_ecs)+ 动态字符串键属性表**:`InstanceId(String)` 即业务实例 id(如 `ext-fire120-xxx`)、`TypeRef`(archetype id)、`IdHash(u128)` 内部索引(`crates/runtime/src/components.rs:22-36`)。
- 强类型组件(Transform `[lon,alt,lat]` 度、Mobile、WaterSprayer、Flammable…)按 archetype 装配决定存在性(`crates/runtime/src/assemble/spawn_instance.rs:48-346`);**运行真值在 `ExtraAttributes` 动态表**(canonical 路径 `component/field`,`crates/runtime/src/attr_ids.rs:1-186`),typed↔dynamic 帧末同步。
- 场字段(辐射/温度网格)在 environment 单例实体的专用组件上,flat `Vec<f64>` + nx/ny/cell_meters;网格**从不推送客户端**(`write_silent` :770-777)。

### 2.3 System 注册与调度

- 注册表 `crates/runtime/src/system_registry.rs`:9 阶段(Input→…→Commit→History→Metrics :132-196)、16 默认系统(:679-1089,combustion/radiation-diffusion/sprinkler/fire-extinguishing/mobile/water-intake/tank-init/geo-damage/injury-threat…),声明 reads/writes FieldRefs、triggers、order_hint。
- **混合实现**:`SystemImplementationKind {Native, Workflow, DynamicLibrary}`(:229-234)。config.toml 当前 `system_mode="workflow"`——8 个系统被 `fixtures/shared/business-systems/lc-*` 低代码 workflow 覆盖(`simulation.rs:479-716`);workflow 有**节点级 trace**(`behavior_workflow/node_trace.rs`)。
- 调度 `simulation.rs:1298-1999`:阶段内依赖图波次执行;workflow 节点读帧首快照(Original)或预写 overlay(Current/Effective)(`behavior_workflow/io.rs:1-50,151-200`);延迟写 flush;系统失败中止 tick 并写 `system.execution/failed_systems` 伪实例 delta。

### 2.4 命令/帧/历史/追溯

- 命令:`POST /sim/:id/command`(`routes/command.rs:13-250`,CommandLog 或直写两路径,`commandId` 幂等 :86-115);词表 `runtime/src/commands.rs:1-93`(action_ignite/spray_water/spray_foam/move/board…)。
- 帧:`POST /sim/:id/branch/:branch/:time` 推帧;返回 `(FrameSummary, pre_deltas, post_deltas)`;Pre 层=帧首命令/参数编辑,Post 层=系统产出。所有执行强制过 `server/src/engine.rs`(持久化唯一入口)。
- 历史:`HistoryStore` + `BranchGraph` DAG(main 起点、commit 推进 head、fork 分叉,`crates/history/src/branch.rs:16-145`);PG `s_simulation.branches`(节流写)+ **`s_simulation_tick` append-only 一帧一行**(`sql/02_create_core_tables.sql:500-522`,tick_entry={executionId,branchId,frame,revision,requestId,deltas});恢复=按 seq 重放(`Simulation::restore_from_stage_deltas` :1172-1200)。
- 磁盘工件:`{data_dir}/{sim}/branch-*/frame-%06d/{meta.json, frame_data.json, delta_frame.json, attribute_deltas.json,…}`(`runtime/src/persist.rs:272-500`,确定性排序,三路执行字节一致契约)。
- 追溯:**PG tick 行 delta 带 `{attribute, frame_layer, instance_id, source_system_id, value}`(实测样例确证)→ SYSTEM_EFFECT 级可用**;磁盘 `attribute_deltas.json` 只有 `{instanceId,id,after,branch,tick}` → 仅 PROPERTY_DELTA 级;`FrameProfiler/runtime_trace.jsonl` 有 per-system 耗时(审计的旧运行目录未发现该文件持久化=缺口);无节点输入版本记录(除 workflow NodeTrace)。

### 2.5 API 面(与集成相关子集)

读:`GET /sim`、`GET /sim/:id`、`/attribute-definitions`、`/branch/:b/attributes`、`/branch/:b/deltas?startTick&endTick`、`/api/v2/simulations/:id/branches`;写:`POST /sim`、推帧、`/command`、`/branch` fork、`/evacuation-plan/apply`;CM:`/cm/scene|entity|component|system|dataset|plan…`;providers:`/cm/integration/{hospitals,ambulances,rescue-teams,rescue-forces}`;播放:`/playback/{play,pause,seek,speed}`。WS `/ws/:sceneId/:simId`(v3 信封,JSON/MsgPack/二进制列 MCB1)。

### 2.6 单位/量种、确定性

- 数值全部无类型 f64(serde_json::Value in ExtraAttributes);单位只存在于属性命名约定与文档(°C、kW/m²、L/s、m/frame、人/ha);位置 `[lon,alt,lat]` 度(非 gltf 序)。
- **无仿真 RNG**(fastrand 仅生成 trace id);力学为闭式确定性;重放条件=同 SceneBundle + 同 tick 行序列(注意:ext-* provider 实例需重取或由 s_simulation.instances 恢复;外部 AMap 路由需复用录制 fixture;nanoid 恢复时以 `restored_id` 保留原 id)。

---

## 3. 前端 mas-suite/mas-refactor(角色定位)

- 主应用 `apps/sim-studio-new`(Vite :5176 → 代理 18080):TanStack Router/Query;高频帧态走 `RuntimeStateReader+useSyncExternalStore` 而非 Zustand。
- `packages/map-engine-v2`:Cesium 引擎(EntityPool/DataBridge/b3dm ExtractedTilesetRenderer/lowpoly 合并图元/辐射等值线/调度路线 overlay;app 侧实现 `MapEngineDataProvider` 桥接 data-engine)——**工作台契约所指的外部 MapEngine 即此包**。
- `packages/data-engine`:SimDataEngine + WorkingCopy(@tanstack/db 内存集合,`working-copy.ts:42-89`、属性历史树 `attribute-history-tree.ts:42-66`);播放纯 TS 状态机(`packages/timeline`)+ WASM 内核权威播放(`kernelSessionRunner`,MCB1 解码)。
- 命令链:干预入队 `controlled/commands` → 帧边界 commit(命令时间取 `__MAS_PLAN_EXEC_TICK__` 锚);点燃走专用 `/command` 通道。
- 本地持久化仅:天地图瓦片 IndexedDB、若干 localStorage 配置;**帧/路线无前端持久缓存**(每会话由后端重建)。
- 无通用"导出运行为 JSON"的 UI;run-viewer(data-admin)只读 recon 运行工件。

---

## 4. 计划 §3.2 十二问逐条回答(摘要)

| # | 问题 | 回答(证据见上) |
|---|---|---|
| 1 | 真 ECS 还是业务实体+属性表? | **两者叠加**:bevy_ecs 骨架 + archetype 装配 + ExtraAttributes 动态属性表为运行真值(§2.2) |
| 2 | ID 稳定关联? | **是**:ECS 实体即携带 `InstanceId(String)`=业务 id;ext-{provider}-{item} 规则;IdHash 仅内部(§2.2) |
| 3 | 动态 schema? | **半动态**:archetype/组件/系统在 PG(s_entity/s_component/s_system)可 CRUD 且运行装配走 SceneBundle;类型本身编译期不强约束(属性即字符串键) |
| 4 | 模板/默认/显式 null/0 区分? | fixture 实例=覆盖列表(无键=不设);无 valuePresence 概念;0/false 合法值;**缺省与未装配由 archetype 成员与 spawn 逻辑决定,无显式 null 语义** → 映射时 UNSET/NOT_APPLICABLE 需从 archetype 推导(见 04 文档) |
| 5 | 查询动态发现? | 系统 query 走 archetype+属性;服务端有 `/api/grid/system-matrix` 等内省;前端每次帧内注册新实例(delta 帧) |
| 6 | System 形态? | 三类并存:Native 编译函数 / Workflow 低代码图(lc-*,可动态加载)/ cdylib 动态库(§2.3) |
| 7 | 外层调度语义? | 9 阶段+阶段内依赖波次;workflow 读 Original/Current/Effective 可配;native 系统读当前 World(追踪器隔离);提交边界=帧末 Post 层(§2.3-2.4) |
| 8 | 内部程序类型化端口/变量/单位? | workflow 节点图有 io 端口与 scratch 作用域;**无单位/量种系统**(§2.6) |
| 9 | 效果语义? | **仅直接写**(ExtraAttributes.write/deferred + 帧末 flush);无 set/contribute/propose 协议;用户命令有 CommandLog 请求/获准/冲突裁决,属性效果无请求-裁决对(§2.4) |
| 10 | 运行记录最细层级? | run/system 两级:per-frame meta(系统耗时)+ PG delta 带 source_system_id;workflow 系统另有节点级 NodeTrace;**无输入版本引用**(§2.4) |
| 11 | 历史/恢复/续算? | BranchGraph fork/commit + append-only tick 重放恢复;`restore_from_stage_deltas` 续算;快照机制存在(内存 store);RNG 无需 checkpoint(§2.4/2.6) |
| 12 | 隔离样例与敏感性? | chem-roaded 全 fixture 场景(93 实例,无个人信息);采样运行 83 实例 0 个 ext-*;坐标为测试工业区;可安全脱敏复制(见 05 文档) |

## 5. 审计结论(G0 前置事实)

1. 两工程技术栈、入口、身份体系、执行语义、存储均有源码级证据;无凭说明文字采信项。
2. 工作台对真实引擎的**全部既有假设被证实为缺口**:`sourceSystemId/sourceRevision`、capability manifest、FileAdapter、单位映射均不存在,需在 V7-1 新增(而非改既有模块语义)。
3. 引擎侧可无损读出的最小集 = SceneBundle(schema+实例) + 逐帧磁盘工件 + PG tick 行(新格式含 source_system_id);节点级输入版本在引擎中不存在(除 workflow NodeTrace),不得伪造。
4. 引擎已有**可编译图系统**(lc-* workflow JSON + 节点执行器 + 节点 trace),是 V7-4 S1/S2 映射的现实候选,无需先造编译器。
