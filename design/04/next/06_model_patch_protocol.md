# 06 ModelPatch 事务化协议(W0 无写入部分,实现 `src/services/modelPatch/protocol.ts`)

日期:2026-10-23 ｜ 状态:LOCAL_ONLY(dryRun/校验/幂等语义已实现并测试;apply 属 V7-3 闸门)

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
