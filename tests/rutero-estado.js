/* Subida de un rutero con columna Estado y opción «rutero completo» contra el Supabase simulado. */
const { chromium } = require('playwright'); const XLSX = require('xlsx'); const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
const WEB = path.join(__dirname, '..', 'web');
const srv = http.createServer((req, res) => { const f = path.join(WEB, req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0]); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'application/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' }); res.end(fs.readFileSync(f)); });
(async () => { await new Promise((r) => srv.listen(8794, r)); const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 1500, height: 1100 } })).newPage(), errs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.route('https://cdn.jsdelivr.net/**', (r) => { const u = r.request().url(); const S = (f) => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(f) }); if (/supabase/.test(u)) return S(path.join(__dirname, 'fake.js')); if (/xlsx/.test(u)) return S(path.join(__dirname, '..', 'node_modules', 'xlsx', 'dist', 'xlsx.full.min.js')); r.abort(); });
  await p.goto('http://localhost:8794/#carga'); await p.waitForSelector('#fl'); const cods = await p.evaluate(() => window.__DB.rutero.map((r) => r.codigo)); console.log('PDV en la base:', cods.length);
  const filas = cods.slice(0, 10).map((c, i) => ({ Cliente_SAP: c, NombreCliente3: 'PDV ' + c, Region: 'SIERRA', ECM: 'ECM001', Estado: i < 3 ? 'Inactivo' : 'Activo' }));
  const fx = path.join(os.tmpdir(), 'rutero_prueba.xlsx'); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), 'Rutero'); XLSX.writeFile(wb, fx);
  for (const modo of ['auto', 'completo']) {
    await p.evaluate(() => { window.__DB.rutero.forEach((r) => { r.activo = true; r.estado_manual = false; }); });
    await p.setInputFiles('#fl', fx); await p.waitForSelector('#crut'); await p.selectOption('#crut', modo); await p.click('#go'); await p.waitForFunction(() => document.querySelector('#main').innerText.includes('Resultado de la última carga'), { timeout: 60000 }); await p.waitForTimeout(800);
    const R = await p.evaluate(() => { const t = window.__DB.rutero; return { inact: t.filter((r) => r.activo === false).length, act: t.filter((r) => r.activo !== false).length, fijos: t.filter((r) => r.estado_manual).length }; });
    console.log(modo, '→', JSON.stringify(R), '|', await p.$$eval('.nodo', (a) => a.map((x) => x.innerText.replace(/\n/g, ' ').slice(0, 170)).join(' || ')));
    await p.goto('http://localhost:8794/#carga'); await p.reload(); await p.waitForSelector('#fl');
  }
  console.log('errores:', errs.length, errs.slice(0, 3)); await b.close(); srv.close(); })();
