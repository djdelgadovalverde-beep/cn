/* PDV activos/inactivos: pantalla Rutero (filtro, contadores, activar/desactivar, automático, recalcular). */
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), http = require('http');
const WEB = path.join(__dirname, '..', 'web');
const srv = http.createServer((req, res) => { const f = path.join(WEB, req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0]); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'application/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' }); res.end(fs.readFileSync(f)); });
(async () => { await new Promise((r) => srv.listen(8793, r)); const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 1500, height: 1000 } })).newPage(), errs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); }); p.on('dialog', (d) => d.accept('Cerrado'));
  await p.route('https://cdn.jsdelivr.net/**', (r) => { const u = r.request().url(); const S = (f) => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(f) }); if (/supabase/.test(u)) return S(path.join(__dirname, 'fake.js')); if (/xlsx/.test(u)) return S(path.join(__dirname, '..', 'node_modules', 'xlsx', 'dist', 'xlsx.full.min.js')); r.abort(); });
  await p.goto('http://localhost:8793/#rutero'); await p.waitForSelector('#tb table'); await p.waitForTimeout(500);
  console.log('KPIs:', (await p.$eval('#rk', (e) => e.innerText.replace(/\n/g, ' '))));
  const total = await p.$$eval('#tb tbody tr', (a) => a.length); await p.selectOption('#fe', 'ina'); console.log('valor select:', await p.$eval('#fe', (e) => e.value), 'onchange:', await p.$eval('#fe', (e) => typeof e.onchange)); await p.waitForTimeout(400);
  await p.waitForTimeout(800); console.log('estados:', JSON.stringify(await p.$$eval('#tb .st', (a) => a.map((x) => x.innerText).slice(0, 8))), 'info:', await p.$eval('#info', (e) => e.innerText.slice(0, 40))); console.log('Inactivos en la página:', await p.$$eval('#tb tbody tr', (a) => a.length), '· todos tienen badge Inactivo:', await p.$$eval('#tb .st', (a) => a.every((x) => x.innerText === 'Inactivo')));
  await p.screenshot({ path: path.join(__dirname, 'pdv.png') });
  await p.selectOption('#fe', 'act'); await p.waitForTimeout(400); const b1 = await p.$('[data-est$="|0"]'); const cod = (await b1.getAttribute('data-est')).split('|')[0]; await b1.click(); await p.waitForTimeout(500);
  const DB = await p.evaluate((c) => window.__DB.rutero.find((r) => r.codigo === c), cod); console.log('Desactivado a mano:', cod, DB.activo, DB.estado_manual, DB.estado_motivo);
  await p.selectOption('#fe', 'ina'); console.log('valor select:', await p.$eval('#fe', (e) => e.value), 'onchange:', await p.$eval('#fe', (e) => typeof e.onchange)); await p.waitForTimeout(400); await p.click(`[data-auto="${cod}"]`); await p.waitForTimeout(500); console.log('Vuelve a automático:', (await p.evaluate((c) => window.__DB.rutero.find((r) => r.codigo === c), cod)).estado_manual);
  await p.click('#rc'); await p.waitForTimeout(400); console.log('Toast:', await p.$eval('#toast', (e) => e.innerText));
  console.log('errores:', errs.length, errs.slice(0, 3)); await b.close(); srv.close(); })();
