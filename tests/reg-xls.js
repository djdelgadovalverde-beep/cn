const { chromium } = require('playwright'); const XLSX = require('xlsx'); const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
const WEB = path.join(__dirname, '..', 'web');
const srv = http.createServer((req, res) => { const f = path.join(WEB, req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0]); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'application/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' }); res.end(fs.readFileSync(f)); });
(async () => { await new Promise((r) => srv.listen(8801, r)); const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1800, height: 1000 }, acceptDownloads: true }), p = await ctx.newPage(), errs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.route('https://cdn.jsdelivr.net/**', (r) => { const u = r.request().url(); const S = (f) => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(f) }); if (/supabase/.test(u)) return S(path.join(__dirname, 'fake.js')); if (/xlsx/.test(u)) return S(path.join(__dirname, '..', 'node_modules', 'xlsx', 'dist', 'xlsx.full.min.js')); r.abort(); });
  await p.goto('http://localhost:8801/#registro'); await p.waitForSelector('[data-act="xls"]');
  for (const est of ['pend', 'all']) { await p.selectOption('[data-f="est"], select[data-rg="est"], .fbar select >> nth=0', est).catch(() => {}); await p.waitForTimeout(400);
    const txt = await p.$eval('[data-act="xls"]', (e) => e.innerText); const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-act="xls"]')]); const f = path.join(os.tmpdir(), dl.suggestedFilename()); await dl.saveAs(f);
    const ws = XLSX.readFile(f).Sheets.Visitas, j = XLSX.utils.sheet_to_json(ws, { header: 1 }); console.log(est, '→ botón:', txt, '| archivo:', dl.suggestedFilename(), '| filas:', j.length - 1, '| columnas:', j[0].join(', ')); }
  console.log('errores:', errs.length, errs.slice(0, 2)); await b.close(); srv.close(); })();
