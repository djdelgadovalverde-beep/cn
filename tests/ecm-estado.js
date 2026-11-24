/* ECM activo/inactivo y penetración sobre PDV activos. */
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), http = require('http');
const WEB = path.join(__dirname, '..', 'web');
const srv = http.createServer((req, res) => { const f = path.join(WEB, req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0]); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'application/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' }); res.end(fs.readFileSync(f)); });
(async () => { await new Promise((r) => srv.listen(8795, r)); const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 1500, height: 1100 } })).newPage(), errs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.route('https://cdn.jsdelivr.net/**', (r) => { const u = r.request().url(); const S = (f) => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(f) }); if (/supabase/.test(u)) return S(path.join(__dirname, 'fake.js')); if (/xlsx/.test(u)) return S(path.join(__dirname, '..', 'node_modules', 'xlsx', 'dist', 'xlsx.full.min.js')); r.abort(); });
  await p.goto('http://localhost:8795/#ecm'); await p.waitForSelector('[data-ea]'); console.log('Resumen ECM:', await p.$eval('#main .card .note', (e) => e.innerText.slice(0, 90)));
  const antes = await p.evaluate(() => CN.ecmInact.size); await p.selectOption('[data-ea]:nth-of-type(1)', '0').catch(async () => { await (await p.$('[data-ea]')).selectOption('0'); }); await p.waitForTimeout(600);
  console.log('ECM inactivos antes/después:', antes, await p.evaluate(() => CN.ecmInact.size), '· fila marcada:', await p.$$eval('tr.ina', (a) => a.length));
  await p.selectOption('#e_fe', 'ina'); await p.waitForTimeout(400); console.log('Filtro inactivos →', await p.$$eval('[data-ea]', (a) => a.length), 'fila(s)');
  await p.goto('http://localhost:8795/#sos'); await p.waitForSelector('.rs-sec, .card', { timeout: 15000 }); await p.waitForTimeout(1500);
  const tx = await p.$eval('#main', (e) => e.innerText.replace(/\n/g, ' ')); console.log('secciones:', await p.$$eval('.rs-sec h2', (a) => a.map((x) => x.innerText))); const k = tx.indexOf('Penetración'); console.log('Penetración:', k < 0 ? 'NO aparece' : tx.slice(k, k + 420));
  console.log('errores:', errs.length, errs.slice(0, 3)); await b.close(); srv.close(); })();
