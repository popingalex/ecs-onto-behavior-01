# 00 verified-baseline(v0.7-H 任务 A 交付)

日期:2026-10-23 ｜ 分支:`v07-h-hardening`(基于 main@`89d0ee628a664c500d7d8adb4e4969de463e24b9`)
方法:全部命令在本机复跑,非转录报告声明。

## AUD-01 代码与测试基线(独立复现)

| 项 | 值(实测) |
|---|---|
| 工作台 HEAD | `89d0ee628a664c500d7d8adb4e4969de463e24b9`(main;本轮在新分支 `v07-h-hardening` 施工) |
| 工作区差异 | 提交前 0(脏文件=本轮新增归档/证据,见批次提交) |
| 测试 | `corepack pnpm@10.34.3 test` → **125 passed / 0 failed**(与报告一致,复现) |
| tsc | `npx tsc --noEmit` → 0 错误 |
| build | `corepack pnpm@10.34.3 build` → 通过(~750ms) |
| 引擎仓 | mas-rust@`65c7f96`,工作区干净,本轮**零改动** |
| 在线服务 | 18080 在线;J3 会话(5UYNf2wUVurVl0616t0Xn)在列表中,只读使用 |

## AUD-02 报告文件定位核对(全部实存)

- `src/pages/p12/NativeExecutionPlan.tsx` ✅(报告称 pages/p12/,实为 `src/pages/p12/`,相符)
- `buildRunC` → `src/services/nativeImport/normalize.ts` ✅;RunBundle/FrameReplay → `types.ts`/`processView.ts` ✅
- Catalog → `src/services/nativeImport/catalog.ts` ✅;MapViewport/MapEngineMount → `src/components/domain/MapViewport.tsx` ✅
- J3 黄金证据 `design/04/evidence/j3-run-compare/native-run-compare.json` ✅(verdict PASS;本轮只追加 `correction_2026_10_23`,原始字段未动)

## AUD-03 REAL-06 PARTIAL 口径修订(矛盾消除)

- 原矛盾:REPORT 称「J0–J6 完成」又写「REAL-01..12 全 PASS(REAL-06 PARTIAL)」——统计口径不一致。
- 修订(已改 `00_v72_process_report.md`/`00_j3_v74_gates_report.md`):**REAL-01..05/07..12 PASS;REAL-06 PARTIAL**。
- REAL-06 缺口:引擎无用户可定义查询层(fixtures/PG 均无 query 定义),P10 原生模式为空态+解释,非静默。
- 通过条件(二选一,待用户/引擎侧裁定):①引擎暴露查询定义目录(schema 可导出);②接受替代口径「以运行命中数据(archetype+属性过滤)作为查询展示」并由用户书面豁免。

## AUD-04 + 关键更正:attributes 历史帧端点(本轮最重要发现)

- **J3 原对照脚本误用查询参数 `?frame=N`**——该形式被路由忽略,恒返 head(实测 frame=1/2/6 均 tick=6 属实)。
- 引擎真历史端点(**路径参数**):`GET /sim/:id/branch/:branch/:time/attributes`(`crates/server/src/routes/attributes.rs:163-196`,"tick>head 显式 404,不静默以 head 顶替";实现为 history 折叠装配只读路径,不 restore 共享 ECS)。
- **逐帧复测**(同 J3 会话,证据 `evidence/j3-run-compare/native-run-compare-history.json`):帧 1–6 每帧 resolvedTick=请求帧;工作台重放 vs 引擎真历史态 **3208/3208 全量零差异**;超界帧(t=99)实测 404。
- 措辞更正已落:旧结论「引擎 HTTP 不提供历史帧态/per-frame 为工作台独有」**作废**;正确表述:引擎提供只读历史帧端点,工作台重放与其逐帧全等。
- 由此 H1 的"引擎侧修复之一"两项候选中,「真实支持按帧解析」**已存在**(无需引擎改动);剩余治理项仅为:查询参数形式应在引擎侧显式拒绝或忽略告警(引擎 API 改动,留待授权)。

## AUD-05 引擎版本/存储路径与安全边界

- 在线 18080 为旧二进制:新会话写 legacy `s_simulation.snapshot` 列、无 `s_simulation_tick` 行(J3 会话实测;新 append-only 路径源码在 `7949a26` 之后)。**未重启、未迁移、未写共享 PG(除用户授权的 J3 会话数据本身)**。
- 只读定位(源码行号,均未改动):`system_registry` → `crates/runtime/src/system_registry.rs`;TraceRecorder → `crates/runtime/src/trace.rs`(未启用,meta.performance 仅 `{compute,simDurationMs,total}` 实测);`/cm` CRUD → `crates/server/src/routes/cm_crud.rs`(无 baseRevision 事务,维持 V7-3 闸门判定);deltas 端点(只读化修复 W2/C2)→ `routes/attributes.rs:197+`。

## 任务 A 结论

基线固定完成;报告声明全部独立复现;发现并更正一处我方误用端点的历史结论(J3 证据升级为逐帧 3208/3208)。REAL-06 口径已修订。进入任务 B/C/D 实施。
