/* Ayuda interactiva: bienvenida de primera vez, recorrido por el menú, franja explicativa, panel «?» y Centro de ayuda. */
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), http = require('http');
const WEB = path.join(__dirname, '..', 'web');
const srv = http.createServer((req, res) => { const f = path.join(WEB, req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0]); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'application/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' }); res.end(fs.readFileSync(f)); });
(async () => { await new Promise((r) => srv.listen(8792, r)); const b = await chromium.launch(), errs = [];
  for (const [nombre, vw] of [['escritorio', { width: 1400, height: 900 }], ['movil', { width: 390, height: 800 }]]) {
    const p = await (await b.newContext({ viewport: vw })).newPage(); p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await p.addInitScript(() => { window.__BIENVENIDA = 1; });
    await p.route('https://cdn.jsdelivr.net/**', (r) => { const u = r.request().url(); const S = (f) => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(f) }); if (/supabase/.test(u)) return S(path.join(__dirname, 'fake.js')); if (/xlsx/.test(u)) return S(path.join(__dirname, '..', 'node_modules', 'xlsx', 'dist', 'xlsx.full.min.js')); r.abort(); });
    await p.goto('http://localhost:8792/#visitas'); await p.waitForSelector('.ay-wm', { timeout: 15000 }); console.log(nombre, '· bienvenida:', await p.$eval('.ay-wm h2', (h) => h.innerText));
    await p.screenshot({ path: path.join(__dirname, `ay-${nombre}-1.png`) });
    await p.click('[data-w="si"]'); await p.waitForSelector('.ay-tour');
    let pasos = 0; const titulos = []; for (; pasos < 40; pasos++) { titulos.push(await p.$eval('.ay-tip b', (e) => e.innerText)); if (pasos === 2) await p.screenshot({ path: path.join(__dirname, `ay-${nombre}-2.png`) }); const fin = await p.$eval('[data-t="n"]', (e) => e.innerText); await p.click('[data-t="n"]'); if (fin === 'Terminar') { pasos++; break; } }
    console.log(nombre, '· pasos del recorrido:', pasos, titulos.join(' | ')); console.log(nombre, '· recorrido cerrado:', !(await p.$('.ay-tour')));
    console.log(nombre, '· franja:', (await p.$eval('#main .ay-intro', (e) => e.innerText.replace(/\n/g, ' ').slice(0, 150))), '| subtítulos de menú:', await p.$$eval('#nav .ay-sub', (a) => a.length));
    await p.click('#ayb'); await p.waitForSelector('#ayp'); console.log(nombre, '· panel:', (await p.$eval('#ayp h2', (e) => e.innerText)), '·', await p.$$eval('#ayp li', (a) => a.length), 'items'); await p.screenshot({ path: path.join(__dirname, `ay-${nombre}-3.png`) }); await p.keyboard.press('Escape');
    await p.click('#ayb'); await p.click('[data-ay="tour"]'); await p.waitForSelector('.ay-tour'); console.log(nombre, '· tour de pantalla pasos:', await p.$eval('.ay-step', (e) => e.innerText)); await p.keyboard.press('Escape');
    await p.evaluate(() => { location.hash = '#ayuda'; }); await p.waitForSelector('#ay-q'); await p.fill('#ay-q', 'semana'); await p.waitForTimeout(200); console.log(nombre, '· centro, resultados «semana»:', await p.$$eval('.ay-grid .card', (a) => a.length), 'pantallas');
    await p.click('#ayt').catch(() => {}); console.log(nombre, '· toggle:', await p.$eval('#ayt span', (e) => e.innerText).catch(() => 'n/a'));
  }
  console.log('errores:', errs.length, errs.slice(0, 4)); await b.close(); srv.close(); })();
