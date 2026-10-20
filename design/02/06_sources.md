# 核对资料与技术判断边界

仓库检查基准见contracts/review_source.json；每条发现的具体文件见contracts/audit_findings.json。本次为静态源码审计，没有构建或运行当前React项目。

官方资料：

- shadcn/ui Data Table：https://ui.shadcn.com/docs/components/base/data-table 。说明Table与TanStack Table组合，不是一个万能业务表。
- shadcn/ui Resizable：https://ui.shadcn.com/docs/components/radix/resizable 。用于可调整面板的交互基础。
- React Flow自定义节点：https://reactflow.dev/learn/customization/custom-nodes 。支持自定义React节点及多端口。
- React Flow Handles：https://reactflow.dev/learn/customization/handles 。端口、多个handle与交互基础。
- React Flow Computing Flows：https://reactflow.dev/learn/advanced-use/computing-flows 。能构建数据流示例，但不提供本系统的贡献裁决、历史和执行语义。
- FlowGram自由布局：https://flowgram.ai/api/components/free-layout-editor 。使用FreeLayoutEditor作为内层画布基础。
- FlowGram变量：https://flowgram.ai/guide/variable/basic.html 。包含变量作用域、类型推导和设计态能力；官方明确设计态变量引擎与运行态不同。

“shadcn作为基础界面、React Flow管理外层、FlowGram管理内层”是本次面向现有React原型的工程设计判断。它们没有现成实现ECS领域模型、读旧值/私有暂存、局部contract或完整溯源；这些仍通过统一文档与mock adapter定义。

选择具体版本时要在现有React19/Tailwind4/Vite组合下完成M0技术切片并锁文件，不盲目逐个安装latest，也不宣称本轮已通过兼容性检查。正式Rust/WASM内核性能不由这些Web组件文档证明。
