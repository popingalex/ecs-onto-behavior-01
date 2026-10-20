"""可重复的 UI mock 参考器。Python 3 标准库；非正式推演内核。"""
from pathlib import Path
from copy import deepcopy
import json, argparse
ROOT=Path(__file__).resolve().parents[1]
def read(n): return json.loads((ROOT/'mock'/n).read_text())
def check_graph(graph):
 nodes={n['id']:n for n in graph['nodes']}
 if len(nodes)!=len(graph['nodes']):raise ValueError('DUPLICATE_NODE_ID')
 for edge in graph['edges']:
  a=nodes[edge['source']]['out'][edge['port']];b=nodes[edge['target']]['in'][edge['targetPort']]
  if a!=b:raise ValueError('UNIT_KIND_MISMATCH:'+a+' -> '+b)

def graph_eval(graph,old,params):
 check_graph(graph)
 values={}; trace=[]
 constants={(x['target'],x['targetPort']):x for x in graph['constantBindings']}
 for node in graph['nodes']:
  ins={}
  for edge in graph['edges']:
   if edge['target']==node['id']: ins[edge['targetPort']]=values[(edge['source'],edge['port'])]
  for (target,port),b in constants.items():
   if target==node['id']: ins[port]=params[b['parameter']] if 'parameter' in b else params.get('sourceC',b.get('value'))
  k=node['kind']
  if k=='ReadPrevious': out={'value':old}
  elif k=='CoolingRoom': out={'room':max(0,ins['old']-ins['source'])}
  elif k=='Min': out={'value':min(ins['a'],ins['b'])}
  elif k=='Negate': out={'delta':-ins['value']}
  elif k=='Contribute': out={'request':ins['delta']}
  else: raise ValueError('UNSUPPORTED_NODE:'+k)
  for p,v in out.items(): values[(node['id'],p)]=v
  trace.append({'nodeId':node['id'],'inputs':ins,'outputs':out})
 return values[('n-emit','request')],trace

