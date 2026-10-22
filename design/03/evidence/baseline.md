# W0 基线取证（v0.6 批次 0）

日期：2026-10-22 ｜ 执行人：Kimi Code（本机施工代理） ｜ 性质：独立复现取证，不改业务代码

## 基线结论

| 项 | 值 | 证据 |
|---|---|---|
| 完整 HEAD SHA | `f5b1780e488f6bf34c49c0703eafc265690d070a` | `logs/w0-git.txt` |
| REPORT.md 所称 `2620768` | 是真实 commit（IA v2），但 HEAD 已前进一格到 f5b1780（REPORT.md 自身）；验收以 **f5b1780** 为准 | `logs/w0-git.txt` |
| 分支 / 工作区 | `main`，干净（0 项未提交） | `logs/w0-git.txt` |
| Node / pnpm | v22.20.0 / `corepack pnpm@10.34.3`（与 .mise.toml 锁定一致） | `logs/w0-env.txt` |
| install | `install --frozen-lockfile` exit 0（官方 registry） | `logs/w0-install.log` |
| build | `vite build` exit 0（仅 chunk 体积提示） | `logs/w0-build.log` |
| test | `scripts/test.mjs`：**77 passed / 0 failed**（与 REPORT.md 一致） | `logs/w0-test.log` |
| 测试用例数核对 | 与报告 77 项一致；跳过 0；无 NOT_RUN | `logs/w0-test.log` |

## 与 REPORT.md 的差异

- 唯一差异：HEAD 从报告的 2620768 前进到 f5b1780（即报告文档自身那次提交），属预期前进，不是内容分歧。
- AC01–AC20 的 19 通过/1 部分、AC10 缺口、commit 会话内存限制、TanStack Table 未用等声明与仓库现状一致（详见 code-map 与后续 W 批次）。

## 复现方法

```bash
corepack pnpm@10.34.3 install --frozen-lockfile --registry=https://registry.npmjs.org/
corepack pnpm@10.34.3 run build
corepack pnpm@10.34.3 run test
```

未参与原施工的开发者按上述命令在同一 SHA 上可重现 77/0 与构建通过（本批即为该独立复现）。
