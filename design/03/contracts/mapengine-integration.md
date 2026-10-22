# MapEngine 集成契约（v0.6 草案，只定义不接入）

版本：0.1 ｜ 日期：2026-10-22 ｜ 状态：**草案，待本仓库与 mas-suite MapEngine 责任人共同审定**。v0.6 不包含任何接入实现；P06/P07/P09 在接入前保持迁移/入口页（RetiredPage），不得计作本仓库的场景装配/地图/模型库能力。

## 1. 稳定身份

| 契约项 | 约定 | 必测情况 |
|---|---|---|
| 身份空间 | `projectId` / `sceneId` / `entityId` / `assetId` / `templateId` 全部以本仓库 ECS 的稳定字符串 ID 为权威；MapEngine 不得自造平行 ID，只持有引用 | 重命名实体不换 ID；删除被引用对象受阻 |
| 版本标识 | `sceneVersion`、`modelBundleId/hash`、`commitId`、`branchId` 四者必须可互查；空间表现按 `sceneVersion+commitId` 定位 | 切换历史 viewCommit 时空间表现跟随匹配；MapEngine 缓存键含版本 |

## 2. 场景数据所有权

- ECS/运行内核（本仓库）拥有：实体身份、组件装配、属性权威值、运行演化（世界快照）。
- MapEngine 拥有：地理数据、3D 资产、空间表现、装配/布局的**呈现态**。
- `position.local` 等空间属性是 ECS 属性（权威在本仓库）；MapEngine 的相机、图层、样式属呈现态，不回写业务事实。
- 逻辑实体无位置也合法存在：MapEngine 不绘制但必须能从实体清单读到（「逻辑保留，视图不绘制」）。

## 3. 坐标

- 坐标系：园区局部 ENU（park-ENU），三分量 east/north/up，单位米；高程基准需在接入评审时与 MapEngine 全局坐标（如 WGS84/Cesium ECEF）的换算关系一并锁定。
- `[0,0,0]` 是有效原点位置；`null` = 未放置（不绘制，不等于原点）；`0` 分量与缺值不得混淆。

## 4. 选择联动

- ECS 表格/对象树选中 → MapEngine 聚焦（有位置实体）；MapEngine 拾取 → 本仓库实体检查器选中。
- 无空间表现的实体被选中时，MapEngine 侧给出「无空间表现」提示而不是静默丢失或跳到原点。

## 5. 运动权威

- 轨迹/路线/位置-速度序列与到达事件由运行内核（推演）产生权威版本；MapEngine 的播放是权威路线的**投影**。
- 客户端视觉路线（拖拽、路径编辑）不得直接改变业务位置事实；任何位置变更走 ECS 属性写入路径。

## 6. 资产

- `assetId`、版本、离线地址、缺失处理：资产失效（404/格式不支持）显示占位与原因，不写假坐标、不静默跳过。

## 7. 错误与能力协商

- 模块未安装/版本不兼容/资源加载失败/只读状态：降级文案明确（「MapEngine 未连接」类），不画假地图、不假装集成成功。
- 能力协商字段建议：`{ engineVersion, capabilities: [], sceneVersion, mode: 'embedded'|'external'|'unavailable' }`。

## 8. Fixture 与契约测试计划（v0.7 接入时执行）

- `fixtures/mapengine/scene-05.json`：六实体样例（含一个 null 位置 C01、一个 [0,0,0] 原点实体）+ 版本引用。
- 契约测试清单：身份稳定/删除阻止、历史切换匹配、null 不绘制、原点有效、选择双向联动、资产失效降级、未连接降级文案。每项给定输入与可机读判据。
