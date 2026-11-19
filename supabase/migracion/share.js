const fs = require('fs'), path = require('path');
const M = require('./migrate.js'); const { JOBS, ECM, RUT } = M;
const norm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
const ecmNorm = (v) => norm(v).replace(/^EC(?=ECM)/, ''); const normReg = (v) => norm(v).replace(/^REGION\s+/, '').replace(/\s*KKAA.*$/, '');
const DRY = process.argv.includes('--dry'), MINW = Number((process.argv.find((a) => a.startsWith('--desde=')) || '--desde=36').slice(8));
const URL = 'https://iizebvjhmpglgsunmtog.supabase.co/functions/v1/ingest', TOKEN = process.env.INGEST_TOKEN;
const ANON = fs.readFileSync(path.join(__dirname, 'migrate.js'), 'utf8').match(/const ANON = '([^']+)'/)[1];
/* clasificación de respaldo (igual que la web) */
const KW_MERC = ['OTRAS MARCAS DEL MERCADO', 'OTRAS MARCAS DE MERCADO', 'MERCADO', 'MERC', 'ROYAL DUTCH', 'ARTESANAL', 'ARTESANALES', 'PERONI', 'PRIMA', 'PONY MALTA', 'ESTRELLA GALICIA', 'WEIDMAN', 'WIERQUER', 'HORSE', 'LATITUD CERO', 'X MARK', 'HOFFEN'];
const KW_HNK = ['HEINEKEN', 'HNK', 'HK', 'AMSTEL', 'AMS', 'BIELA', 'BL', 'DORADA', 'SOL', 'ANDINA', 'DOR'];
const KW_CN = ['PILSENER', 'CLUB', 'PLATINO', 'CORONA', 'BUDWEISER', 'BUD', 'MODELO', 'STELLA', 'QUILMES', 'BECKS', 'SIEMBRA', 'CONQUER', 'ARCHER', 'INTERNACIONELS', 'INTERNACIONALES', 'GLOBALES', 'OTRAS MARCAS CN', 'OTRAS CN', 'MARCAS DE CN', 'MARCAS CN'];
const kw = (t, l) => l.find((w) => new RegExp('(^|[^A-Z0-9])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^A-Z0-9]|$)').test(t)) || null;
function auto(q, sv) { const k = norm(q).replace(/\?/g, ''); if (/^OBSERVACION/.test(k)) return { grupo: 'EXCLUIR', tipo: sv === 'SOS' ? 'PERCHA' : 'RUMA', marca: 'OBSERVACIÓN', visual: '' };
  const t = k.replace(/([A-Z])HAY /g, '$1 HAY ').replace(/^¿?CUANT[AO]S (CARAS|SKUS|COLUMNAS|EXHIBIDORES) DE /, '').replace(/ HAY$/, '').trim(); let w = kw(t, KW_MERC), g = 'MERC'; if (!w) { w = kw(t, KW_HNK); g = 'HNK'; } if (!w) { w = kw(t, KW_CN); g = 'CN'; } if (!w) return null;
  if (sv === 'SOS') return { grupo: g, tipo: 'PERCHA', marca: w, visual: t };
  const tipo = /EXHIBIDOR|COLUMNA|VENTANAL/.test(k) ? null : /RUMA/.test(k) ? 'RUMA' : /FRIO/.test(k) ? 'BANDEJA FRÍO' : /SECO/.test(k) ? 'BANDEJA SECO' : null; return tipo ? { grupo: g, tipo, marca: w, visual: t } : { grupo: 'EXCLUIR', tipo: 'RUMA', marca: w, visual: t }; }
