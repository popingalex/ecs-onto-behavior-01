# 06 ModelPatch 事务化协议(W0 无写入部分,实现 `src/services/modelPatch/protocol.ts`)

日期:2026-10-22(深夜;提交 22:5x +0800,见 H_RELEASE_EVIDENCE) ｜ 状态:LOCAL_ONLY(dryRun/校验/幂等语义已实现并测试;apply 属 V7-3 闸门)

## DTO(zod,`modelPatchSchema`)

`{patchId, sourceSystemId:"mas-rust", targetSceneId, expectedRevision, idempotencyKey, operations[]}`;
操作:`replaceAttribute{entityId,attributePath,newValue}` / `addEntity{entityId,typeId,label}` / `removeEntity{entityId}`。

## 本地校验规则(dryRunModelPatch)

SCENE_MISMATCH / REVISION_CONFLICT(乐观锁)/ ENTITY_MISSING / ENTITY_EXISTS /
ATTRIBUTE_UNDECLARED(只允许改已声明属性)/ TYPE_MISMATCH(shape+primitive+非空约束)/
UNIT_MISMATCH(**单位 UNKNOWN 拒盲写**:先在契约层定单位)/ REMOVE_BLOCKED_BY_REFS(删除引用阻止)/
IDEMPOTENCY_CONFLICT(同目标重复操作)。任一 error → 不产生变更集(原子预览)。

## 幂等语义(IdempotencyLedger,本地内存版)

同 idempotencyKey+同 patchId → replay(返回原结果摘要);同 key 异 patchId → conflict。
真实幂等与原子性(WRITE-04/07/08)由引擎事务承载,本层不冒充。

## V7-3 解锁硬条件(复述自计划 §8.3,未满足前 NOT_RUN)

隔离引擎/独立 PG 授权;引擎侧原子 dryRun/validate/apply 协议;expectedRevision 冲突拒绝;
幂等键;引用/值校验;失败零半提交;成功返回新源 revision;历史不被覆盖。

## 验收映射

WRITE-01 ✅(dryRun 变更集+模型零修改断言)/ WRITE-02 ✅(REVISION_CONFLICT)/
WRITE-03 ✅(五类负例+UNKNOWN 单位)/ WRITE-05 ✅(本地语义)/
WRITE-04/06/07/08 ⛔ 闸门(引擎事务)。

---

## v0.7-postH 补充(W0 补足,2026-10-22 深夜)

### /cm 真实能力只读审计(差异清单)

`crates/server/src/routes/cm_crud.rs:40-195`:entity/component/system 等仅 list/get/create/update/delete **纯 CRUD**;
`revision|version|transaction|baseRevision|expected` 全文件 **0 命中**——无乐观锁、无事务、无幂等键、无 dryRun/apply 两阶段。
**结论:W1 不得以 /cm 串联直写+事后校验实现**(计划 §4 判定一致);需引擎侧新增事务端点(候选:POST /cm/model-patch:validate|apply|status)。

### 本轮新增(W0)

- `patchSubmissionStatusSchema` + `PatchStatusReply` + `getPatchStatus`(候选 getStatus;UNKNOWN 状态禁止客户端自动重试);
- 负例新增:部分失败原子性(整包拒绝+定位坏操作)、显式 null vs UNSET(nullable 属性 null 合法且绕过单位检查;非 nullable null 拒绝;已声明未写路径可显式赋值);
- 测试 4→7 项,138→141 passed。

### W1 隔离实验方案(待授权,不执行)

1. 环境:独立端口引擎实例+独立 PG+场景副本(chem-roaded 拷贝);固定新二进制 buildId。
2. 首个试验:仅 replaceAttribute 单操作,改一个引擎原生支持参数(如 flammable/temperature 初值);
3. 引擎侧事务要求(候选协议,须引擎评审):单事务内 revision 原子检查→全操作校验→全提交/全回滚→幂等键+请求 digest→产生原生新 revision;失败路径注入(中途 kill)验证可恢复;
4. 验收:W-01..08(计划 §4);双向读取一致以工作台重放 vs 引擎历史端点逐帧对拍为准(方法已就绪)。
