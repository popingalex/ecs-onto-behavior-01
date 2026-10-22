# ecs-onto-behavior-01 v0.7：真实推演系统集成实施方案

> 文档状态：**建议实施基线 / 待真实工程审计后修订**  
> 编制日期：2026-10-22  
> 工作台仓库：https://github.com/popingalex/ecs-onto-behavior-01  
> 工作台报告基线：用户上传的新版 `REPORT.md`，其报告声称 `main @ ee2070e`、109 项测试通过。**本次未能直接获取 GitHub 源码复验**。  
> 原有推演系统：**尚未提供工程目录与源码；所有内部接口、运行语义、存储与技术栈均待核验**。  
> 建议归档位置：`design/04/01_v07_real_engine_integration_plan.md`  
> 附件：`ecs_onto_behavior_v07_local_agent_first_task.md`（本地 Agent 首轮执行任务）

## 0. 结论和执行策略

本阶段不应继续把 `ecs-onto-behavior-01` 当作一套准备取代原系统的完整推演平台，而应将它定位为现有推演系统之上的**可独立启动的可视化工具集**：

1. **ECS/本体与模型定义编辑器**：浏览/编辑类型、组件、属性、模板、实体以及绑定和版本。
2. **System 外层调度与内部程序编辑器**：描述计划、参数、程序、变量和约束；将其编译/映射到目标系统实际支持的能力。
3. **推演结果与过程分析器**：读真实运行、状态、事件、效果、裁决和历史；按事实可得性展示来源链。
4. **地图/场景工作台宿主**：承接原有或外部 MapEngine；不在本仓库重复实现地理引擎。

**首个真正的完成目标**不是“能改新实体并让 TS mock 冷却”，而是：

> 从原有推演系统取得一个真实场景与一次真实运行（优先用可复制的隔离副本），在工作台中正确显示实体、属性、System、运行结果、历史版本与可用的追溯记录，并能从可视化结果返回原生记录标识。

如果原系统还缺实际读取依赖/节点级执行记录，第一条纵向链可以先达到 **system 级或属性变更级真实回放**。界面必须显示追溯完整度，不得伪造节点级来源。

**首批只读；随后按能力闸门有条件解锁编辑发布、图编译执行、历史分支和地图双向联动。** 不以仓库页数、路由数、mock 算术或前端截图替代真实集成成功。

## 1. 事实、依据与工程假设

### 1.1 由当前报告支持的工作台状态

- v0.6 宣称完成 `AC01–AC20 = 20/20`、`AC06-01–30 = 30/30`，报告列出 109 项测试/0 失败、tsc 和 Vite 构建通过。
- ECS CRUD、React Flow 外层、FlowGram 五节点内层、纯 TS mock executor、P20/P22–P27、IndexedDB 本地持久化均已有报告中的交付结果。
- MapViewport 当前是**地图宿主**，并非已经接入 MapEngine。
- 报告明确说明：新建草稿实体/属性初值尚未进入执行世界；P17/P28 只读；真实 MapEngine、Rust/WASM 未接入；10000 实体 TS 测试约 690ms，未达到正式 0.5 秒目标。
- 上述均为**报告陈述**，本计划不将它们误写成独立源码审计结果。

### 1.2 关于“已有推演系统”的证据边界

历史讨论曾提到早期系统采用 JS/Cesium/Java、矩阵增量计算和多场景实现，但**不能自动把这些历史描述当成用户稍后提供的真实工程现状**。真正的语言、模块、运行内核、状态存储、分支、模型版本与接口，在 V7-0 中从实际源码确认。

### 1.3 本轮补充调研得出的技术判断

| 技术/规范 | 官方资料支持什么 | 对本项目的决策 |
|---|---|---|
| React Flow | 支持 `nodes/edges/viewport` 的 JSON 保存与恢复 | 可保存**编辑视图**，但不能把画布 JSON 当作引擎可执行计划；领域 Schedule/IR 单独版本化 |
| FlowGram | 自由画布、表单、变量/作用域等编辑能力 | 继续用于 P14；目标引擎能否执行内部节点须经映射/编译器及语义对照核验 |
| JSON Schema 2020-12 | 可描述并验证 JSON 数据结构和组合约束 | 用于模型快照、能力声明、运行导入包的**结构校验**；单位、引用、读写语义还需领域校验 |
| W3C PROV | `Entity`、`Activity`、`Agent` 及 `used/wasGeneratedBy` 等来源关系 | 可作为溯源视图概念映射；**无须强制引入 RDF/图数据库** |
| OpenTelemetry | Span、事件、链路等可观测性 | 可记录**技术耗时和请求链路**；不能代替属性输入版本/裁决的业务追溯 |
| Apache Arrow | 列式内存布局与 IPC 批量传输 | **仅在真实大矩阵/批量状态导入有性能需求时评估**，首批控制面先用 JSON |
| FMI 3 | 模型状态获取/设置/序列化是带 capability flag 的能力 | 仅在已有系统采用 FMU/外部求解器时适用；不得假设所有模型可完整 checkpoint |

