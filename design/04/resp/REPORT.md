# ecs-onto-behavior-01 现状报告(截至 2026-10-23)

工作台 `main @ 0b60022`(已推送,148 passed / 0 failed)｜ 引擎 `feature/202605 @ 1ff58ba`(已推送,W1+T 已合入)
本轮覆盖:自上次 req 输入(postH 两份计划,归档为 `09_post_h_implementation_plan.md`/`10_post_h_agent_instructions.md`)以来的全部工作。

## 一句话现状

**W1(原生事务化模型写入)已从引擎端点到工作台 UI 端到端闭环**:引擎 `/cm/model-patch` 单事务端点(乐观锁+幂等+原子回滚)合入主线,W-01..08 隔离实测全 PASS;工作台 P18 补丁面板浏览器 E2E 实际提交成功(APPLIED rev-3,引擎复核落库);T(逐系统 TraceRecorder)真实输出落地(TRACE-01/02/04/05 PASS)。全程 18080 共享服务未动、共享 PG 仅增量、既有数据零破坏。

## 自上次 req 以来的三段工作

### ① postH Sprint(P0–P3,分支 `v07-post-h` 合并 `b7172d4`)

| 批次 | 结果 | 要点 |
|---|---|---|
| P0 证据封版 | PASS | `next/H_RELEASE_EVIDENCE.md`:四个证据问题全部裁定——历史端点"更正"=**调用端误用**(查询参数从未注册路由,引擎双路由并存未改);3208/3208=写入值层、35,408 默认另层;文档日期以 **git 提交时间戳**为权威并已修正;J3 黄金数据 correction 为追加字段、哈希封存 |
| P1 W0 | PASS(准备级) | /cm 审计:纯 CRUD、revision/事务 **0 命中**;modelPatch 补 getStatus 契约+部分失败原子性+显式 null(绕过单位检查)与 UNSET 区分负例 |
| P2 X0 | PASS(只读级) | `executionProfile.ts` Profile v0.2 代码化:帧内可见性**按写路径分置**(write=FRAME_PROPAGATED / deferred=DEFERRED_FLUSH / silent=SILENT_BLOCK / workflow=PHASE_SNAPSHOT);S 矩阵一律拒绝编译(X1 闸门);J3 归属核对测试 |
| P3 G0 | PASS(协议级) | map-engine-v2 只读核对(入口=React 组件无 iframe 出口、默认 LNG_ALT_LAT、feature id=instanceId 零转换);mapMount 超时熔断+位置策略(null 不渲染/[0,0,0] 合法/Vec3 待坐标系联调) |

### ② W1+T 引擎侧(用户授权 worktree+共享 PG 增量;分支 `feat/w1-model-patch-1023`,合入 `feature/202605` 并推送)

- **W1 端点** `/cm/model-patch/{validate,apply,status/:key,revision/:scene}`(schema/model_patch.rs + routes/model_patch.rs):rev-N 修订计数器(不动 s_scene DDL);apply 单 tokio_postgres 事务=幂等摘要→`FOR UPDATE` 行锁→修订比对→s_entity 声明+类型校验→instances jsonb 原子更新+审计登记。
- **验收 W-01..08 全 PASS**(隔离实例 18081+独立 data_dir,证据 `evidence/w1-modelpatch/`):dryRun 零写入/原生 rev-1→rev-2 修订链/四类拒绝/同 key 重放不重复写、异请求冲突/多操作一坏整包回滚零半提交/原场景与 J3 会话零触碰/双侧(引擎↔工作台归一化器)逐值一致/18080 PID 全程不变。
- **附加实证**:补丁场景上重跑点燃 6 帧,delta 50/30/27/25/23/23 与 J3 **逐位一致**(确定性保持)。
- **T**:`MAS_TRACE_RECORDER=1` 门控+双持久化路径逐帧 flush(踩坑:推帧走 push 路径,仅挂 engine.rs 会漏);`plan-run.jsonl` 每帧 10 系统逐项 duration_ms(真实 TraceRecorder 非估算,TRACE-02);开销约 +10%(TRACE-04)。

