# 04 原生执行语义档案(X0 草案,只读阶段)

日期:2026-10-23 ｜ 状态:DRAFT(值取自源码审计与 J3 实测;编译闸门未开)

## ExecutionSemanticsProfile(候选版)

```text
engineBuildId: mas-rust@65c7f96(在线服务为旧二进制,buildId 待引擎侧暴露版本端点后固定)
planVersion: registry-v2(default_v2_systems 16 注册系统,9 阶段)
readVisibility: FRAME_PROPAGATED(帧首 clear_trackers;同帧后续系统可读前序写入;workflow 节点可配 Original/Current/Effective)
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
