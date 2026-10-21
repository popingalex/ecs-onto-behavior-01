# 第三方组件库使用核对（源码 / 交互 / 产物三证）

核对日期：2026-10-21。标准：组件库安装成功不等于业务完成；每项给源码 import、运行交互、保存产物三类证据。

## shadcn/ui（`src/components/shadcn/`，17 个组件）

- **源码**：业务页直接 import，如 `src/pages/p29/P29Attributes.tsx`、`src/features/schedule-editor/ScheduleEditor.tsx` 等 9 个文件 import `components/shadcn/*`；另有 `src/components/ui/*` 薄封装保持既有语义主题。
- **交互**：P15 绑定选择器（dialog/radio）、P11 启用开关（switch）、各页表格/标签页/按钮均渲染真实 shadcn 组件（截图 `screens/p15-binding.png`、`screens/p29-attributes.png`）。
- **产物**：草稿保存写 localStorage（draftRegistry `draft/1` 格式），刷新恢复已在 AC18 验证。

## React Flow（`@xyflow/react@12.12.0`）— P12 外层调度

- **源码**：`src/features/schedule-editor/ScheduleEditor.tsx`、`ScheduleCanvas.tsx`、`nodes.tsx`、`codec.ts` 共 4 处 import。
- **交互**：P12 拖入 System、连 order/effect 边（`checkConnection` 拦截 product/成环）、删除、启停、双击跳 P14；画面左下角有 React Flow 署名（`screens/ac20-p12-1440x900.png`）。
- **产物**：ScheduleDocument 草稿（`schedule:schedule-main`），布局写 layout 不进语义 hash（单测 `layoutDoesNotChangeScheduleSemantics`）。

## FlowGram（`@flowgram.ai/free-layout-editor@1.0.16`）— P14 内层程序

- **源码**：`src/features/logic-editor/LogicCanvas.tsx`、`LogicNodeCard.tsx`、`geometry.ts`、`programFile.ts` + `src/services/logicGraphCodec.ts` 共 5 处 import。
- **交互**：P14 节点库拖入/双击建节点、端口连线（`checkEdge` 单位校验）、断线、删除、撤销重做、导入导出（`screens/p14-graph.png`、`screens/error-missing-input-p14.png`）。
- **产物**：LogicGraphDocument 草稿（`program:<id>`）+ `logic-graph/1` 导出文件（含 program/layout/workflow 三段，导入以 workflow 回写并过 Zod 校验）。

## react-resizable-panels（4.14.7）

- **源码**：`src/features/logic-editor/LogicEditor.tsx`、`src/features/schedule-editor/ScheduleEditor.tsx`、`src/components/shadcn/resizable.tsx`。
- **交互**：P14/P12 的左库/画布/右表单/下诊断各区拖分隔条调大小。
- **产物**：面板布局偏好（重置面板布局按钮可见于顶栏）。

## TanStack Table（8.21.3）— 已安装未使用

- 依赖在 `package.json`，但 `src` 内**无任何 import**：各页表格目前用 shadcn table + 自绘行。如实记为「装了没用」，M0 的「引入 TanStack Table」只完成安装；如需替换表格层另立任务。

## 结论

React Flow 与 FlowGram 均为真实挂载与业务读写，不是 SVG 占位；shadcn 组件在核心页真实使用；react-resizable-panels 真实可用；TanStack Table 未落地（唯一未兑现的 M0 依赖项）。
