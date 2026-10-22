# AC10（AC06-03/04/05/08）验收证据：顺序边读旧状态 + 失败原子性

- 验收日期：2026-10-22
- 代码：`main @ f5b1780e488f6bf34c49c0703eafc265690d070a` + 工作区未提交改动（W4 persistence 等 + 本轮 W1 修复/测试，见文末「本轮代码改动」）
- 环境：macOS，dev server `http://localhost:8443`（Vite），Kimi Code 桌面浏览器 1920×1080
- 数据：种子 scene-05（F01/F02/F03 = 100/80/60°C @ c042），schedule-main，g-cool@g5

## 结论

| 验收点 | 判据 | 结果 |
|---|---|---|
| AC06-03 顺序边读旧状态 | 加 cool-A→cool-B order 边后，B 的 `read_previous(F01.temperature)` 仍为旧值 100°C，不是 A 暂存的 50°C | **PASS** |
| AC06-04 外层计划真实变化 | order 边改变批次/顺序（[A,B] 并行 → [A]→[B] 串行），业务结果不变 | **PASS** |
| AC06-05 基线动态结果 | F01 两路请求 −50/−50、比例 0.8、获准 −40/−40、最终 20°C | **PASS** |
| AC06-08 缺输入失败 | `INPUT_MISSING`、head/world 不动、无孤立成功记录、可恢复重试 | **PASS** |

**AC10 核心问题回答：加 order 边后 B 仍读旧值（100°C @ c042），不读 A 的私有暂存。** 浏览器证据与机读 trace、executor 单测三者一致。

## 基线（前一代理完成，未重做）

| 截图 | 内容 |
|---|---|
| 01-p20-baseline-c042-plan-preview.png | R1 前 c042 计划预览：A/B 同组并行 |
| 02-p20-r1-c044-parallel-baseline.png | R1（main c042→c044，record-c044）并行批次，获准 −140→−90 |
| 03-p22-r1-coolB-F01-read-previous-100.png | R1 P22 cool-B×F01 n-old=100°C |
| 04-p12-plan-before-edge-parallel.png | P12 加边前计划：组1（并行）cool-A cool-B |

## 加边对照（05–08）

操作：P12 React Flow 画布从 cool-A 右侧手柄拖线到 cool-B 左侧手柄 → 弹窗选「顺序 order」→ 创建连线 → 保存调度文档（本地保存 12:01）。

| 截图 | 内容 | 判据 |
|---|---|---|
| 05-p12-order-edge-added-plan.png | 计划预览变 组1 cool-A → 组2 cool-B←cool-A；「顺序边的可见性」明示"B 仍读取 c042 的 previous 值，看不到 A 的暂存贡献" | 计划真实变化 |
| 06-p20-r2-orchestration-a-then-b.png | main@c044 推算得 R2=record-c045：批次1 cool-A（previous=c044）→ 批次2 cool-B（previous=c044）→ 归约 → 提交 | 编排层 A 先 B 后 |
| 06b-p20-r2-branch-c046-a-then-b-requests.png | branch-order-ab@c042 推算得 record-c046：批次1 A / 批次2 B，均 previous=c042，请求 −140 获准 −90，F01/F02/F03=20 | 非零下 A/B 输入相同 |
| 07-p22-r2-coolB-F01-still-100.png | record-c046 P22 cool-B×F01：n-old（seq 16）出 value=**100°C**，访问日志 读取 F01.thermal.temperature@c042 | **B 读旧值 100，非 A 暂存 50** |
| 08-p23-r2-decisions.png | record-c046 P23 decision-F01：旧值100@c042、额度80K、比例0.8、请求−50/−50、暂存预览50、获准−40/−40、最终20@c046 | 数字与基线一致 |
| 05b-p12-order-edge-removed-restored.png | 收尾：删除 order 边并保存（12:23），计划恢复 组1（并行）cool-A cool-B | 种子调度形态恢复 |

机读证据（P26「导出历史包」→ 提取）：

- `../traces/ac10-history-package.json`：完整导出（format history-package/1）。
- `../traces/ac10-r2-record.json`：R2 关键段 + R1/R2 `logicalParallelGroups` 对照。
  - R1 record-c044：`[["cool-A","cool-B"],["reduce-cooling"],["commit"]]`
  - R2 record-c046：`[["cool-A"],["cool-B"],["reduce-cooling"],["commit"]]`
  - `exec-F01-cool-B:n-old` seq 16，`outputs.value=100`，`inputVersionRefs=["F01.thermal.temperature@c042"]`
  - decision-F01：old 100 / budget 80 / scale 0.8 / approved −40/−40 / final 20
  - 提取脚本断言全部通过（见回传记录）。

