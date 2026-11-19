const { chromium } = require('playwright'); const fs=require('fs'),path=require('path'),http=require('http');
const WEB=path.join(__dirname,'..','web'),T=__dirname,NM=path.join(__dirname,'..','node_modules')+'/';
const srv=http.createServer((req,res)=>{let f=path.join(WEB,req.url.split('?')[0]==='/'?'index.html':req.url.split('?')[0]);if(!fs.existsSync(f)){res.writeHead(404);return res.end()}res.writeHead(200,{'Content-Type':f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':'text/html'});res.end(fs.readFileSync(f))});
(async()=>{await new Promise(r=>srv.listen(8785,r));const b=await chromium.launch(),p=await(await b.newContext({viewport:{width:1800,height:1000}})).newPage(),errs=[];
p.on('pageerror',e=>errs.push('PAGE '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push('CON '+m.text())});
await p.route('https://cdn.jsdelivr.net/**',r=>{const u=r.request().url();const S=(f)=>r.fulfill({contentType:'application/javascript',body:fs.readFileSync(f)});if(/supabase/.test(u))return S(__dirname+'/fake.js');if(/xlsx/.test(u))return S(NM+'xlsx/dist/xlsx.full.min.js');r.abort()});
await p.goto('http://localhost:8785/');await p.waitForSelector('#nav [data-go]');
for(const k of ['plan','alcance']){await p.click(`#nav [data-go="${k}"]`);await p.waitForTimeout(2500);
 console.log(k,await p.evaluate(()=>({h:document.querySelector('#main').scrollHeight,txt:document.querySelector('#main').innerText.slice(0,260).replace(/\n/g,' | ')})));
 await p.screenshot({path:`${__dirname}/out/s_${k}.png`});
 if(k==='alcance'){for(const v of ['dia','ecmdia']){await p.click(`[data-av="${v}"]`);await p.waitForTimeout(900);console.log(' vista',v,await p.evaluate(()=>document.querySelector('#pan').innerText.slice(0,160).replace(/\n/g,' | ')));await p.screenshot({path:`${__dirname}/out/s_alc_${v}.png`})}
  await p.click('[data-am="rep"]');await p.waitForTimeout(700);await p.click('[data-pp="-1"]');await p.waitForTimeout(1500)}}
console.log('errores',errs.length,errs.slice(0,4));await b.close();srv.close()})();
