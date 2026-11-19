const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http');
const WEB = path.join(__dirname, '..', 'web'), T = __dirname;
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' };
const srv = http.createServer((req, res) => { let f = path.join(WEB, req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0]); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'text/plain' }); res.end(fs.readFileSync(f)); });
(async () => {
  await new Promise((r) => srv.listen(8765, r));
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1800, height: 900 } }), p = await ctx.newPage(), errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.route('https://cdn.jsdelivr.net/**', (r) => { const u = r.request().url(); if (/supabase/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(__dirname, 'fake.js')) }); if (/xlsx/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(__dirname, '..', 'node_modules', 'xlsx/dist/xlsx.full.min.js')) }); r.abort(); });
  await p.goto('http://localhost:8765/'); await p.waitForSelector('#nav [data-go]', { timeout: 15000 });
  const links = await p.$$eval('#nav [data-go]', (a) => a.map((x) => x.dataset.go)); console.log('NAV:', links.join(', '));
  const shot = process.argv[2];
  for (const k of links) {
    await p.click(`#nav [data-go="${k}"]`); await p.waitForTimeout(900);
    const txt = await p.$eval('#main', (m) => m.innerText.length); const tabs = await p.$$eval(`#nav [data-sub^="${k}|"]`, (b) => b.map((x) => x.dataset.sub.split('|')[1]));
    console.log(`\n== ${k}: ${txt} chars, tabs=[${tabs.join(',')}]`);
    for (const t of tabs) { const before = errs.length; await p.click(`#nav [data-sub="${k}|${t}"]`); await p.waitForTimeout(700); const n = await p.$eval('#main', (m) => m.innerText.length); const bad = await p.$$eval('#main .card', (c) => c.filter((x) => /No se pudo armar/.test(x.innerText)).map((x) => x.innerText.slice(0, 160)));
      console.log(`   tab ${t}: ${n} chars${bad.length ? '  !! ' + bad[0] : ''}${errs.length > before ? '  !! errs ' + errs.slice(before).join(' | ') : ''}`);
      if (shot && `${k}:${t}` === shot) await p.screenshot({ path: path.join(T, 'shot.png'), fullPage: false });
    }
  }
  console.log('\nERRORES TOTALES:', errs.length); errs.slice(0, 12).forEach((e) => console.log(' -', e));
  await b.close(); srv.close();
})();
