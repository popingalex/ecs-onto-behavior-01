# 11 W1+T 实施报告:原生事务化模型补丁 + 逐系统 TraceRecorder

日期:2026-10-23 ｜ 授权:用户(「mas-rust 在 worktree 开工,共享 PG 只要不破坏已有数据」)
引擎:worktree `mas-suite/wt-ecs-w1-1023` 分支 `feat/w1-model-patch-1023 @ 1cd0076`(基线 65c7f96,**已推送**)——18080 共享服务全程未动(PID 31791 起于 Oct21 不变)
隔离实例:18081(独立 data_dir=/tmp/w1-data,共享 PG 增量写:新表 s_model_patch + 新行,既有行零修改)

## 一、W1:/cm/model-patch 事务化端点(引擎侧实现)

**端点**(`crates/server/src/routes/model_patch.rs`):
- `POST /cm/model-patch/validate` —— dryRun 零写入,返回变更集+当前修订;
- `POST /cm/model-patch/apply` —— 单 tokio_postgres 事务:幂等键检查(同 key 同摘要→重放/异摘要→冲突)→ `SELECT … FOR UPDATE` 场景行锁 → 修订号原子比对(`rev-N` 计数器)→ 全操作校验(s_entity 声明核对+类型门)→ instances jsonb 原子更新+登记行 → 提交;任一步失败整体回滚;
- `GET /cm/model-patch/status/:key` —— 超时后幂等查询(UNKNOWN 不允许自动重试);
- `GET /cm/model-patch/revision/:scene` —— 乐观锁基线。

**验收 W-01..08(证据 `design/04/evidence/w1-modelpatch/`,隔离实例实测)**:

| ID | 判据 | 结果 |
|---|---|---|
| W-01 | dryRun 零写入 | **PASS**(changeset 正确;instances md5 前后一致) |
| W-02 | 成功产生原生 revision | **PASS**(APPLIED rev-1;tank-1 health/durability=25 落库;修订链 rev-1→rev-2 复验) |
| W-03 | stale/未声明/类型不符/实例缺失拒绝 | **PASS**(REVISION_CONFLICT/ATTRIBUTE_UNDECLARED/TYPE_MISMATCH/ENTITY_MISSING) |
| W-04 | 幂等 | **PASS**(同 key 同请求→REPLAYED 修订不前进;同 key 异请求→IDEMPOTENCY_CONFLICT) |
| W-05 | 失败原子性 | **PASS**(两操作一坏→整包 REJECTED,md5 不变,tank-2 未写入) |
| W-06 | 历史不变 | **PASS**(chem-roaded md5=50a3f57a… 不变;J3 会话行 updated 时间戳不变) |
| W-07 | 双侧读取一致 | **PASS**(引擎补丁值经工作台 normalizeScene 读取:tank-1=25/tank-2=60/93 实例;`w07-bilateral.json`) |
| W-08 | 未触共享服务 | **PASS**(18080 HTTP 200 且 PID/启动时间不变;共享 PG 仅增量) |

**附加实证**:W1 补丁后场景(chem-roaded-w1lab)上重跑点燃 6 帧,delta 序列 50/30/27/25/23/23 与 J3 逐位一致——补丁未破坏确定性重放。

## 二、T:逐系统 TraceRecorder(真实输出)

- 门控:`MAS_TRACE_RECORDER=1`(默认关;`simulation.rs` 构造点 + push/plan-tick 两条持久化路径逐帧 flush);
- 实测(证据 `design/04/evidence/trace-isolated/`):`plan-run.jsonl` 每帧含 `system_stats` 10 系统逐项 `duration_ms`(如帧 1 人员受威胁热力 16ms),**来自 TraceRecorder 非估算**(TRACE-02);
- TRACE-01 ✓(隔离实例,18080/共享 PG 未动);TRACE-04 开销对比:无 trace 34.3/42.8/37.0ms vs 有 trace 37.6ms 量级(≈+10%,单帧级,详见 `trace-summary.json`);TRACE-03 display_name↔sys_id 映射待 UI 接线(限制已记);TRACE-05 ✓(工作台未接时仍显示"未提供",不画假曲线)。

## 三、边界与遗留

- W1 首个试验范围=replaceAttribute(计划 §4 约定);addEntity/removeEntity 为后续(需引用删除审计);
- s_model_patch 为**新表**(增量);REJECTED 亦落审计行;同 key 重试语义=同摘要重评估/异摘要拒绝(文档化);
- worktree 未合入引擎 main(待评审);共享 PG 中 w1lab 场景与 2 个试验 sim 行保留作证据,可按需清理;
- 工作台 UI 尚未接 /cm/model-patch(下一批:P18 发布页接入 dryRun/apply 流)。
