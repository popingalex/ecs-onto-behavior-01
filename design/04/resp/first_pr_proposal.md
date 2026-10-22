# first_pr_proposal:V7-1 只读 FileAdapter 集成(建议变更清单)

日期:2026-10-22 ｜ 状态:PROPOSED(未实施,待批准) ｜ 目标仓:仅 `ecs-onto-behavior-01`(mas-rust 零改动)

## 1. 范围与不做

**做**:把样例 A(场景+schema)+样例 B(运行 sBwT4d6RsTuGGHPIgu1L3)以 REAL_IMPORT_READ_ONLY 模式导入工作台并只读展示;达成 J0–J6 中 J1/J2(部分)/J4–J6 的静态部分与 REAL-01..07 首批。
**不做**:写回引擎、执行真实运行、图编译、MapEngine 接入、CommandLog 导入、历史导入接口(维持 v0.6 决策)。

## 2. 变更清单(全部为新增文件+少量接线)

| # | 变更 | 文件(新) | 要点 |
|---|---|---|---|
| 1 | 隔离 fixture 落位 | `src/testdata/native/`(gitignore 大文件,manifest 登记哈希) | 复制样例 A/B(用户批准后) |
| 2 | 归一化器 | `src/services/nativeImport/modelPackage.ts` | archetype/components/instances → PrototypeModel;单位映射表 `units.map.ts`(查无→UNKNOWN);网格属性→blockRef |
| 3 | 运行导入 | `src/services/nativeImport/runBundle.ts` | 帧→commit(一帧一 commit);traceCompleteness 定级;failed 帧标记 |
| 4 | 能力声明 | `src/services/nativeImport/capabilityManifest.ts` | 静态 manifest;UI 按能力启用/禁用动作 |
| 5 | 适配器注册 | `src/services/executionAdapter.ts`(+~15 行) | 第三个适配器 `readOnlyImportAdapter`:settle 恒返回诊断 REAL_READ_ONLY |
| 6 | 数据源标识 | `src/stores/session.ts` + StatusBar/P20/P22 页头 | `MOCK_SANDBOX | REAL_IMPORT_READ_ONLY` 徽标;切换互斥 |
| 7 | 页面接线 | P02/P03/P29/P05/P08/P10/P11 只读渲染真实模型;P20 绑定 RunBundle;P22 按 PROPERTY_DELTA 级渲染 | 各页仅换数据源分支,不复制解析逻辑(统一走 facade) |
| 8 | 缓存隔离 | `src/stores/persistence/`(+native: 前缀 store) | 真实导入缓存与本地草稿历史隔离;标注非权威 |
| 9 | 测试 | `src/services/nativeImport/__tests__/` | 归一化对拍(93 实例逐字段 vs PG 行)、presence 规则负例、单位 UNKNOWN、导入失败红条(删工件)、无 mock 回退断言 |
| 10 | 文档 | `design/04/contracts/`(model-package/run-bundle 定稿) | 从 06 文档候选升格 |

预计规模:~1200 行新增 + ~80 行修改;无既有测试破坏(109 回归全绿为准出条件)。

## 3. 验收(可独立复验)

| ID | 判据 | 复验方式 |
|---|---|---|
| REAL-01 | 审计完成(本轮 02-06 文档) | 文档+git SHA |
| REAL-02 | 样例 A/B 导出可重现 | manifest 哈希重算一致 |
| REAL-03 | 93 实例 ID/类型/装配/继承逐项对照 | 脚本 diff PG 行 vs 工作台模型 |
| REAL-04 | 0/null/unset/notApplicable 可辨 | 负例帧(构造缺键/显式 null/0) |
| REAL-05 | 单位校验:登记单位校验、UNKNOWN 豁免并标注 | 数据契约测试 |
| REAL-06 | P10 查询集合=真实 frame-0 数据过滤结果 | 集合对照 |
| REAL-07 | 删工件导入必须红条,无 F01 顶替 | 故障注入+截图 |
| REAL-12 | 缓存清空不影响源;UI 标注非权威 | 断连/刷新测试 |

(REAL-08..11 属 V7-2 运行对照,首批只验 P20 静态绑定帧数据与 frame_data 逐值一致。)

## 4. 回滚方案

- 全部新能力挂 `session.mode=REAL_IMPORT_READ_ONLY` 门后;默认仍 MOCK_SANDBOX。
- 回滚=删除 `src/services/nativeImport/` + `src/testdata/native/` + revert 接线 3 处(executionAdapter/session/页头);无 schema/持久化迁移(新 store 前缀独立,DB version 不动)。
- IndexedDB:新 store 随前缀可整体删除,不影响既有 6 store。

## 5. 依赖与前置

1. 用户批准样例 A/B 复制(REAL-18 边界)。
2. fixture 哈希补录(real_fixture_manifest §6)。
3. V7-1 开发期间引擎仓冻结只读(不 cherry-pick/不重编)。

## 6. 风险重申

最大风险仍是「导入失败静默回落 mock」(REAL-07)与「把本地缓存当源权威」(REAL-12)——两者均已设计进负例测试;其次是属性路径无 schema 声明的长尾(以"未声明属性清单"透出,不阻塞导入)。
