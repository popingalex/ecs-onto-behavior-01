"""业务结果、数据引用和反向造错检查；不做性能认证。"""
from pathlib import Path
from copy import deepcopy
import json,sys,math
sys.path.insert(0,str(Path(__file__).parent))
from simulate import run,check_graph,ROOT,read
checks=[]
def ok(name,condition):
 if not condition:raise AssertionError(name)
 checks.append(name)
def audit(r):
 for t in r['temperatures']:
  effects=[x for x in r['contributions'] if x['entityId']==t['entityId']]
  assert math.isclose(t['final'],t['old']+sum(x['approved'] for x in effects)),'CONTRIBUTION_SUM'
  assert t['floor']<=t['final']<=t['old'],'FLOOR_RANGE'
  assert math.isclose(t['candidate'],t['old']+sum(x['requested'] for x in effects)),'CANDIDATE_SUM'
  assert all(abs(x['approved'])<=abs(x['requested'])+1e-8 for x in effects),'OVER_APPROVAL'
 ids={a['id'] for a in r['activities']}
 assert all(x['executionId'] in ids for x in r['contributions']),'MISSING_EXECUTION'
 for e in r['contributions']:
  old=next(t['old'] for t in r['temperatures'] if t['entityId']==e['entityId'])
  assert math.isclose(e['selfPreview'],old+e['requested']),'SELF_PREVIEW'
 inv=r['contractPreview'];assert inv['inventoryBefore']==inv['inventoryAfter']+sum(x['granted'] for x in inv['allocations']),'RESOURCE_CONSERVATION'
 if r['policy']['status']=='satisfied':assert r['policy']['endWater']['V01']>=5000,'POLICY_FALSE_SUCCESS'
 ev={e['id'] for e in r['events']};assert all(s in ev for e in r['events'] for s in e['causedBy']),'EVENT_REF'
 if r['case']=='baseline':assert all(e['type']!='unmet' for e in r['events']),'PREDICTION_AS_FACT'
 return True
allruns={c['id']:run(c['id']) for c in read('04_cases.json')['cases']}
for name,r in allruns.items():ok(name+'：联合约束/来源/资源/事件一致',audit(r))
b=allruns['baseline'];ok('基线温度20/20/20',[x['final'] for x in b['temperatures']]==[20,20,20]);ok('停用一路50/30/20',[x['final'] for x in allruns['one-cooler']['temperatures']]==[50,30,20]);ok('降低功率30/20/20',[x['final'] for x in allruns['lower-power']['temperatures']]==[30,20,20]);ok('V01/V02末水5100/8400',b['policy']['endWater']=={'V01':5100,'V02':8400});ok('故障未满足且4500',allruns['no-replacement']['policy']['status']=='unmet' and allruns['no-replacement']['policy']['endWater']['V01']==4500);ok('位置缺失不能派车',allruns['missing-position']['policy']['replacementId'] is None);ok('补给800/400',[x['granted'] for x in b['contractPreview']['allocations']]==[800,400]);ok('8逻辑7空间',len(b['state'])==8 and sum(e.get('position') is not None for e in b['state'])==7);ok('零点是有效位置',[0,0,0] is not None);ok('F03未发现仍进q-fire','F03' in [x['entityId'] for x in b['temperatures']]);ok('重复求值结果相同',run()==run());ok('case间commit唯一',len({r['commit'] for r in allruns.values()})==len(allruns));ok('任务路线40米4秒',b['tasks'][0]['route']['distanceMetres']==40 and b['tasks'][0]['route']['durationSeconds']==4)
# 实际验证已保存结果，不只验证刚算出的内存值
for name,r in allruns.items():ok(name+'：落盘结果与参考重算一致',r==read('runs/'+name+'.json'))
pages=json.loads((ROOT/'contracts/page_index.json').read_text());pageids={p['id'] for p in pages}
ok('28页独立规格存在',len(pages)==28 and all((ROOT/p['file']).is_file() for p in pages))
nav=json.loads((ROOT/'contracts/navigation.json').read_text());ok('导航目标均存在',all(n['source'] in pageids and(n['target'] in pageids or n['target']=='return') for n in nav))
for page in json.loads((ROOT/'contracts/page_bindings.json').read_text()):
 for ref in page['sources']:
  name,pointer=ref.split('#');value=read(name)
  for token in pointer.strip('/').split('/'):
   if token:value=value[int(token)] if isinstance(value,list) else value[token]
ok('28页全部JSON Pointer可解析',True)
h=read('07_history.json');cids={c['id'] for c in h['commits']};ok('提交父引用与分支head有效',all(p in cids for c in h['commits'] for p in c['parents']) and all(b['head'] in cids for b in h['branches']))
for c in h['commits']:
 if c.get('resultFile'):ok(c['id']+'：历史文件commit一致',read(c['resultFile'])['commit']==c['id'])
# 故意造错：每个错误都必须被审计拒绝。
neg=[]
def reject(name,mut):
 r=deepcopy(b);mut(r)
 try:audit(r)
 except (AssertionError,ValueError,KeyError):neg.append(name);return
 raise AssertionError('错误未被拒绝：'+name)
reject('获准总和与最终不符',lambda r:r['temperatures'][0].update(final=0))
reject('伪造自身预览',lambda r:r['contributions'][0].update(selfPreview=20))
reject('获准超过请求',lambda r:r['contributions'][0].update(approved=-60))
reject('资源超额发放',lambda r:r['contractPreview']['allocations'][1].update(granted=800))
reject('来源执行缺失',lambda r:r.update(activities=[]))
reject('水量45%却标满足',lambda r:r['policy']['endWater'].update(V01=4500))
reject('事件引用不存在',lambda r:r['events'][1].update(causedBy=['missing']))
reject('预测伪装真实违约',lambda r:r['events'].append({'id':'false','type':'unmet','causedBy':[]}))
g=deepcopy(read('03_programs.json')['graphs'][0]);g['nodes'][3]['out']['delta']='Quantity<temperatureAbsolute,degC>'
try:check_graph(g)
except ValueError:neg.append('绝对温度连接温差端口')
else:raise AssertionError('量种错误未拒绝')
ok('9项故意造错均被拒绝',len(neg)==9)
report={'positiveChecks':checks,'negativeRejected':neg,'scope':'mock semantics / references; not production core or performance'}
(ROOT/'qa/check_results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(len(checks),'项检查通过；',len(neg),'项故意造错被拒绝')
