from pathlib import Path
import json,logging,subprocess,time
from concurrent.futures import ThreadPoolExecutor
from weasyprint import HTML,CSS
logging.getLogger('weasyprint').setLevel(logging.ERROR)
ROOT=Path(__file__).resolve().parents[1];root=ROOT/'prototypes';tmp=ROOT/'reference'/'render-temp';tmp.mkdir(exist_ok=True)
def render(s):
 start=time.time();print('start',s['pageId'],flush=True)
 doc=HTML(filename=str(root/s['html'])).render(stylesheets=[CSS(string='@page {size:1920px 1200px;margin:0} html,body{width:1920px;height:1200px} body{position:relative}')]);pdf=tmp/(s['pageId']+'.pdf');doc.write_pdf(str(pdf))
 subprocess.run(['pdftocairo','-png','-singlefile','-r','96',str(pdf),str(root/s['pageId'])],check=True,stdout=subprocess.DEVNULL)
 subprocess.run(['pdftocairo','-svg','-f','1','-l','1',str(pdf),str(root/(s['pageId']+'.svg'))],check=True,stdout=subprocess.DEVNULL)
 print('done',s['pageId'],round(time.time()-start,1),flush=True)
 return {'pageId':s['pageId'],'pageCount':len(doc.pages),'renderer':'WeasyPrint 70 + Poppler','imagePixels':[1920,1200]}
with ThreadPoolExecutor(max_workers=3) as pool:report=list(pool.map(render,json.loads((root/'screens.json').read_text())))
(ROOT/'qa/render_checks.json').write_text(json.dumps(report,indent=2))
