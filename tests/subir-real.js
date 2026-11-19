/* Sube un archivo real (ruta en argv[2]) a través de «Cargar bases» contra el Supabase simulado y muestra lo reconocido y guardado. */
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), http = require('http');
const WEB = path.join(__dirname, '..', 'web'), ARCH = process.argv[2];
const srv = http.createServer((req, res) => { const f = path.join(WEB, req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0]); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'application/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' }); res.end(fs.readFileSync(f)); });
(async () => { await new Promise((r) => srv.listen(8791, r)); const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 1500, height: 1200 } })).newPage(), errs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.route('https://cdn.jsdelivr.net/**', (r) => { const u = r.request().url(); const S = (f) => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(f) }); if (/supabase/.test(u)) return S(path.join(__dirname, 'fake.js')); if (/xlsx/.test(u)) return S(path.join(__dirname, '..', 'node_modules', 'xlsx', 'dist', 'xlsx.full.min.js')); r.abort(); });
  await p.goto('http://localhost:8791/#carga'); await p.waitForSelector('#fl');
  await p.evaluate(() => { window.__DB.tareas.length = 0; window.__DB.visitas.length = 0; });
  await p.setInputFiles('#fl', ARCH); await p.waitForTimeout(6000);
  console.log('RECONOCIDO:', (await p.$$eval('#lista .card', h => h.map(x => x.innerText.replace(/\n/g, ' ').slice(0, 260)))).join(' || '));
  if (await p.$('#go')) { await p.click('#go'); await p.waitForFunction(() => !document.querySelector('#go') || document.querySelector('#main').innerText.includes('Resultado de la última carga') || document.querySelector('[role=alert]'), { timeout: 120000 }).catch(() => {}); await p.waitForTimeout(1500);
    console.log('RESULTADO:', await p.$eval('#main', m => { const c = [...m.querySelectorAll('.card')].find(x => /Resultado de la última carga|se detuvo/.test(x.innerText)); return c ? c.innerText.replace(/\n/g, ' ') : 'SIN RESULTADO: ' + m.innerText.slice(0, 300); })); }
  const T = await p.evaluate(() => { const t = window.__DB.tareas; const cat = {}; t.forEach(x => cat[x.categoria] = (cat[x.categoria] || 0) + 1); return { n: t.length, cat, frio: t.filter(x => x.es_frio).length, fechas: [t.map(x => x.fecha).sort()[0], t.map(x => x.fecha).sort().pop()], ej: t[0] && { id: t[0].id, fecha: t[0].fecha, ecm: t[0].ecm, cliente: t[0].cliente, cat: t[0].categoria, ts: t[0].detalle.ts } }; });
  console.log('GUARDADO:', JSON.stringify(T)); console.log('errores:', errs.length, errs.slice(0, 3)); await b.close(); srv.close(); })();
