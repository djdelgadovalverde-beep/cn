const { chromium } = require('playwright'); const fs=require('fs'),path=require('path'),http=require('http');
const WEB=path.join(__dirname,'..','web'),T=__dirname,NM=path.join(__dirname,'..','node_modules')+'/';
const srv=http.createServer((req,res)=>{let f=path.join(WEB,req.url.split('?')[0]==='/'?'index.html':req.url.split('?')[0]);if(!fs.existsSync(f)){res.writeHead(404);return res.end()}res.writeHead(200,{'Content-Type':f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':'text/html'});res.end(fs.readFileSync(f))});
(async()=>{await new Promise(r=>srv.listen(8783,r));const b=await chromium.launch(),ctx=await b.newContext({viewport:{width:1400,height:1000},acceptDownloads:true}),p=await ctx.newPage(),errs=[];
p.on('pageerror',e=>errs.push('PAGE '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push('CON '+m.text())});
await p.route('https://cdn.jsdelivr.net/**',r=>{const u=r.request().url();const S=(f)=>r.fulfill({contentType:'application/javascript',body:fs.readFileSync(f)});
 if(/supabase/.test(u))return S(__dirname+'/fake.js');if(/xlsx/.test(u))return S(NM+'xlsx/dist/xlsx.full.min.js');if(/exceljs/.test(u))return S(NM+'exceljs/dist/exceljs.min.js');if(/html2canvas/.test(u))return S(NM+'html2canvas/dist/html2canvas.min.js');if(/jspdf/.test(u))return S(NM+'jspdf/dist/jspdf.umd.min.js');if(/pptxgenjs/.test(u))return S(NM+'pptxgenjs/dist/pptxgen.bundle.js');r.abort()});
await p.goto('http://localhost:8783/');await p.waitForSelector('#nav [data-go]');
const out={};
for(const tp of ['visitas','tareas']){await p.click(`#nav [data-go="${tp}"]`);await p.waitForTimeout(900);
 for(const t of ['inf','jus','par','cal']){await p.click(`#nav [data-sub="${tp}|${t}"]`);await p.waitForTimeout(1100);
  out[tp+'›'+t]=await p.evaluate(()=>({h:document.querySelector('#main').scrollHeight,cards:document.querySelectorAll('#main .card').length,dlb:document.querySelectorAll('#main .dlb').length,kpis:document.querySelectorAll('#main .k').length,txt:(document.querySelector('#pan')||{}).innerText?.slice(0,60).replace(/\n/g,' ')}));}}
console.log(JSON.stringify(out,null,1));
// descargas: PPT, Excel de la vista, Excel completo, justificadas con fotos, PNG de tarjeta
await p.click('#nav [data-go="visitas"]');await p.waitForTimeout(600);await p.click('#nav [data-sub="visitas|inf"]');await p.waitForTimeout(900);
const dl=async(sel,lab)=>{try{const [d]=await Promise.all([p.waitForEvent('download',{timeout:45000}),p.click(sel)]);const pa=await d.path();console.log('✔',lab,d.suggestedFilename(),fs.statSync(pa).size,'bytes')}catch(e){console.log('✘',lab,e.message.slice(0,100))}};
await dl('[data-vx="vista"]','Excel vista');await dl('[data-vx="todo"]','Excel completo');await dl('[data-vx="ppt"]','PPT');
await dl('#pan [data-ex="png"]','PNG tarjeta');await dl('#pan [data-ex="pdf"]','PDF tarjeta');await p.screenshot({path:__dirname+'/out/s_inf.png'});
await p.click('#nav [data-sub="visitas|jus"]');await p.waitForTimeout(1200);await dl('[data-jx]','Excel justificadas');
await p.screenshot({path:__dirname+'/out/s_jus.png'});await p.check('#jfoto');await dl('[data-jx]','Excel justificadas+fotos');
const bt=await p.$('[data-jv]');if(bt){await bt.click();await p.waitForTimeout(900);console.log('modal detalle:',await p.evaluate(()=>(document.querySelector('.modal .box')||{}).innerText?.slice(0,120).replace(/\n/g,' ')));}
console.log('errores',errs.length,errs.slice(0,5));await b.close();srv.close()})();