官方依据详见文末第 15 节。以上是**适配建议**，不是声称当前两个仓库已经实现了这些标准。

## 2. 产品与架构责任划分

### 2.1 谁是权威

| 对象/能力 | 权威与所有者（默认推荐） | 工作台的职责 |
|---|---|---|
| 原生实体、组件、运行属性 | 原有推演系统 | 建立稳定 ID 映射、查询、编辑草稿、展示 |
| 模型定义、版本 | 原系统若已有则优先复用；否则双方协商唯一权威 | 可视化作者界面、变更集、校验、发布 |
| System 运行语义 | 原有推演内核 | 构建可解释的调度/程序 IR；校验目标能力 |
| ECS 外层/内层图的编辑布局 | 工作台 | 存储 EditorLayout，避免影响计算语义 |
| 推演执行和共享世界状态 | 原有推演系统 | 发命令、接收结果和诊断；TS 为沙盒参考器 |
| Commit/Run/Trace 原始事实 | 已有推演系统，如现有能力不足需增量插桩 | 只读展示、索引/缓存、溯源完整度标注 |
| 本地草稿/回放缓存 | 工作台 IndexedDB | 文档恢复、离线浏览、缓存；不冒充原系统权威 |
| 地图/资产/空间展示 | MapEngine/原场景模块 | 地图宿主、当前分支/时间/实体选中同步 |

**一条原则：**不维护两个彼此无映射、可独立写入的“权威世界”。真实引擎提交与工作台本地 IndexedDB 记录要明确区分，不能以本地 commit 冒充源系统 commit。

### 2.2 建议的逻辑模块

```text
┌───────────────────────────────────────────────────────┐
│  ecs-onto-behavior-01 现有 UI                         │
│  ECS / P12 Schedule / P14 Logic / P20-P27 Analysis    │
└─────────────────────┬─────────────────────────────────┘
                      │ UI-facing domain API
┌─────────────────────▼─────────────────────────────────┐
│  Integration Domain Layer（尽量沿用已有模块与 DTO）    │
│  Schema/Identity Map | Capability | IR | Trace View   │
│  Version / Binding / Unit / Provenance Completeness   │
└─────────────────────┬─────────────────────────────────┘
                      │ EngineAdapter interface
        ┌─────────────┼───────────────────┐
        ▼             ▼                   ▼
  MockAdapter     FileAdapter         NativeAdapter
  TS reference    真实离线快照/运行包    本地服务/进程/插件
        └─────────────┼───────────────────┘
                      ▼
          Existing Simulation System
       Model | Runtime | History | Geo
```

最初可以只实施 `FileAdapter`（离线快照+运行包），让它在**无法启动原引擎 API**的情况下仍可完成真实数据只读验收。若原系统已有稳定 API，再添加 NativeAdapter；两种途径共享同一前端领域读取接口，而不是维护两套页面。

### 2.3 集成方式选择（依实际工程核验）

| 方式 | 最适合 | 主要风险 | 选择建议 |
|---|---|---|---|
| 文件导入/导出（JSON + 可选数据块） | 原系统不能轻易启动、需要可复制的审计样例 | 非实时、需要版本和完整性管理 | **默认第一步** |
| 本地进程/HTTP API（后续按需流式） | 原系统可本地跑、有可复用查询/运行接口 | 生命周期、权限、跨进程版本协调 | 完成只读样例后优先评估 |
| 直接库/插件/WASM 嵌入 | 同语言内核或已有稳定 FFI/插件协议 | 耦合与生命周期复杂 | 仅有确凿收益时采用 |
| 直接读取数据库 | 只有历史只读查询且具备正式稳定 schema | 绕过领域解释、版本损坏、耦合表结构 | 不作为默认模型/执行适配方案 |

**不要先决定 HTTP/gRPC、嵌入 WASM、Arrow、FMI 或数据库双写。** 它们取决于现有工程事实。首轮先稳定**语义契约**，再选择传输技术。

## 3. V7-0：两个工程的只读审计和可行性门槛

### 3.1 本地 Agent 必须读取

- 工作台：`AGENTS.md`（若存在）、真实 HEAD、`package.json`、`design/02`、`design/03`、ECS schema、ExecutionAdapter、P12/P14、P20-P27、MapViewport、IndexedDB/trace 层。
- 真实系统：入口、模块拓扑、ECS/矩阵数据结构、System 注册与调度、控制命令、状态更新、历史与快照、来源/日志、地图、场景导入导出、测试/样例目录。
- 只能从**真实源码**定位文件和能力；不能凭旧说明自动判为实现。

