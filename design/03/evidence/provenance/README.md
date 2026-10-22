# W3 证据索引 — 不可变执行记录、单位与属性来源

验收日期：2026-10-22。执行：W3 子代理。任务书：`design/03/01_v06_implementation_plan.md` §7。
契约产物：`design/03/contracts/trace-provenance-v06.md`（含 §7.1 全字段核对表，此处不重复）。

## 1. 补缺清单

| # | 缺口 | 处理 | 位置 |
|---|---|---|---|
| 1 | 缺 inputVersionRef 时页面无"不可完整追溯节点"指示（W3.5 硬缺口） | 新增 `traceabilityGaps(record)` 审计（图快照中 ReadPrevious/ReadSelfPreview 节点 refs 为空 → 缺口，不编造边）；P22 访问日志区与 P24 顶部列出具体节点 | `src/pages/p22/traceView.ts`、`src/pages/p22/P22NodeDebug.tsx`、`src/pages/p24/P24Provenance.tsx`；测试 `traceabilityGapsDetectsMissingRefs` |
| 2 | W3.3"缺必含单位不回填"缺回归 | 新增测试：剥掉图快照端口单位声明后，record 字段记 null，不拿当前 schema/启发式回填（含机读 JSON 断言） | `missingDeclaredUnitStaysNullInRecord`（mockExecutor.test.ts） |
| 3 | 零净变化"请求/裁决事实不丢"缺显式回归 | 新增测试：requestedDelta=0 时 effect/decision/used/proposed 边保留，无 PropertyChange/generated 边 | `zeroNetChangeKeepsRequestAndDecisionFacts`（mockExecutor.test.ts） |
| 4 | 旧 schema 单位不重新解释缺显式回归 | 新增测试：当前图改单位后，旧记录仍按记录内嵌图快照解释 | `historicalUnitsStayWithRecordSnapshot`（traceView.test.ts） |

其余 §7.1 字段核对均为齐备/等效，未改 DTO（详见契约文档核对表；声明读写集合可由 `compileSchedule` 输出按 record 锚定的冻结输入重建，P13 已展示，不落入 record）。

## 2. W3.2 历史图不可变（v1/v2 两轮，浏览器证据）

流程：branch-one-cooler@head c042 以**已保存模型**（g-cool 当前参数 maxDropK=50K）推算 → **R1 = c051**（record-c051）；
P11 草稿改 cool-A maxDropK=20（不保存），branch-lower-power@head c042 以**草稿试算**推算 → **R2 = c052**（record-c052）；
随后（草稿仍存在、R2 已入历史）回看 R1 的 P22/P23/P24。取证后草稿已撤销恢复"已保存"状态。

| 文件 | 内容 |
|---|---|
| `w32-r1-p23-c051-v1-values.png` | R1 P23：F01 旧值 100°C@c042、额度 80K、比例 0.8、请求 −50/−50K、获准 −40/−40K、最终 20°C@c051；F02 0.6 / F03 0.5 |
| `w32-r1-p22-ncap-b50-declared-units.png` | R1 P22 n-cap（取小 seq 3）：入 a=80K、b=50K（v1 参数）、出 50K，单位为图快照 declared（无 ≈）；访问日志读取 F01.thermal.temperature@c042 |
| `w32-r1-p24-f01-100-to-20.png` | R1 P24：输入版本 @c042 旧值 100 → 输出版本 @c051 新值 20，固定图 g-cool@g5 |
| `w32-r2-p23-c052-v2-values.png` | R2 P23：F01 A 请求 −20K 全额获准、比例 1、最终 30°C@c052；F02 比例 0.857、F03 0.667（30/20/20） |
| `w32-r2-p22-ncap-b20.png` | R2 P22 n-cap：入 b=20K（v2 参数）、出 20K；F01 暂存预览 80°C |
| `w32-r1-p22-after-r2-still-v1.png` | **R2 之后回看 R1 P22**：仍 b=50K、出 50K、−50/−50、比例 0.8、最终 20°C |
| `w32-r1-p23-after-r2-still-v1.png` | **R2 之后回看 R1 P23**：仍比例 0.8、获准 −40/−40K、最终 20°C@c051（左侧树可见 c052 已存在） |
| `w32-r1-p24-after-r2-still-v1.png` | **R2 之后回看 R1 P24**：仍 100@c042 → 20@c051，g-cool@g5 不随草稿变化 |

