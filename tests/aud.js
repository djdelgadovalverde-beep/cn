const { chromium } = require('playwright'); const fs=require('fs'),path=require('path'),http=require('http');
const WEB=path.join(__dirname,'..','web'),T=__dirname,NM=path.join(__dirname,'..','node_modules')+'/';
const srv=http.createServer((req,res)=>{let f=path.join(WEB,req.url.split('?')[0]==='/'?'index.html':req.url.split('?')[0]);if(!fs.existsSync(f)){res.writeHead(404);return res.end()}res.writeHead(200,{'Content-Type':f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':'text/html'});res.end(fs.readFileSync(f))});
const W=+process.argv[2]||1280;
(async()=>{await new Promise(r=>srv.listen(8786,r));const b=await chromium.launch(),p=await(await b.newContext({viewport:{width:W,height:900},colorScheme:process.env.DARK?'dark':'light'})).newPage(),errs=[];
p.on('pageerror',e=>errs.push(e.message));
await p.route('https://cdn.jsdelivr.net/**',r=>{const u=r.request().url();const S=(f)=>r.fulfill({contentType:'application/javascript',body:fs.readFileSync(f)});if(/supabase/.test(u))return S(__dirname+'/fake.js');if(/xlsx/.test(u))return S(NM+'xlsx/dist/xlsx.full.min.js');r.abort()});
await p.goto('http://localhost:8786/');await p.waitForSelector('#nav [data-go]');
const mob=W<800,op=async()=>{if(mob&&!(await p.$('.sb.open')))await p.click('#mb');await p.waitForTimeout(200)};
const chk=()=>p.evaluate(()=>{
 const lum=(c)=>{const m=c.match(/[\d.]+/g).map(Number);const a=m[3]==null?1:m[3];const f=(v)=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return {l:.2126*f(m[0])+.7152*f(m[1])+.0722*f(m[2]),a}};
 const bg=(e)=>{while(e){const c=getComputedStyle(e).backgroundColor;const x=lum(c);if(x.a>.5)return c;e=e.parentElement}return 'rgb(255,255,255)'};
 const out={sinNombre:[],btnVacio:[],contraste:[],chico:[],idsDup:[],img:[]};const main=document.querySelector('#main');
 main.querySelectorAll('input,select,textarea').forEach(e=>{if(e.type==='hidden'||e.offsetParent===null)return;const has=e.getAttribute('aria-label')||e.getAttribute('aria-labelledby')||e.title||(e.id&&document.querySelector('label[for="'+e.id+'"]'))||e.closest('label')||e.closest('.msw');if(!has)out.sinNombre.push((e.tagName+'.'+e.className+'#'+e.id+'['+(e.dataset&&Object.keys(e.dataset)[0]||'')+']').slice(0,60))});
 main.querySelectorAll('button,a').forEach(e=>{if(e.offsetParent===null)return;if(!(e.textContent.trim()||e.getAttribute('aria-label')||e.title))out.btnVacio.push((e.className||e.tagName).slice(0,40))});
 main.querySelectorAll('img').forEach(e=>{if(!e.hasAttribute('alt'))out.img.push(e.src.slice(0,30))});
 const seen=new Set();main.querySelectorAll('p,span,td,th,label,button,a,small,h1,h2,h3,li,b,i,div').forEach(e=>{if(e.offsetParent===null||!e.childNodes.length)return;const t=[...e.childNodes].filter(n=>n.nodeType===3&&n.textContent.trim()).map(n=>n.textContent).join('');if(!t.trim())return;const cs=getComputedStyle(e);const fg=lum(cs.color),bgc=lum(bg(e));if(fg.a<.99&&fg.a<.5)return;const L1=Math.max(fg.l,bgc.l),L2=Math.min(fg.l,bgc.l),r=(L1+.05)/(L2+.05),fs=parseFloat(cs.fontSize),bold=+cs.fontWeight>=700,need=(fs>=24||(fs>=18.66&&bold))?3:4.5;if(r<need){const k=(e.className||e.tagName)+'|'+cs.color+'|'+bg(e);if(!seen.has(k)){seen.add(k);out.contraste.push(`${(e.className||e.tagName).toString().slice(0,24)} ${cs.color} sobre ${bg(e)} = ${r.toFixed(2)} "${t.trim().slice(0,22)}"`)}}});
 main.querySelectorAll('button,select,input:not([type=checkbox]):not([type=radio])').forEach(e=>{if(e.offsetParent===null)return;const r=e.getBoundingClientRect();if(r.height<28||(r.width<28&&e.tagName==='BUTTON'))out.chico.push((e.className||e.tagName)+' '+Math.round(r.width)+'x'+Math.round(r.height))});
 const ids={};document.querySelectorAll('[id]').forEach(e=>{ids[e.id]=(ids[e.id]||0)+1});Object.entries(ids).forEach(([k,v])=>{if(v>1)out.idsDup.push(k)});
 return out});
const agg={sinNombre:new Set(),btnVacio:new Set(),contraste:new Set(),chico:new Set(),idsDup:new Set(),img:new Set()};
const links=await p.$$eval('#nav [data-go]',a=>a.map(x=>x.dataset.go));
for(const k of links){await op();await p.click(`#nav [data-go="${k}"]`);await p.waitForTimeout(800);
 const subs=await p.$$eval(`#nav [data-sub^="${k}|"]`,b=>b.map(x=>x.dataset.sub.split('|')[1]));
 for(const t of (subs.length?subs:[null])){if(t){await op();await p.click(`#nav [data-sub="${k}|${t}"]`);await p.waitForTimeout(500)}
  const r=await chk();Object.keys(agg).forEach(x=>r[x].forEach(v=>agg[x].add((k+(t?'›'+t:''))+' :: '+v)))}}
const sh=await p.evaluate(()=>({h1:document.querySelectorAll('h1').length,main:!!document.querySelector('main'),nav:!!document.querySelector('nav'),lang:document.documentElement.lang,title:document.title,skip:!!document.querySelector('a[href="#main"]'),focus:getComputedStyle(document.querySelector('button')).outlineStyle}));
console.log('ANCHO',W,JSON.stringify(sh));
for(const [k,v] of Object.entries(agg)){const L=[...v];console.log('\n##',k,L.length);L.slice(0,14).forEach(x=>console.log('  ',x))}
console.log('errores',errs.length);await b.close();srv.close()})();
