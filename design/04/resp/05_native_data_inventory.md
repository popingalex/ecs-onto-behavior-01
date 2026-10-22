# 05 真实数据样本盘点(V7-0)

日期:2026-10-22 ｜ 全部为**只读盘点**结果(未复制、未导出、未修改)

## 1. 引擎侧数据资产总览

| 资产 | 位置 | 规模 | 内容 |
|---|---|---|---|
| 场景 fixture | `mas-rust/fixtures/chem-roaded/` | scene.json 151B(**薄指针,instances=[]**)+ instances/*.json(10 文件,93 实例)+ plan-ternary-v1.json 10.9KB | 危化品火灾-路网场景:66 tank+6 ball_tank+5 foam_fire_truck+4 fire_truck+1 ambulance+1 environment(实际权威在 PG s_scene) |
| 场景 fixture | `fixtures/chem-evacuation/` | 289B 薄指针+plan 37.8KB | 人员转移场景(PG 9 实例) |
| schema fixture | `fixtures/shared/` | 19 archetype JSON+44 组件 JSON+systems.json+expressions.json+example-behaviors.json+system-field-access.json | **引擎的"schema 目录"静态副本**(PG s_entity/s_component 的种子) |
| 低代码系统 | `fixtures/shared/business-systems/` | 10 套(lc-combustion…lc-water-intake,各 system.json+snippets/) | workflow 节点图定义(V7-4 S1 映射素材) |
| 录制路线 | `fixtures/chem-evacuation/routes/` | 219 个高道德线 JSON(经纬度命名) | 外部 AMap 路由录制(重放确定性依赖) |
| 基准运行 | `data/output/` | 371 目录 / 170MB | 每目录 summary.json{simId,sceneId,planId,framesExecuted…}+逐帧工件(branch-*/frame-000NNN/) |
| 服务器执行日志 | `data/logs/` | 119 sim 目录 / 1.1GB | {sim}/execution.log+branch-*/frame-*/{meta,delta_frame,frame_data,…} |
| **在线 data_dir** | `~/app/simulation-server/` | 2205 目录 | config data_dir 实际落点(含 4blIyLeuvJG-71gggXWcn) |
| PostgreSQL | `localhost:5432/sim_2601` | s_scene 2 / s_simulation 555 / s_simulation_tick 17 | 555 会话绝大多数为 legacy snapshot 格式;**新 append-only 格式(delta 含 source_system_id)覆盖 3 个运行共 40 行(活库,计数随时增长):4blIyLeuvJG-71gggXWcn 11 帧(main@0+plan-evacuation@1..10)等** |
| providers | `/cm/integration/*`(服务端)+ data/datasets(外部仓) | — | 医院/人员/救援力量;**不在本轮样本内** |

## 2. 推荐只读样例(第三步选择结果)

### 样例 A:场景+schema 快照(J0/J1 用)

- `fixtures/shared/{entities,components}/*.json` + `fixtures/chem-roaded/instances/*.json` + PG `s_scene(chem-roaded)` instances jsonb(93 实例,权威)。
- 特性:多类型(6 类)、多组件(44 定义)、关系(罐-消防车-环境)、属性带位置;**无个人信息、无真实单位名称**(实例名如"储罐-N/救护车-1")。
- 校验和:见 `real_fixture_manifest.md`。

### 样例 B:小型真实运行(J3–J6 用,PROPERTY_DELTA 级)

- **`data/output/sBwT4d6RsTuGGHPIgu1L3/`**:10 帧(branch-main),83 实例(66 tank/6 ball_tank/5 foam_fire_truck/4 fire_truck/1 ambulance/1 environment),**0 个 ext-\* provider 实例**(完全自包含),1.95MB。
- 每帧 6 文件:meta.json(perf/source/tick/instanceCount)、frame_data.json(全量状态,键=实例 id)、delta_frame.json(WS 线格式 {b,d:[{a,i,v}]} 含 contours)、attribute_deltas.json({instanceId,id,after,branch,tick})、batch_changes、simvo_changes。
- 覆盖多系统演化:辐射 contours/网格、flammable/health/container 属性逐帧变化(实测 frame-5 delta 域:container/environment_radiation/flammable/health)。
- 追溯级别:PROPERTY_DELTA(无 source_system_id)→ P22/P23 按此级展示。
- 缺口:该运行(2026-06-30)早于当前 fixture(93 实例)与 PG 场景版本;**以 frame-000000/frame_data.json 为该运行的初始世界权威**,场景漂移在 manifest 记录,不回填。

### 样例 C:SYSTEM_EFFECT 级运行(V7-2 升级用)

- **PG `s_simulation_tick` where simulation_id=4blIyLeuvJG-71gggXWcn**(11 行:main@0 + plan-evacuation@1..10,delta 带 source_system_id/frame_layer;另有 bundle.json 完整 SceneBundle+run.json executionId)+ `~/app/simulation-server/4blIyLeuvJG-71gggXWcn/` 磁盘工件双侧齐备。
- 只读导出步骤(待用户批准后执行):`SELECT tick_entry FROM s_simulation_tick WHERE simulation_id='…' ORDER BY seq` → JSON 文件+行数/哈希登记;磁盘目录 rsync 到隔离目录。

## 3. 运行可复现性条件(实测结论)

- 无 RNG;确定性闭式力学。重放=SceneBundle+tick 行按 seq(代码路径 `load_full→import_all→restore_from_stage_deltas`)。
- 破坏项:ext-* 实例需 s_simulation.instances 恢复(样例 B 无此问题);AMap 路由需 fixtures/routes 复用;nanoid 以 restored_id 保留。
- **样例 B/C 均不含破坏项**(B 无 ext/无外部路由依赖;C 需验证,导出时核对)。

## 4. 敏感性与授权边界

- 样例 B 数据面:测试场景合成数据,无人名/账号/secret;坐标位于测试工业区(117.62,38.71);AMap 路线为公开路网几何。**结论:可脱敏隔离复制,不外传**。
- 严禁入样例:config.local.toml(含 AMap key)、PG 连串、providers 真实数据集、b3dm 受限资产。
- 使用范围:仅本地 `ecs-onto-behavior-01` 测试目录(design/04/fixtures 或 src/testdata),验收后按用户指示保留/删除。

## 5. 缺口清单

| 缺口 | 影响 | 补齐方式(均只读或需授权) |
|---|---|---|
| 旧运行(555 会话)无 tick 行 | 无法 SYSTEM_EFFECT 级导入 | 只用样例 C;旧运行按 SNAPSHOT/PARTIAL 处理 |
| 审计目录未见 runtime_trace.jsonl 持久化 | per-system 耗时只有 meta.json 汇总 | 引擎侧已实现 TraceRecorder;若需逐系统曲线,V7-2 用新跑一次运行(需授权触发)或用 meta.json 汇总 |
| 无 WS 捕获文件 | WS 线格式只能从 delta_frame.json 间接代表 | 可接受;FileAdapter 不依赖 WS |
| fixture 场景与样例 B 时间漂移 | 初始状态对账 | 以运行 frame-0 为权威,manifest 记 diff |
| `jobs/runs/` 为空、test-results 仅 last-run | 无影响 | — |
