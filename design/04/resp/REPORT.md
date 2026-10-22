# V7-0 双工程只读审计报告(汇总)· 含 V7-1 实施结果

日期:2026-10-22 ｜ V7-0:只读审计轮 ｜ V7-1:FileAdapter 真实只读导入完成(`00_v71_fileadapter_report.md`)｜ V7-2:真实运行过程只读分析完成(`00_v72_process_report.md`)｜ **J3 实跑对照 PASS+V7-4 切片+V7-3/V7-5 闸门裁定(`00_j3_v74_gates_report.md`;v0.7-R 达成)**
工作台 `ecs-onto-behavior-01`(V7-0 审计@`773b450` → V7-1 实施)｜ 引擎 `mas-rust @ 65c7f96`(零改动)+ 前端快照仓 `mas-suite/mas-refactor`

## 一句话结论

两工程事实已源码级核清:原有推演系统是 **bevy_ecs+动态属性表的 Rust 引擎(9 阶段 16 系统、workflow 低代码图、append-only 帧历史、PG 持久)**,可**无损提供**场景身份/schema 与至少两份可复现真实运行(83 实例 10 帧自包含样例 + SYSTEM_EFFECT 级 17 帧样例);工作台侧缺口全部集中在「真实适配层不存在」而非模型不兼容——**建议以离线 FileAdapter 为第一切片启动 V7-1**,首批只读,不做写回/图编译/MapEngine。

## 本轮产物

| 文档 | 内容 |
|---|---|
| `02_dual_repo_audit.md` | 双工程架构与源码定位;十二问逐条回答;位置勘误(前端真身在 mas-suite) |
| `03_capability_matrix.md` | 22 项能力映射矩阵(integrationClass/语义冲突/改动/证据);16 系统 S0/S1/S2 分级 |
| `04_semantics_gap_analysis.md` | State[n]/值/效果/提交/历史/追溯六组差异+裁决建议;不可映射清单 |
| `05_native_data_inventory.md` | 引擎数据资产盘点;推荐样例 A/B/C;敏感性与缺口 |
| `real_fixture_manifest.md` | 样例来源/revision/校验和/脱敏状态(复制待批准) |
| `06_integration_decisions.md` | FileAdapter 裁定;V7-1 切片;最小接口契约;风险对策;三决定性问题回答 |
| `first_pr_proposal.md` | 首个 PR 变更清单/验收(REAL-01..07,12)/回滚方案 |
| `00_v71_fileadapter_report.md` | V7-1 实施与验收对账 |
| `00_v72_process_report.md` | V7-2 过程分级渲染与 REAL-08..12 对账;v0.7-R 静态链 J0–J6 闭环结论 |
| `00_j3_v74_gates_report.md` | J3 引擎实跑双侧对照(535/535 全等,390 delta 来源零差异);V7-4 等效计划只读渲染;V7-3/V7-5 闸门裁定与解锁条件;v0.7-R 终态对账 |

## 关键发现(择要)

1. **109 passed / 0 failed 独立复验通过**(HEAD 773b450)——v0.6 报告声明属实。
2. **引擎即 ECS**:ECS 实体直接携带业务 `InstanceId`(字符串同构,ext-{provider}-{item} 规则),身份映射零成本;运行真值在 `ExtraAttributes` 动态表,组件存在性=archetype 装配。
3. **溯源分级实测**:PG 新格式 tick 行 delta 带 `source_system_id`(SYSTEM_EFFECT 级,活库 3 运行;样例 C 11 帧已导出);磁盘工件仅 after 值(PROPERTY_DELTA);**请求→获准效果对与输入版本引用在引擎中不存在**——P23/P24 必须诚实降级,禁止反推。
4. **引擎已有可编译图系统**:config 默认 workflow 模式,8 个系统被 lc-* 节点图覆盖且有节点级 NodeTrace——V7-4 的 S1/S2 映射有现实路径,无需先造编译器。
5. **工作台三处概念空白需新增**(非改语义):sourceSystemId/sourceRevision、capability manifest、FileAdapter;单位映射引擎侧无类型(f64),须 UNKNOWN 策略。
6. **样例质量**:推荐样例 B(83 实例/10 帧/1.95MB/0 外部依赖/无个人信息)完全自包含,可直接支撑 J0–J6 只读闭环。

## G0 出口条件对账

| 条件 | 状态 |
|---|---|
| 工程技术栈与运行入口有证据 | ✅ 02 文档 |
| 代表性真实场景可安全复制 | ✅ chem-roaded(93 实例,合成数据)+样例 B(脱敏判定通过) |
| 单一原始真相来源选定 | ✅ 模型/场景/运行权威=引擎(PG+磁盘工件);工作台仅缓存 |
| 核心 ID/值/版本/执行/追溯能力清单 | ✅ 03 矩阵 22 项 |
| 每个 System 兼容等级 | ✅ S0×6 / S1×8 / 基础设施 S0;S2 待 V7-4 证明 |
| 依据真实工程更新任务顺序 | ✅ 06 文档(V7-1 FileAdapter → V7-2 RunBundle → 3/4/5 闸门) |

## 严格执行声明(REAL-18 前置)

本轮操作仅:git log/status、rg/ls/cat、shasum、psql 只读 SELECT、工作台自身 pnpm test。两工程源文件零修改、零提交、零推送、零数据库写入、未启动/触碰任何推演进程。

## 下一步(待用户批准)

1. 批准样例 A/B 复制到 `src/testdata/native/`(real_fixture_manifest §5 授权范围)。
2. 批准 first_pr_proposal(V7-1 FileAdapter)开工;期间引擎仓维持只读。
3. V7-2 前决定是否授权导出样例 C(PG tick 行只读 SELECT 导出)。
