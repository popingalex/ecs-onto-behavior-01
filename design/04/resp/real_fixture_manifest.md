# real_fixture_manifest(V7-0 + V7-1 落位补录)

日期:2026-10-22 ｜ 性质:只读盘点登记 ｜ **V7-1 已获批准并完成复制落位**(见 §6)

## 1. 来源系统标识

| 项 | 值 |
|---|---|
| sourceSystemId | `mas-rust` |
| sourceRevision | git `65c7f96`(工作区干净,0 未提交修改) |
| 前端快照仓 | `mas-suite/mas-refactor`(非 git,只读参照,不入 fixture) |
| 数据库 | `localhost:5432/sim_2601`(只读 SELECT 计数:s_scene 2 / s_simulation 555 / s_simulation_tick 首查 17/复核 40,活库) |
| 审计时工作台 HEAD | `ecs-onto-behavior-01 @ 773b450`(109 tests 独立复验 PASS) |

## 2. 样例 A:场景+schema(fixture 只读,校验和实测)

| 文件 | sha256(前 16 位) |
|---|---|
| fixtures/chem-roaded/scene.json | `0f490721f7dc1170` |
| instances/ambulance.json | `2da565993f808745` |
| instances/ball_tank.json | `d88ce02d92de03fc` |
| instances/building.json | `ef22e24cae13446c` |
| instances/environment.json | `7f81e2c4db8b63a3` |
| instances/fire_engine.json | `2ddfdc5fee3a6015` |
| instances/fire_hydrant.json | `955e2d1ac8cf0adf` |
| instances/foam_fire_truck.json | `5a6873872bcd37c4` |
| instances/rescue_point.json | `d45d27238870a682` |
| instances/scene.json | `97818c47bbec9a78` |
| instances/tank.json | `58b5cc03fe25d1d4` |
| fixtures/shared/systems.json | `7f473911fb37fc05` |

- 完整 64 位哈希以 `shasum -a 256` 现场重算为准;fixtures/shared/{entities,components}/ 逐文件哈希在执行复制时补齐登记(19+44 文件)。
- **场景权威注记**:fixtures 薄指针 instances=[],真权威=PG `s_scene(chem-roaded).instances`(93 实例);导出时须一并 SELECT 该行 jsonb 并哈希登记。

## 3. 样例 B:真实运行(只读盘点,未复制)

| 项 | 值 |
|---|---|
| runId | `sBwT4d6RsTuGGHPIgu1L3` |
| 路径 | `mas-rust/data/output/sBwT4d6RsTuGGHPIgu1L3/` |
| 规模 | 10 帧 × 6 文件,1,996KB;83 实例(tank 66/ball_tank 6/foam_fire_truck 5/fire_truck 4/ambulance 1/environment 1);ext-* = 0 |
| 目录聚合 sha256 | `33fd29503ac914b6`(`find|sort|xargs shasum -a 256 | shasum -a 256`) |
| traceCompleteness | `PROPERTY_DELTA`(attribute_deltas 无 source_system_id;meta.json 有 perf 汇总) |
| frame-0 实测 | deltaCount 425 / instanceCount 83 / performance.total 26ms / source=init |
| 敏感性 | 合成测试数据;无人名/账号/密钥;坐标为测试工业区;**判定:可脱敏复制,仅限本地隔离目录** |
| 已知漂移 | 运行(06-30,83 实例)早于当前 fixture/PG 场景(93 实例);**运行初始世界以 frame-000000/frame_data.json 为权威** |

## 4. 样例 C:SYSTEM_EFFECT 级运行(PG+磁盘双侧,待授权导出)

- runId `4blIyLeuvJG-71gggXWcn`:PG tick 行 11 帧(main@0 delta 9 条;plan-evacuation@1..10,帧 1 含 203 条 delta;字段 `{attribute, frame_layer, instance_id, source_system_id, value}` 实测确证)。**已导出**(2026-10-22 18:5x,用户批准):ticks.jsonl 11 行 + bundle.json(完整 SceneBundle:scene 9 实例/entities/components 44/systems 23/expressions 35,无 ext-*)+ run.json(executionId)+ scene_info.json + 每 frame meta.json;排除 delta_frame.json(WS 投影,与 ticks 冗余)与 frame.json(pre/post 含 before 大对象,与 ticks 冗余)、*.log。场景=chem-evacuation。
- 只读导出步骤(需用户批准):`psql -tAc "select tick_entry from s_simulation_tick where simulation_id='4blIyLeuvJG-71gggXWcn' order by seq"` > `ticks.jsonl`;`rsync -a ~/app/simulation-server/4blIyLeuvJG-71gggXWcn/ <隔离目录>/disk/`;两处 sha256 登记本表补录。
- 导出前核对:该运行无 ext-* 实例与外部路由依赖(未核验——导出时先跑只读检查脚本)。

## 5. 脱敏与授权声明

- 排除项(永不入 fixture):`config.local.toml`(AMap key)、PG 凭据、providers 真实数据集(data/datasets 外部仓)、b3dm 受限资产、`~/app/simulation-server` 其余 2204 目录。
- 授权范围:用户在 req 中授权本地只读审计;样例复制到 `ecs-onto-behavior-01` 隔离测试目录属 V7-1 施工输入,**本轮未执行**。
- REAL-18 证据:本轮全部操作=git log/status、rg/ls/cat、shasum、psql SELECT、pnpm test(工作台自身);两工程源文件零修改、零提交、零推送、零数据库写入。

## 6. 缺口与补录(V7-1 落位后更新)

**已落位**(用户批准后 2026-10-22 执行,目标 `src/testdata/native/`,154 文件):

| 样例 | 落位路径 | 内容流 sha256(前 16) | 备注 |
|---|---|---|---|
| A 场景+schema | `src/testdata/native/chem-roaded/` | `baef70a4bc75f5f2` | scene.json+instances/10 文件+shared/{entities 19,components 44,systems.json,expressions.json}+scene-pg.json(PG s_scene 行导出,93 实例权威) |
| B 运行(全量逐字节) | `src/testdata/native/runs/sBwT4d6RsTuGGHPIgu1L3/` | `2b5a71933518adee`(与源 **MATCH**) | 10 帧 × 6 文件含 execution.log(.gitignore 已加 `!src/testdata/native/**/*.log` 反排除) |
| C 运行(核心集) | `src/testdata/native/runs/4blIyLeuvJG-71gggXWcn/` | `75c7c5e9705925c1` | ticks.json(PG SELECT 11 行,原 jsonl 转 JSON 数组、内容不变)+bundle.json+run.json+scene_info.json+每帧 meta.json;**排除** delta_frame.json(WS 投影,与 ticks 冗余)、frame.json(pre/post 含 before 大对象,与 ticks 冗余)、*.log |

全树聚合(`find|sort|xargs shasum -a 256|shasum`):`a4399b0c03169da6`。

剩余缺口:
1. 逐系统耗时曲线:需授权新跑一次短运行(引擎 TraceRecorder 已具备持久化能力,旧运行未启用)——不阻塞 V7-1。
2. C 的精确 fork tick(branches jsonb 未随样例导出)——导入器保守记 main@0 并在提交摘要注明缺口。
