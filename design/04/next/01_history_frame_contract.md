# 01 历史帧契约(H1 定稿)

日期:2026-10-22(深夜;提交 22:5x +0800,见 H_RELEASE_EVIDENCE) ｜ 实现:`src/services/nativeImport/replayGuards.ts`(+黄金钉死测试)

## 1. 引擎端点语义(实测确证)

| 端点形式 | 行为 | 裁定 |
|---|---|---|
| `GET /sim/:id/branch/:b/:time/attributes`(路径参数) | **真历史帧**:history 折叠装配只读路径;`resolvedTick=请求帧`;tick>head 显式 404(`routes/attributes.rs:163-196`) | **唯一合法的引擎历史帧读取方式** |
| `GET .../attributes?frame=N`(查询参数) | frame 被忽略,恒返 head | **禁止使用**;工作台 `assertResolvedFrame` 拦截该形式的误用(FRAME_NOT_RESOLVED) |

J3 逐帧对照(黄金证据 `evidence/j3-run-compare/native-run-compare-history.json`):帧 1–6 工作台重放 vs 引擎真历史态 **3208/3208 全量零差异**。

## 2. 工作台重放护栏(FRAME-02)

`validateTicksForReplay`:空序列/帧缺口/帧序倒退/重复帧/分支串档/revision 倒退 → error 诊断;`buildRunC` 对每分支强制执行,**有诊断即拒绝构造帧态,不拿 head 或最新值填空**。

## 3. 值分层(N-07)

- `ExplicitWrittenValues`(重放写入集):样例 D 合计 3208(黄金钉死,测试防回归)。
- `EffectiveRuntimeValues`(引擎物化默认集):35,408 项,工作台按 UNSET 不回填;两层**分开统计,禁止合并宣称"全世界全等"**。
- presence 四态(显式 null/UNSET/0/Vec3)由归一化规则保证(04 文档 §2,V7-1 测试钉死)。

## 4. 待引擎侧授权项(不在本轮)

查询参数形式在引擎侧显式拒绝(400)或文档标注 head-only——引擎 API 改动,需单独授权;当前由工作台侧拦截兜底。
