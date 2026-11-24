/* Una pregunta nueva de SOS que no se reconoce entra al catálogo como SIN CLASIFICAR y no se cuenta. */
const { chromium } = require('playwright'); const XLSX = require('xlsx'); const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
const WEB = path.join(__dirname, '..', 'web');
const srv = http.createServer((req, res) => { const f = path.join(WEB, req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0]); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'application/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' }); res.end(fs.readFileSync(f)); });
(async () => { await new Promise((r) => srv.listen(8797, r)); const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 1500, height: 1100 } })).newPage(), errs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.route('https://cdn.jsdelivr.net/**', (r) => { const u = r.request().url(); const S = (f) => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(f) }); if (/supabase/.test(u)) return S(path.join(__dirname, 'fake.js')); if (/xlsx/.test(u)) return S(path.join(__dirname, '..', 'node_modules', 'xlsx', 'dist', 'xlsx.full.min.js')); r.abort(); });
  await p.goto('http://localhost:8797/#carga'); await p.waitForSelector('#fl'); const cod = await p.evaluate(() => window.__DB.rutero[0].codigo);
  const f = (d) => d.toISOString().slice(0, 10); const d = new Date(); while (d.getUTCDay() !== 4) d.setUTCDate(d.getUTCDate() - 1);
  const base = { CodigoCliente: cod, 'Fecha Encuesta': f(d), BDR: 'ECM001', NombreCliente: 'PDV', NombreEncuesta: 'SOS' };
  const filas = [{ ...base, DescripcionPregunta: 'Pilsener hay', Respuesta: 5 }, { ...base, DescripcionPregunta: 'Producto misterioso xyz', Respuesta: 3 }];
  const fx = path.join(os.tmpdir(), 'enc_prueba.xlsx'); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), 'Export'); XLSX.writeFile(wb, fx);
  await p.setInputFiles('#fl', fx); await p.click('#go'); await p.waitForFunction(() => document.querySelector('#main').innerText.includes('sin clasificar'), { timeout: 30000 }); await p.waitForTimeout(500);
  console.log('Mensaje:', await p.$eval('#main', (m) => { const c = [...m.querySelectorAll('.card')].find((x) => /sin clasificar/.test(x.innerText)); return c ? c.innerText.replace(/\n/g, ' ').slice(0, 220) : 'no'; }));
  console.log('Catálogo:', JSON.stringify(await p.evaluate(() => window.__DB.catalogo_share.filter((c) => /MISTERIOSO|PILSENER/i.test(c.pregunta)).map((c) => [c.pregunta, c.grupo, c.origen]))));
  console.log('Filas contadas del producto misterioso:', await p.evaluate(() => window.__DB.share_detalle.filter((r) => /MISTERIOSO/i.test(r.marca + r.sku)).length));
  await p.goto('http://localhost:8797/#catalogo'); await p.waitForSelector('#tb table'); console.log('Catálogo info:', await p.$eval('#info', (e) => e.innerText), '| primera fila marca:', await p.$eval('#tb tbody tr select', (s) => s.value));
  console.log('errores:', errs.length, errs.slice(0, 3)); await b.close(); srv.close(); })();
