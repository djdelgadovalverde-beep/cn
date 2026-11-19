const { chromium } = require('playwright'); const fs=require('fs'),path=require('path'),http=require('http');
const NM = path.join(__dirname, '..', 'node_modules') + '/';
const WEB=path.join(__dirname,'..','web'),T=__dirname;
const srv=http.createServer((req,res)=>{let f=path.join(WEB,req.url.split('?')[0]==='/'?'index.html':req.url.split('?')[0]);if(!fs.existsSync(f)){res.writeHead(404);return res.end()}res.writeHead(200,{'Content-Type':f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':'text/html'});res.end(fs.readFileSync(f))});
const W=+process.argv[2]||1400;
(async()=>{await new Promise(r=>srv.listen(8779,r));const b=await chromium.launch(),p=await(await b.newContext({viewport:{width:W,height:900}})).newPage();
await p.route('https://cdn.jsdelivr.net/**',r=>{const u=r.request().url();if(/supabase/.test(u))return r.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(__dirname,'fake.js'))});if(/xlsx/.test(u))return r.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(NM,'xlsx/dist/xlsx.full.min.js'))});r.abort()});
await p.goto('http://localhost:8779/');await p.waitForSelector('#nav [data-go]');
const links=await p.$$eval('#nav [data-go]',a=>a.map(x=>x.dataset.go));
const mob=W<800,op=async()=>{if(mob&&!(await p.$('.sb.open')))await p.click('#mb');await p.waitForTimeout(250)};
for(const k of links){await op();await p.click(`#nav [data-go="${k}"]`);await p.waitForTimeout(700);
 const subs=await p.$$eval(`#nav [data-sub^="${k}|"]`,b=>b.map(x=>x.dataset.sub.split('|')[1]));
 for(const t of (subs.length?subs:[null])){if(t){await op();await p.click(`#nav [data-sub="${k}|${t}"]`);await p.waitForTimeout(500)}
  const r=await p.evaluate(()=>{const o=[];const de=document.documentElement;if(de.scrollWidth>innerWidth+1)o.push('PAGE-HSCROLL '+de.scrollWidth);
   const main=document.querySelector('#main');const mr=main.getBoundingClientRect();
   main.querySelectorAll('*').forEach(e=>{const cs=getComputedStyle(e);if(cs.display==='none'||!e.offsetWidth)return;const r=e.getBoundingClientRect();
    if(r.right>innerWidth+2&&!e.closest('.tw,.tws,.twin,.scroll')&&!e.closest('details.ms:not([open]),.hubtabs'))o.push('OUT '+e.tagName+'.'+e.className+' r='+Math.round(r.right));
    if(['BUTTON','LABEL','TH','H2','H3','.lbl'].includes(e.tagName)&&e.scrollWidth>e.clientWidth+2&&cs.overflow!=='visible')o.push('CLIP '+e.tagName+' "'+(e.textContent||'').trim().slice(0,25)+'"');
    if(e.tagName==='BUTTON'&&e.scrollWidth>e.clientWidth+2&&cs.overflowX==='visible')o.push('SPILL '+e.tagName+' "'+(e.textContent||'').trim().slice(0,25)+'"')});
   // tablas anchas sin contenedor
   main.querySelectorAll('table').forEach(t=>{if(!t.closest('.tw')&&t.getBoundingClientRect().width>mr.width+2)o.push('TABLE-NO-WRAP')});
   return{o:[...new Set(o)].slice(0,8),h:main.scrollHeight}});
  if(r.o.length||r.h>2600)console.log(k+(t?'›'+t:''),'h='+r.h,r.o.join(' | '))}}
await b.close();srv.close()})();
