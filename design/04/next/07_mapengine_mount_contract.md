# 07 MapEngineMount 宿主协议(G0,实现 `src/services/mapMount/protocol.ts`,替身测试通过)

日期:2026-10-22(深夜;提交 22:5x +0800,见 H_RELEASE_EVIDENCE) ｜ 状态:PROTOCOL_READY(无 Cesium 替身验证;真实挂载待微前端评审)

## 协议 v1

宿主→地图:INIT(protocolVersion, context) / LOAD_SCENE / SET_VIEW_TIME(context) / SELECT_ENTITY(entityId, correlationId, context)
地图→宿主:READY(protocolVersion, capabilities) / SCENE_LOADED / ENTITY_SELECTED / VIEW_CHANGED / ERROR

## 已实现护栏(测试钉死)

- 版本握手:READY 版本不符 → error,**不降级冒充已连接**(MAP-01/MAP-06);
- 来源校验钩子(acceptsOrigin;跨 iframe 时校验 origin/身份)(MAP-01);
- 回环防护:地图按同 correlationId 回抛宿主选择 → 吞掉不广播;异 corr=地图自发点选 → 广播(MAP-02);
- 上下文护栏:切分支/时刻后旧上下文回包丢弃(STALE_RESPONSE_DROPPED)(MAP-04);
- 未就绪消息拒绝(NOT_READY)。

## 坐标语义规则(G0 硬约束)

`transform/position` 为 Vec3 数值,**禁止**未经契约确认当作 lon/lat/height 展示;
接入前必须核对:坐标系/轴顺序(引擎实测 [lon, alt, lat])/单位(度)/ENU 或地理/高程基准与采样策略,
并把 coordinateFrame 写入位置类型(map-engine-v2 侧 `coordinateAdapter.ts` 的 LNG_ALT_LAT 序可作对照基线,仍须以联调控制点核对为准)(MAP-05)。

## 真实挂载前置(待评审)

iframe/微前端优先(隔离 Cesium 依赖);实体三重身份映射(原生 entityId↔工作台↔featureId);
时间/分支权威(SET_VIEW_TIME 绑 sceneVersion+sim+branch+viewRef);P20 保持 NOT_CONNECTED 状态直到真实接入(MAP-06)。

---

## v0.7-postH 补充(G0,map-engine-v2 只读核对,2026-10-22 深夜)

实测事实(mas-suite/mas-refactor/packages/map-engine-v2):
- **入口**:`MapEngineV2` 为 React 组件(forwardRef+Props,`components/MapEngineV2.tsx:123`);**无现成 iframe/微前端出口** → G1 二选一:在 map 侧包 iframe 壳(评审项)或工作台直接 React 嵌入(引 Cesium 重依赖,违背宿主轻量原则,不推荐);协议按 iframe 语义设计,两种载体均适用。
- **坐标**:`utils/coordinateAdapter.ts` 默认 `rawCoordinateOrder='LNG_ALT_LAT'`(即 [lng, alt, lat])+ `isSaneGeographicLngLat`(±180/±90 合法域);与引擎 `transform/position [lon,alt,lat]` 一致——**但工作台侧仍按 PENDING_FRAME_RESOLUTION 处理,联调控制点核对前不投影**(MAP-05)。
- **feature ID**:EntityPool 以 `instanceId` 为键(实体池/贴地/动画全用它)→ **地图 feature id=引擎 InstanceId 原样**,三重身份映射中"原生↔地图"为零转换。
- **贴地**:groundPosition 模块强制所有高度经它采样(地形高程缓存)——SET_VIEW_TIME 历史位置也须过该通道,地图只插值不做权威。

本轮新增代码与测试(+2):`initTimeoutMs` 超时熔断(INIT_TIMEOUT;超时后 READY 拒绝翻转)+ `classifyMapPosition`(null=NO_MARKER/[0,0,0]=VALID_ORIGIN/Vec3=PENDING_FRAME_RESOLUTION/形状不符=INVALID)。测试 3→5 项,累计 146 passed。
