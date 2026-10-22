# 03 双工程能力矩阵(V7-0)

日期:2026-10-22 ｜ 依据:02_dual_repo_audit.md 的源码定位
状态口径:`integrationClass ∈ NATIVE(原生可直接)/ ADAPTABLE(可映射)/ READ_ONLY(仅读展示)/ UNSUPPORTED(不可适配)/ UNKNOWN(证据不足)`;`decisionStatus` 首轮全部为 PROPOSED。

## 1. 核心能力矩阵

| capabilityId | 工作台实现 | 原系统实现 | integrationClass | 语义冲突 | 预计最小改动 | 证据 | 方案 |
|---|---|---|---|---|---|---|---|
| `schema.catalog.read` | PrototypeModel(schema:model-05 草稿文档;Zod 解析 `src/schema/parse.ts:71-246`) | PG s_entity/s_component/s_system + `fixtures/shared/{entities,components}`(19 archetype/44 组件)+ `GET /sim/:id/attribute-definitions` | **ADAPTABLE** | 工作台 TypeRef 有 quantityKind/unitId/frameId;引擎无单位概念 | 新增 FileAdapter 归一化器(archetype→EntityType、component→ComponentSchema、属性→AttributeSchema,单位按映射表填 UNKNOWN 不杜撰) | dto.rs:87-118;fixtures/shared/ | V7-1 导入 |
| `schema.write` | 本地草稿 CRUD 完备(draftRegistry) | `/cm/entity|component|system` CRUD 存在但为管理面,**运行 schema 变更须重建场景/会话** | **READ_ONLY(首轮)** | 双权威风险;并发版本校验缺失 | 暂不映射;V7-3 再议 ModelPatch | routes/cm_crud;engine.rs 装配链 | 首轮只读 |
| `entity.identity` | `id@version` ObjectRef;业务 id 字符串 | `InstanceId(String)`=业务 id 直接上 ECS;ext-{provider}-{item} 规则 | **NATIVE** | 无(字符串 id 同构) | 无(保留原 id 为稳定 ID) | components.rs:22-36;external_data.rs:386-401 | 直映射 |
| `entity.instance.read` | SceneEntity{templateRef,componentInstances,initialOverrides} | PG s_scene.instances jsonb(chem-roaded 93 实例)+ frame_data.json 键值全量 | **ADAPTABLE** | 引擎实例=扁平属性覆盖列表,无 templateRef 层 | 覆盖列表→initialOverrides;archetype→templateRef(一对一) | sql/02:106-153;实测 frame_data | V7-1 导入 |
| `value.presence` | 键存在性区分显式 null/UNSET;9 态 DisplayValue;无 valuePresence 字段 | 无 presence 概念;缺键=未写;组件存在性=archetype 成员 | **ADAPTABLE(有损向)** | 引擎无法区分 EXPLICIT_NULL 与 UNSET | 归一化规则:引擎缺键→UNSET;组件不在 archetype→NOT_APPLICABLE;`null`/`[]` 按值保留;**禁止把缺键回填 0** | values.ts:4-72;spawn_instance.rs:48-76 | 映射规则入 04 文档§2 |
| `value.unit.quantity` | TypeRef.quantityKind/unitId + °C→K 差异拒绝(domainBindingService:94-117) | 全 f64 无单位;单位散在命名/文档 | **ADAPTABLE(单向)** | 无损映射不可能;需单位字典 | 建 attr path→量种映射表(°C 温度/kW·m⁻² 热通量/L·s⁻¹ 流量/m·frame⁻¹ 速度等);查不到=UNKNOWN 并透出 | components.rs:877-885;attr_ids.rs | 映射表+UNKNOWN 策略 |
| `value.blocks.grid` | 无块引用概念(属性均标量/Vec3) | environment 单例网格组件:flat Vec<f64>+nx/ny/cell_meters;`radiation_matrix/intensity_grid/contours` 以属性 delta 传 | **READ_ONLY** | 百万格不可展开为实体 | 作为 blockRef 数据块导入,P20 只显示摘要/范围,不解构 | components.rs:240-400;实测 delta 样例 | blockRef 契约(V7-1 只摘要) |
| `query.engine` | queryMatches:eq+previous+按 id 排序(Zod 钉死) | 系统 query=archetype+属性过滤(系统注册表 reads/writes);`/api/grid/system-matrix` 内省 | **READ_ONLY(首轮)** | 工作台查询不可配置 op;引擎查询嵌入系统定义 | 导入时把系统 reads 映射为"声明访问集",P10 展示命中集合来自真实 frame 数据比对 | model.ts:93-100;system_registry.rs:237-339 | PARTIAL 对照 |
| `system.catalog.read` | SystemDefinition{queryRef,programRef,access} | system_registry 16 系统+reads/writes/triggers;PG s_system;`/api/grid/system-matrix` | **ADAPTABLE** | 工作台无 phase/triggers 概念 | 目录导入含 phase/order_hint 存 native metadata;P11 只读展示 | system_registry.rs:679-1089 | V7-1 目录导入 |
| `system.schedule.write` | P12 ScheduleDocument(order/effect 边、Reducer/Contract/Commit 节点) | 引擎调度=注册表 phase+after/before 约束(PG DTO 可加序) | **UNSUPPORTED(→V7-4)** | 图语义(order-only/product 拒绝)与 9 阶段调度不可逆映射 | 不映射;P12 对真实引擎只读渲染"等效计划" | scheduleCompiler.ts;system_registry.rs:617-659 | V7-4 闸门任务 |
| `system.program.graph` | P14 FlowGram 图(9 节点类型,类型化端口+单位) | **lc-\* workflow 节点图**(fixtures/shared/business-systems/ 10 套 system.json+snippets;行为解释器+NodeTrace) | **ADAPTABLE(S1/S2 候选)** | 节点类型集不同;workflow 无单位约束 | 双向编解码器(LogicGraphDocument⇄workflow JSON);不可表达节点保留 native 块 | behavior_workflow/*;fixtures/shared/business-systems | V7-4 主路径 |
| `system.dynamic.load` | 无(程序只在工作台内) | cdylib 动态系统加载器+deno 脚本(SDK 通道) | **UNSUPPORTED(黑盒)** | 编译产物不可视化还原 | S0 黑盒展示 | dynamic_system_loader.rs:1-40 | S0 |
| `execution.run` | ExecutionAdapter.settle(整轮) | 推帧 `POST /sim/:id/branch/:b/:t`;FrameProfiler | **ADAPTABLE(FileAdapter 读结果)** | 工作台不发起真实执行(首轮) | RunBundle 只读导入;不回写 | routes/simulation.rs:684+ | V7-2 |
| `trace.system.effect` | EffectRequest/Allocation/ConstraintDecision(请求→获准) | PG tick delta 带 source_system_id(**无请求/获准对**);CommandLog 仅用户命令 | **READ_ONLY** | 引擎无贡献/裁决协议;不可从结果逆推请求 | RunBundle.traceCompleteness=SYSTEM_EFFECT(PG 源)或 PROPERTY_DELTA(磁盘源);P23 显示"原引擎未提供请求级数据" | 实测 tick_entry 样例;command_log.rs | V7-2 诚实降级 |
| `trace.node` | NodeExecution.inputVersionRefs+traceabilityGaps | 仅 workflow 系统有 NodeTrace(by_node/by_frame);native 系统无 | **READ_ONLY(部分)** | 输入版本概念引擎不存在 | lc-* 系统可显示节点级耗时;native 系统明示缺口 | node_trace.rs:9-106 | 分级展示 |
| `run.records` | RunRecord(inputVersions=语义哈希) | meta.json(perf/source/tick)+execution.log+PG 行(executionId/requestId/revision) | **ADAPTABLE** | 工作台 inputVersions 是自产哈希,不能套在引擎运行上 | RunBundle 保留引擎原生 executionId/branchId/frame/revision;不伪造 inputVersions | persist.rs:272-500;sql/02:500-522 | 原生字段直存 |
| `history.commit.branch` | 本地 IDB:commit 链+分支 head+fork;导出不导入 | BranchGraph DAG(main/fork/commit);PG branches jsonb(节流)+tick append-only;恢复续算 `restore_from_stage_deltas` | **ADAPTABLE(单向导入)** | 引擎 commit=帧,工作台 commit=settle 结果;粒度可对齐(一帧=一 commit) | 帧→commit 映射;分支树导入 P26 只读;**工作台缓存不得写回** | history/src/branch.rs:16-145 | V7-2 |
| `history.replay.resume` | 本地回放(记录重放) | tick 重放恢复+续算(实测路径存在)+WASM 内核播放 | **NATIVE(引擎侧)** | 工作台无续算 | 首轮仅回放展示;续算归引擎 | simulation.rs:1172-1200 | 展示原生能力 |
| `geo.map.host` | MapViewport 宿主+MapEngineMount 挂载位(从未传 engine) | map-engine-v2(Cesium,b3dm/lowpoly/等值线/路线)+MapEngineDataProvider 协议 | **ADAPTABLE(接口已备)** | 坐标系:工作台 park-ENU(米)vs 引擎 [lon,alt,lat] 度 | V7-5 经 MapEngineMount 挂 map-engine-v2 或轻量只读图层;**首轮不做** | MapViewport.tsx:13-16;map-engine-v2/core | V7-5 |
| `geo.position` | position.local Vec3 米+nullable;[0,0,0]≠null | transform/position [lon,alt,lat] 度;缺省=未写 | **ADAPTABLE** | 序+单位+参考系三重差异 | 归一化器显式换算并记录 frameId=native-geodetic;null 保留 | components.rs:39-45 | V7-1 |
| `provenance.sourceIds` | 无 sourceSystemId/sourceRevision | 引擎有 executionId/simulationId/branch/frame/requestId/revision 全链 | **ADAPTABLE** | 方向相反:引擎比工作台完备 | 工作台 RunBundle 增加 sourceRevision 字段(新增,无破坏) | runtime/src/provenance.rs:37-105 | V7-1 |
| `capability.manifest` | 无 | 无统一 manifest;能力散在路由 | **ADAPTABLE** | — | 静态 JSON FileAdapter 附带 | app.rs 路由清单 | V7-1 新增 |

## 2. 引擎 16 系统 S0/S1/S2 分级

| 系统(system_registry id) | 实现形态(config 默认 workflow 模式) | 分级 | 依据 |
|---|---|---|---|
| combustion | lc-combustion workflow 覆盖 + native 快路径 | **S1**(图可读可映射;native 部分黑盒) | fixtures/shared/business-systems/lc-combustion |
| mobile(疏散移动) | lc-mobile + native(路网+车道偏移) | **S1** | lc-mobile;systems/mobile.rs |
| radiation-diffusion | native(网格管线)+lc 覆盖可选 | **S0**(native 网格内核;参数可读) | systems/radiation/* |
| fire-extinguishing | lc-fire-extinguishing | **S1** | lc-fire-extinguishing |
| sprinkler | lc-sprinkler | **S1** | lc-sprinkler |
| water-intake | lc-water-intake | **S1** | lc-water-intake |
| tank-init / geo-damage / injury-threat / transport(lc-transport) | 混合 | tank-init **S1**;geo-damage **S0**;injury-threat **S0**(纯 native 计算+带外 summary);transport **S1** | 各 lc- 目录存在性+systems/ |
| system.structural/commit/history/metrics/priority-arbitration/health-monitor | 基础设施系统 | **S0**(非业务,不映射) | ids mod :545-577 |
| 任意 cdylib 动态系统 | .so/.dylib 加载 | **S0** | dynamic_system_loader.rs |

**S2(图可双向编译并原生执行)在 V7-0 无证据支持**:workflow JSON 虽是图,但其节点类型集≠FlowGram 节点集,且引擎不消费外部图 IR。V7-4 需先证明 LogicGraphDocument→workflow JSON 编译+对拍一致,才可升级 combustion/sprinkler 等为 S2。

## 3. 数据损失风险汇总

| 项 | 风险 | 等级 |
|---|---|---|
| 单位/量种 | 引擎无单位→工作台单位校验链对导入数据退化为 UNKNOWN(不校验) | 可接受(明示) |
| 属性级来源 | 磁盘工件无 source_system_id;仅 PG 新格式有 | 可接受(PROPERTY_DELTA 级明示) |
| 请求→获准效果对 | 引擎不存在 | 不可接受(不得伪造)→ P23 降级展示 |
| 输入版本引用 | 引擎不存在(native 系统) | 不可接受(不得伪造)→ 不生成 NodeExecution.inputVersions |
| 网格块 | 展开为实体会爆炸 | 不可接受 → blockRef |
| 旧运行(legacy snapshot 列) | 555 会话中绝大多数无 tick 行 | 可接受(选样时只用新格式或磁盘工件) |
| 场景漂移 | fixture(93 实例)晚于样例运行(83 实例) | 可接受(以运行 frame-0 为准,manifest 记录差异) |

## 4. verificationId 对应

矩阵各行方案落点 → V7-1 验收 REAL-01..07(导入/身份/值/单位/查询/无 mock 回退)、V7-2 验收 REAL-08..12(运行对照/trace 完整度/跳转/上下文隔离/缓存非权威)。逐项见 06_integration_decisions.md §验收映射。
