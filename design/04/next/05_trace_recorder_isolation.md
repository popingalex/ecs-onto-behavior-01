# 05 TraceRecorder 隔离实验计划(H4,待授权)

日期:2026-10-22(深夜;提交 22:5x +0800,见 H_RELEASE_EVIDENCE) ｜ 状态:PLANNED(未执行;在线 18080 为旧二进制且有历史会话,禁重启)

## 现状(实测)

- 新运行 meta.performance 仅 `{compute, simDurationMs, total}`;无 per-system stats。
- `runtime_trace.jsonl` 未产出(TraceRecorder 未启用);FrameProfiler 累计量在引擎内有,未随工件落盘。

## 实验前置(缺一不可)

1. 用户授权运行**隔离引擎实例**(独立端口+独立 PG+场景副本;不复用承载历史会话的库);
2. 新二进制(≥7949a26)构建 ID 固定、schema 迁移与回滚方案落档;
3. 固定 fixture=已存 J3 数据(样例 D),不新建生产会话;
4. trace 开销上限与采样策略约定(禁全量逐节点)。

## 期望输出与验收(TRACE-01..05)

`runId/frame/phaseId/systemId/engineBuildId/start/end/duration/entityBatchCount/diagnostics/traceCompleteness`
+ (若引擎提供)actual read version refs。per-system duration **不得**当属性因果依赖(技术 span≠业务 DAG)。
缺 trace 时 UI 显示"当前引擎未提供此指标",不画假曲线(P22 现状即如此)。
