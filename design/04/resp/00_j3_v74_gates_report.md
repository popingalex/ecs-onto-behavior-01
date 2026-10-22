# J3 实跑对照 + V7-4 切片 + V7-3/V7-5 闸门裁定报告

日期:2026-10-22(深夜) ｜ 依据:用户指令「继续完成他们」(授权 J3 触发真实运行)
测试:125 passed / 0 failed ｜ tsc 干净 ｜ build 通过 ｜ 浏览器实测 P12 通过

## 一、J3:引擎侧新运行双侧对照(PASS)

**执行**(隔离新会话,未触碰既有推演/场景):
- 新建推演 `5UYNf2wUVurVl0616t0Xn`(chem-roaded,executionId `v71-j3-verify-001`,名称「V71-J3-只读对照」)。
- 经 CommandLog 点燃 tank-1(`action_ignite`,equivalentFireArea=12,commandId 幂等),推帧 1–6(delta 50/30/27/25/23/23)。

**对照方法与结果**(证据 `design/04/evidence/j3-run-compare/native-run-compare.json`):

| 维度 | 结果 |
|---|---|
| head 态逐值 | **535/535 写入值全等**(帧 6:工作台 buildRunC 重放 vs 引擎 attributes 端点) |
| delta 来源 | **390/390 条 source_system_id 零差异**(input=pre 层命令;combustion/fire-extinguishing/field_thermal_live=post 层) |
| 名义差异 4 处 | 全部由 J3 脚本误用查询参数 `?frame=N`(该形式被忽略恒返 head,实测 frame=1/2/6 均 tick=6)解释;非归一化错误,更正见"点燃演化"行 |
| 引擎多出 35,408 项 | 引擎物化默认值;工作台按 UNSET 不回填(04 文档 §2 规则) |
| 点燃演化 | tank-1 温度 41.5→77.4°C 六帧演化逐帧可现。**v0.7-H 更正**:J3 脚本曾误用查询参数 `?frame=N`(被忽略恒返 head);引擎真历史端点为路径参数 `GET /sim/:id/branch/:branch/:time/attributes`(超界显式 404)。以正确端点逐帧复测:**工作台重放 vs 引擎真历史态 3208/3208 全量零差异**(`evidence/j3-run-compare/native-run-compare-history.json`) |

**顺带发现**(如实登记):
1. 当前 18080 服务为**旧二进制**:新会话写 legacy `s_simulation.snapshot` 列、无 `s_simulation_tick` 行(对照改走 HTTP deltas 通道,其自带 sourceSystemId)。与既有「新旧二进制共库滚动升级」备忘一致。
2. 运行期出现静态目录未收录的系统 id `field_thermal_live`——已补入 catalog(标注"运行期观测"),P11/P12 同步可见。

## 二、逐系统耗时曲线:确认为真缺口(不阻塞)

新运行 meta.performance 仅 `{compute, simDurationMs, total}`,无 per-system stats;`runtime_trace.jsonl` 未启用。**解锁条件**:以带 TraceRecorder 的二进制重启引擎(需协调——当前服务上有历史会话,遵守"活推演期间禁重启"纪律,不擅自执行)。

## 三、V7-4 切片:原生执行计划只读渲染(落地)

- `pages/p12/NativeExecutionPlan.tsx`:system_registry 9 阶段 × 17 系统目录的阶段泳道渲染(系统可跳 P11),含**语义不兼容声明**(引擎帧内写传播 vs 工作台 order-only,不可编译/不可编辑)与 V7-4 完整版闸门条件(ReadMode 声明+双向编解码器+J3 式对拍)。浏览器实测通过(9 阶段×17 系统全渲染,DOM 快照留证于会话记录;截图因 IAB 截图面超时未存盘,同 V7-1 P08/P11 先例)。
- catalog 增补运行期观测条目(+1 测试不变,125 全绿)。

## 四、V7-3 / V7-5 闸门裁定(NOT_RUN,理由与解锁条件)

### V7-3(安全编辑与发布)——闸门未开
- **理由**:apply 意味着写引擎侧模型(s_scene/s_entity/s_component 经 /cm CRUD)。至今 mas-rust 全程零改动是本轮纪律底线;且引擎无 baseRevision 并发校验的模型写协议(/cm 直写),先写后验会破坏 REAL-18 边界。
- **解锁条件**:①用户明确授权写引擎(或提供隔离引擎实例+独立 PG);②引擎侧补 ModelPatch 校验端点或约定 /cm 写后校验流程;③V7-1 的 REAL-13 验收用例先行设计(dry-run/冲突负例)。
- **已就位的基础**:工作台侧 ModelPatch 草稿形态可复用 draftRegistry;baseVersion 区隔机制已在 V7-1 验证。

### V7-5(地图/历史真实联动)——闸门未开
- **理由**:真身是 mas-suite 的 map-engine-v2(Cesium);工作台契约明确"不在本仓库重复实现地理引擎"。接入需把 Cesium+MapEngineV2 打进工作台包(重依赖)并定义 WorkingCopy↔导入数据的权威映射;冒进实现等于造第二地理前端。
- **解锁条件**:①map-engine-v2 以独立微前端/iframe 挂载方案评审通过;②空间权威映射契约(lon/lat/高度采样/资产引用)定稿;③P20 MapEngineMount 注入协议实现(挂载位已就绪)。
- **本轮已达成的可联动基础**:实体真实经纬度已在导入数据中(transform/position Vec3),P20 SpatialViewport 为占位渲染,替换面收敛在 MapViewport 单点。

## 五、v0.7-R 终态对账

J0–J6 **全链闭环**(J3 由本次实跑补齐);REAL-01..05/07..12 PASS、REAL-06 PARTIAL(缺口与通过条件见 design/04/next/00_verified_baseline.md §AUD-03)、REAL-13..15 NOT_RUN(闸门)、REAL-16 NOT_RUN(闸门)、REAL-17 部分、REAL-18 PASS。**v0.7-R 达成(口径已修订)。**