def run(case='baseline'):
 model=read('01_model.json'); world=read('02_world.json'); programs=read('03_programs.json')
 commit='c043' if case=='baseline' else 'c043-'+case
 patch=next(x['patch'] for x in read('04_cases.json')['cases'] if x['id']==case)
 entities={e['id']:e for e in world['entities']}; systems=programs['systems']; base=deepcopy(world)
 if patch.get('disableSystem'):
  next(x for x in systems if x['id']==patch['disableSystem'])['enabled']=False
 if patch.get('systemParameter'):
  p=patch['systemParameter']; next(x for x in systems if x['id']==p['id'])['params']['maxDropK']=p['maxDropK']
 if patch.get('unavailableVehicle'): entities[patch['unavailableVehicle']]['healthy']=False
 if patch.get('clearPosition'): entities[patch['clearPosition']]['position']=None
 contributions=[]; temperatures=[]; traces=[]; activities=[]; dependencies=[]
 for f in sorted([e for e in entities.values() if e['classId']=='Fire' and e['active']],key=lambda e:e['id']):
  req=[]
  for s in systems:
   if not s['enabled']: continue
   delta,trace=graph_eval(programs['graphs'][0],f['temperature'],s['params'])
   effectId='eff-'+f['id']+'-'+s['id']; execution='exec-'+f['id']+'-'+s['id']
   req.append({'id':effectId,'entityId':f['id'],'propertyId':'thermal.temperature','systemId':s['id'],'requested':delta,'selfPreview':f['temperature']+delta,'executionId':execution})
   traces.append({'executionId':execution,'entityId':f['id'],'systemId':s['id'],'nodes':trace})
   activities.append({'id':execution,'kind':'system','systemId':s['id'],'graphVersion':'g4','inputCommit':'c042'})
   dependencies.append({'source':f['id']+'.thermal.temperature@c042','target':execution,'kind':'used'})
  total=-sum(x['requested'] for x in req); budget=max(0,f['temperature']-f['floor']); scale=min(1,budget/total) if total else 1
  for x in req:
   x['approved']=x['requested']*scale; x['scale']=scale; x['constraintId']='cooling-floor'; contributions.append(x)
   dependencies.append({'source':x['executionId'],'target':'reduce-'+f['id'],'kind':'proposed'})
  final=f['temperature']+sum(x['approved'] for x in req)
  temperatures.append({'entityId':f['id'],'old':f['temperature'],'requestedDelta':sum(x['requested'] for x in req),'candidate':f['temperature']+sum(x['requested'] for x in req),'approvedDelta':sum(x['approved'] for x in req),'final':final,'floor':f['floor'],'unit':'degC','deltaUnit':'deltaK','versionId':f['id']+'.thermal.temperature@'+commit})
  activities.append({'id':'reduce-'+f['id'],'kind':'allocation','constraintVersion':'c1'})
  dependencies.append({'source':'reduce-'+f['id'],'target':f['id']+'.thermal.temperature@'+commit,'kind':'generated'})
  f['temperature']=final
 # 领域事件子步：预先预测阈值与到达，不重复推进 system。
 current=entities['V01']; threshold=current['capacity']*world['policy']['waterMin']; rate=current['rateLps']; dt=model['clock']['stepSeconds']
 cross=(current['water']-threshold)/rate
 excluded=[]; candidates=[]
 for e in entities.values():
  if e['classId']!='FoamTruck' or e['id']=='V01':continue
  reasons=[]
  if not e['healthy']:reasons.append('车辆故障')
  if e['position'] is None:reasons.append('缺少位置')
  if e['water']/e['capacity']<world['policy']['waterMin']:reasons.append('水量低于50%')
  if e['status']!='idle':reasons.append('非待命')
  if reasons:excluded.append({'entityId':e['id'],'reasons':reasons})
  else:candidates.append(e)
 candidates.sort(key=lambda e:(e['travelSeconds'],e['id']))
 replacement=candidates[0] if candidates else None
 events=[{'id':'evt-predict','time':420,'type':'prediction','label':'一车在425秒触及50%','causedBy':[],'relation':'derivedFrom'}]
 if replacement:
  arrival=replacement['travelSeconds']; held=min(dt,arrival)
  current['water']-=rate*held
  replacement['water']-=replacement['rateLps']*max(0,dt-arrival)
  replacement['status']='suppressing' if arrival<=dt else 'moving'; replacement['target']='F01'
  if arrival<=dt:
   current['status']='standby'; current['target']=None; replacement['position']=[280,180,0]
  events += [ {'id':'evt-dispatch','time':420,'type':'taskAccepted','label':'派遣二车接替','causedBy':['evt-predict'],'relation':'triggeredBy'}, {'id':'evt-arrive','time':420+arrival,'type':'arrival','label':'二车到达处置点','causedBy':['evt-dispatch'],'relation':'taskLifecycle'}, {'id':'evt-handoff','time':420+arrival,'type':'handoff','label':'一车停止耗水，二车接替','causedBy':['evt-arrive'],'relation':'triggeredBy'} ]
  status='satisfied' if held<=cross else 'unmet'; violationStart=None if held<=cross else 420+cross
 else:
  current['water']-=rate*dt; status='unmet'; violationStart=420+cross
  events.append({'id':'evt-unmet','time':425,'type':'unmet','label':'无合格接替，保障目标未满足','causedBy':['evt-predict'],'relation':'evaluatedFrom'})
 policy={'id':'policy-cover','targetId':'F01','currentVehicle':'V01','crossingSeconds':cross,'thresholdTime':425,'replacementId':replacement['id'] if replacement else None,'candidateIds':[x['id'] for x in candidates],'excluded':excluded,'status':status,'violationStart':violationStart,'endWater':{'V01':current['water'],'V02':entities['V02']['water']},'sampling':'事件子步：420/424/425/430；425秒恰好50%仍合格，之后不足'}
 # 补给争用为独立试算，不叠加到本回合车辆水量。
 contract=programs['contracts'][0]; remaining=entities['S01']['inventory']; allocations=[]
 for p in sorted(contract['proposals'],key=lambda p:(-p['priority'],p['id'])):
  granted=min(remaining,p['litres']);remaining-=granted;allocations.append({**p,'granted':granted,'status':'accepted' if granted==p['litres'] else 'partial'})
 waterChanges=[]
 for vid in ['V01','V02']:
  old=next(e for e in base['entities'] if e['id']==vid)['water'];new=entities[vid]['water'];ex='exec-water-'+vid
  waterChanges.append({'entityId':vid,'propertyId':'water.remaining','old':old,'final':new,'delta':new-old,'unit':'L','executionId':ex,'versionId':vid+'.water.remaining@'+commit})
  activities.append({'id':ex,'kind':'domainConsumption','systemId':'water-use','inputCommit':'c042','taskRef':'task-replace-V02' if vid=='V02' and replacement else None})
  dependencies.extend([{'source':vid+'.water.remaining@c042','target':ex,'kind':'used'},{'source':ex,'target':vid+'.water.remaining@'+commit,'kind':'generated'}])
 return {'case':case,'inputPatch':patch,'inputCommit':'c042','commit':commit,'branch':'main' if case=='baseline' else 'branch-'+case,'parent':'c042','simTime':430,'state':list(entities.values()),'temperatures':temperatures,'waterChanges':waterChanges,'contributions':contributions,'traces':traces,'activities':activities,'dependencies':dependencies,'events':events,'tasks':([{'id':'task-replace-V02','executor':'V02','target':'F01','status':'suppressing','route':{'frame':'park-ENU','points':[[240,180,0],[280,180,0]],'durationSeconds':4,'distanceMetres':40},'startedAt':420,'arrivedAt':424}] if replacement else []),'checkpoint':{'policyInstances':[policy],'eventQueue':[],'rng':world['rng'],'runtimeVersion':'mock-ref-04'},'policy':policy,'contractPreview':{'isolated':True,'inventoryBefore':1200,'allocations':allocations,'inventoryAfter':remaining},'readViews':{'previous':'c042','self':'execution scoped provisional','final':commit},'warnings':['温度达到20°C不会自动产生火焰熄灭事件；两者为独立mock状态。']}

def main():
 p=argparse.ArgumentParser();p.add_argument('--case',default='baseline');p.add_argument('--all',action='store_true');a=p.parse_args()
 cases=[x['id'] for x in read('04_cases.json')['cases']] if a.all else [a.case]
 out=ROOT/'mock'/'runs';out.mkdir(exist_ok=True)
 for c in cases:
  r=run(c); (out/(c+'.json')).write_text(json.dumps(r,ensure_ascii=False,indent=2));print(c,[(x['entityId'],x['final']) for x in r['temperatures']],r['policy']['status'])
if __name__=='__main__':main()
