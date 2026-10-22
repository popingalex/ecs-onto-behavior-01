# 给本地 Agent 的下一轮施工指令(v0.7-H)

> 使用前填写 `WORKBENCH_ROOT`、`ENGINE_ROOT`(如可读)及 J3 既有证据目录。
> 本轮只允许**工作台内的只读验证、修复和本地测试**;不代表允许修改原生引擎、重启在线服务或写共享数据库。
> 方案参照:`07_next_implementation_plan.md`。

## 优先顺序

**任务 A:获取可靠基线(不得直接跳过)**

1. 阅读双方工程的 `AGENTS.md` 和设计/验收规范,固定完整 SHA、工作区差异、程序/数据库运行版本。
2. 找到并实际读取:`design/04/evidence/j3-run-compare/native-run-compare.json`,报告列出的 `NativeExecutionPlan.tsx`、`buildRunC`、Catalog、RunBundle、MapViewport,以及已有 REAL 结果。
3. 使用仓库**真实存在**的测试脚本复现报告中的 125 passed、tsc 与 build;命令错误或数据不可用则记录,不虚报 PASS。
4. 定位真实引擎 `attributes?frame`、TraceRecorder、system_registry、`/cm` 和 legacy/new tick 存储路径(只读)。
5. 整理 REAL-06 为什么是 PARTIAL;把"REAL-01..12 all PASS"的矛盾标记出来并提供证据/修订建议。

**任务 B:修正历史帧读取(工作台可安全修改)**

1. 对来自真实系统的历史帧请求添加请求帧/实际帧检查;不再默认为 `attributes?frame=N` 可提供过去帧。
2. 以已有 J3 delta 为事实,从 base + 有序 deltas 取得 frame 态;丢帧/乱序/版本冲突时拒绝并给出诊断。
3. 535 项显式写入值与 35,408 项默认物化值分层对账;不为缺省 `UNSET` 静默填默认。
4. 加单测与 P20/P24 真实数据展示负例,证明切历史不会显示 head。

**任务 C:Catalog 与 P12 只读计划收口**

1. 对静态 `system_registry` 与真实 delta 的 runtime system ID 做动态合并。`field_thermal_live` 是固定回归案例;未知系统默认保留 UNKNOWN 阶段而非胡乱归属。
2. P12 标注原生 `FRAME_PROPAGATED` 与工作台 `ROUND_SNAPSHOT/order-only` 的语义差别,禁用原生计划编辑/编译/发布能力。
3. 补保存的浏览器截图、DOM/plan JSON、真实系统 ID 对 P11 的跳转测试。
4. 确保 `source_system_id` 等级与节点级 `inputVersionRefs` 不混淆。

**任务 D:仅写文档/测试规范,不开启引擎写入**

1. 起草事务化 ModelPatch 契约和 dryRun/冲突/幂等/原子性验收;禁止生产 `/cm` 直写。
2. 起草 `ExecutionSemanticsProfile` 和双向 codec 条件;暂不部署原生可编辑图。
3. 起草 MapEngineMount 微前端协议与坐标 frame 定义;可在工作台用无 Cesium 的替身协议测试。
4. TraceRecorder 仅形成隔离新二进制的实验计划;无用户授权不得启动或迁移 engine/db。

## 第一轮交付要求

请在一个合适的新工作分支里逐批完成 A、B、C;若发现任何需要修改 engine 或写原生数据的工作,**停止该子任务**,只提交证据与待授权变更建议。

每批必须提供:实际修改文件、full SHA、可复现测试命令、通过/失败/未运行的用例、浏览器截图或 JSON evidence、剩余风险、回滚说明。

不得:
- 修改 J3 原始黄金数据去迎合测试;
- 运行已知危险的写模式 `pnpm format`;
- 重启正在运行的 18080 服务;
- 修改共享 PG 或原生模型;
- 把未支持的本机 Graph IR 编译成已成功执行;
- 在没有真实坐标语义的情况下把 Vec3 当经纬度;
- 把 `source_system_id` 当完整节点级因果链。

## 开始前填写的路径

```text
WORKBENCH_ROOT = /Users/alexxu/workspace/simulation/202605/ecs-onto-behavior-01
ENGINE_ROOT = /Users/alexxu/workspace/simulation/202605/mas-rust(只读)
J3_EVIDENCE = design/04/evidence/j3-run-compare/(工作台内)
ENGINE_SERVICE = http://localhost:18080(只读)
```

**完成边界:**A/B/C 可独立复现并有完整证据,即可提议完成 `v0.7-H`。ModelPatch 原生 apply、TraceRecorder 新二进制、MapEngine 真正挂载和 System 原生图部署分别列为待闸门后续工作。