### ③ W1-UI+TRACE-03(工作台 `main @ 0b60022`)

- `nativeClient.ts` 四端点客户端,含 **DTO 翻译**(工作台 `entityId` ↔ 引擎 `instanceId`,实测发现)+ zod 拒绝空操作。
- P18 原生模式=补丁面板(仅连隔离实例,明示禁指 18080):**浏览器 E2E 实操作 拉取 rev-2 → validate(before/77)→ apply APPLIED rev-3**;引擎复核 tank-1 health/durability=77 落库、审计表 rev-1/2/3 可查;截图 `12-P18-native-modelpatch.png`。
- TRACE-03:display_name↔sys_id 10 条映射入 catalog(实测名全覆盖,未知名不猜),测试钉死。

## 里程碑总账(V7-0 至今)

| 阶段 | 状态 | 交付锚点 |
|---|---|---|
| V7-0 双工程审计 | ✅ | resp/02–06+manifest(22 项能力矩阵,S0/S1 分级) |
| V7-1 FileAdapter 只读导入 | ✅ | 双模开关+三道封锁;109→120 tests |
| V7-2 过程只读分析 | ✅ | P22 帧过程/P24 演化链分级;125 tests |
| J3 实跑对照 + V7-4 切片 | ✅ | 逐帧 3208/3208 全等(端点勘误后);P12 等效计划 |
| v0.7-H 加固 | ✅ | replayGuards+样例 D 黄金钉死+目录动态发现;138 tests |
| postH(P0–P3) | ✅ | 证据封版+W0/X0/G0 准备;146 tests |
| W1 引擎+UI 闭环 | ✅ | 引擎合入 feature/202605;P18 E2E;148 tests |
| T 逐系统耗时 | ✅ | plan-run.jsonl 实测;N-11 PASS |
| X1 图编译 / G1 真地图 | ⛔ 未开工(无环境卡点:X1 可用隔离实例 workflowResource 通道;G1 需 map-engine-v2 壳方案) | — |

## 验收与安全边界

- REAL-NEXT 现状:N-01..10/12/13(引擎实测)/14(引擎实测)/15(引擎实测)/16/18/19/21/22 PASS;N-11 PASS;N-17/20 NOT_RUN(X1/G1)。
- 安全边界执行:18080 全程未动(PID 31791 起于 Oct21 不变);共享 PG 仅增量(新表 s_model_patch、试验场景 chem-roaded-w1lab 现 rev-3、试验 sim 行——保留作证据,可按需清理);J3 黄金数据未改;未以 mock 冒充真实、未把 source_system_id 冒充节点因果、未猜经纬度。
- 引擎侧合并说明:mas-rust 与 mas-suite/mas-rust 为两个独立 clone 同在 feature/202605;合入经 mas-rust 拉取 origin 分支完成(代理失效期 GitHub SSH 直连可用)。

## 文档地图(resp/next)

- resp/:02–06 审计五件+manifest+first_pr_proposal;00_v71/v72/j3_v74 各轮报告;**本文件=现状总报告**。
- next/:00_verified_baseline、01_history_frame_contract、04_native_execution_semantics(v0.2)、05_trace_recorder_isolation、06_model_patch_protocol(含引擎已实现标注)、07_mapengine_mount_contract、08_acceptance_real_next(REAL-NEXT 对账)、11_w1_t_report(W1+T 完整报告)、H_RELEASE_EVIDENCE。
- 归档计划:07/08(v0.7-H 轮)、09/10(postH 轮)。
- 证据:j3-run-compare/、native-mode/、w1-modelpatch/、trace-isolated/。

## 下一步建议(无授权依赖排序)

1. **X1 图编译对拍**(环境已备:隔离实例+workflowResource 通道+J3 对拍方法);2. addEntity/removeEntity 扩展(引擎侧,复用事务框架);3. G1 map-engine-v2 iframe 壳方案评审;4. 工作台接 trace display(P22 逐系统耗时面板,数据源 plan-run.jsonl)。
