const { chromium } = require('playwright'); const fs=require('fs'),path=require('path'),http=require('http');
const NM = path.join(__dirname, '..', 'node_modules') + '/';
const WEB=path.join(__dirname,'..','web'),T=__dirname;
const srv=http.createServer((req,res)=>{let f=path.join(WEB,req.url.split('?')[0]==='/'?'index.html':req.url.split('?')[0]);if(!fs.existsSync(f)){res.writeHead(404);return res.end()}res.writeHead(200,{'Content-Type':f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':'text/html'});res.end(fs.readFileSync(f))});
(async()=>{await new Promise(r=>srv.listen(8778,r));const b=await chromium.launch(),p=await(await b.newContext({viewport:{width:1800,height:1000}})).newPage(),errs=[];
p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await p.route('https://cdn.jsdelivr.net/**',r=>{const u=r.request().url();if(/supabase/.test(u))return r.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(__dirname,'fake.js'))});if(/xlsx/.test(u))return r.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(NM,'xlsx/dist/xlsx.full.min.js'))});r.abort()});
await p.goto('http://localhost:8778/');await p.waitForSelector('#nav [data-go]');
const medir=()=>p.evaluate(()=>{const m=document.querySelector('#main');const fechas=m.querySelectorAll('input[type=date]').length;const lbl={};m.querySelectorAll('label,.msw .lbl').forEach(l=>{const t=(l.querySelector('.lbl')?l.querySelector('.lbl').textContent:l.childNodes[0]&&l.childNodes[0].textContent||'').trim();if(t&&t.length<30&&(l.querySelector('select,input,details')||l.classList.contains('msw')))lbl[t]=(lbl[t]||0)+1});const rep=Object.entries(lbl).filter(([k,v])=>v>1).map(([k,v])=>k+'×'+v);const bars=m.querySelectorAll('.fbar').length;return{fechas,rep,bars}});
const links=await p.$$eval('#nav [data-go]',a=>a.map(x=>x.dataset.go));let malos=0;
for(const k of links){await p.click(`#nav [data-go="${k}"]`);await p.waitForTimeout(900);const subs=await p.$$eval(`#nav [data-sub^="${k}|"]`,b=>b.map(x=>x.dataset.sub.split('|')[1]));const lista=subs.length?subs:[null];
 for(const t of lista){if(t){await p.click(`#nav [data-sub="${k}|${t}"]`);await p.waitForTimeout(700)}const r=await medir();const mal=r.fechas>2||r.rep.length;if(mal){malos++;console.log('!! DUPLICADO',k+(t?'›'+t:''),'| fechas:',r.fechas,'| etiquetas repetidas:',r.rep.join(', '),'| barras:',r.bars)}}}
console.log('Pantallas/pestañas con filtros duplicados:',malos,'| errores:',errs.length);await b.close();srv.close()})();