### 3.2 需要回答的十二个实际问题

1. 原系统是否拥有真正的 ECS，还是业务实体＋动态属性表/矩阵索引？组件存在性怎样表达？
2. 原始业务 ID、内部运行 Entity ID、类型 ID、属性 ID、空间对象 ID 是否可稳定关联？
3. 类型/组件/属性是运行时动态 schema，还是编译期固定类型？能否编辑后动态加载？
4. 模板/默认/实例覆盖、显式 null/未设置、不适用、0 值怎样区分？
5. 查询能否动态发现新增实体/组件？能否读取查询候选集、关系/邻接/空间索引依赖？
6. System 是脚本、函数、行为树、矩阵算子、数据流图、事件处理还是固定编译模块？是否允许动态注册？
7. 外层调度的 order、effect、阶段、并行、提交边界；读旧世界/读新世界的规则是什么？
8. System 内部程序有没有类型化端口、作用域/变量、参数、单位/量种或可插入的算子？
9. 效果是 set、贡献、候选 min/max、提案、事件/任务中的哪些？联合约束由谁裁决？
10. 运行记录最细到哪个层级：run/system/entity/node、输入版本、请求/获准、属性增量、事件？
11. 现有历史能回放吗？能恢复运行上下文和从旧状态续算吗？checkpoint 覆盖 RNG/任务/插件吗？
12. 可用于隔离调试的真实场景、数据量、许可证与敏感性边界是什么？能否安全导出副本？

### 3.3 输出：双工程能力映射矩阵

对每一项能力提供：

```text
capabilityId
workbenchCurrent       # 已有实现与源码路径
engineCurrent          # 实际实现与源码路径
integrationClass       # NATIVE / ADAPTABLE / READ_ONLY / UNSUPPORTED / UNKNOWN
semanticDifference     # 行为与语义差别
dataLossRisk           # 无 / 可接受（说明）/ 不可接受
evidence               # 源码文件、测试、样例、运行记录
requiredChange         # 工作台 / 原系统 / 两端 / 无
verificationId         # 对应下一步测试 ID
decisionStatus         # PROPOSED / APPROVED / BLOCKED
```

特别注意 `UNKNOWN` 不可当作 `UNSUPPORTED`；`READ_ONLY` 不能伪装成可发布；`ADAPTABLE` 必须通过双向映射测试。

### 3.4 V7-0 的出口条件（G0）

- 工程实际技术栈与运行入口有证据；
- 一个具代表性的真实场景能够安全复制或导出；
- 选择了**单一原始真相来源**（source of truth）；
- 核心 ID/值/版本/执行/追溯能力清单完成；
- 对每个待集成 System 给出兼容等级：可原生编辑、可映射编辑、仅黑盒可视化、不可适配；
- 依据真实工程更新本文任务顺序和目录，不在此之前批量改代码。

## 4. 共同的最小数据与能力契约（先定义候选，不预设实现）

### 4.1 Capability Manifest

原系统/适配器应提供静态文件或接口可读取的能力声明（示例结构，**非已定稿 API**）：

```json
{
  "contractVersion": "0.1.0",
  "sourceSystemId": "sim-source",
  "sourceRevision": "<full-source-revision>",
  "capabilities": {
    "schemaRead": "native",
    "entityRead": "native",
    "entityWrite": "unsupported",
    "systemCatalogRead": "native",
    "scheduleWrite": "unsupported",
    "programCompile": "unsupported",
    "runStart": "readonly",
    "runRecords": "native",
    "traceNode": "unsupported",
    "historyRead": "native",
    "branchCreate": "unsupported",
    "geoView": "adapter"
  },
  "traceCompleteness": "system"
}
```

UI 从 capability 决定是否展示/启用动作，而不是**按钮能点以后才发现后台根本不能执行**。状态按实际发现变更，不能硬编码每个适配器都有相同能力。

### 4.2 最小规范化模型

建议区分五个层次：

- `SchemaCatalog`：实体类型/继承、组件定义、属性定义、关系/约束、量种/单位。
- `ModelPackage`：固定 schema、模板、查询、System 定义、图 IR、原系统版本引用。
- `SceneSnapshot`：实体和组件装配、初值/覆盖、空间关联、场景版本。
- `RuntimeSnapshot`：分支/commit 的有效状态和当前时刻；**不代替初始覆盖**。
- `RunBundle`：运行 ID、基准版本、提交、变化、System 执行、效果/裁决、历史引用与追溯完整度。

