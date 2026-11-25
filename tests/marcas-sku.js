const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), http = require('http');
const WEB = path.join(__dirname, '..', 'web');
const srv = http.createServer((req, res) => { const f = path.join(WEB, req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0]); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'application/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' }); res.end(fs.readFileSync(f)); });
(async () => { await new Promise((r) => srv.listen(8800, r)); const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 1400, height: 1000 } })).newPage(), errs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.route('https://cdn.jsdelivr.net/**', (r) => { const u = r.request().url(); const S = (f) => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(f) }); if (/supabase/.test(u)) return S(path.join(__dirname, 'fake.js')); if (/xlsx/.test(u)) return S(path.join(__dirname, '..', 'node_modules', 'xlsx', 'dist', 'xlsx.full.min.js')); r.abort(); });
  await p.goto('http://localhost:8800/#sos'); await p.waitForSelector('#nav [data-sub^="sos|"]');
  console.log('Pestañas:', (await p.$$eval('#nav [data-sub^="sos|"]', (a) => a.map((x) => x.innerText))).join(' | '));
  for (const t of ['mar', 'sku']) { await p.click(`[data-sub="sos|${t}"]`); await p.waitForTimeout(1200); console.log(t, '→', await p.$$eval('#main table thead th', (a) => a.map((x) => x.innerText.trim())), '| filas:', await p.$$eval('#main table tbody tr td:first-child', (a) => a.slice(0, 5).map((x) => x.innerText))); }
  console.log('errores:', errs.length, errs.slice(0, 2)); await b.close(); srv.close(); })();
