# 本地 Agent:v0.7-H 后续 Sprint 任务单

> 先在工作台创建新分支;遵守仓库 AGENTS.md。
> 本轮允许修改**工作台**源码与测试,不允许修改 mas-rust、共享 PG、当前 18080 服务、原生场景或地图系统。
> 最新验收 `08_acceptance_real_next.md` 称 138 passed / 0 failed;`08_next_agent_tasks.md` 是上一轮已执行指令,**不要重复 H0–H3**。
> 主计划:`09_post_h_implementation_plan.md`。

## A. 证据封版(P0)

1. 确认 `v07-h-hardening` 完整 SHA、分支与 main 关系、工作区是否干净。
2. 复现 138 测试、tsc 与 build;核对 3208/3208 逐帧写值及 390/390 System 来源证据。
3. 查明 `attributes?frame` head-only 问题是调用端更正,还是引擎 API 已修复;写真实代码路径和请求对照。
4. 补 P12/P20 落盘视觉证据或明确 DOM 证据替代范围;核对 REAL-06 PARTIAL 口径。
5. 核查报告日期 2026-10-23 与本轮时间差异,固定 J3 原始样本 hash 和 correction 位置。
6. 产出 `H_RELEASE_EVIDENCE.md` 和源文件/代码行索引。

## B. W0 ModelPatch 无写入准备(P1)

1. 找到已存在的 `modelPatch/protocol.ts` 和 4 项测试,保留现有实现。
2. 只读检查 mas-rust `/cm` 的 revision、CRUD 和事务能力。
3. 起草原生 validate/dryRun/apply/getStatus 契约,覆盖引用、单位、继承/空值、expectedRevision、幂等及失败原子性。
4. 仅用工作台假服务完成冲突、重复 key、无效单位、部分失败等负例。
5. 输出差异清单与隔离原生实验方案,**不真正 apply**。

## C. X0 原生 System 语义对照(P2)

1. 只读审计原生 System 的 stage/tick/read/write/flush/barrier。
2. 明确工作台 `State[n]`/order-only 与原生帧内写传播的精确区别。
3. 形成 `ExecutionSemanticsProfile`、S0/S1/S2 兼容矩阵与 native→IR 只读适配方案。
4. 通过真实 J3 资料检查 ID、stage、run 归属;禁止发布任何原生新计划。

## D. G0 地图宿主准备(P3)

1. 复用已有 `mapMount/protocol.ts` 和 3 项替身测试。
2. 只读检查 map-engine-v2 真实入口、坐标单位/框架和 feature ID。
3. 补协议版本、origin 验证、请求超时、旧分支消息丢弃、选择回环和 null/原点等测试。
4. 不接入真实地图,不新建 Cesium 地图。

## 交付

- 工作台新增 `design/04/09_post_h_implementation_plan.md`(或已有文档更新)。
- H_RELEASE_EVIDENCE.md、modelpatch gap、native semantics profile、map mount contract 和相关测试。
- 每项记录 status、full SHA、真实测试命令、机读证据、浏览器证据、剩余风险。
- 任意需要原生引擎写入/服务重启/数据库迁移的任务停止并提出单独授权申请。

完成 A–D 仅能宣布"证据封版和 W0/X0/G0 准备完成";不可以宣布 W1/X1/G1 或 TraceRecorder 已验收。
