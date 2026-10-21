# Figma原型整改计划 v0.5

目标：将当前React/Figma Make工作台的四项核心能力做成可编辑、可执行、可解释的原型：ECS构建、System外层调度、System内部逻辑、计算过程记录与展示。

这是基于仓库源码的修改计划与施工资料。M0–M5 已全部完成（2026-10-20/21），实际进度见 07_progress.md、acceptance/ 与 contracts/implementation_tasks.json 的 statusNote。

## 阅读顺序

1. 01_repository_audit.md：实际缺口、可保留基础和源码证据，含28条失效规格路径（已修复，见 07_progress.md）。
2. 02_revision_plan.md：对象分层、独立页面、组件职责、数据流、文件改动与施工顺序。
3. 03_figma_make_tasks.md：可逐轮交给Figma Make的明确任务，含完成标准。
4. 04_data_and_trace_contract.md：模型、图、运行记录、旧数据迁移与可复算业务。
5. 05_acceptance.md：原型点击验收，防止再次交付占位页面。
6. 06_sources.md：官方组件文档、使用边界与核对依据。
7. 07_progress.md：M0–M5 施工与验收回传：实际改动、验证结果与剩余缺口。
8. acceptance/：核心旅程验收记录（AC01–AC20）、组件库使用核对与真实截图。
9. contracts/：审计证据、页面映射、任务列表（含施工状态）、TypeScript DTO。
10. mock/：结构化原型输入和预期结果。prototype_seed.v05.json 是应用唯一种子来源；expected_runs 仅作对照核对与「查看样例」，不作为「执行当前图」的分支查表（M4 起执行由 src/services/mock-executor 真实求值）。

## 本轮决策

当前仓库是React 19 + Vite + Tailwind。原型界面明确采用shadcn/ui；外层调度采用React Flow；内层程序采用FlowGram自由布局、节点表单和变量能力。两种画布各有独立文档与组件，统一领域契约。

这取代上一版把egui候选当作Figma原型施工依赖的做法。正式Rust core与未来原生/WASM客户端的工程路线不在本轮改动范围；Web原型用mock计算适配器验证交互和语义，后续可替换为Rust/WASM调用。

实体类型、组件定义、属性定义、实体模板、场景实体及实体属性值必须分别管理。P03收敛为组件管理，新增P29独立属性管理；P08实现实体实例编辑；P12仅管理system调度；P14仅管理system内部程序。P22按执行记录展示过程，不重复搭建一个独立逻辑定义。

2026-10-21 起导航架构更新为 IA v2（详见 07_progress.md「IA v2」节）：四组导航（项目/建模/逻辑/推演）、资源树改为纯对象树（点击=宿主页内选中，画布页图中聚焦）、场景组下线（归 mas-suite MapEngine）、运行主页首屏为 system 编排层。design/01 的六组导航与页面分组为历史规格，以 IA v2 为准。

## 完成标准

用户能新建温度属性→装配Thermal组件→构造火源实体→编辑冷却程序→创建两个system并编排→结算→查看节点输入输出/请求/获准/最终→从结果跳回来源节点。改参数或断开必需连接后，结果或校验必须实际改变。
