# ExecutionAdapter / Rust-WASM 适配契约（v0.6 草案）

版本：0.1 ｜ 日期：2026-10-22 ｜ 状态：草案。当前唯一实现是浏览器内 TS 参考执行器（`src/services/mock-executor/`，经 `src/services/executionAdapter.ts` 暴露）。Rust/WASM 正式内核属 v0.7；本契约固定其对齐边界。

## 1. 输入（正式执行器必须与 TS 参考器对齐）

| 输入 | 约定 |
|---|---|
| 模型冻结 | 固定 model/schema bundle（语义哈希）、场景 baseWorld/baseCommit、program/schedule/system/query 的确定版本（`id@version#hash`）。不得以「当前 UI 表单状态」为隐藏输入 |
| 回合命令 | `{ runId, branchId, baseCommit, idempotencyKey }` + 参数覆盖（草稿试算需显式声明模型视图 saved/draft） |
| 模拟参数 | 步长（当前 10 s）、策略/随机源引用（当前无 RNG，契约保留字段） |
| 语义版本 | 执行/归约/单位语义的版本标识（schemaVersion + 执行器语义版本），单位表随模型冻结 |

## 2. 输出（与 RoundResult 对齐）

- **成功**：`nextWorld`、`RunRecord`（recordId/inputVersions/batches/SystemExecution/NodeExecution/EffectRequest/ConstraintDecision/PropertyChange/DependencyEdge/diagnostics）。字段语义以 `design/03/contracts/trace-provenance-v06.md` 为准。
- **失败**：结构化 Diagnostic（code/severity/定位到 node/port/schedule 元素），**不产出半个结果，不移动 branch head**。
- 时序/播放：UI 播放事件只是已提交结果的投影（当前 playback 与 sim 解耦），动画不重新决定状态。`elapsedMs` 可为 null（显示「未测量」），禁止虚构耗时。

## 3. 语义对照测试方案（TS ↔ Rust/WASM）

1. 从 TS 参考器抽取领域无关 golden fixtures：以 `design/02/mock/prototype_seed.v05.json` + 三组试算（基线/停用B/20K）+ 负例（断边 INPUT_MISSING、成环、product、°C→K）为首批。
2. 判定一致范围：领域结果（最终温度）、每路 requested/approved/ratio、批次/执行顺序、依赖边与 inputVersionRefs、失败诊断 code 与定位。
3. 浮点容差按算子/量种明示（如比例除法 1e-12）；禁止用不受控线程顺序或隐式四舍五入掩盖差异。
4. 对照通过后才推进：性能/并行、WASM Worker、原生客户端复用、checkpoint（含任务/事件队列/RNG/插件状态，不只是 world 值）。

## 4. 适配器边界现状（参考）

- `ExecutionAdapter.settle(request) → SettleResult`（`src/services/executionAdapter.ts`）：`mockExecutorAdapter`（默认，串行参考求值，label 明示「当前图」）与 `referenceAdapter`（仅查看样例，label 明示「非当前图计算」）并存。新内核实现同一接口即可替换，UI 无感知。