const CAT = {}; JOBS.catalogo_share.forEach((c) => (CAT[norm(c.clave) + '|' + c.encuesta] = c));
const dir = path.join(__dirname, 'weeks'), files = fs.readdirSync(dir).map((f) => path.join(dir, f)), W = [];
files.forEach((f) => { try { const j = JSON.parse(fs.readFileSync(f, 'utf8')); if (j && j.survey && j.rows && j.qs && j.year === 2026 && j.week >= MINW) W.push(j); } catch (e) { } });
W.sort((a, b) => a.week - b.week || a.survey.localeCompare(b.survey));
const acc = {}, nuevoCat = {}, unm = {}, newRut = {}; const S = { rows: 0, sinCat: 0, auto: 0, excl: 0 };
W.forEach((j) => { const sv = j.survey;
  const info = j.qs.map((q) => { const k = norm(q) + '|' + sv; if (CAT[k]) return CAT[k]; const a = auto(q, sv); if (a) { const rec = { clave: norm(q), pregunta: q.slice(0, 300), encuesta: sv, ...a, origen: 'auto' }; CAT[k] = rec; nuevoCat[k] = rec; S.auto++; return rec; } (unm[sv + '|' + q] ||= 0); return null; });
  j.rows.forEach(([cod, qi, v]) => { S.rows++; const c = info[qi]; if (!c) { unm[sv + '|' + j.qs[qi]] += v; S.sinCat++; return; } if (c.grupo === 'EXCLUIR') { S.excl++; return; }
    const fecha = (j.f && j.f[cod]) || j.start, marca = String(c.marca || '').slice(0, 80), sku = String(c.visual || '').slice(0, 120), k = [fecha, cod, c.tipo, c.grupo, marca, sku].join('|'), p = j.pdv[cod] || [], ecm = ecmNorm(p[1] || '');
    (acc[k] ||= { fecha, codigo: cod, pdv: String(p[0] || '').slice(0, 100), ecm, supervisor: (ECM[ecm] && ECM[ecm].supervisor) || '', tipo: c.tipo, grupo: c.grupo, marca, sku, caras: 0 }).caras += Number(v); });
  Object.entries(j.pdv).forEach(([cod, p]) => { if (!RUT[cod] && !newRut[cod]) newRut[cod] = { codigo: cod, pdv: String(p[0] || '').slice(0, 120), ecm: ecmNorm(p[1] || ''), region: /COSTA|SIERRA/.test(norm(p[3] || '')) ? normReg(p[3]) : null }; }); });
const rows = Object.values(acc);
async function post(body) { const r = await fetch(URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + ANON, apikey: ANON, 'x-ingest-token': TOKEN }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw new Error(`${body.table}: ${j.error || r.status}`); return j; }
(async () => {
  console.log('Semanas:', W.map((j) => j.survey + j.week).join(' '));
  console.log(`Respuestas ${S.rows} · sin catálogo ${S.sinCat} · clasificadas auto ${S.auto} · excluidas ${S.excl} → ${rows.length} filas de caras · PDV nuevos para rutero ${Object.keys(newRut).length}`);
  const top = Object.entries(unm).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 8); if (top.length) console.log('Preguntas sin clasificar:', top.map(([k, v]) => k.slice(0, 70) + ' (' + v + ')').join(' | '));
  const g = rows.reduce((m, r) => ((m[r.tipo + ' ' + r.grupo] = (m[r.tipo + ' ' + r.grupo] || 0) + r.caras), m), {}); console.log('Caras por tipo/grupo:', JSON.stringify(g));
  if (DRY) return;
  const send = async (table, list, sz = 1000) => { for (let i = 0; i < list.length; i += sz) { await post({ table, rows: list.slice(i, i + sz) }); process.stdout.write(`\r  ${table}: ${Math.min(i + sz, list.length)}/${list.length}   `); } console.log(); };
  if (Object.keys(nuevoCat).length) await send('catalogo_share', Object.values(nuevoCat), 300);
  if (Object.keys(newRut).length) await send('rutero', Object.values(newRut).map((o) => ({ pdv: null, region: null, cadena: null, ciudad: null, supervisor: null, ecm: null, dia_visita: null, subcadena: null, kam: null, gerencia: null, grupo_supervision: null, semanas: null, dia_entrega: null, agrupacion: null, gestor: null, ...o })), 500);
  await send('share_detalle', rows, 1000); console.log('OK');
})().catch((e) => { console.error('ERROR', e.message); process.exit(1); });
