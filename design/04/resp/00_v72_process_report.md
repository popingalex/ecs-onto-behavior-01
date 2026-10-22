# V7-2 完成报告:真实运行过程只读分析

日期:2026-10-22(晚) ｜ 依赖:V7-1 FileAdapter(同日) ｜ 计划:`design/04/req` §7(V7-2)
测试:**125 passed / 0 failed**(+5 过程视图)｜ tsc 干净 ｜ build 通过 ｜ 浏览器实测通过

## 一句话结论

P20–P25 六个过程页在 REAL_IMPORT_READ_ONLY 模式下全部按引擎事实分级渲染:P22 显示原生帧过程(SYSTEM_EFFECT 级按 source_system_id 归并 / PROPERTY_DELTA 级仅属性变更),P24 显示属性逐帧演化链(来源系统可跳 P11 目录),P23/P25 以显式空态声明引擎不提供的记录(请求→获准、业务事件因果),全程缺口明示、零伪造。

## 交付明细

| 项 | 实现 | 证据 |
|---|---|---|
| 过程视图模型 | `src/services/nativeImport/processView.ts`(提交→帧反查、系统归因组、属性 delta、块引用、演化链) | 5 项新测试:21 帧提交全反查、C 帧 1=203 delta+归并组数=有来源 delta 数、B 级无来源组、chainOf 重建、块清单 |
| P22 原生帧过程 | `pages/p22/NativeFrameProcess.tsx`:帧头(run/branch/executionId/completeness)+缺口警示+系统归因组(可点选过滤)+帧内变更表(层/来源/帧值)+块引用 | 浏览器:C 运行帧 1 → fire-extinguishing(200 条,S1)+input(2)两组;pre 层 input 归因(受控命令)与 post 层系统归因如实分列;归因粘连原样保留并注明 |
| P24 原生演化链 | `pages/p24/NativeProvenance.tsx`:实例变更属性清单(可切换)+逐帧链(帧/提交/层/来源系统→P11 跳转/帧值);对象值标"块,不入值域" | 浏览器:environment 的 temperature_grid 链 1→10 帧全列,来源 fire-extinguishing 可跳 P11 |
| P23 显式空态 | 引擎无 EffectRequest/裁决:明示"不得从温差反推请求值",指路 P22 | 浏览器实测 |
| P25 显式空态 | 样例未含带 ID/因果字段事件;帧序≠因果 | 浏览器实测 |
| P26/P27 | 复用 V7-1 数据(22 native 提交+双分支);P26 实测 fork 分支树可见 | DOM 快照 |

## V7-2 验收对账(计划 §7)

| ID | 判据 | 状态 |
|---|---|---|
| REAL-08 | 原生运行 ID/版本/状态一致 | PASS(runId/executionId/branchId/帧号全链一致;测试+P20/P22 双页对读) |
| REAL-09 | trace 完整度正确,缺节点信息不补造 | PASS(SYSTEM_EFFECT/PROPERTY_DELTA 分级渲染;inputVersionRefs/请求对显式缺声明;测试钉死) |
| REAL-10 | 结果→原 System 跳转有据 | PASS(P22 归因组/P24 来源列 → P11 原生目录;系统名=引擎真实 id) |
| REAL-11 | 切换运行/时间/分支不串值 | PASS(浏览器 P20→P22→P24 同一提交上下文参数一致;两运行切换各页面取值正确;mock↔native 互切零泄漏[V7-1 已证]) |
| REAL-12 | 本地缓存非原生权威 | PASS(V7-1,维持) |

## 剩余缺口(不阻塞 v0.7-R)

1. ~~J3 需授权~~ → 当晚已执行并 PASS,见 `00_j3_v74_gates_report.md`。
2. 逐系统耗时曲线:引擎 TraceRecorder 未随旧运行持久化;如需,P22 可扩展 meta.performance 汇总展示。
3. P26/P27 画布为 SVG 渲染,ARIA 快照覆盖有限,以 P26 截图/DOM 佐证。

## 结论

v0.7-R(读真实数据和真实运行)的 J0–J6 静态链已闭环:J0(导出冻结+哈希)→J1(导入对照)→J2(P10 PARTIAL,按矩阵判定)→J3(复用既有真实运行,新运行待授权)→J4(P20 帧对照)→J5(P22/P24 分级溯源)→J6(上下文切换)。REAL-01..05/07..12 PASS;REAL-06 PARTIAL(缺口=引擎无用户查询层;通过条件与豁免记录见 design/04/next/00_verified_baseline.md §AUD-03);REAL-18 PASS。