内部建议沿用现有 DTO，新增导入适配器做**schema 归一化**，不创建同名第二套模型。映射表始终保存原生 ID、稳定 ID、sourceRevision、生成依据和反向引用。

### 4.3 值与成员语义

**必要字段/语义**：`valuePresence`（VALUE/EXPLICIT_NULL/UNSET/NOT_APPLICABLE/UNKNOWN）、primitive/shape、quantityKind、unit、坐标系（如适用）、attributeSchemaVersion、sourceRef。

- `UNSET` 是继承/未覆盖，不等于 `EXPLICIT_NULL`；
- 未装配组件是 `NOT_APPLICABLE`，不能凭属性值不存在猜测；
- 数字 0、`false`、位置 `[0,0,0]` 都是合法 `VALUE`；
- 绝对温度 °C 与温差 K 有不同量种；失去量种则不是无损映射；
- 原系统高密度场/矩阵应作为 `blockRef`/带维度的数据块保存，不把百万格硬包装成一百万普通 ECS 实体；
- 没有来源和来源损坏分别明确标注，绝不回填最新值伪装历史。

### 4.4 版本与身份

每次从源系统来的数据包至少有：

`sourceSystemId`、`sourceRevision`、`schemaVersion`、`sceneVersion`、`modelBundleId/hash`（如原系统具备）、`runId`、`branchId`、`baseCommit`/`resultCommit`（如原系统具备）、export timestamp、内容校验和。

**不要伪造缺失 commit。** 原系统若只有帧序号或数据库版本，则保留其原生时间/版本字段，并明确映射等级。工作台 IndexedDB 的缓存 ID 不得替代源系统 ID。

### 4.5 业务追溯完整度

建议每个 `RunBundle` 和详细记录同时带有：

| 级别 | 实际具有的事实 | UI 呈现 |
|---|---|---|
| `NODE_INPUT_VERSION` | 节点执行、实际输入版本、请求/裁决、最终版本 | 完整节点级可追溯 |
| `SYSTEM_EFFECT` | System/实体、效果请求或变更、部分裁决，缺节点读取版本 | System/效果级、显式缺口 |
| `PROPERTY_DELTA` | 状态/属性版本增量，不能证明来源算子 | 属性变化回放；来源未知 |
| `SNAPSHOT_ONLY` | 只有前后完整状态/帧 | 状态比较，不显示虚构效果 |
| `UNKNOWN` | 数据损坏或覆盖范围未知 | 不完整/不可验证 |

W3C PROV 可以用于“属性版本 = Entity、执行 = Activity、参与者/模型 = Agent”的视图映射，但数据库是否使用 RDF 与此无关；OpenTelemetry Span 仅用于技术诊断，不是 `inputVersionRefs` 的替代品。

## 5. System 图与真实引擎的语义适配

### 5.1 三种 System 适配等级

| 级别 | 典型对象 | 编辑器行为 |
|---|---|---|
| S0：`OpaqueNativeSystem` | 真实原生函数、求解器、旧脚本，内部不可用图表达 | 在 P12 表示为 System 节点；可读参数、声明访问和外部 trace，P14 只能只读摘要 |
| S1：`MappedNativeSystem` | 参数化 System/现有规则表，部分可投影为图 | 可编辑可映射的字段；保留无法表达的原始字段/版本，禁止损失性回写 |
| S2：`CompiledGraphSystem` | 真实内核确实支持相应 IR/节点、可校验编译 | FlowGram 图可编译/部署/运行，结果与参考语义对照 |

**不应为了让 P14 全部可编辑，把真实原生 System 强行转换成五节点 CoolingRoom 图。**

### 5.2 双层图规范

- P12 `ScheduleDocument`：System、Reducer、Contract、Commit；`order`/`effect`/明确支持的 `product` 各有单独语义。
- P14 `LogicGraphDocument`：查询、绑定、读旧值、纯计算、条件、贡献、赋值、事件/任务等节点，视实际引擎可表达性支持。
- `EditorLayout`：坐标、缩放、面板布局与主题；**不参与语义 hash**。
- `CompiledPlan/IR`：规范化、版本化、独立于 React Flow/FlowGram 的可校验领域计划。
- 不支持的类型/节点/边不得悄悄降级到 `order` 或空操作。

### 5.3 五个必须比较的执行语义

1. System 默认读取的是 `State[n]`、已更新世界，还是阶段快照？
2. System 自身是否有私有暂存和 `readSelf`？跨实体分片能否读取新值？
3. 顺序/依赖边会不会传递前一 System 的即时写入？
4. `set/contribute/propose/emit` 与 reducer/contract 是否存在等价语义？
5. 哪个边界发生最终提交、是否有失败原子性与完整可重演记录？