### 偏离说明（R2 执行上下文）

任务书写「P20（main@最新 head）推算得 R2」并要求 P22 n-old=100°C、P23 请求 −50/−50。但基线 R1 已把 main 推进到 c044（F01 已达 20°C 冷却下限），从 c044 推算（record-c045）请求合计为 0，无法满足 3/4 步的数值判据。因此：

- 步骤 2（编排层顺序）按任务书在 main@head 执行：06 = record-c045，A→B 顺序正确（零请求，因下限已达）。
- 步骤 3/4（100°C / −50/−50 / 0.8 / −40/−40 / 20°C）在与 R1 相同基准 c042 上执行：P26「从此建立分支」建 branch-order-ab（head=c042），推算得 record-c046（06b/07/08）。BASE_NOT_HEAD 守卫禁止直接在历史提交上续算，建分支是应用规定的正规路径。
- 副作用：main 上多出 record-c045（零请求回合）与 record-c047（失败原子性重试），branch-order-ab 分支与 record-c046 保留在历史中，供复查。

## 失败原子性（09–11）

操作：P14 导出 g-cool.logic.json → 本地删除 le4 边（`program.edges` 与 `workflow.edges[data.id=le4]` 都删，le4 = n-neg.delta→n-emit.delta）→ P14 导入（草稿 r1，未保存；程序诊断即报 `INPUT_MISSING n-emit.delta`）→ P20（main@c045）开「草稿试算」→ 推算下一回合。

| 截图 | 内容 | 判据 |
|---|---|---|
| 09-p20-input-missing-no-commit.png | 红色横幅 `INPUT_MISSING n-emit.delta（增量）没有来源…（共 2 个错误；未产生任何结果，分支头保持 c045）`；侧栏 main 仍只有 c045/c044/c042，无新提交；head 选择器仍 c045 | 无新 commit、head 不动、诊断定位 n-emit.delta；期间无「成功提交」通知 |
| 11-p21-rejected.png | P20 命令队列抽屉：两条 SettleRound 已生效（c044/c042 基准）+ 一条 **已拒绝**（基准 c045，幂等键 run-main:main:c045:settle，附同一 INPUT_MISSING 诊断） | 队列留有 rejected 记录 |
| 10-p20-retry-success.png | P14 撤销导入（草稿恢复 4 边、无诊断、未保存）→ P20 重试推算成功：record-c047（c045→c047，第45回合），错误横幅消失 | 恢复后正常执行 |

草稿处置：P14 导入的坏草稿**未保存**，以「撤销」恢复；P12 order 边已删除并保存恢复种子形态。

## 本轮代码改动（W1 发现的阻塞缺陷与缺口）

1. **修复 P12 连线白屏（AC10 阻塞缺陷）**：`src/features/schedule-editor/ScheduleCanvas.tsx`、`ScheduleEditor.tsx`。传给 `<ReactFlow>` 的回调/对象此前为内联闭包，xyflow `StoreUpdater` 每次渲染都 `store.setState` → 触发订阅者重渲染 → 又产生新闭包，构成「Maximum update depth exceeded」死循环，连线成功即整树卸载白屏（Playwright 复现并取证：`An error occurred in the <StoreUpdater> component`）。修复：所有传给 React Flow 的处理器用 `useCallback`/`useMemo` 稳定引用。修复后 Playwright 复测无错误，桌面浏览器完成全部上述流程。
2. **补 S10-02 执行器级单测**：`src/services/mock-executor/__tests__/mockExecutor.test.ts` 新增 `orderEdgeKeepsPreviousReads`（原文件只有成环/product 负例，无"加 order 边后 B 仍读 baseWorld 旧值"的正例）：断言计划变 `[cool-A]→[cool-B]`、`exec-F01-cool-B:n-old=100` 且 `inputVersionRefs=[F01.thermal.temperature@c042]`、裁决与最终温度与无顺序边一致。
3. 测试/构建：`corepack pnpm@10.34.3 test` → **89 passed, 0 failed**（88+1 新增）；`corepack pnpm@10.34.3 build` → 通过（仅既有 chunk 体积告警）。

## 已知限制

- 无录屏，仅关键帧截图 + 机读 trace（与任务书口径一致）。
- record-c045 为下限已达后的零请求回合，仅用于编排层顺序证据。
- 导入的修改版 g-cool 文件留在 `.tmp/g-cool-no-le4.logic.json`（导入用临时文件，可删）。
