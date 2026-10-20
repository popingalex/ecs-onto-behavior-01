# 第三方组件与复用边界

核对日期：2026-10-20。此处是候选组合，不是已完成兼容测试的依赖锁。遵守既有“客户端原生/WASM共享”方向；本包的HTML画面仅用于精确呈现规格与出图，不作为新增生产界面技术栈的批准。

|需求|首选复用|核实的能力与许可|需要平台补齐|
|---|---|---|---|
|基础控件、布局、输入|egui|Rust即时模式GUI；MIT或Apache-2.0|主题、中文字体/IME、领域值控件、可访问性验证|
|Bevy与UI集成|bevy_egui|官方仓库有Web示例和侧栏视口适配；MIT或Apache-2.0|事件焦点、3D拾取抢占、资源与渲染区同步|
|停靠面板|egui_dock|标签停靠与程序化布局；MIT|默认布局、工作区持久化、浏览器多窗口约束|
|表格|egui_extras::TableBuilder|列布局、可调列宽；TableBody::rows按可见行调用|筛选/排序、单元格编辑、批改、schema校验；它不是完整电子表格|
|节点图编辑|egui-snarl|有类型节点载荷、SnarlViewer、自定义输入输出pin、连线响应、serde布局；MIT或Apache-2.0|领域类型/单位/控制作用域、执行编译、撤销命令、trace适配|
|趋势与时间轴底座|egui_plot|egui二维绘图；MIT或Apache-2.0|覆盖区间、提交节点、具名事件关系、选中联动|
|关系图布局/校验|petgraph + 固定层级布局适配|图结构和常见算法；MIT或Apache-2.0|可读布局、裁剪、业务边语义、稳定ID|
|配置/图/历史序列化|serde/serde_json|Rust成熟序列化生态|版本迁移、校验、不可变引用、hash与提交事务|
|动态表达式/脚本|Rhai（可选）|预编译AST与WASM文档；MIT或Apache-2.0|受控读写封装、查询预算、依赖追踪，不自动增量化|
|空间呈现|Bevy/wgpu候选与现有地理适配|保持客户端路线验证边界|离线地图、真实资产、坐标、拾取与低配实测|

## 不能误当作现成能力

egui-snarl不提供FlowGram级本体变量系统，不提供业务执行器。我们复用节点/连线交互，只实现binding selector、类型与单位检查接口、执行计划和调试映射。egui_extras不提供完整树形数据表；基础树先用egui折叠组件，数量大时采用可见区扁平列表，避免同时引入第二个树形框架。

提交DAG、属性来源DAG和事件泳道使用同一图结构适配层，但数据类型分开。自动布局若首版不足，先提供稳定固定层级与手动布局；不为画图引入完整商业BPMN引擎。当前内部程序并非BPMN语义，不需要把所有节点变成BPMN任务。

React Flow/FlowGram仍是可参考的Web编辑器生态；采用它们需要明确增加React/TS和原生WebView宿主。此前没有这项用户批准，因此本包不把它们列为默认生产依赖。bpmn.io也不是本系统必要依赖。

## 兼容组合闸门

实施前在同一Cargo.lock中解析Bevy、bevy_egui、egui、egui-snarl、egui_dock、egui_plot。必须只出现可互操作的egui核心版本；不能把多个“latest”各自安装后当成兼容。验证原生构建、wasm32构建、中文IME、文件导入、10k行表、300节点图、两个停靠区、空间拾取焦点与浏览器缓存恢复。记录实际版本、目标平台、设备与结果后才能锁定。

16GB集显目标需要测量内存峰值、纹理/瓦片/图缓存预算；本包图片和Python参考器都不证明正式客户端性能。高级图编辑、中文输入和辅助技术支持也需双端验收。

## 官方资料

- egui：https://github.com/emilk/egui
- bevy_egui：https://github.com/vladbat00/bevy_egui
- egui-snarl：https://github.com/zakarumych/egui-snarl
- egui_dock（原地址现重定向到维护仓库）：https://github.com/anhosh/egui_dock
- TableBuilder：https://docs.rs/egui_extras/latest/egui_extras/struct.TableBuilder.html
- 可见行表：https://docs.rs/egui_extras/latest/egui_extras/struct.TableBody.html
- egui_plot：https://github.com/emilk/egui_plot
- petgraph：https://github.com/petgraph/petgraph
- Rhai：https://rhai.rs/book/engine/compile.html 与 https://rhai.rs/book/start/builds/wasm.html

只使用开源基础能力，保留所锁版本LICENSE/NOTICE。数据、地图与3D资产的使用权独立于界面库许可，不从库许可推导资产授权。
