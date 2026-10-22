# W0 核实代码审计（v0.6 批次 0 产出）

日期：2026-10-22 ｜ HEAD：`f5b1780e488f6bf34c49c0703eafc265690d070a`（验收对象）｜ 详表：`evidence/code-map.md` ｜ 复现：`evidence/baseline.md` + `evidence/logs/`

## 复现结论

独立复现通过：`install --frozen-lockfile` / `build` / `test` 全绿（77 passed → 施工后 101 passed / 0 failed）。REPORT.md 所称 2620768 为真实 commit，HEAD 已正常前进一格；无内容分歧。

## 关键风险定位（文件:行 级入口见 code-map）

1. **history/trace 曾仅会话内存** → 已由 W4 解决（`src/stores/persistence/`，IndexedDB 单事务 + 恢复校验；契约 `contracts/local-history-v06.md`）。
2. **P12 React Flow 更新深度死循环白屏**（StoreUpdater 不稳定闭包）→ 已由 W1 修复（`features/schedule-editor/` 全部处理器 useCallback/useMemo）。
3. **W4 恢复校验误伤合理用户流**（整库回退丢历史）→ 已修复（根提交落 IDB + 分支级隔离 + mergeCatalogRuns 早退潜伏 bug）。
4. **FlowGram 1.0.16 DI 在 StrictMode 双挂载必现白屏** → 上游缺陷仍在，绕行必要；最小复现 `evidence/toolchain/strictmode-host/`。
5. **oxfmt 0.2.0 破坏行内类型字面量** → 写模式保持禁用；0.74.0 候选修复版本已验证（`evidence/toolchain/`）。
6. **草稿新实体/新属性初值不进入执行世界** → 契约级缺口（D 类，P18 警告暴露），列 v0.7。
7. **P22 端口单位启发式回落** → 已治理：declared 优先、缺声明记 null 不回填、≈ 仅展示层、traceabilityGaps 明示不可完整追溯节点。
8. 低优先级遗留（W2 记录，不阻塞）：P14 校验戳与实时诊断矛盾、视口操作污染修订、1440 画布偏窄、P23 断字、P31 深链契约卡、树计数不随草稿即时更新、孤儿 head 不推测修复。
