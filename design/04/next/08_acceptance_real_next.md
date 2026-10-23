# 08 REAL-NEXT 验收对账(v0.7-H)

日期:2026-10-22(深夜;提交 22:5x +0800,见 H_RELEASE_EVIDENCE) ｜ 分支 `v07-h-hardening` ｜ 测试 **138 passed / 0 failed**(+13)｜ tsc/build 通过
状态口径:PASS / PARTIAL / NOT_RUN(带证据)。

| ID | 关注点 | 状态 | 证据 |
|---|---|---|---|
| N-01 | 最新代码与运行版本可复现 | **PASS** | `00_verified_baseline.md`(SHA 89d0ee6…;125→138 复现链) |
| N-02 | REAL-06 口径修订 | **PASS** | baseline §AUD-03;三份报告措辞已改 |
| N-03 | 末帧写入值复现 | **PASS(升级)** | 逐帧 3208/3208 全等(原 535/535 为 head 级);`native-run-compare-history.json`+黄金钉死测试 |
| N-04 | 来源标识可复现且不夸大 | **PASS** | 390 条来源对拍 0 差异;P22 标"系统归因级,非节点因果";v07h 测试钉死 307/1/82 计数 |
| N-05 | 帧参数安全 | **PASS** | `assertResolvedFrame` 拦 head 顶替(FRAME_NOT_RESOLVED);黄金测试 frame2≠frame6 |
| N-06 | delta 重放可检验 | **PASS** | replayGuards 六类诊断+buildRunC 强制执行;mutated 黄金序列拒绝测试 |
| N-07 | 默认值分层 | **PASS** | 3208 显式写入 vs 35,408 默认物化分开统计;测试钉死 written=3208;不回填 |
| N-08 | 运行时 System 不丢 | **PASS** | field_thermal_live 改**动态发现**(硬编码已删);UNKNOWN 阶段不推测;CAT 测试 |
| N-09 | 原生 P12 只读 | **PASS** | 9 阶段+注册/运行期分组+元数据块(Plan Source/Read Visibility/禁用声明);浏览器 DOM 快照取证(P12 元数据/P11 锚定截图 11-P11-anchor-runtime-catalog.png;P12/P20 截图因 IAB 截图面超时未存盘,同先例) |
| N-10 | 旧/新二进制边界 | **PASS** | 全程未重启/未迁移;baseline §AUD-05 落档 |
| N-11 | TraceRecorder | **NOT_RUN**(闸门) | `05_trace_recorder_isolation.md`(隔离授权前置) |
| N-12 | provenance 分级 | **PASS** | SYSTEM_EFFECT/PROPERTY_DELTA 分级渲染;"缺节点输入版本"明示;不造因果边 |
| N-13 | ModelPatch 预览 | **PASS** | `modelPatch/protocol.ts`+4 测试(WRITE-01/02/03/05 本地语义);零引擎写入 |
| N-14 | 乐观锁/幂等 | **PARTIAL** | REVISION_CONFLICT/幂等登记簿本地实现;真实隔离引擎侧 NOT_RUN(W1 闸门) |
| N-15 | 失败原子性 | **NOT_RUN**(闸门) | 属引擎事务(WRITE-04) |
| N-16 | 原生图兼容诊断 | **PASS(声明级)** | `04_native_execution_semantics.md` Profile+兼容表;P12 禁用+说明;编译级诊断属 X0 |
| N-17 | IR 无损往返 | **NOT_RUN**(闸门) | X0 codec 未开工(前置已列) |
| N-18 | 地图挂载协议 | **PASS** | `mapMount/protocol.ts`+3 替身测试(握手/回环/陈旧丢弃) |
| N-19 | 空间权威 | **PASS(规则级)** | 契约禁止 Vec3 直接当经纬度;coordinateFrame 待联调核对(MAP-05 执行级属 G1) |
| N-20 | 真实地图联动 | **NOT_RUN**(闸门) | G1 |
| N-21 | 安全边界 | **PASS** | mas-rust 零改动、零 PG 写、未重启 18080;J3 黄金数据未改(仅追加 correction 字段) |
| N-22 | 证据归属 | **PASS** | 本表+baseline+evidence 目录逐项对应 |

## v0.7-H 发布判定

计划 §15 清单逐项:H0 ✅ / H1 ✅(含引擎端点更正) / H2 ✅ / H3 ✅(截图证据见 evidence/native-mode,P12 元数据实测) / J3 复核 ✅(3208 升级) / 未触共享 DB·未重启 ✅ / 状态透明 ✅。
**v0.7-H 达成**:可声称「工作台对已导入的真实引擎运行具备可复查的属性/来源对账、历史帧重放(与引擎真历史端点逐帧全等)、原生 System 计划只读分析」;
不得声称:模型可发布/图可编译执行/地图已接入/节点级因果完整。

---

## postH 增量对账(2026-10-22 深夜,分支 v07-post-h;146 passed / 0 failed,+8)

| 项 | 状态 | 说明 |
|---|---|---|
| P0 证据封版 | **PASS** | `H_RELEASE_EVIDENCE.md`:四证据问题全部裁定(端点=调用端更正/写入值与默认分层/日期以提交时间戳为准并已改/黄金数据哈希封存+correction 追加位) |
| P1 W0 补足 | **PASS(准备级)** | /cm 审计差异清单(纯 CRUD 无事务)落 06 文档;getStatus+部分失败原子性+UNSET/null 负例(141→146);**未 apply** |
| P2 X0 语义 | **PASS(只读级)** | Profile v0.2 代码化(写路径分置可见性/9 层 barrier/编译 false)+S 矩阵拒绝诊断+J3 归属核对测试;**未发布任何原生计划** |
| P3 G0 宿主 | **PASS(协议级)** | map-engine-v2 入口/坐标/featureID 实测落 07 文档;超时熔断+位置策略测试;**未接入真实地图** |

**宣布边界**:仅"证据封版与 W0/X0/G0 准备完成";W1(原生事务提交)/X1(IR 编译)/G1(真地图)/T(TraceRecorder)仍为闸门 NOT_RUN。

---

## W1+T 增量(2026-10-23,引擎 worktree 已推送;证据 w1-modelpatch/ + trace-isolated/)

| 项 | 状态 | 说明 |
|---|---|---|
| N-11 TraceRecorder | **PASS** | 隔离实例真实逐系统耗时(plan-run.jsonl;TRACE-01/02/04/05 ✓,03 映射待 UI) |
| N-13 模型变更预览 | **PASS(引擎实测)** | validate 零写入 + 变更集 |
| N-14 乐观锁/幂等 | **PASS(引擎实测)** | REVISION_CONFLICT/REPLAYED/IDEMPOTENCY_CONFLICT |
| N-15 失败原子性 | **PASS(引擎实测)** | 多操作一坏整包回滚,零半提交 |

**宣布边界更新**:W1(隔离场景)可宣布「原生事务化模型补丁可用(worktree 分支,待评审合入)」;生产场景合并与 addEntity/removeEntity 扩展仍待评审。