**如果现有引擎和工作台语义冲突，不能暗中转译。** 必须做出一项明确决定：①通过原系统已有机制完整保真；②在沙盒中以兼容执行后端提供；③标记“不支持此图的正式运行”，仅可编辑或模拟。任何不保真的编译都必须失败并给诊断。

## 6. V7-1：真实数据只读导入（第一施工批次）

### 输入

从现有工程复制一套**脱敏、离线可复现、版本固定**的真实业务样例，至少包括：
- schema（类型、组件、属性与其单位/限制）；
- 实体实例、组件装配、默认/覆盖及有效值；
- System/查询/调度目录或可辨认的原生定义；
- 若可导出，提供模型/场景版本与资产/地图的引用；
- 采集工具、源版本、导出时间、校验和及字段映射说明。

若真实工程无导出接口，先开发一个**只读导出器**，不得在原系统业务逻辑中到处加入面向 UI 的临时字段。

### 开发内容

1. 实现一个 FileAdapter 或复用既有导入层，将原始数据规范化为工作台已有 DTO。
2. 确认实体稳定 ID 与组件存在性；未能无损映射的字段保留 native metadata 并输出诊断。
3. P02/P03/P29/P05/P08/P10/P11/P12 采用同一真实数据源，不混入 seed 数字。
4. 所有真实数据页面显示 `sourceSystem / revision / scene / readOnly` 状态。
5. 如原模型禁止动态 schema 修改，UI 显示只读原因，不能冒充 CRUD 已可回写。
6. 不主动生成位置数据；位置为 null 的实体仍在列表和查询中。

### 验收 V7-1

- 导入数量、稳定 ID 集合、组件装配、类型继承、值/单位/量种与源文件逐项核对；
- 同一实体的字段在列表/详情/查询中一致；刷新后不变；
- `0/null/unset/notApplicable` 可辨；
- 源数据与工作台规范化数据往返（至少工作台导入再导出**同一规范化结构**）没有静默丢失；与原生格式反向回写需另验；
- 无效引用/版本/单位的输入被拒绝并定位；
- 关闭 mock 降级：真实导入失败不能自动显示 F01/F02/F03 却声称读取成功。

## 7. V7-2：真实运行结果和历史的只读分析（第二施工批次）

### 输入

选择与 V7-1 同源场景的一个**原生运行样例**：

- 可复核的运行参数、系统版本、起始状态、结果状态/帧；
- 若存在：运行 System 列表、实体批次、事件/任务、状态 delta、效果请求、裁决与输入依赖；
- 若存在：历史提交或分支关系、模型/场景的固定版本；
- 原系统自己的运行入口、运行日志、结果文件或查询 API。

### 开发内容

1. 定义 `RunBundle` 导入/只读 API，真实 `runId` 与原始记录对齐。
2. 将 P20 绑定真实运行及外层批次/System 信息；P22 根据 `traceCompleteness` 显示可获得的层级。
3. P23 **仅在有真实 EffectRequest/Decision 时**显示请求→获准；没有时展示“原引擎未提供此级数据”，不得从温差结果逆推出 −50/−40。
4. P24 对可得的 sourceRefs 逐层追溯，缺输入版本就提示“不可完整追溯”。
5. P25 业务事件链只使用有 ID/因果字段的真实事件；时间先后不自动连成因果。
6. P26/P27 历史、分支、对比使用**源系统历史**，如果只有连续快照就称“帧回放”，不叫“支持完整分支续算”。
7. 可把快照/记录缓存到 IndexedDB 供本地浏览，但不得生成伪造的原生 commit。

### 验收 V7-2

- 用原系统工具直接读取本次运行结果，与 P20 的数值逐项对照；
- 属性比较缺值不等于 0，版本/单位/时间/分支一致；
- 从结果跳回实际 System/sourceRef，能够显示真实可追溯范围；
- 只有状态快照时 P22/P23 不得构造虚拟节点输入与裁决；
- 切换场景/运行/分支不串值，旧程序/模型不会被当前草稿覆盖；
- 真实运行失败/被取消时页面不展示成功提交。

## 8. V7-3：安全编辑、校验和发布（由 V7-0 能力决定）

**开始条件：**存在稳定的原生模型变更与版本化保存方式，且 V7-1 已验收。若原系统只能从源码编译 schema，应改为“生成配置/代码变更并交开发流水线审查”，不要伪装运行时动态建模。

### 建议协议

