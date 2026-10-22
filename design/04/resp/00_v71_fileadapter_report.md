# V7-1 完成报告:REAL_IMPORT_READ_ONLY FileAdapter(first_pr_proposal 实施)

日期:2026-10-22(晚) ｜ 计划:`design/04/resp/first_pr_proposal.md` ｜ 契约:`design/04/contracts/native-import-contracts.md`
基线:V7-0 审计(同日)→ 本轮在工作台仓实施;mas-rust 维持零改动。

## 一句话结论

first_pr_proposal 的变更清单全部落地:样例 A/B/C 经用户批准复制落位并哈希登记,新增 `nativeImport` 模块把 mas-rust 离线工件归一化为工作台模型/场景/运行(两份真实运行、一帧一提交、溯源按事实分级),REAL_IMPORT_READ_ONLY 模式以单一开关贯通执行/编辑/持久化三道封锁,11 项新测试对拍源工件,**120 passed / 0 failed**,tsc 干净、build 通过、浏览器实测原生模式全页面 + mock 回切无污染。

## 交付对照(变更清单 → 实测)

| # | 计划项 | 结果 | 证据 |
|---|---|---|---|
| 1 | 隔离 fixture 落位 | ✅ `src/testdata/native/` 154 文件 | manifest §6 哈希(B 与源逐字节 MATCH) |
| 2 | 归一化器 modelPackage | ✅ `nativeImport/normalize.ts`(类型分级/单位 UNKNOWN/presence/blockRef) | 测试 schemaCountsMatchSource / unitPolicyIsExplicit / presenceSemanticsPreserved |
| 3 | 运行导入 runBundle | ✅ B(磁盘全量帧)+C(PG ticks 重放)双来源 | runBMatchesDiskArtifacts / runCMatchesPgTicks |
| 4 | capabilityManifest | ✅ `catalog.ts` 静态声明 + 16 系统目录(S0/S1) | catalogIsWellFormed;P11 目录表 |
| 5 | readOnlyImportAdapter | ✅ settle 恒 `REAL_READ_ONLY` | 单测 + 浏览器实测横幅(证据图 04) |
| 6 | 数据源标识 | ✅ StatusBar 徽标+切换(确认后整页重载) | 证据图 01 |
| 7 | 页面接线 | ✅ 经 adapter facade 全页面生效:P01(19/44/226/93)、P08 实体、P20 帧 9 快照+93 实体、P26/P27 历史对比、P11 原生目录 | 浏览器 DOM 快照+截图 |
| 8 | 缓存隔离 | ✅ 原生模式不触 IDB(不恢复/不写入)、localStorage 草稿以 baseVersion 拒收跨模式存档 | 代码路径+模式不变量测试 |
| 9 | 测试 | ✅ 11 项新增,含 REAL-07 无 mock 泄漏断言(F01..C01 不在真实导入) | nativeImport.test.ts |
| 10 | 契约定稿 | ✅ contracts/native-import-contracts.md | — |

## 验收对账(first_pr_proposal §3)

| ID | 判据 | 状态 |
|---|---|---|
| REAL-01 | 审计完成 | PASS(V7-0 文档) |
| REAL-02 | 样例可重现 | PASS(manifest 哈希,B 逐字节 MATCH) |
| REAL-03 | 实体/类型/装配/继承对照 | PASS(93/19/44 逐项;测试 sceneIdentityMatchesPgRow) |
| REAL-04 | 0/null/unset/未装配可辨 | PASS(presenceSemanticsPreserved;缺键不回填) |
| REAL-05 | 单位校验+UNKNOWN 策略 | PASS(unitPolicyIsExplicit) |
| REAL-06 | 查询集合真实来源 | **PARTIAL**(引擎无用户查询层;P10 原生模式显示空+全局条解释——与 03 矩阵 `query.engine=READ_ONLY` 判定一致) |
| REAL-07 | 导入失败不伪装 | PASS(loader 缺件即抛错无 fallback 分支;settle 拒绝;mock 泄漏断言;浏览器横幅实测) |
| REAL-12 | 缓存非权威 | PASS(原生模式零 IDB/localStorage 写入) |

REAL-08..11(运行级对照/trace 展示/跳转/上下文切换)属 V7-2;本轮已具备其数据基座(两份运行包+22 native 提交+双分支)。

## 工程纪律

- mas-rust 零改动、零数据库写入(仅 SELECT 导出);工作台改动=8 文件修改+6 新源文件+fixtures,全部按最小面落点(契约 §6)。
- 回滚路径:契约 §7;默认模式不受影响(120 测试含全部既有 109 回归)。
- 已知缺口(不阻塞):逐系统耗时曲线需新运行授权;C 的精确 fork tick 未随样例导出(提交摘要注明);P08/P11 截图因 IAB 截图面偶发超时未存盘,以 DOM 快照留证(轨迹在会话记录),P01/P20 截图已存 `design/04/evidence/native-mode/`。

## 下一步(V7-2 建议)

1. RunBundle 侧 P22/P24 真实记录渲染:按 traceCompleteness 分级(PROPERTY_DELTA/SYSTEM_EFFECT),P23 显示"原引擎无请求→获准"。
2. P26 分支树只读 + P27 双运行对比的 native 视觉验证(数据已就位)。
3. J3-J6 取证:在引擎侧原生方式复跑样例 B 场景一次(需授权),双侧对照帧值。
