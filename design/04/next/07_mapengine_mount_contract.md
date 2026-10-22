# 07 MapEngineMount 宿主协议(G0,实现 `src/services/mapMount/protocol.ts`,替身测试通过)

日期:2026-10-23 ｜ 状态:PROTOCOL_READY(无 Cesium 替身验证;真实挂载待微前端评审)

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
