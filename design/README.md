# 推演建模与运行工作台 · UI施工包 0.4

本包面向 Figma 原型制作及前端实施，提供逐页布局、交互、组件、数据和独立关键页画面。它可单独阅读；本次未取得上一版ZIP的文件内容，因此不宣称逐文件修订或继承其全部命令契约。对话已经确定的执行语义继续保留。

## 交付入口

1. 01_layout_and_interaction.md：空间布局、状态、可读性与操作约定。
2. pages/：28个独立页面/弹层规格，逐一说明真实内容、跳转、数据、异常和验收。
3. 02_components.md：组件规划、属性、事件、数据责任、Figma变体与Rust实现映射。
4. 03_navigation.md + contracts/navigation.json：完整跳转表、参数、返回与未保存处理。
5. 04_business_flows.md + flows/：建模发布、双路降温、提前交接、分支追溯流程。
6. 05_mock_and_execution.md + mock/：独立业务数据、类型、图、结果、历史、状态和操作剧本。
7. 06_component_libraries.md：官方来源核对、复用范围、许可和兼容性验证边界。
8. 07_figma_handoff.md：Figma文件结构、组件/变量命名和验收清单。
9. prototypes/index.html：独立关键页画面目录，配套1920×1200 PNG、SVG和HTML源；HTML为画面复核材料，正式UI仍按客户端技术栈实施。
10. 08_forms_and_dialogs.md：15个表单/弹层的字段、控件、默认值、校验和提交事件。
11. qa/validation.md：计算、引用、页面路由与画面检查的实际结果和限制。

## 固定业务语义

所有system读State[n]；同一执行上下文可读自身暂存；其他system暂存不可见；贡献是请求，获准后才生效；整回合原子提交。外层顺序边不自动传新状态；内部实体尽量并行，局部contract维护共享资源。历史查看、播放暂停、恢复续算是不同操作。位置null实体不显示但保留逻辑，原点有效。

UI首选候选为Rust+egui生态，与Bevy/wgpu原生/WASM客户端路线配合。引擎及版本兼容仍需实机技术验证；本包不擅自新增React/WebView双界面路线。

## 快速复算

Python 3、无需外部依赖：

```bash
python reference/simulate.py --all
python reference/validate.py
```

模拟步长10秒，演示时长1秒。F01从100°C接受两个−50 K请求，经80 K额度按比例获准−40/−40 K，最终20°C。V01从5500 L耗水，V02在4秒到达交接，末水分别5100/8400 L。温度降到20°C不自动表示火焰熄灭，火源active为独立mock字段。

这是详细UI规格、静态原型设计图片及可运行mock参考器。尚未交付Figma可点击文件、正式Rust计算内核、真实断点续算、真实3D导入或16GB集显实机性能结论。所有园区业务均为虚构训练规则，不代表旧场景已迁移。