- 工作台修改先形成 `ModelPatch`，包含 `baseRevision`、操作集合、稳定原生 ID、预期 schema/model 版本；
- 至少支持 `validate`/`preview`（沙盒或干运行），明确冲突和损失项；
- 有条件实现 `apply`，必须具备并发版本校验、幂等键、权限/审计、失败不半提交；
- 模型发布形成不可变 bundle 或受源系统保证的固定版本，并在实际运行中引用；
- 原系统的业务模型/场景数据不能因打开编辑器、刷新或加载缓存而被写入；
- 工作台 draft/undo 与源系统实际发布/回滚分开，不用 Ctrl+Z 直接撤销生产运行状态。

### 验收 V7-3（仅在被正式纳入范围时）

- 在**隔离副本**新增属性/实体，预览+确认后源系统可读取，原 ID/默认/组件引用正确；
- 追加同名不同 ID、无效引用、超范围数值、并发版本冲突被拒绝；
- 编辑过程不改变历史模型/运行结果；
- 原生系统不支持的 schema 改动明确禁用或导出为变更建议，不谎称可直接运行。

## 9. V7-4：可视化 System 的部署和运行（能力闸门任务）

**开始条件：**V7-0 已证明至少一种 System 可由结构化配置或 IR 真正创建/修改/加载，且底层执行语义可匹配或有明确不兼容提示。

### 开发路径

1. 先映射一个**原系统已有的简单、真实、可控 System**（不是为满足测试而另造替身业务）。
2. P11 读取真实 System 参数；P12 的调度变化与原生执行计划一一对应。
3. 将 P14 节点在必要时编译成领域 IR，而非直接把 FlowGram 视图 JSON 送入引擎。
4. 对不支持的节点、变量或提交边界，在编译阶段产生结构化诊断。
5. 对同一个 model/sourceRevision/输入，比较原生直接运行与工作台触发执行的结果。
6. 做受控负例：缺输入、非法单位、环依赖、重复命令、过期版本、拒绝提交。
7. 如果真实引擎暂不支持动态 System，则停在**可见/可配参数/不可编译新图**的阶段，并提出最小内核扩展，不扩大第二套 TS 生产运行时。

### 验收 V7-4

- 模型、参数、查询命中集合、执行 System 及最终状态由**真实引擎**输出；
- 工作台不能静默退回 mock executor 并显示成“真实执行”；
- 运行 provenance 与 trace 的缺口按引擎事实展示；
- 编辑/发布版本固定，可在旧运行中查看旧版本；
- 默认 `State[n]` 及归约边界若与原引擎不同，必须能证明兼容或显式拒绝图执行。

## 10. V7-5：场景/地图/历史的联动（按实际系统裁定范围）

- P20 的 MapViewport 与原系统/MapEngine 的地图、场景版本、实体身份对接。
- 工作台选中 ECS 实体→地图定位；地图选中→P20/P22/P24 选中同一 `entityId`。
- 空位置实体不出现地图投影，但仍可在 ECS 表与逻辑运行中追踪；`[0,0,0]` 不当作缺位置。
- 显示某旧 commit/viewTime 时，地图不能沿用最新位置、路线或对象状态。
- 运动由权威系统给出路线版本、进度、位置、到达事件；客户端仅插值。
- 初版不要求重建场景编辑与低多边形模型编辑器；地图与资产仍由原系统/MapEngine 负责。
- 将“记录回放”“分支续算”“业务来源”“执行器技术 trace”在 UI 中明确区分。

## 11. 第一条真实纵向业务旅程：推荐执行顺序

使用原系统本来就有的一个小型、可重复场景，优先选含数个实体、多种组件、至少两个 System、一次可观察状态变更或事件的真实数据；**不要求强行变成冷却样例**。

| 关卡 | 操作 | 通过标准 |
|---|---|---|
| J0 | 原生系统导出场景 A 的冻结版本 | 有 revision、原始记录和 checksum |
| J1 | 工作台 FileAdapter 导入、列出实体/属性/System | 数量、ID、值、单位对照一致 |
| J2 | P10 查看真实查询集合 | 与原引擎计算/源码定义的实际集合一致，无法比对则记 PARTIAL |
| J3 | 在原系统原生方式执行一次 | 能取得真实 RunBundle 和不可伪造的 source run ID |
| J4 | P20 显示变化与 System 层级 | 与原始结果逐项一致，无 mock 回退 |
| J5 | P24/P22 展示可用的真实来源层级 | 事实有据；缺口明示 |
| J6 | 切运行/时间/分支并刷新 | 身份/版本/上下文不串 |
| J7 | 如原系统支持，隔离副本编辑并应用一个模型变更 | baseRevision 校验、发布后原系统真能读取 |
| J8 | 如原系统支持，将一个图映射为原生执行计划 | 工作台驱动 vs 原生执行结果一致 |