单测等效覆盖：`recordsAreImmutable`（mockExecutor.test.ts，核对存在，未改动）。切换 branch/viewCommit（branch-one-cooler ↔ branch-lower-power ↔ P11 编辑器）后 R1 稳定解析；图编辑器只写草稿，record 内嵌快照不被改写。

## 3. W3.3 单位治理结论

- 记录图快照有单位 → 确定单位（declared）：R1/R2 全部端口截图无 ≈（上表 P22 截图）；`portUnitsComeFromGraphDeclaration` 覆盖五节点全部端口。
- 缺失 → ≈ 标注且不回写权威 trace：启发式回落仅存在 `portUnit()` 展示层并带 `source:"heuristic"`，P22 渲染 ≈；构造性证据 `portUnitFallbackIsMarkedHeuristic`（端口不在快照 → ≈ 回落三例）。
- 机读证据 `record-units-sample.json`：一条 computed 记录全量 JSON + 单位字段摘样——n-emit（EffectRef）outputUnitId 为声明的 null，全部单位来自图快照/属性定义，**全记录无 `heuristic` 字样**（推测从不写回权威 trace）。
- 新提交 record 缺必含单位 → executeRound 记 null 而非拿当前 schema 回填：`missingDeclaredUnitStaysNullInRecord`（剥声明后 outputUnitId/effect.unitId/budgetUnitId 全为 null，数值事实不受影响）。"不完整状态"由展示层承担（declared-null 无单位渲染 / 端口缺失 ≈），核对结论：契约满足，不改 DTO。

## 4. W3.4 值语义抽查（3 处）

| 页面 | 抽查点 | 结论 |
|---|---|---|
| P08 | `P08Entities.tsx:184`：position `notApplicable`→"—"、`null`→「未放置」Tag、有效值（含 [0,0,0]）走 TypedValueCell value 态 | 不混淆 |
| P20/P27 | `src/data/world.ts:31` `worldValue`：未装配→notApplicable、快照缺字段→unrecorded（不补 0）、0/false/[0,0,0]→value；P27 `missingSideIsUnrecordedNotZero`（缺值差值 null 不当 0）、`compareBaselineVsSample`（null 位置是有效状态、非数值不算差值） | 不混淆 |
| P22 | `P22NodeDebug.tsx:505`：selfPreview null→「未记录」、无 decision→「待裁决」不补 0；P23 未裁决请求列「待裁决」（P23ConstraintDecisions.tsx:290） | 不混淆 |

## 5. W3.5 失败用例结果

| 用例 | 结果 | 证据 |
|---|---|---|
| 缺 inputVersionRef → 指出不可完整追溯节点，不编造边 | **补缺后通过**：`traceabilityGaps` + P22/P24 展示（补缺 #1）；构造性测试证明损坏记录只指出缺口、不补造 used 边 | `traceabilityGapsDetectsMissingRefs` |
| 旧 schema 单位不同 → 历史保持旧单位不重新解释 | 通过：端口单位只读记录内嵌图快照；当前图改单位不影响旧记录 | `historicalUnitsStayWithRecordSnapshot` |
| 图布局变语义不变 → 哈希不变；运算/binding 变 → 校验过期 | 通过（核对既有覆盖） | `layoutOnlyEditKeepsSemanticHash`、`integrityCheckTracksDraftHash` |
| P18 bundle 不可变；run 引用固定版本不引用草稿 | 通过：`publishBundleIsImmutableAndIdempotent`（只增不改、同 id 幂等）；`createRunIsListedAndDoesNotSettle`（RunDef.bundleId 固定引用） | 同名单测 |
| W2 bug2 复核：P19 深链识别本地发布 bundle | **已修复，浏览器复核通过**：`P19?bundleId=bundle-local-1` 选择器正确选中 bundle-local-1，无「目标对象不存在」（修复点 `P19NewRun.tsx:99` 读取 route.params.bundleId） | `w35-p19-deeplink-local-bundle-fixed.png` |

## 6. 回归

`corepack pnpm@10.34.3 test`：101 passed / 0 failed（基线 97 → +4 新用例）；`tsc --noEmit` 干净；`corepack pnpm@10.34.3 build` 通过。未运行 `pnpm format`，未改 `src/main.tsx`。
