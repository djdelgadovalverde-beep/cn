const { chromium } = require('playwright'); const fs=require('fs'),path=require('path'),http=require('http');
const NM = path.join(__dirname, '..', 'node_modules') + '/';
const WEB=path.join(__dirname,'..','web'),T=__dirname;
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');fs.writeFileSync(path.join(T,'f.png'),png);
const srv=http.createServer((req,res)=>{let f=path.join(WEB,req.url.split('?')[0]==='/'?'index.html':req.url.split('?')[0]);if(!fs.existsSync(f)){res.writeHead(404);return res.end()}res.writeHead(200,{'Content-Type':f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':'text/html'});res.end(fs.readFileSync(f))});
(async()=>{await new Promise(r=>srv.listen(8777,r));const b=await chromium.launch(),p=await(await b.newContext({viewport:{width:1800,height:1100}})).newPage(),errs=[];
p.on('pageerror',e=>errs.push('PAGE '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});p.on('dialog',d=>d.accept());
await p.route('https://cdn.jsdelivr.net/**',r=>{const u=r.request().url();if(/supabase/.test(u))return r.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(__dirname,'fake.js'))});if(/xlsx/.test(u))return r.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(NM,'xlsx/dist/xlsx.full.min.js'))});r.abort()});
await p.goto('http://localhost:8777/');await p.waitForSelector('#nav [data-go]');await p.click('#nav [data-go="registro"]');await p.waitForSelector('table.rt tbody tr',{timeout:15000});
const db=(k)=>p.evaluate((k)=>window.__DB[k].length,k), n=(s)=>p.$$eval(s,e=>e.length);
console.log('KPIs:',await p.$$eval('.k.kb',k=>k.map(x=>x.querySelector('span').textContent+'='+x.querySelector('b').textContent).join(' | ')));
console.log('filas página:',await n('table.rt tbody tr'),'| badges reincidencia:',await n('.rei'),'| sugerencias 💡:',await n('.sgb'),'| botones WhatsApp:',await n('button.wa'),'| botones 🔗:',await n('[data-lkp]'));
// 1. asignación masiva
await p.click('tbody tr:nth-child(1) [data-sel]');await p.click('tbody tr:nth-child(2) [data-sel]');await p.selectOption('#bm',{label:'Cliente cerrado'});await p.fill('#bo','Local cerrado por feriado');await p.click('[data-act="bulk"]');await p.waitForTimeout(400);
console.log('cambios sin guardar:',await p.$eval('.savebar span',e=>e.textContent));const j0=await db('justificaciones');await p.click('[data-act="save"]');await p.waitForTimeout(1200);console.log('justificaciones',j0,'→',await db('justificaciones'),'| aviso:',await p.$eval('#toast',e=>e.textContent));
// 2. sugerencia
console.log('sugeridos tras guardar:',await n('.sgb'));if(await n('.sgb')){await p.click('.sgb');await p.waitForTimeout(300);console.log('  aplicar sugerencia → cambios:',await p.$eval('.savebar span',e=>e.textContent))}
// 3. réplica por reincidencia
const ban=await n('[data-act="rjall"]');console.log('banner reincidencia con justificación previa:',ban?'sí':'no');if(ban){await p.click('[data-act="rjall"]');await p.waitForSelector('#rjok');console.log('  casos a replicar:',await n('tbody tr[data-id] [data-rjc]'));await p.click('#rjok');await p.waitForTimeout(500);console.log('  tras replicar →',await p.$eval('.savebar span',e=>e.textContent))}
// 4. WhatsApp + en gestión
await p.click('[data-act="clr"]').catch(()=>{});await p.click('tbody tr:nth-child(3) [data-sel]');await p.click('[data-act="wa"]');await p.waitForSelector('a[data-wae]');
const href=await p.$eval('a[data-wae]',a=>decodeURIComponent(a.href));console.log('WhatsApp →',href.slice(0,40),'…\n   mensaje:',href.split('text=')[1].replace(/\n/g,' ⏎ ').slice(0,170));
await p.evaluate(()=>document.querySelector('a[data-wae]').addEventListener('click',e=>e.preventDefault()));const g0=await db('gestion');await p.click('a[data-wae] button');await p.waitForTimeout(600);console.log('en gestión',g0,'→',await db('gestion'));await p.click('#wax');await p.waitForTimeout(600);
// 5. foto
await p.click('tbody tr:nth-child(1) [data-ev]');await p.waitForSelector('#evf',{state:'attached'});const e0=await db('evidencias');await p.setInputFiles('#evf',path.join(T,'f.png'));await p.waitForTimeout(1200);console.log('fotos',e0,'→',await db('evidencias'),'| miniaturas:',await n('#evg img'));await p.click('#evx');await p.waitForTimeout(600);
// 6. enlaces Involves
await p.click('[data-lkp]');await p.waitForSelector('#lkm');console.log('enlaces: marcados',await n('[data-lk]:checked'),'de',await n('[data-lk]'));await p.selectOption('#lkm',{label:'Cliente cerrado'});await p.click('#lkok');await p.waitForTimeout(500);console.log('  justificar con enlaces →',await p.$eval('.savebar span',e=>e.textContent));
// 7. historial / pestañas
const h=await n('[data-hist]');console.log('botones historial:',h);if(h){await p.click('[data-hist]');await p.waitForTimeout(500);console.log('  historial abre:',(await n('.modal .box'))>0);await p.click('#hx')}
for(const t of ['rei','reg']){await p.click(`#nav [data-sub="registro|${t}"]`);await p.waitForTimeout(900);console.log('pestaña',t,'→',(await p.$eval('#main',m=>m.innerText.length)),'chars; filas:',await n('#main tbody tr'))}
// 8. desde Visitas > Registro
await p.click('#nav [data-go="visitas"]');await p.waitForTimeout(800);await p.click('#nav [data-sub="visitas|det"]');await p.waitForTimeout(1500);console.log('Visitas › Registro y justificación →',await n('table.rt tbody tr'),'filas');
console.log('ERRORES:',errs.length);errs.slice(0,4).forEach(e=>console.log(' -',e.slice(0,200)));await p.screenshot({path:'reg.png'});await b.close();srv.close()})();