**最低可交付切片**是 J0–J6；J7/J8 由真实工程能力决定，不能被无条件定义成已经实现的 v0.7 成功标准。

## 12. 验收矩阵（新增真实集成验收）

| ID | 判据 | 必须的证据 |
|---|---|---|
| REAL-01 | 两工程源码/接口能力审计完成，无猜测标记为已实现 | source map、commit、运行命令 |
| REAL-02 | 原生快照导出可重现，来源/版本固定 | 源包、checksum、日志 |
| REAL-03 | ECS 身份/类型/装配/继承映射 | 双侧集合和差异报告 |
| REAL-04 | `0/null/unset/未装配/原点` 不混淆 | 样例与负例 |
| REAL-05 | 单位/量种/坐标系校验，非法数据拒绝 | 数据契约测试 |
| REAL-06 | P10 查询真来自源场景/原生规则，不来自 seed | 集合/ID 对照 |
| REAL-07 | 导入失败不自动伪装成功加载 mock 数据 | 故障注入及 UI 截图 |
| REAL-08 | 原生 RunBundle 的运行 ID/版本/状态一致 | 双侧运行结果对照 |
| REAL-09 | 真实 trace 完整度正确，缺节点信息不补造 | sourceRef 及缺失样例 |
| REAL-10 | 结果→原 System/原记录的跳转有据可查 | 录屏+machine-readable refs |
| REAL-11 | 时刻/branch/运行切换不串值或套用当前数据 | 多上下文对比 |
| REAL-12 | 本地缓存不是原生系统权威提交 | 断连、刷新和版本诊断 |
| REAL-13 | ModelPatch dry-run / revision 冲突处理（若支持编辑） | 沙盒回写与负例 |
| REAL-14 | 调度/程序语义转换明确：无损或拒绝（若支持图执行） | compile diagnostics 与结果对照 |
| REAL-15 | 真引擎执行失败不更新 head/成功状态（若暴露提交） | 失败用例 |
| REAL-16 | 地图与实体和旧时间点同步（若 MapEngine 已接入） | 双向联动回归 |
| REAL-17 | 真实性能测量拆分读取/计算/trace/持久化/渲染 | 环境、样本、p50/p95 |
| REAL-18 | 用户业务目录和样本不被擅自修改/上传 | 本地 Agent 操作日志与安全声明 |

所有状态取 `PASS / FAIL / PARTIAL / NOT_RUN / NOT_APPLICABLE`，其中 `NOT_APPLICABLE` 必须附 capabilities 和依据，不能被计入功能完成数。

### 完成定义分级

- **v0.7-R（读真实数据和真实运行）**：REAL-01–12 及 REAL-18 必须 PASS；其余按实际能力标注。**建议作为近期第一验收目标。**
- **v0.7-W（可编辑并发布模型）**：在 v0.7-R 基础上 REAL-13 PASS；否则保持只读/变更建议模式。
- **v0.7-X（可部署并执行可视化 System）**：在 v0.7-R 基础上 REAL-14、15 PASS；不兼容的 native 系统仍可作为 S0 黑盒显示。
- **v0.7-G（地图和历史真实联动）**：REAL-16 PASS，并完成时间/分支/路线权威验证。

**不要再以“所有页面已落地”评价完整真实系统适配。**

## 13. 工程批次、提交边界与依赖

| 批次 | 范围 | 主要产物 | 依赖/阻断 |
|---|---|---|---|
| V7-0 | 两工程只读审计 | 代码索引、能力矩阵、差异清单、最小场景选择 | 取得本地工程目录 |
| V7-1 | FileAdapter + 真实 ECS 只读展示 | Model/Scene 导出器、归一化、P02–P12 数据联通、测试 | V7-0 + 可导出真实样本 |
| V7-2 | RunBundle + 真实过程只读分析 | P20–P27 数据适配、来源完整度、真实记录对照 | V7-1 + 一次真实运行 |
| V7-3 | 沙盒模型编辑与发布 | ModelPatch、dry-run、版本检查 | **仅当原系统支持/同意扩展** |
| V7-4 | System IR 编译与原生执行 | 编译器、兼容性诊断、运行对照 | **仅当真实 System 可动态映射/部署** |
| V7-5 | MapEngine/历史联动 | 空间视图和时间/分支/实体同步 | 真实 Map/History 接口 |
| V7-6 | 加固与验收 | 合并回归、结果报告、已知边界、下阶段核心升级建议 | 对当前实现范围 |

第一批和第二批是关键路径。V7-3/4/5 可以在 v0.7-R 达标后单独排期/验收；不要阻塞纯只读真实集成的首次交付。

### 对现仓库的施工要求

