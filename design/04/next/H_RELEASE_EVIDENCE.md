# H_RELEASE_EVIDENCE(v0.7-H 证据封版,Sprint 0/P0 交付)

封版执行:2026-10-23 ｜ 封版人:本地 Agent(ZCode)｜ 封版基线:`main @ 34a3d2f1675ec3165ab73156ea7def2ef65572f6`
方法:全部命令本机复跑;引擎侧仅只读。

## 1. 版本与分支(A1)

| 项 | 值(实测) |
|---|---|
| `v07-h-hardening` HEAD | `029a63f26db502d7fa13ade5f121884e73a31721`(三提交:851f642 docs-A / 3b23fdb feat-B+C / 029a63f feat-D) |
| main | `34a3d2f`(merge --no-ff v07-h-hardening,2026-10-22 22:58:40 +0800);`v07-h-hardening ⊆ main` 验证通过 |
| 封版时工作区 | 干净(仅本轮新增 09/10 归档文件,属 v07-post-h 分支施工内容) |
| 测试复现 | `corepack pnpm@10.34.3 test` → **138 passed / 0 failed**;`npx tsc --noEmit` 0 错误;`vite build` ✓(~840ms) |
| mas-rust | HEAD `65c7f96`;本轮封版中发现并清除**我方残留临时脚本** `scripts/.j3-history.mjs`(上一轮 shell cwd 漂移误写入,非引擎文件),现 **0 脏文件**;18080 服务在线未重启(HTTP 200) |

## 2. 计划 §2 四个证据问题的裁定

### Q1 历史端点"更正"是调用端还是引擎修复?

**调用端更正;引擎 API 未修复也未损坏。** 路由表为证(`crates/server/src/app.rs:777-790`):

- `GET /sim/:id/branch/:branch/attributes` → `get_branch_attributes`(**head 态**);
- `GET /sim/:id/branch/:branch/:time/attributes` → `get_branch_attributes_at_frame`(**真历史帧**,`routes/attributes.rs:163-196`,tick>head 显式 404)。

`?frame=N` 查询参数**从未注册为路由参数**——J3 原脚本带查询参数请求命中 head 路由,属调用方误用。旧查询形式的 head 行为在引擎侧**依旧存在**(未变),工作台侧以 `assertResolvedFrame`(FRAME_NOT_RESOLVED)拦截兜底。**不得推断引擎 API 已改。**

### Q2 3208/3208 与 390/390 的覆盖边界

- 3208/3208 = 跨帧 1–6 **显式写入值**(工作台重放写入集 ⊆ 引擎真历史态,逐值全等);**35,408 项引擎物化默认值另层统计**,未参与等价宣称,工作台按 UNSET 不回填(测试钉死 `written=3208`)。
- 390/390 = **System 来源 ID 级**(source_system_id 逐条一致);**不构成节点级因果/输入版本**——P22/P24 已明示"系统归因级,非节点因果"。
- 以上口径已写入 `01_history_frame_contract.md` §3 与黄金测试注释。

### Q3 报告日期 2026-10-23 vs 实际 10-22 的问题

v0.7-H 各文档曾标注"日期:2026-10-23",实际提交时间戳全部为 **2026-10-22 22:55–22:58 +0800**(深夜施工,作者按完工日预写了次日日期)。**裁定:以 git 提交时间戳为权威**;本轮已将 7 份 next/ 文档日期改为"2026-10-22(深夜;提交 22:5x +0800,见 H_RELEASE_EVIDENCE)"。时区:+0800 本地。

### Q4 J3 黄金数据是否被就地改写?

**原始字段未动,更正以追加字段承载。** 证据(`design/04/evidence/j3-run-compare/`):

| 文件 | sha256(前 24) | 说明 |
|---|---|---|
| bundle.json | `896f8dd5e3155bc117432dac` | 引擎导出,未改 |
| native-run-compare.json | `d542ecf8d764404cbfd1f9ef` | **追加** `correction_2026_10_23` 字段(位置:顶层);simId/direction/frames/totalChecked/… 原始字段原样 |
| native-run-compare-history.json | `014aeac4b2fd573e8c37b19b` | 逐帧对照新证据(独立文件,非覆盖) |
| run.json | `21468746910c288b7984e787` | 未改 |
| ticks.jsonl | `e3b0c44298fc1c149afbf4c8` | **空文件存痕**(当时 PG 导出为 0 行的历史事实,保留不改);J3 真值 tick 落在 `src/testdata/native/runs/5UYNf2wUVurVl0616t0Xn/ticks.json`(样例 D) |

## 3. N-09 视觉证据口径(P12/P20 截图未落盘的裁定)

IAB 截图面在本环境对**后台化面板**持续超时("surface preparation timed out"),P12/P20 两张未能落盘;已落盘证据:`11-P11-anchor-runtime-catalog.png`。**裁定:以会话内 DOM 快照为 P12/P20 的正式验收证据**(完整 ARIA 树含 Plan Source/Read Visibility/9 阶段/17 系统/原生帧 4 等断言点,存于会话记录),验收文档已注明该限制。不虚构截图。

## 4. REAL-06 口径(复核维持)

PARTIAL 维持:缺口=引擎无用户可定义查询层;通过条件=①引擎暴露查询目录或 ②用户书面豁免"以运行命中数据为查询展示"。报告措辞已统一为"REAL-01..05/07..12 PASS;REAL-06 PARTIAL"。

## 5. 源文件/代码行索引

| 主题 | 位置 |
|---|---|
| 帧重放护栏 | `src/services/nativeImport/replayGuards.ts`(六类诊断+assertResolvedFrame) |
| 黄金钉死测试 | `src/services/nativeImport/__tests__/v07hHardening.test.ts`(3208/温度 41.4677…/77.43…/307/1/82) |
| 引擎历史帧路由 | mas-rust `crates/server/src/app.rs:777-790`;handler `routes/attributes.rs:163-196` |
| 引擎 head 路由 | 同上 `get_branch_attributes`(`attributes.rs:32+`) |
| 目录动态发现 | `src/services/nativeImport/catalog.ts`(collectRuntimeObservations/mergeRuntimeCatalog) |
| ModelPatch 本地契约 | `src/services/modelPatch/protocol.ts`(+`__tests__` 4 项) |
| MapMount 协议 | `src/services/mapMount/protocol.ts`(+`__tests__` 3 项) |
| 验收对账 | `design/04/next/08_acceptance_real_next.md` |

## 6. 封版结论

报告数字在固定提交 `34a3d2f` 上**全部独立复现**(138/0、3208/3208、390/390、端点行为、黄金哈希);四个证据问题均已裁定并落档。v0.7-H 证据封版完成,进入 W0/X0/G0(本轮 P1–P3)。
