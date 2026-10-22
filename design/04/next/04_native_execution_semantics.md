# 04 原生执行语义档案(X0 v0.2,只读阶段)

日期:2026-10-22(深夜)修订 v0.2(postH P2)｜ 状态:X0 定稿(只读)｜ 代码化:`src/services/nativeImport/executionProfile.ts`(+测试)

## ExecutionSemanticsProfile(候选版)

```text
engineBuildId: mas-rust@65c7f96(在线服务为旧二进制,buildId 待引擎侧暴露版本端点后固定)
planVersion: registry-v2(default_v2_systems 16 注册系统,9 阶段)
readVisibility: **按写路径分置**——write()=FRAME_PROPAGATED(components.rs:734 直写即生效) / write_deferred()=DEFERRED_FLUSH(components.rs:687-804 pending overlay 帧末 flush) / write_silent()=SILENT_BLOCK(不入值域) / workflow Original=PHASE_SNAPSHOT(io.rs:24-33;默认 Effective)
stageBarriers: 9 阶段(Input→Structural→Preprocess→Simulation→Coupling→Decision→Commit→History→Metrics);阶段内依赖图波次
systemOrdering: registry order_hint + PG after/before 约束(混合:Native/Workflow/DynamicLibrary)
effectKinds: 直接写(write/write_deferred + 帧末 flush)——无 set/contribute/propose 协议
reductionAndConflictRules: 无通用裁决器(读写声明+调度互斥;priority-arbitration 为基础设施内部机制)
commitBoundary: 一帧=Pre 层(命令/参数)+Post 层(系统产出);失败写 failed_systems delta,帧内原子
queryMembershipTiming: spawn 时装配;帧内 delta 可新增实例
supportsIntermediateProduct: FALSE(order-only 语义下不可表达帧内传播)
supportsProgramGraphCompilation: FALSE(需双向 codec+对拍闸门,见 X0 门槛)
```

## 兼容表结论(工作台 mock vs 原生)

| 维度 | 工作台 | 原生 | 判定 |
|---|---|---|---|
| 读世界 | State[n] previous | FRAME_PROPAGATED | **不兼容** → 原生计划只读(P12 已声明);编译必须拒绝 |
| 顺序边 | order 不传写入 | 传播 | 单列 readVisibility,禁止静默翻译 |
| 贡献/裁决 | contribute→proportional reduce | 直接写 | 无对应 → 拒绝编译 |
| 提交 | 整轮原子 | 帧内原子(Pre/Post) | 映射=一帧一提交(已用于导入) |
| 执行记录 | node trace+inputVersionRefs | system/delta(无输入版本) | 分级展示(V7-2) |

## X0 编译闸门(开启条件)

1. LogicGraphDocument ⇄ lc-* workflow JSON 双向无损 codec(往返哈希一致);
2. 逐系统 ReadMode 声明并在编译诊断中拒绝不可表达组合;
3. 固定 fixture(样例 D)J3 式双侧对拍,除声明变更外零差异;
4. 布局变更不参与语义哈希(既有规则复用)。
未过闸门前,P12 原生计划保持只读(编辑/编译/发布入口禁用,无假实现)。

---

## v0.2 增补(postH P2)

1. **帧内传播精确边界(源码定案)**:帧首 clear_trackers 仅清脏键;可见性取决于写路径——mobile 等直写系统同帧后续可见;water_intake 等 deferred 系统帧末才可见;网格走 silent 不进值域。**不存在单一统一读视图**。
2. **S 矩阵判定代码化**:`executionProfile.ts#adaptationFor`——S0-infra/S0/S1 全部 `compilable=false`(X1 双向 codec+对拍闸门未开,拒绝不静默降级);S2 仅在 codec 通过后可 true(当前不存在)。
3. **native→IR 只读适配方案**:仅 S1(lc-* workflow JSON 有节点图/端口)可做只读 IR 投影;映射规则:workflow 节点→只读节点摘要(类型/端口/参数),控制边→无语义 order(标注 FRAME_PROPAGATED 不可表达);不支持节点类型→诊断拒绝清单。**禁止把 9 阶段泳道当可部署图。**
4. **J3 归属核对**(测试钉死):观测来源 ID 100% 入合并目录;field_thermal_live=OBSERVED_RUNTIME/UNKNOWN;fire-extinguishing 保持 REGISTERED/S1(观测不改写注册等级)。