- 保留 v0.6 的 MockAdapter、既有前端页面和本地历史用于回归，不整仓重写。
- 新增“数据来源/运行模式”标识：`MOCK_SANDBOX`、`REAL_IMPORT_READ_ONLY`、未来的 `REAL_CONNECTED`；不可混淆。
- 尽量沿用已有数据适配器、schema、draftRegistry 和 trace DTO；只在明确缺失时新增 contracts。
- 图编辑器、运行 DTO 和可视化组件依赖统一 adapter facade，不在每个页面单独写真实系统解析逻辑。
- 按 documentId/version/branch/run 隔离缓存及异步请求；数据切换时旧响应不能污染新上下文。
- 禁止直接在真实业务场景上写入/实验；一切变更先在隔离副本或明确授权的测试环境。
- 留完整的失败路径、差异报告和原生数据引用，不允许靠改业务数据或预期断言来让测试通过。

## 14. 本地 Agent 启动指令、产物与安全边界

用户提供真实系统工程目录后，先仅执行单独附件中的 `local_agent_first_task.md`。首轮应交付如下结构（目录是**建议**，需核对真实仓库的现有文档位置）：

```text
design/04/
  01_v07_real_engine_integration_plan.md
  02_dual_repo_audit.md
  03_capability_matrix.md
  04_semantics_gap_analysis.md
  05_native_data_inventory.md
  06_integration_decisions.md
  contracts/
    model-package.md
    scene-snapshot.md
    run-bundle.md
    source-identity-map.md
    capability-manifest.md
  acceptance/
    real_integration_cases.md
  evidence/
    native-source-map.md
    real-fixture-manifest.md
    export-and-import-diff.json
    native-run-compare.json
```

**首轮不要求 Agent 改代码。** 真正着手 V7-1 前应能回答三项决定性问题：

1. 原系统是否可无损提供工作台所需的模型/场景身份与 schema？
2. 原系统是否可提供一次可复现真实运行的数据及对应版本？
3. 哪些 System/追溯细节在原系统中是真事实，哪些只可以以黑盒或降级方式展示？

如任一为否，先完成最小读出/记录插桩方案；不要扩充 FlowGram 节点以掩盖后端缺口。

### 决策清单（必须在 V7-0 后确定）

- 原系统是否已有稳定的 schema/scene/run API？是文件导入还是本地服务？
- 模型真正的权威在哪里？工作台能否编辑发布还是只能提交变更请求？
- 原生 System 处于 S0/S1/S2 哪类，是否存在可逆/无损的映射？
- 历史只有帧、可回放，还是具备完整 checkpoint 续算？
- MapEngine 是否与该工程同仓或独立？如何固定空间实体与 commit 的对应？
- 哪些真实资产或敏感数据只可留在本地，验收样本如何脱敏？

## 15. 官方资料与本轮研究依据

1. React Flow, Save and Restore： https://reactflow.dev/examples/interaction/save-and-restore
2. React Flow, `ReactFlowJsonObject`： https://reactflow.dev/api-reference/types/react-flow-json-object
3. FlowGram 官方项目 README（Free Layout / Form / Variable）： https://github.com/bytedance/flowgram.ai
4. JSON Schema Draft 2020-12： https://json-schema.org/draft/2020-12/
5. W3C PROV-O： https://www.w3.org/TR/prov-o/
6. OpenTelemetry Trace Concepts： https://opentelemetry.io/zh/docs/concepts/signals/traces/
7. Apache Arrow Columnar / IPC： https://arrow.apache.org/docs/format/Columnar.html
8. FMI 3.0 Specification, FMU State： https://fmi-standard.org/docs/3.0.1/

这些文档支持某些**通用技术事实与集成原则**，不证明已有推演系统已实现这些功能。真实工程的权威证据必须来自本地 Agent 的源码审计和可重复运行输出。

---

## 16. 本轮评审的最终实施决定建议

**立即做：**准备真实工程只读审计，确定模型/场景/执行/历史的实际权威和接口；保留旧 demo 做防回归；用真实数据完成至少一条 J0–J6 的可复现读/运行/分析闭环。

**审计后决定：**是否能直接把 ECS 编辑发布到现有系统；哪些 System 可从 FlowGram/React Flow 编译、哪些必须以黑盒方式显示；需要在原系统增加哪些来源记录。

**暂不做：**再造一套正式仿真引擎、未证实的动态脚本万能编译器、强制替换数据库、整站 UI 重做、为了显示节点级来源而伪造引擎不存在的数据。

项目达到 v0.7-R 后，再决定是否优先推进 v0.7-W（真实建模发布）、v0.7-X（真实可视化 System 执行）或 v0.7-G（场景与历史联动）。选择依据应是已有工程支持程度和用户真正要验证的业务流程，而不是继续增加页面。
