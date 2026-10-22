# V7-1 真实只读导入契约(定稿)

日期:2026-10-22 ｜ 实现:`src/services/nativeImport/` ｜ 上游:mas-rust@65c7f96

## 1. 数据源模式(互斥)

- `MOCK_SANDBOX`(默认):v0.5 种子 + mock 执行器,全部既有能力不变。
- `REAL_IMPORT_READ_ONLY`:mas-rust 离线工件只读导入。
- 存储:`sessionStorage["ecs-workbench.dataSource.v1"]`;切换经 StatusBar 徽标 → 整页 reload(防 store/草稿/历史串味)。
- 模式不变量:原生模式下 **settle 一律 `REAL_READ_ONLY` 拒绝**(executionAdapter)、**applyEdit/saveDocument 一律封锁**(draftRegistry)、**不注册 expected_runs 参考样例、不合并本地目录运行、不恢复 IndexedDB 历史**(data/store)。

## 2. NativeModelPackage(样例 A,目录式)

```
src/testdata/native/chem-roaded/
  scene.json                 # fixture 薄指针(仅参照)
  instances/*.json           # fixture 实例目录(与 PG 对账用)
  scene-pg.json              # PG s_scene 行导出 = 场景权威(93 实例)
  shared/entities/*.json     # archetype(19) → EntityTypeDef + 组件成员
  shared/components/*.json   # 组件定义(44) → ComponentSchema + AttributeSchema
  shared/systems.json        # workflow 系统定义(V7-4 素材,本期不消费)
```

归一化规则(实现 `normalize.ts`,测试对拍):
- 属性类型 `n|b|s|u`→scalar、`n[3]`→vector3;其余(元组数组/`()`)→ `complexAttributes` 清单,不进值域。
- 单位:`NATIVE_UNIT_MAP` 人工登记表(°C/L·s⁻¹/m·帧⁻¹ 等);查无 → `unknown`(unit/quantity 均登记 unknown,不猜)。
- presence:实例属性=显式覆盖(含显式 null);缺键=UNSET 不回填;组件存在性=archetype 成员;对象/网格值 → `blockAttributes` 清单。
- 实体稳定 ID=引擎 InstanceId 原样;templateRef=null(引擎无模板层);template 层留空。

## 3. NativeRunBundle(样例 B/C 两种来源)

| | 样例 B(磁盘) | 样例 C(PG ticks+bundle) |
|---|---|---|
| 输入 | frame_data.json(全量)/attribute_deltas.json/meta.json | ticks.json(delta 含 source_system_id)/bundle.json/run.json/scene_info.json |
| 世界 | 帧值直接来自 frame_data(逐值过滤) | bundle 初值 + tick 重放(pre+post 按序) |
| traceCompleteness | `PROPERTY_DELTA`(无 source,不造) | `SYSTEM_EFFECT`(source_system_id 保留原值,含归因粘连原样) |
| 帧结构 | 一帧=一提交 `nat-<run6>-<branch>-f%06d`,parent=前一帧/fork 基点 | 同左 |
| 分支 | main | main + fork 分支(fork 精确 tick 缺口:保守 main@0,提交摘要注明) |

不伪造清单:无 EffectRequest/获准对、无 inputVersionRefs、无请求→裁决;P22/P23/P24 在原生模式显示空态由全局条解释。

## 4. Capability Manifest(静态,`catalog.ts`)

`schemaRead=converted, entityRead=native, entityWrite/systemCatalogWrite→unsupported(写全封), runStart=readonly, traceNode=unsupported, traceSystemEffect=partial, historyRead=native, branchCreate=unsupported, editDrafts=blocked`;`traceCompleteness` 按运行登记。UI 以此为准,不按适配器硬编码。

## 5. 身份与版本

- 实体:`InstanceId` 原样;工作台 `id@version` 的 version 固定 `native-1`(组件)/`native-import-1@65c7f96`(草稿基线,baseVersion 用于拒收跨模式 localStorage 存档)。
- 提交:`CommitDef.source="native-import"`(类型联合新增);场景基点 `nat-scene-chem-roaded-base`。
- 分支:命名空间 `<run6>/<branchId>`(避免跨运行 main 冲突)。

## 6. 变更面(实现落点)

新增:`src/services/nativeImport/{types,catalog,fixtures,normalize,seedAdapter}.ts`、`src/stores/dataSource.ts`、`src/components/domain/NativeModeStrip.tsx`、`src/testdata/native/**`。
修改(最小):`data/store.ts`(模式分流)、`stores/modelDocuments.ts`(基线覆盖+版本区隔+用户程序跳过)、`stores/draftRegistry.ts`(applyEdit/saveDocument 封锁)、`stores/session.ts`(只读适配器默认)、`services/executionAdapter.ts`(readOnlyImportAdapter)、`core/types.ts`(source 联合)、`shell/{StatusBar,WorkspaceShell}.tsx`(徽标/全局条)、`pages/p11`(原生目录表)、`pages/{p20,p26,p27}`(native-import 标签)。

## 7. 回滚

默认模式仍为 MOCK_SANDBOX;回滚=删除 `src/services/nativeImport/`、`src/testdata/native/`、`src/stores/dataSource.ts`、`src/components/domain/NativeModeStrip.tsx`,revert §6 修改清单;无 schema/IndexedDB 迁移(原生模式不触 IDB,新 store 前缀独立)。
