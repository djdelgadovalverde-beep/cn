'use strict';
/* Precios: seguimiento diario de precios y promociones por cadena. Cargas (precios del mes, plan promocional, check-in) y pantallas:
   Control de precios por canal, Análisis del día, Competencia, Auditoría (con encuestas en blanco), SKU y marcas, Asesores (check-in cruzado con el equipo ECM). */
(function () {
  NAV.precios = ['Precios', ['admin', 'gerencia', 'supervisor']];
  if (typeof ICON !== 'undefined') ICON.precios = '<path d="M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0L3 13V3h10l7.6 7.6a2 2 0 010 2.8z"/><circle cx="8" cy="8" r="1.5"/>';
  if (typeof GROUPS !== 'undefined' && GROUPS[0] && !GROUPS[0][1].includes('precios')) GROUPS[0][1].push('precios');

  /* solo se guardan y analizan las cadenas requeridas: Rosado, Favorita, Atimasa, Tía y Coral */
  const SUBS = ['PRIMAX', 'CORAL', 'CORALITO', 'AKI', 'MAXI', 'TITAN', 'HIPER', 'MICO', 'MINI', 'TIA'];
  const GRUPO_DE = { HIPER: 'ROSADO', MICO: 'ROSADO', MINI: 'ROSADO', AKI: 'FAVORITA', MAXI: 'FAVORITA', TITAN: 'FAVORITA', PRIMAX: 'ATIMASA', TIA: 'TIA', CORAL: 'CORAL', CORALITO: 'CORAL' };
  const LAYOUT = [['ATIMASA', ['PRIMAX']], ['CORAL', ['CORAL', 'CORALITO']], ['FAVORITA', ['AKI', 'MAXI', 'TITAN']], ['ROSADO', ['HIPER', 'MICO', 'MINI']], ['TIA', ['TIA']]];
  const COMP_SUBS = ['AKI', 'MAXI', 'TITAN', 'HIPER', 'MICO', 'MINI', 'TIA'];
  const COPIA_FAM = [{ id: 'ROSADO', label: 'Rosado (HIPER → MICO → MINI)', subs: ['HIPER', 'MICO', 'MINI'] }, { id: 'FAVORITA', label: 'Favorita (MAXI → AKI → TITAN)', subs: ['MAXI', 'AKI', 'TITAN'] }, { id: 'CORAL', label: 'Coral (CORAL ↔ CORALITO)', subs: ['CORAL', 'CORALITO'] }];
  const MODA_FAM = [['CORAL', 'CORALITO'], ['MAXI', 'AKI', 'TITAN'], ['HIPER', 'MICO', 'MINI']], HERM = {}; MODA_FAM.forEach((l) => l.forEach((s) => (HERM[s] = l.filter((x) => x !== s))));
  const U_ICONO = 0.10, U_CAMBIO = 0.20, U_GRIS1 = 0.30, U_GRIS2 = 2.00, MODA_MIN = 1, MODA_MAX = 59, ENVASE = { 207: 'NR', 269: 'LATA', 330: 'NR', 355: 'LATA', 473: 'LATA' };

  /* ---------- utilidades ---------- */
  const normSku = (s) => String(s == null ? '' : s).replace(/[?¿]/g, ' ').replace(/\.+\s*$/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
  const proper = (k) => String(k).toLowerCase().replace(/\b([a-záéíóúñ])/g, (m) => m.toUpperCase());
  const toNum = (v) => { if (v == null || v === '') return NaN; if (typeof v === 'number') return v; let t = String(v).replace(/[$\s]/g, ''); if (/,/.test(t) && !/\./.test(t)) t = t.replace(',', '.'); else t = t.replace(/,/g, ''); return parseFloat(t); };
  const cents = (x) => Math.round(x * 100), r2 = (x) => Math.round(x * 100) / 100, money = (v) => (v == null ? '—' : '$' + Number(v).toFixed(2)), mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
  const dmy = (iso) => (iso ? iso.slice(8) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '');
  const addDias = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const horaDe = (v) => { if (v instanceof Date) return String(v.getHours()).padStart(2, '0') + ':' + String(v.getMinutes()).padStart(2, '0'); if (typeof v === 'number') { const m = Math.round((v - Math.floor(v)) * 1440); return String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); } const m = String(v == null ? '' : v).match(/(\d{1,2}):(\d{2})/); return m ? m[1].padStart(2, '0') + ':' + m[2] : ''; };
  const subDe = (cadenaRaw, pdvRaw) => {
    const c = norm(cadenaRaw).toLowerCase(), p = norm(pdvRaw).toLowerCase(), has = (t, s) => t.includes(s);
    if (has(c, 'aki') || (has(c, 'favorita') && has(p, 'aki'))) return 'AKI'; if (has(c, 'maxi') || has(c, 'favorita')) return 'MAXI'; if (has(c, 'titan')) return 'TITAN'; if (has(c, 'atimasa')) return 'PRIMAX';
    if (has(c, 'santa maria') || has(c, 'santamaria')) return 'SANTA MARIA'; if (has(c, 'coralito')) return 'CORALITO'; if (has(c, 'coral')) return 'CORAL'; if (has(c, 'tia')) return 'TIA';
    if (has(c, 'mini') || (has(c, 'rosado') && has(p, 'mini'))) return 'MINI'; if (has(c, 'mico') || has(p, 'mico') || has(c, 'comisariato') || has(p, 'comisariato')) return 'MICO'; if (has(c, 'hiper') || has(c, 'rosado')) return 'HIPER'; return 'no vigente';
  };
  const marcaAuto = (k) => { const t = String(k).toLowerCase(); return /heineken|amstel|biela/.test(t) || /\bsol\b/.test(t) ? 'HNK' : t.includes('prima') ? 'MERC' : 'CN'; };
  CN.subDe = (cad, pdv) => { const s = subDe(cad, pdv); return GRUPO_DE[s] ? s : ''; }; CN.grupoDe = (cad, pdv) => GRUPO_DE[subDe(cad, pdv)] || '';
  let MARCAS = {}; const marcaDe = (k) => MARCAS[k] || marcaAuto(k);
  const formato = (k) => { const t = String(k).toUpperCase(), ml = t.match(/\b(\d{3})\b/), pk = t.match(/\bX\s*(\d{1,2})\b/); if (!ml || !pk) return null; const m = +ml[1], p = +pk[1], env = /\bLATA\b/.test(t) ? 'LATA' : /\bNR\b/.test(t) ? 'NR' : ENVASE[m] || ''; return { key: m + '|' + env + '|' + p, ml: m, pack: p, env, label: m + ' ml ' + (env === 'LATA' ? 'lata ' : env === 'NR' ? 'NR ' : '') + 'x' + p }; };

  /* ---------- cargas ---------- */
  const subir = async (tabla, filas, onConflict, say, etiqueta, tam = 1500) => {
    for (let i = 0; i < filas.length; i += tam) { say && say(`Guardando ${etiqueta}: ${Math.min(i + tam, filas.length).toLocaleString('es-EC')} de ${filas.length.toLocaleString('es-EC')}…`); const { error } = await CN.conReintento(() => sb.from(tabla).upsert(filas.slice(i, i + tam), { onConflict })); if (error) throw error; }
  };
  async function cargarPre(rows, orig, say) {
    const cols = orig.map((h) => ({ k: key(h), n: norm(h) })), precioCols = [], fotoCol = {};
    cols.forEach((c) => { const m = c.n.match(/^[¿?]?\s*QUE PRECIO TIENE\s+(.+)$/); if (m) precioCols.push({ k: c.k, sku: normSku(m[1]) }); else { const f = c.n.match(/^FOTO DE\s+(?:TIENE\s+)?(.+)$/); if (f) fotoCol[normSku(f[1])] = c.k; } });
    if (!precioCols.length) throw new Error('No encuentro columnas de precio («¿Que precio tiene …?»).');
    const fix = CN.mapaFechas(rows.map((r) => toISO(r.FECHAYHORADELAENCUESTA))), enc = {}, obs = []; let sinFecha = 0, desde = '9999', hasta = '';
    rows.forEach((r, i) => {
      const fecha = fix(toISO(r.FECHAYHORADELAENCUESTA)); if (!fecha) { sinFecha++; return; }
      const id = r.IDDELAENCUESTA != null && r.IDDELAENCUESTA !== '' ? String(r.IDDELAENCUESTA).replace(/\.0+$/, '') : 'F' + fecha + '-' + i, cadena = TXT(r.CADENA), pdv = TXT(r.PDV), sub = subDe(cadena, pdv);
      const nov = norm(r.EXISTIONOVEDADESENELPUNTO) === 'SI' ? (TXT(r.DESCRIBALASNOVEDADES).slice(0, 300) || 'Sí (sin descripción)') : '';
      let con = false;
      precioCols.forEach((c) => { const p = toNum(r[c.k]); if (!(p > 0) || p > 9999) return; con = true; const fk = fotoCol[c.sku]; obs.push({ fecha, id_enc: id, cadena, pdv, sub, sku_key: c.sku, precio: r2(p), fotos: fk && r[fk] ? TXT(r[fk]).slice(0, 1500) : null, novedad: nov || null }); });
      enc[id] = { id_enc: id, fecha, cadena, pdv, sub, empleado: ecmNorm(TXT(r.EMPLEADO)), hora: horaDe(r.FECHAYHORADELAENCUESTA), con_precio: con }; if (fecha < desde) desde = fecha; if (fecha > hasta) hasta = fecha;
    });
    const E = Object.values(enc).filter((e) => GRUPO_DE[e.sub]); if (!E.length) throw new Error('No encontré encuestas de Rosado, Favorita, Atimasa, Tía o Coral con fecha válida.');
    const okId = new Set(E.map((e) => e.id_enc)), omitidas = Object.keys(enc).length - E.length, obsOk = obs.filter((o) => okId.has(o.id_enc));
    await subir('precios_enc', E, 'id_enc', say, 'encuestas'); await subir('precios_obs', obsOk, 'id_enc,sku_key', say, 'precios', 2000);
    if (CN.prInvalidar) CN.prInvalidar();
    return { tp: 'pre', filas: rows.length, texto: `${E.length.toLocaleString('es-EC')} encuestas (${desde} → ${hasta}) · ${obsOk.length.toLocaleString('es-EC')} precios de ${precioCols.length} SKU · ${E.filter((e) => !e.con_precio).length} encuestas en blanco${omitidas ? ' · ' + omitidas.toLocaleString('es-EC') + ' encuestas de otras cadenas no se guardaron' : ''}${sinFecha ? ' · ' + sinFecha + ' filas sin fecha' : ''}` };
  }
  async function cargarPro(rows, say) {
    const fix = CN.mapaFechas(rows.map((r) => toISO(r.FECHA))), m = new Map(); let desc = 0;
    rows.forEach((r) => { const f = fix(toISO(r.FECHA)), sk = normSku(r.AHORA), p = toNum(r.PROMOCIONAL); if (!f || !sk || !(p > 0)) { desc++; return; } m.set(f + '|' + sk, { fecha: f, sku_key: sk, precio: r2(p) }); });
    const L = [...m.values()]; if (!L.length) throw new Error('El plan no trae filas válidas (FECHA, AHORA y PROMOCIONAL).');
    await subir('precios_promo', L, 'fecha,sku_key', say, 'plan promocional'); if (CN.prInvalidar) CN.prInvalidar();
    const fs = L.map((x) => x.fecha).sort();
    return { tp: 'pro', filas: rows.length, texto: `${L.length.toLocaleString('es-EC')} precios promocionales (${fs[0]} → ${fs[fs.length - 1]})${desc ? ' · ' + desc + ' filas omitidas' : ''}` };
  }
  async function cargarChk(rows, say) {
    const ts = (v) => { if (v == null || v === '') return 0; if (v instanceof Date) return Math.round(v.getTime() / 60000); if (typeof v === 'number') return Math.round(v * 1440); const d = new Date(String(v).replace(' ', 'T')); return isNaN(d) ? 0 : Math.round(d.getTime() / 60000); };
    const grupos = {}; let total = 0;
    rows.forEach((r) => {
      if (r.HORADEENTRADA == null || r.HORADEENTRADA === '') return; total++; const emp = ecmNorm(TXT(r.EMPLEADO)); if (!emp) return; const k = emp + '|' + TXT(r.PERFILDELPDV) + '|' + ts(r.HORADEENTRADA);
      const g = grupos[k] || (grupos[k] = { emp, cad: TXT(r.CADENA) || TXT(r.RED), pdv: TXT(r.PUNTODEVENTA).replace(/^"|"$/g, ''), ciudad: TXT(r.CIUDAD), ent: ts(r.HORADEENTRADA), hora: horaDe(r.HORADEENTRADA), ymd: toISO(r.FECHADELITINERARIO) || toISO(r.HORADEENTRADA), cerrado: false });
      if ((r.HORADESALIDA != null && r.HORADESALIDA !== '') || (r.CHECKOUTREGISTRADOEL != null && r.CHECKOUTREGISTRADOEL !== '')) g.cerrado = true;
    });
    const ult = {}; Object.values(grupos).forEach((x) => { if (!ult[x.emp] || x.ent > ult[x.emp].ent) ult[x.emp] = x; });
    const en = Object.values(ult).filter((x) => !x.cerrado).map((x) => ({ ecm: x.emp, cadena: x.cad, pdv: x.pdv, ciudad: x.ciudad, ymd: x.ymd || null, hora: x.hora, ent: x.ent, sub: subDe(x.cad, x.pdv) }));
    const { error: e0 } = await sb.from('precios_checkin').delete().neq('ecm', ''); if (e0) throw e0; await subir('precios_checkin', en, 'ecm', say, 'check-in');
    return { tp: 'chk', filas: rows.length, texto: `${Object.keys(ult).length} asesores en el reporte · ${en.length} están ahora en un local (entrada sin salida) · ${total} visitas leídas` };
  }
  CN.cargarPrecios = (tp, rows, orig, say) => (tp === 'pre' ? cargarPre(rows, orig, say) : tp === 'pro' ? cargarPro(rows, say) : cargarChk(rows, say));

  /* ---------- cálculo (moda, copias, plan, variaciones) ---------- */
  function modaOf(list, ref) {
    const freq = {}; let n = 0, lo = Infinity, hi = -Infinity;
    (list || []).forEach((x) => { if (!(x.p >= MODA_MIN && x.p <= MODA_MAX)) return; const c = cents(x.p); freq[c] = (freq[c] || 0) + x.n; n += x.n; if (x.p < lo) lo = x.p; if (x.p > hi) hi = x.p; });
    if (!n) return null; let best = null, bn = 0, tie = 0;
    Object.keys(freq).forEach((k) => { const kc = +k; if (freq[k] > bn) { best = kc; bn = freq[k]; tie = 1; } else if (freq[k] === bn) { tie++; const mej = ref != null ? Math.abs(kc - ref) < Math.abs(best - ref) || (Math.abs(kc - ref) === Math.abs(best - ref) && kc < best) : kc < best; if (mej) best = kc; } });
    return { v: best / 100, n, lo, hi, tie };
  }
  function modaHerm(sub, getL) {
    const md = modaOf(getL(sub)); if (!md || md.tie < 2) return md; const firmes = [], todas = [];
    (HERM[sub] || []).forEach((h) => { const m = modaOf(getL(h)); if (!m) return; todas.push(cents(m.v)); if (m.tie < 2) firmes.push(cents(m.v)); });
    const base = firmes.length ? firmes : todas; if (!base.length) return md; return modaOf(getL(sub), mean(base));
  }
  const bucketCelda = (rows) => { const o = {}; (rows || []).forEach((r) => { const k = r.sub + '|' + r.sku_key; (o[k] ||= []).push({ p: Number(r.precio), n: Number(r.n), pdvs: Number(r.pdvs) }); }); return o; };
  function calcular(D, copias) {
    const cur = bucketCelda(D.celdas), prv = bucketCelda(D.prev), sem = bucketCelda(D.sem), plan = D.plan, planPrev = D.planPrev;
    const fuentes = {}; COPIA_FAM.filter((f) => copias.includes(f.id)).forEach((f) => f.subs.forEach((s, i) => (fuentes[s] = f.subs.slice(i + 1).concat(f.subs.slice(0, i)))));
    const skus = new Set(); Object.keys(cur).forEach((k) => skus.add(k.split('|').slice(1).join('|'))); Object.keys(plan).forEach((k) => skus.add(k));
    const matriz = [], porSub = {}; SUBS.forEach((s) => (porSub[s] = { idx: [], deb: 0, enc: 0, saltos: 0, copias: 0, celdas: 0, pdvs: 0 }));
    const dispersion = [], outliers = [], promoDeb = [], promoEnc = []; let kDeb = 0, kEnc = 0;
    skus.forEach((sk) => {
      const c = {}, p = {}, w = {}, getC = (s) => cur[s + '|' + sk] || null, getP = (s) => prv[s + '|' + sk] || null, getW = (s) => sem[s + '|' + sk] || null;
      SUBS.forEach((s) => {
        const l = cur[s + '|' + sk]; if (l) { const md = modaHerm(s, getC); if (md) c[s] = { v: md.v, n: md.n, pdvs: l.reduce((a, x) => a + x.pdvs, 0), lo: md.lo, hi: md.hi, inh: 0 }; }
        if (prv[s + '|' + sk]) { const pm = modaHerm(s, getP); if (pm) p[s] = pm.v; } if (sem[s + '|' + sk]) { const wm = modaHerm(s, getW); if (wm) w[s] = wm.v; }
      });
      const c0 = { ...c }, p0 = { ...p };
      SUBS.forEach((dst) => { const cand = fuentes[dst] || []; if (!c0[dst]) for (const sr of cand) if (c0[sr]) { c[dst] = { ...c0[sr], inh: 1, from: sr }; break; } if (p0[dst] == null) for (const sr of cand) if (p0[sr] != null) { p[dst] = p0[sr]; break; } });
      const vals = SUBS.filter((s) => c[s]).map((s) => c[s].v), pv = SUBS.filter((s) => p[s] != null).map((s) => p[s]), prom = vals.length ? r2(mean(vals)) : null, promPrev = pv.length ? r2(mean(pv)) : null, pl = plan[sk] != null ? plan[sk] : null, plp = planPrev[sk] != null ? planPrev[sk] : null, m = marcaDe(sk);
      const decora = (cel, v, pvv, sub, esReal) => {
        if (pvv != null && Math.abs(cents(v) - cents(pvv)) >= U_CAMBIO * 100) { cel.r = 1; cel.pv = pvv; }
        if (esReal && pl != null) { const d = cents(v) - cents(pl); if (d >= U_ICONO * 100) cel.a = 1; else if (d <= -U_ICONO * 100) cel.a = -1; }
        if (esReal && m === 'CN' && prom != null) { const dd = Math.abs(v - prom); if (dd > U_GRIS2) cel.b = 2; else if (dd >= U_GRIS1 - 1e-9) cel.b = 1; }
      };
      const celdas = { PLAN: pl != null ? { v: pl } : null, PROM: prom != null ? { v: prom, n: vals.length } : null }; if (celdas.PLAN) decora(celdas.PLAN, pl, plp, 'PLAN', false); if (celdas.PROM) decora(celdas.PROM, prom, promPrev, 'PROM', false);
      SUBS.forEach((s) => {
        const x = c[s]; if (!x) { celdas[s] = null; return; } decora(x, x.v, p[s], s, true); if (p[s] != null) x.hp = 1; if (w[s] != null && !x.inh && Math.abs(cents(x.v) - cents(w[s])) >= U_CAMBIO * 100) x.pw = w[s]; celdas[s] = x; const ps = porSub[s]; ps.celdas++;
        if (x.a === -1) { ps.deb++; kDeb++; promoDeb.push({ s: proper(sk), sub: s, v: x.v, plan: pl, d: r2(x.v - pl) }); } if (x.a === 1) { ps.enc++; kEnc++; promoEnc.push({ s: proper(sk), sub: s, v: x.v, plan: pl, d: r2(x.v - pl) }); }
        if (x.r) ps.saltos++; if (x.inh) ps.copias++; if (!x.inh && prom != null) ps.idx.push((x.v / prom - 1) * 100);
        if (!x.inh && prom != null && Math.abs(x.v - prom) > U_GRIS2) outliers.push({ s: proper(sk), sub: s, v: x.v, prom, d: r2(x.v - prom) });
      });
      const propios = SUBS.filter((s) => c[s] && !c[s].inh);
      if (propios.length >= 3) { let lo = propios[0], hi = propios[0]; propios.forEach((s) => { if (c[s].v < c[lo].v) lo = s; if (c[s].v > c[hi].v) hi = s; }); dispersion.push({ s: proper(sk), m, lo, loV: c[lo].v, hi, hiV: c[hi].v, spread: r2(c[hi].v - c[lo].v), n: propios.length }); }
      matriz.push({ k: sk, s: proper(sk), m, c: celdas });
    });
    const ord = { CN: 0, HNK: 1, MERC: 2 }; matriz.sort((a, b) => ((ord[a.m] ?? 9) - (ord[b.m] ?? 9)) || a.s.localeCompare(b.s));
    dispersion.sort((a, b) => b.spread - a.spread); outliers.sort((a, b) => Math.abs(b.d) - Math.abs(a.d)); promoDeb.sort((a, b) => a.d - b.d); promoEnc.sort((a, b) => b.d - a.d);
    const tabla = SUBS.map((s) => { const ps = porSub[s]; return { sub: s, idx: ps.idx.length ? r2(mean(ps.idx)) : null, skus: ps.idx.length, deb: ps.deb, enc: ps.enc, saltos: ps.saltos, copias: ps.copias }; });
    return { matriz, tabla, dispersion, outliers, promoDeb, promoEnc, kDeb, kEnc, nPlan: matriz.filter((m) => m.c.PLAN).length };
  }

  /* ---------- datos ---------- */
  const PR = { tab: 'ctrl', fechas: [], fecha: '', copias: ['ROSADO'], marca: '', q: '', soloAl: false, desde: '', hasta: '', D: null, K: null, AUD: null, ana: null };
  const cache = {}; CN.prInvalidar = () => { Object.keys(cache).forEach((k) => delete cache[k]); PR.D = PR.K = PR.AUD = PR.ana = null; };
  const rpc = async (n, a) => { const { data, error } = await sb.rpc(n, a); if (error) throw error; return data || []; };
  async function cargarFechas() {
    PR.fechas = (await rpc('precios_fechas')).map((x) => x.fecha); const m = (await sb.from('precios_marcas').select('*')).data || []; MARCAS = Object.fromEntries(m.map((x) => [x.sku_key, x.marca]));
    if (!PR.fecha || !PR.fechas.includes(PR.fecha)) PR.fecha = PR.fechas[PR.fechas.length - 1] || '';
  }
  async function cargarDia() {
    const f = PR.fecha; if (cache[f]) return (PR.D = cache[f]); const i = PR.fechas.indexOf(f), prev = i > 0 ? PR.fechas[i - 1] : null, w = addDias(f, -7), sem = PR.fechas.includes(w) ? w : null;
    const promo = async (d) => { if (!d) return {}; const { data, error } = await sb.from('precios_promo').select('sku_key,precio').eq('fecha', d); if (error) throw error; const o = {}; (data || []).forEach((x) => { const p = Number(x.precio); if (!(o[x.sku_key] > p)) o[x.sku_key] = p; }); return o; };
    const [celdas, pc, sc, plan, planPrev] = await Promise.all([rpc('precios_celdas', { p_fecha: f }), prev ? rpc('precios_celdas', { p_fecha: prev }) : [], sem ? rpc('precios_celdas', { p_fecha: sem }) : [], promo(f), promo(prev)]);
    const { data: enc } = await sb.from('precios_enc').select('id_enc,pdv,sub,con_precio').eq('fecha', f).limit(20000);
    return (cache[f] = PR.D = { fecha: f, prev, sem, celdas, prev: pc, sem: sc, plan, planPrev, prevFecha: prev, semFecha: sem, enc: enc || [] });
  }

  /* ---------- pantallas ---------- */
  const TABS = [['ctrl', 'Control de precios'], ['ana', 'Análisis del día'], ['comp', 'Competencia'], ['aud', 'Auditoría'], ['sku', 'SKU y marcas'], ['ase', 'Asesores']];
  const barra = () => `<div class="fbar"><label>Día<select id="pr_f">${PR.fechas.slice().reverse().map((f) => `<option value="${f}" ${f === PR.fecha ? 'selected' : ''}>${dmy(f)}</option>`).join('')}</select></label><button type="button" id="pr_p" title="Día anterior con relevo">‹</button><button type="button" id="pr_n" title="Día siguiente con relevo">›</button>
    <label>Marca<select id="pr_m"><option value="">Todas</option>${['CN', 'HNK', 'MERC'].map((x) => `<option ${PR.marca === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label><label>Buscar SKU<input id="pr_q" value="${esc(PR.q)}" placeholder="Ej. CLUB 330"></label>
    <span class="note">Replicar precios cuando falta relevo:</span>${COPIA_FAM.map((f) => `<label class="mso" style="flex-direction:row"><input type="checkbox" data-cp="${f.id}" ${PR.copias.includes(f.id) ? 'checked' : ''}> ${esc(f.label)}</label>`).join('')}</div>`;
  const celdaHTML = (c, ref) => {
    if (!c) return '<td class="pc-na">—</td>';
    const cl = ['pc', c.a === 1 ? 'pc-up' : c.a === -1 ? 'pc-dn' : '', c.b ? 'pc-b' + c.b : '', c.r ? 'pc-r' : '', c.inh ? 'pc-inh' : ''].filter(Boolean).join(' ');
    const tip = [c.n != null ? `${c.n} precios${c.pdvs ? ' · ' + c.pdvs + ' locales' : ''}` : '', c.lo != null && c.lo !== c.hi ? `rango ${money(c.lo)}–${money(c.hi)}` : '', c.pv != null ? `relevo anterior ${money(c.pv)}` : '', c.pw != null ? `hace 7 días ${money(c.pw)}` : '', c.inh ? `copiado de ${c.from}` : ''].filter(Boolean).join(' · ');
    return `<td class="${cl}" title="${esc(tip)}">${money(c.v)}${c.a === 1 ? ' ▲' : c.a === -1 ? ' ▼' : ''}</td>`;
  };
  function filtraMatriz(K) { const q = norm(PR.q); return K.matriz.filter((m) => (!PR.marca || m.m === PR.marca) && (!q || norm(m.s).includes(q)) && (!PR.soloAl || Object.values(m.c).some((c) => c && (c.a || c.r || c.b === 2)))); }
  function vistaCtrl(D, K) {
    const L = filtraMatriz(K), npdv = new Set(D.enc.map((e) => e.pdv)).size, nprec = D.celdas.reduce((a, x) => a + Number(x.n), 0);
    const head1 = `<tr><th rowspan="2">SKU</th><th rowspan="2">Marca</th><th colspan="2">Referencia</th>${LAYOUT.map(([g, s]) => `<th colspan="${s.length}">${g}</th>`).join('')}</tr>`, head2 = `<tr><th>Plan promo.</th><th>Promedio</th>${LAYOUT.map(([, s]) => s.map((x) => `<th>${x}</th>`).join('')).join('')}</tr>`;
    return `<div class="kp">${VZ.kpi('Día', dmy(D.fecha), D.prevFecha ? 'anterior: ' + dmy(D.prevFecha) : 'sin día anterior')}${VZ.kpi('Locales encuestados', VZ.n(npdv), VZ.n(D.enc.length) + ' encuestas')}${VZ.kpi('Precios', VZ.n(nprec), VZ.n(K.matriz.length) + ' SKU')}${VZ.kpi('Bajo el plan', VZ.n(K.kDeb), K.nPlan + ' SKU con plan', K.kDeb ? 'var(--cP)' : '')}${VZ.kpi('Sobre el plan', VZ.n(K.kEnc), 'tolerancia ' + Math.round(U_ICONO * 100) + ' ctvs', K.kEnc ? 'var(--cF)' : '')}</div>
      <div class="card" style="padding:0"><div class="bar" style="padding:10px 14px;margin:0"><b>Control de precios por canal</b><span class="note">Precio más frecuente (moda) de cada SKU por cadena. ${L.length} SKU.</span><label class="mso" style="flex-direction:row"><input type="checkbox" id="pr_al" ${PR.soloAl ? 'checked' : ''}> Solo con alertas</label><button type="button" id="pr_xl">⬇ Excel</button></div>
      <div class="tws" style="max-height:70vh"><table class="pm"><thead>${head1}${head2}</thead><tbody>${L.map((m) => `<tr><td class="pm-s">${esc(m.s)}</td><td><span class="chip">${m.m}</span></td>${celdaHTML(m.c.PLAN)}${celdaHTML(m.c.PROM)}${SUBS_ORD.map((s) => celdaHTML(m.c[s])).join('')}</tr>`).join('') || '<tr><td colspan="16" class="note">Sin SKU con estos filtros.</td></tr>'}</tbody></table></div>
      <p class="note" style="padding:8px 14px"><span class="pc-r">rojo</span> cambió ≥ ${Math.round(U_CAMBIO * 100)} ctvs contra el relevo anterior · ▲▼ ≥ ${Math.round(U_ICONO * 100)} ctvs sobre/bajo el plan · celeste: se aleja del promedio (CN) · <span class="pc-inh">cursiva</span>: copiado de otra cadena de su familia.</p></div>`;
  }
  const SUBS_ORD = LAYOUT.flatMap(([, s]) => s);
  const T = (cols, rows, name) => VZ.table(cols, rows, { name, max: 100 });
  async function vistaAna(D, K) {
    if (!PR.ana || PR.ana.f !== D.fecha) { const [s, fuera, nov] = await Promise.all([rpc('precios_saltos', { p_fecha: D.fecha }), sb.from('precios_obs').select('sub,pdv,sku_key,precio,fotos').eq('fecha', D.fecha).or(`precio.lt.${MODA_MIN},precio.gt.${MODA_MAX}`).order('precio').limit(300), sb.from('precios_obs').select('id_enc,pdv,sub,novedad').eq('fecha', D.fecha).not('novedad', 'is', null).limit(1500)]);
      const nv = {}; (nov.data || []).forEach((x) => (nv[x.id_enc] ||= x)); PR.ana = { f: D.fecha, s, fuera: fuera.data || [], nov: Object.values(nv) }; }
    const A = PR.ana, tb = K.tabla.filter((t) => t.idx != null), cara = tb.slice().sort((a, b) => b.idx - a.idx)[0], barata = tb.slice().sort((a, b) => a.idx - b.idx)[0], sg = (x) => (x > 0 ? '+' : '') + x.toFixed(1);
    const res = [`Se registraron ${VZ.n(D.celdas.reduce((a, x) => a + Number(x.n), 0))} precios en ${VZ.n(new Set(D.enc.map((e) => e.pdv)).size)} locales (${dmy(D.fecha)}).`];
    if (cara && barata && cara.sub !== barata.sub) res.push(`Frente al promedio de cada SKU, la cadena más cara es ${cara.sub} (${sg(cara.idx)} %) y la más barata es ${barata.sub} (${sg(barata.idx)} %).`);
    res.push(K.nPlan ? `Contra el plan promocional (${K.nPlan} SKU con plan): ${K.kDeb} precios por debajo y ${K.kEnc} por encima, con tolerancia de ${Math.round(U_ICONO * 100)} ctvs.` : 'No hay plan promocional cargado para este día, por eso no se calculan desviaciones.');
    res.push(`Alertas: ${VZ.n(A.s.total || 0)} saltos de más de 20 ctvs frente al relevo anterior del mismo local, ${K.outliers.length} precios a más de $2 del promedio y ${A.fuera.length} fuera del rango $${MODA_MIN}–$${MODA_MAX}.`);
    if (K.dispersion[0]) { const d = K.dispersion[0]; res.push(`Mayor dispersión entre cadenas: ${d.s} (${money(d.loV)} en ${d.lo} vs ${money(d.hiV)} en ${d.hi}).`); }
    const bk = A.s.buckets || {};
    return `<div class="card"><h3>Resumen del día</h3><ul>${res.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
      <div class="card"><h3>Índice de precio por cadena (frente al promedio de cada SKU)</h3>${T([{ h: 'Cadena' }, { h: 'Índice %', n: 1 }, { h: 'SKU', n: 1 }, { h: 'Bajo plan', n: 1 }, { h: 'Sobre plan', n: 1 }, { h: 'Cambios ≥20 ctvs', n: 1 }, { h: 'Copias', n: 1 }], K.tabla.map((t) => ({ c: [t.sub, t.idx == null ? '—' : sg(t.idx), VZ.n(t.skus), t.deb, t.enc, t.saltos, t.copias], s: [t.sub, t.idx ?? -999, t.skus, t.deb, t.enc, t.saltos, t.copias] })), 'precios_indice')}</div>
      <div class="g2"><div class="card"><h3>Bajo el plan promocional</h3>${T([{ h: 'SKU' }, { h: 'Cadena' }, { h: 'Precio', n: 1 }, { h: 'Plan', n: 1 }, { h: 'Dif.', n: 1 }], K.promoDeb.map((x) => ({ c: [esc(x.s), x.sub, money(x.v), money(x.plan), money(x.d)], s: [x.s, x.sub, x.v, x.plan, x.d] })), 'precios_bajo_plan')}</div>
      <div class="card"><h3>Sobre el plan promocional</h3>${T([{ h: 'SKU' }, { h: 'Cadena' }, { h: 'Precio', n: 1 }, { h: 'Plan', n: 1 }, { h: 'Dif.', n: 1 }], K.promoEnc.map((x) => ({ c: [esc(x.s), x.sub, money(x.v), money(x.plan), '+' + money(x.d)], s: [x.s, x.sub, x.v, x.plan, x.d] })), 'precios_sobre_plan')}</div></div>
      <div class="card"><h3>Saltos de precio · mismo local contra su relevo anterior (${VZ.n(A.s.total || 0)})</h3><p class="note">${Object.entries(bk).map(([k, v]) => `${k}: ${v}`).join(' · ') || 'Sin variaciones.'}</p>${T([{ h: 'Local' }, { h: 'Cadena' }, { h: 'SKU' }, { h: 'Hoy', n: 1 }, { h: 'Antes', n: 1 }, { h: 'Relevo anterior' }, { h: 'Dif. ctvs', n: 1 }, { h: 'Foto' }], (A.s.rows || []).map((x) => { const f = String(x.fotos || '').match(/https?:\/\/\S+/); return { c: [esc(x.pdv), x.sub, esc(proper(x.sku_key)), money(x.hoy), money(x.ant), dmy(x.fant), x.dc, f ? `<a href="${safeUrl(f[0])}" target="_blank" rel="noopener noreferrer">Ver</a>` : ''], s: [x.pdv, x.sub, x.sku_key, x.hoy, x.ant, x.fant, x.dc, ''] }; }), 'precios_saltos')}</div>
      <div class="g2"><div class="card"><h3>Precios a más de $2 del promedio</h3>${T([{ h: 'SKU' }, { h: 'Cadena' }, { h: 'Precio', n: 1 }, { h: 'Promedio', n: 1 }, { h: 'Dif.', n: 1 }], K.outliers.map((x) => ({ c: [esc(x.s), x.sub, money(x.v), money(x.prom), (x.d > 0 ? '+' : '') + money(x.d)], s: [x.s, x.sub, x.v, x.prom, x.d] })), 'precios_lejos_promedio')}</div>
      <div class="card"><h3>Mayor dispersión entre cadenas</h3>${T([{ h: 'SKU' }, { h: 'Más barato' }, { h: 'Más caro' }, { h: 'Diferencia', n: 1 }], K.dispersion.map((x) => ({ c: [esc(x.s), `${x.lo} ${money(x.loV)}`, `${x.hi} ${money(x.hiV)}`, money(x.spread)], s: [x.s, x.loV, x.hiV, x.spread] })), 'precios_dispersion')}</div></div>
      <div class="g2"><div class="card"><h3>Precios fuera de $${MODA_MIN}–$${MODA_MAX} (${A.fuera.length})</h3>${T([{ h: 'SKU' }, { h: 'Local' }, { h: 'Cadena' }, { h: 'Precio', n: 1 }], A.fuera.map((x) => ({ c: [esc(proper(x.sku_key)), esc(x.pdv), x.sub, money(x.precio)], s: [x.sku_key, x.pdv, x.sub, x.precio] })), 'precios_fuera_rango')}</div>
      <div class="card"><h3>Novedades en el punto (${A.nov.length})</h3>${T([{ h: 'Local' }, { h: 'Cadena' }, { h: 'Novedad' }], A.nov.map((x) => ({ c: [esc(x.pdv), x.sub, esc(x.novedad)], s: [x.pdv, x.sub, x.novedad] })), 'precios_novedades')}</div></div>`;
  }
  function vistaComp(D, K) {
    const byK = Object.fromEntries(K.matriz.map((m) => [m.k, m])), fm = {};
    K.matriz.forEach((m) => { const f = formato(m.k); if (!f) return; (fm[f.key] ||= { f, ks: [] }).ks.push(m); });
    const G = Object.values(fm).sort((a, b) => a.f.ml - b.f.ml || a.f.pack - b.f.pack).filter((g) => g.ks.some((m) => m.m === 'CN') && g.ks.some((m) => m.m !== 'CN'));
    if (!G.length) return '<div class="card"><p class="note">No hay grupos para comparar: se necesitan SKU de CN y de la competencia con el mismo formato (ml, envase y pack) en el nombre.</p></div>';
    return `<p class="note">Cada grupo reúne los SKU del mismo formato (ml, envase y pack). «Competencia» es el promedio de los SKU que no son CN; «CN vs competencia» es la diferencia de cada SKU de CN contra ese promedio.</p>` + G.map((g) => {
      const ord = g.ks.slice().sort((a, b) => (a.m === 'CN') - (b.m === 'CN') || a.s.localeCompare(b.s)), comp = ord.filter((m) => m.m !== 'CN'), cn = ord.filter((m) => m.m === 'CN');
      const ref = (s) => { const v = comp.map((m) => m.c[s]).filter(Boolean).map((c) => c.v); return v.length ? { a: r2(mean(v)), mn: Math.min(...v), mx: Math.max(...v) } : null; };
      const fila = (m) => `<tr><td class="pm-s">${esc(m.s)}</td><td><span class="chip">${m.m}</span></td>${COMP_SUBS.map((s) => celdaHTML(m.c[s])).join('')}</tr>`;
      const rf = COMP_SUBS.map((s) => ref(s));
      return `<div class="card" style="padding:0"><div class="bar" style="padding:10px 14px;margin:0"><b>Formato ${esc(g.f.label)}</b><span class="note">${cn.length} SKU CN · ${comp.length} de competencia</span></div><div class="tws"><table class="pm"><thead><tr><th>SKU</th><th>Marca</th>${COMP_SUBS.map((s) => `<th>${s}</th>`).join('')}</tr></thead><tbody>${ord.map(fila).join('')}
        <tr class="pm-ref"><td class="pm-s">Competencia (promedio)</td><td></td>${rf.map((r) => `<td class="pc" title="${r ? 'mín. ' + money(r.mn) + ' · máx. ' + money(r.mx) : ''}">${r ? money(r.a) : '—'}</td>`).join('')}</tr>
        ${cn.map((m) => `<tr class="pm-ref"><td class="pm-s">CN vs competencia · ${esc(m.s)}</td><td></td>${COMP_SUBS.map((s, i) => { const c = m.c[s], r = rf[i]; if (!c || !r) return '<td class="pc-na">—</td>'; const d = r2(c.v - r.a); return `<td class="pc ${d > 0 ? 'pc-up' : d < 0 ? 'pc-dn' : ''}">${d > 0 ? '+' : ''}${money(d)}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div></div>`;
    }).join('');
  }
  async function vistaAud() {
    if (!PR.desde) PR.desde = PR.hasta = PR.fecha; const A = (PR.AUD && PR.AUD.k === PR.desde + PR.hasta) ? PR.AUD : (PR.AUD = { k: PR.desde + PR.hasta, ...(await rpc('precios_aud', { p_desde: PR.desde, p_hasta: PR.hasta })) });
    const ecmN = (e) => { const x = (S.ecmMap || []).find((y) => ecmNorm(y.ecm) === ecmNorm(e)); return x ? [x.nombre || '', x.supervisor || ''] : ['', '']; }, tt = A.total || {};
    const vac = A.vacias || [], vsub = {}; vac.forEach((v) => (vsub[v.sub] = (vsub[v.sub] || 0) + 1));
    return `<div class="fbar"><label>Desde<input type="date" id="pa_d" value="${PR.desde}"></label><label>Hasta<input type="date" id="pa_h" value="${PR.hasta}"></label><span class="note">${dmy(PR.desde)} → ${dmy(PR.hasta)}</span></div>
      <div class="kp">${VZ.kpi('Encuestas', VZ.n(tt.enc), '')}${VZ.kpi('Locales', VZ.n(tt.pdv), '')}${VZ.kpi('Precios', VZ.n(tt.precios), '')}${VZ.kpi('Precios sin foto', VZ.n((A.sin_foto || []).length), 'por recuperar', 'var(--cF)')}${VZ.kpi('Encuestas en blanco', VZ.n(vac.length), 'sin ningún precio', vac.length ? 'var(--cP)' : '')}</div>
      <div class="card"><h3>Encuestas por cadena</h3>${T([{ h: 'Cadena' }, { h: 'Encuestas', n: 1 }, { h: 'Locales', n: 1 }, { h: 'Precios', n: 1 }, { h: 'Sin foto', n: 1 }, { h: 'En blanco', n: 1 }], (A.subs || []).map((x) => ({ c: [x.sub, VZ.n(x.enc), VZ.n(x.pdv), VZ.n(x.precios), VZ.n(x.sin_foto), vsub[x.sub] || 0], s: [x.sub, x.enc, x.pdv, x.precios, x.sin_foto, vsub[x.sub] || 0] })), 'precios_auditoria')}</div>
      <div class="card"><h3>Precios por recuperar (sin foto)</h3><p class="note">Un precio se pide solo si ninguna encuesta que lo reportó trae foto; se lista la más reciente.</p>${T([{ h: 'Cadena' }, { h: 'Local' }, { h: 'SKU' }, { h: 'Precio', n: 1 }, { h: 'Día' }, { h: 'Encuestas', n: 1 }], (A.sin_foto || []).map((x) => ({ c: [x.sub, esc(x.pdv), esc(proper(x.sku_key)), money(x.precio), dmy(x.fecha), x.n], s: [x.sub, x.pdv, x.sku_key, x.precio, x.fecha, x.n] })), 'precios_sin_foto')}</div>
      <div class="card"><h3>Encuestas en blanco · local y encuestador</h3>${T([{ h: 'Día' }, { h: 'Cadena' }, { h: 'Local' }, { h: 'Encuestador' }, { h: 'Nombre' }, { h: 'Supervisor' }, { h: 'Hora' }], vac.map((v) => { const [nm, sp] = ecmN(v.empleado); return { c: [dmy(v.fecha), v.sub, esc(v.pdv), esc(v.empleado || ''), esc(nm), esc(sp), v.hora || ''], s: [v.fecha, v.sub, v.pdv, v.empleado, nm, sp, v.hora] }; }), 'precios_en_blanco')}</div>`;
  }
  async function vistaSku(D, K) {
    const marcas = ['CN', 'HNK', 'MERC'], can = CN.puede('catalogo') || S.me.rol === 'admin', L = K.matriz.filter((m) => !norm(PR.q) || norm(m.s).includes(norm(PR.q)));
    return `<div class="card"><h3>SKU y marcas</h3><p class="note">La marca se asigna sola por el nombre (Heineken, Amstel, Biela, Sol → HNK; Prima → MERC; el resto CN). Puedes corregirla aquí${can ? '' : ' (solo quien edita el catálogo)'}; también puedes escribir otra marca de competencia.</p>
      ${T([{ h: 'SKU' }, { h: 'Marca automática' }, { h: 'Marca' }], L.map((m) => ({ c: [esc(m.s), marcaAuto(m.k), `<select data-mk="${esc(m.k)}" ${can ? '' : 'disabled'}>${[...new Set([...marcas, ...Object.values(MARCAS), marcaDe(m.k)])].map((x) => `<option ${x === marcaDe(m.k) ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>`], s: [m.s, marcaAuto(m.k), marcaDe(m.k)] })), 'precios_sku_marcas')}</div>`;
  }
  async function vistaAse() {
    const { data: chk } = await sb.from('precios_checkin').select('*').order('ent'), { data: enc } = await sb.from('precios_enc').select('id_enc,empleado,sub,con_precio,hora').eq('fecha', PR.fecha).limit(20000);
    const E = {}; (S.ecmMap || []).forEach((e) => (E[ecmNorm(e.ecm)] = e)); const por = {}; (enc || []).forEach((x) => { const k = ecmNorm(x.empleado); if (!k) return; const o = (por[k] ||= { n: 0, blanco: 0 }); o.n++; if (!x.con_precio) o.blanco++; });
    const wa = (e) => { let t = String((E[e] || {}).telefono || '').replace(/\D/g, ''); if (t.startsWith('0')) t = '593' + t.slice(1); return t ? `<a href="https://wa.me/${t}" target="_blank" rel="noopener noreferrer">💬</a>` : ''; };
    const ahora = Date.now() / 60000;
    const act = (S.ecmMap || []).filter((e) => e.activo !== false), sinEnc = act.filter((e) => !por[ecmNorm(e.ecm)]);
    return `<div class="card"><h3>Asesores en local ahora · ${(chk || []).length}</h3><p class="note">Del último reporte de check-in: asesores cuya última entrada no tiene salida, cruzados con el equipo ECM (nombre, supervisor y teléfono).</p>${T([{ h: 'ECM' }, { h: 'Nombre' }, { h: 'Supervisor' }, { h: 'Cadena' }, { h: 'Local' }, { h: 'Ciudad' }, { h: 'Entrada' }, { h: 'Tiempo' }, { h: '' }], (chk || []).map((x) => { const e = E[x.ecm] || {}, min = Math.max(0, Math.round(ahora - Number(x.ent))); return { c: [x.ecm, esc(e.nombre || '—'), esc(e.supervisor || '—'), x.sub || esc(x.cadena || ''), esc(x.pdv || ''), esc(x.ciudad || ''), x.hora || '', min > 0 && min < 1440 ? Math.floor(min / 60) + ' h ' + (min % 60) + ' min' : '', wa(x.ecm)], s: [x.ecm, e.nombre || '', e.supervisor || '', x.sub, x.pdv, x.ciudad, x.hora, x.ent, ''] }; }), 'precios_en_local')}</div>
      <div class="card"><h3>Encuestas de precios por ECM · ${dmy(PR.fecha)}</h3>${T([{ h: 'ECM' }, { h: 'Nombre' }, { h: 'Supervisor' }, { h: 'Encuestas', n: 1 }, { h: 'En blanco', n: 1 }], Object.entries(por).sort((a, b) => b[1].n - a[1].n).map(([k, o]) => { const e = E[k] || {}; return { c: [k, esc(e.nombre || '—'), esc(e.supervisor || '—'), o.n, o.blanco], s: [k, e.nombre || '', e.supervisor || '', o.n, o.blanco] }; }), 'precios_por_ecm')}</div>
      <div class="card"><h3>ECM activos sin encuesta de precios ese día · ${sinEnc.length}</h3>${T([{ h: 'ECM' }, { h: 'Nombre' }, { h: 'Supervisor' }, { h: '' }], sinEnc.map((e) => ({ c: [e.ecm, esc(e.nombre || '—'), esc(e.supervisor || '—'), wa(ecmNorm(e.ecm))], s: [e.ecm, e.nombre || '', e.supervisor || '', ''] })), 'precios_ecm_sin_encuesta')}</div>`;
  }
  function excelMatriz(K) {
    const head = ['SKU', 'Marca', 'Plan promocional', 'Promedio', ...SUBS_ORD], rows = filtraMatriz(K).map((m) => [m.s, m.m, m.c.PLAN ? m.c.PLAN.v : '', m.c.PROM ? m.c.PROM.v : '', ...SUBS_ORD.map((s) => (m.c[s] ? m.c[s].v : ''))]);
    const ws = XLSX.utils.aoa_to_sheet([head, ...rows]), wb = XLSX.utils.book_new(); ws['!cols'] = head.map((h, i) => ({ wch: i === 0 ? 38 : 13 })); XLSX.utils.book_append_sheet(wb, ws, 'Control de precios'); XLSX.writeFile(wb, `control_precios_${PR.fecha}.xlsx`);
  }

  VIEWS.precios = async function () {
    if (CN.pendingTab && CN.pendingTab[0] === 'precios') { PR.tab = CN.pendingTab[1]; CN.pendingTab = null; }
    CN.sub.precios = { tabs: () => TABS.filter(([k]) => CN.tabOk('precios', k)), cur: () => PR.tab, set: (k) => { PR.tab = k; draw().catch(fail); } };
    const m = $('#main'); m.innerHTML = '<p class="note">Cargando…</p>'; await cargarFechas();
    if (!PR.fechas.length) { m.innerHTML = '<div class="card"><h3>Aún no hay precios cargados</h3><p>El administrador sube el Excel de precios del mes (y, si lo hay, el plan promocional y el reporte de check-in) en <b>Cargar bases</b>. Se reconocen solos por sus encabezados.</p></div>'; return; }
    if (!m._pr) { m._pr = 1; m.addEventListener('change', onChange); m.addEventListener('click', onClick); m.addEventListener('input', (e) => { if (e.target.id === 'pr_q') { PR.q = e.target.value; clearTimeout(PR.t); PR.t = setTimeout(() => { draw(true).catch(fail); }, 300); } }); }
    await draw();
  };
  async function draw(soloTabla) {
    const m = $('#main'); if (!PR.fechas.length) return; const D = await cargarDia(); if (!PR.K || PR.K.f !== D.fecha + PR.copias.join()) PR.K = { f: D.fecha + PR.copias.join(), ...calcular(D, PR.copias) };
    const K = PR.K; let cuerpo = '';
    if (PR.tab === 'ctrl') cuerpo = vistaCtrl(D, K); else if (PR.tab === 'ana') cuerpo = await vistaAna(D, K); else if (PR.tab === 'comp') cuerpo = vistaComp(D, K); else if (PR.tab === 'aud') cuerpo = await vistaAud(); else if (PR.tab === 'sku') cuerpo = await vistaSku(D, K); else cuerpo = await vistaAse();
    const foco = soloTabla && document.activeElement && document.activeElement.id === 'pr_q'; m.innerHTML = (PR.tab === 'aud' ? '' : barra()) + cuerpo;
    if (foco) { const q = $('#pr_q'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }
  }
  function onChange(e) {
    const t = e.target; if (!$('#main').contains(t) || PR.tab == null) return;
    if (t.id === 'pr_f') { PR.fecha = t.value; PR.desde = PR.hasta = ''; PR.AUD = null; } else if (t.id === 'pr_m') PR.marca = t.value; else if (t.id === 'pr_al') PR.soloAl = t.checked;
    else if (t.dataset.cp) { PR.copias = [...document.querySelectorAll('[data-cp]')].filter((x) => x.checked).map((x) => x.dataset.cp); }
    else if (t.id === 'pa_d' || t.id === 'pa_h') { PR.desde = $('#pa_d').value; PR.hasta = $('#pa_h').value; if (PR.desde > PR.hasta) PR.hasta = PR.desde; PR.AUD = null; }
    else if (t.dataset.mk) { const marca = t.value.trim().toUpperCase(); sb.from('precios_marcas').upsert({ sku_key: t.dataset.mk, marca }, { onConflict: 'sku_key' }).then(({ error }) => { if (error) return fail(error); MARCAS[t.dataset.mk] = marca; PR.K = null; toast('Marca guardada'); draw().catch(fail); }); return; }
    else return; draw().catch(fail);
  }
  function onClick(e) {
    const b = e.target.closest('#pr_p, #pr_n, #pr_xl'); if (!b) return; if (b.id === 'pr_xl') return excelMatriz(PR.K);
    const i = PR.fechas.indexOf(PR.fecha), j = b.id === 'pr_p' ? i - 1 : i + 1; if (j < 0 || j >= PR.fechas.length) return toast('No hay más días con relevo.'); PR.fecha = PR.fechas[j]; PR.desde = PR.hasta = ''; PR.AUD = null; draw().catch(fail);
  }
})();
