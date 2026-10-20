// v0.5 原型契约草案；实现时用Zod等解析输入，不能只用类型断言。
export type PageId = `P${number}`;
export type ObjectRef = { id: string; version: string };
export type RawValue = number | boolean | string | null | [number, number, number];
export type TypeRef = { primitive: string; shape: 'scalar'|'vector3'|'matrixRef'; quantityKind?: string; unitId?: string; frameId?:string; nullable: boolean };
export type Binding =
  | {root:'self';propertyId:string;view:'previous'|'selfPreview'}
  | {root:'parameter';parameterId:string}
  | {root:'upstream';nodeId:string;portId:string}
  | {root:'relation';relationId:string;propertyId:string;view:'previous'};
export interface AttributeSchema {id:string;componentId:string;label:string;type:TypeRef;default:RawValue;writeMode:'configuration'|'exclusive'|'contribution'|'contract';reducerRef?:ObjectRef}
export interface ComponentSchema {id:string;version:string;propertyIds:string[]}
export interface SceneEntity {id:string;typeId:string;templateRef:ObjectRef|null;componentInstances:{schemaRef:ObjectRef}[];initialOverrides:Record<string,RawValue>}
export type TargetBinding = {root:'self';propertyId:string;view?:never};
export interface LogicNode {id:string;type:string;inputs:Record<string,TypeRef>;outputs:Record<string,TypeRef>;bindings:Record<string,Binding|TargetBinding>;params:Record<string,RawValue>}
export interface LogicGraphDocument {id:string;version:string;kind:'entity-program';scopeType:string;nodes:LogicNode[];edges:{id:string;kind:'data'|'control';source:{nodeId:string;portId:string};target:{nodeId:string;portId:string}}[]}
export interface SystemDefinition {id:string;queryRef:ObjectRef;programRef:ObjectRef;parameters:Record<string,RawValue>;enabled:boolean}
export interface ScheduleDocument {id:string;version:string;nodes:({id:string;type:'SystemNode';systemRef:string}|{id:string;type:'ReducerNode'|'ContractNode';constraintRef:ObjectRef}|{id:string;type:'CommitNode'})[];edges:{id:string;source:string;target:string;kind:'order'|'effect'|'product'}[];readView:'previous'}
export interface EditorLayout {documentId:string;positions:Record<string,{x:number;y:number}>;viewport:{x:number;y:number;zoom:number}}
export interface RunRecord {id:string;runId:string;branchId:string;baseCommit:string;resultCommit:string;modelVersion:string;scheduleRef:ObjectRef;programRefs:ObjectRef[];logicalParallelGroups:string[][];elapsedMs:number|null}
export interface NodeExecution {id:string;recordId:string;executionId:string;systemId:string;entityId:string;nodeId:string;seq:number;status:'completed'|'skipped'|'cached'|'error';inputs:Record<string,unknown>;outputs:Record<string,unknown>;inputVersionRefs:string[];elapsedMs:number|null}
export interface EffectRequest {id:string;recordId:string;executionId:string;nodeId:string;systemId:string;entityId:string;propertyId:string;requestedDelta:number;unitId:string;selfPreview:number}
export interface ConstraintDecision {id:string;recordId:string;entityId:string;propertyId:string;old:number;candidate:number;budget:number;scale:number;allocations:{effectId:string;approvedDelta:number;status:'approved'|'partial'|'rejected'}[];final:number}
export interface WorldSnapshot {commitId:string;simTime:number;values:Record<string,Record<string,RawValue>>}
export interface SystemExecution {id:string;recordId:string;systemId:string;entityId:string;programRef:ObjectRef;inputCommit:string;nodeExecutionIds:string[];localPreview:number;elapsedMs:number|null}
export interface PropertyChange {entityId:string;propertyId:string;old:RawValue;new:RawValue;unitId?:string;versionId:string;decisionId:string}
export interface DependencyEdge {source:string;target:string;kind:'used'|'proposed'|'generated'}
export interface Diagnostic {id:string;severity:'error'|'warning';code:string;message:string;target?:{documentId:string;nodeId?:string;portId?:string;propertyId?:string}}
export interface RoundResult {nextWorld:WorldSnapshot;record:RunRecord;systemExecutions:SystemExecution[];nodeExecutions:NodeExecution[];effectRequests:EffectRequest[];constraintDecisions:ConstraintDecision[];propertyChanges:PropertyChange[];dependencyEdges:DependencyEdge[];diagnostics:Diagnostic[]}
export type SettleOutcome = {ok:true;result:RoundResult}|{ok:false;diagnostics:Diagnostic[]};
export interface ExecutionAdapter {settle(input:{baseWorld:WorldSnapshot;modelBundle:{id:string;version:string;attributes:AttributeSchema[];components:ComponentSchema[];constraints:ReadonlyArray<Record<string,unknown>>};schedule:ScheduleDocument;systems:SystemDefinition[];programs:LogicGraphDocument[];idempotencyKey:string}):Promise<SettleOutcome>}
// JSON样本为便于人工阅读使用id@version简写；loader必须规范化为ObjectRef，不可直接as断言。
// immutable结果与运行期间的progress events分开；进度可以取消或丢弃，失败不得伪造resultCommit。
