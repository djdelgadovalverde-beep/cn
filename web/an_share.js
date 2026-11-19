'use strict';
/* SOS (share de percha) y SOE (share de espacios): resumen, evolución, grupos, marcas, productos, PDV, alertas, análisis y edición. */
(function () {
  const { n: fN, p: f1, pc, kpi, hbar, stack, line, vstack, heat, table, tabs, legend, COL } = VZ;
  const GRP = ['CN', 'HNK', 'MERC', 'OTROS'], GC = { CN: 'var(--s1)', HNK: 'var(--s2)', MERC: 'var(--s3)', OTROS: 'var(--s4)' }, ESP = ['RUMA', 'BANDEJA FRÍO', 'BANDEJA SECO'];
  const ymd = (d) => d.toISOString().slice(0, 10);
  const add = (d, n) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return ymd(t); };
  const wl = (w) => w.slice(8) + '/' + w.slice(5, 7);
  const ST = { from: '', to: '', reg: [], cad: [], sup: [], ecm: [], tab: 'sem', dim: 'supervisor', sem: '', q: '', dp: 0 };
  let OPTS = null; const CACHE = {};
  const metaS = () => Number(S.cfg.meta_sos || 0.8), metaE = () => Number(S.cfg.meta_soe || 0.8);

  /* ---------- datos (agregados en el servidor) ---------- */
  async function rpcPar(args) {
    const key = JSON.stringify(args); if (CACHE[key]) return CACHE[key];
    const first = await sb.rpc('share_agg', args, { count: 'exact' }).range(0, 999); if (first.error) throw first.error;
    let out = first.data || []; const total = first.count || out.length, pages = []; for (let f = 1000; f < total; f += 1000) pages.push(f);
    for (const g of CN.chunks(pages, 6)) (await Promise.all(g.map((f) => sb.rpc('share_agg', args, {}).range(f, f + 999)))).forEach((r) => { if (r.error) throw r.error; out = out.concat(r.data); });
    return (CACHE[key] = out);
  }
  const arr = (x, up) => (x.length ? (up ? x.map((v) => String(v).toUpperCase()) : x) : null);
  const agg = (dim, o = {}) => rpcPar({ p_desde: o.from || ST.from, p_hasta: o.to || ST.to, p_dim: dim, p_region: arr(ST.reg), p_cadena: arr(ST.cad), p_supervisor: arr(ST.sup, 1), p_ecm: arr(ST.ecm, 1) });
  CN.invalidarShare = () => { OPTS = null; Object.keys(CACHE).forEach((k) => delete CACHE[k]); };

  /* acumula filas en {p:{CN..tot}, e:{CN..tot}, t:{tipo:{CN..}}} */
  function acum(rows) {
    const o = { p: { CN: 0, HNK: 0, MERC: 0, OTROS: 0, tot: 0 }, e: { CN: 0, HNK: 0, MERC: 0, OTROS: 0, tot: 0 }, t: {} };
    rows.forEach((r) => { const c = Number(r.caras), isP = r.tipo === 'PERCHA', b = isP ? o.p : o.e; b[r.grupo] += c; b.tot += c; if (!isP) { const t = (o.t[r.tipo] ||= { CN: 0, HNK: 0, MERC: 0, OTROS: 0, tot: 0 }); t[r.grupo] += c; t.tot += c; } });
    o.sos = o.p.tot ? (o.p.CN / o.p.tot) * 100 : null; o.soe = o.e.tot ? (o.e.CN / o.e.tot) * 100 : null; return o;
  }
  const bySem = (rows) => { const m = {}; rows.forEach((r) => (m[r.sem] ||= []).push(r)); return m; };
  const byDim = (rows) => { const m = {}; rows.forEach((r) => (m[r.dim] ||= []).push(r)); return m; };
  const delta = (a, b) => (a == null || b == null ? '<span class="mu">—</span>' : `<span style="color:var(${a - b >= 0 ? '--cE' : '--cP'})">${a - b >= 0 ? '▲' : '▼'} ${Math.abs(a - b).toFixed(1)} pp</span>`);
  const sc = (v, meta) => (v == null ? '—' : `<span class="semaforo" style="--c:${v >= meta * 100 ? 'var(--cE)' : v >= meta * 100 - 10 ? 'var(--cF)' : 'var(--cP)'}"></span>${f1(v)}`);

  async function opciones() {
    if (OPTS) return OPTS; const { data, error } = await sb.rpc('share_opts'); if (error) throw error; OPTS = data;
    if (!ST.from) { const h = data.hasta || ymd(new Date()); ST.to = h; ST.from = (h.slice(8) < '14' ? add(h, -13) : h.slice(0, 8) + '01'); if (S.me.rol === 'supervisor' && S.me.supervisor) ST.sup = [S.me.supervisor.toUpperCase()]; if (S.me.rol === 'asesor' && S.me.ecm_code) ST.ecm = [S.me.ecm_code.toUpperCase()]; }
    return OPTS;
  }

  /* ---------- pestañas ---------- */
  async function resumen() {
    const rows = await agg('TOTAL'), W = bySem(rows), ws = Object.keys(W).sort(); if (!ws.length) return vacio();
    const A = ws.map((w) => ({ w, ...acum(W[w]) })), u = A[A.length - 1], p = A[A.length - 2];
    const ms = metaS() * 100, me = metaE() * 100, tipos = ESP.map((t) => ({ t, v: u.t[t] && u.t[t].tot ? (u.t[t].CN / u.t[t].tot) * 100 : null }));
    const rowsM = await agg('marca', { from: u.w, to: add(u.w, 6) }), prev = p ? await agg('marca', { from: p.w, to: add(p.w, 6) }) : [];
    const mk = (rs) => { const m = {}; rs.filter((r) => r.tipo === 'PERCHA').forEach((r) => { const o = (m[r.dim] ||= { g: r.grupo, c: 0 }); o.c += Number(r.caras); }); return m; };
    const M1 = mk(rowsM), M0 = mk(prev), tot1 = u.p.tot, tot0 = p ? p.p.tot : 0;
    const dif = Object.keys({ ...M1, ...M0 }).map((k) => ({ k, g: (M1[k] || M0[k]).g, d: ((M1[k] ? M1[k].c : 0) / (tot1 || 1) - (M0[k] ? M0[k].c : 0) / (tot0 || 1)) * 100 })).filter((x) => x.g === 'CN').sort((a, b) => a.d - b.d);
    return `<div class="kp">${kpi('Semana ' + wl(u.w), 'SOS ' + f1(u.sos), p ? delta(u.sos, p.sos) + ' vs sem. anterior' : '', u.sos >= ms ? 'var(--cE)' : 'var(--cP)')}${kpi('SOE (espacios)', f1(u.soe), p ? delta(u.soe, p.soe) + ' vs sem. anterior' : '', u.soe >= me ? 'var(--cE)' : 'var(--cP)')}${kpi('Meta SOS / SOE', `${ms.toFixed(0)}% / ${me.toFixed(0)}%`, '')}${kpi('Caras de percha', fN(u.p.tot), 'CN ' + fN(u.p.CN))}${kpi('Espacios', fN(u.e.tot), 'CN ' + fN(u.e.CN))}</div>
      <div class="g2"><div class="card"><h3>Evolución del share CN · SOS (percha)</h3>${line(ws.map(wl), [{ n: 'SOS CN', c: COL[0], d: A.map((x) => x.sos) }], { meta: ms, ymax: 100, pct: true, tipfy: (v) => v.toFixed(1) + '%' })}</div>
      <div class="card"><h3>Evolución del share CN · SOE (espacios)</h3>${line(ws.map(wl), [{ n: 'SOE CN', c: COL[2], d: A.map((x) => x.soe) }], { meta: me, ymax: 100, pct: true, tipfy: (v) => v.toFixed(1) + '%' })}</div></div>
      <div class="g2"><div class="card"><h3>Share de percha por grupo · última semana</h3>${stack([{ l: 'Percha', segs: GRP.map((g) => ({ v: u.p[g], c: GC[g], n: g })) }, ...ESP.map((t) => ({ l: t, segs: GRP.map((g) => ({ v: (u.t[t] || {})[g] || 0, c: GC[g], n: g })) }))])}${legend(GRP.map((g) => [g, GC[g]]))}</div>
      <div class="card"><h3>Share CN por tipo de espacio</h3>${hbar(tipos.filter((x) => x.v != null).map((x) => ({ l: x.t, v: x.v, t: f1(x.v), c: x.v >= me ? 'var(--cE)' : 'var(--cP)' })), { max: 100, meta: me })}</div></div>
      <div class="card"><h3>Afectación al share CN · marcas CN que más suben y bajan vs semana anterior</h3><p class="note">Variación de la participación de cada marca CN en la percha (puntos porcentuales).</p>${dif.length ? hbar([...dif.slice(0, 6), ...dif.slice(-6)].filter((x, i, a) => a.findIndex((y) => y.k === x.k) === i).map((x) => ({ l: x.k, v: Math.abs(x.d), t: (x.d >= 0 ? '+' : '') + x.d.toFixed(2) + ' pp', c: x.d >= 0 ? 'var(--cE)' : 'var(--cP)' }))) : '<p class="note">Se necesitan al menos dos semanas con datos por marca.</p>'}</div>`;
  }
  const vacio = () => '<div class="card"><h3>Aún no hay datos de SOS/SOE en este rango</h3><p>Carga el reporte de encuestas en «Cargar bases» o amplía las fechas.</p></div>';

  async function grupos(kind) {
    const dm = ST.dim, rows = await agg(dm), W = bySem(rows), ws = Object.keys(W).sort(); if (!ws.length) return vacio();
    const w1 = ST.sem && ws.includes(ST.sem) ? ST.sem : ws[ws.length - 1], i1 = ws.indexOf(w1), w0 = ws[i1 - 1], D1 = byDim(W[w1]), D0 = w0 ? byDim(W[w0]) : {}, meta = kind === 'sos' ? metaS() : metaE();
    const key = kind === 'sos' ? 'sos' : 'soe', blk = kind === 'sos' ? 'p' : 'e';
    const L = Object.keys(D1).map((k) => { const a = acum(D1[k]), b = D0[k] ? acum(D0[k]) : null; return { k, a, b, v: a[key], d: b ? a[key] - b[key] : null, nom: D1[k][0].nombre }; }).filter((x) => x.a[blk].tot > 0).sort((p, q) => (p.v ?? 999) - (q.v ?? 999));
    const T = acum(W[w1]), dims = [['supervisor', 'Supervisor'], ['ecm', 'ECM'], ['region', 'Región'], ['cadena', 'Cadena']];
    return `<div class="bar">${dims.map(([k, t]) => `<button data-sdim="${k}" class="${k === dm ? 'pri' : ''}">${t}</button>`).join('')}<label>Semana<select id="s_sem">${[...ws].reverse().map((w) => `<option value="${w}" ${w === w1 ? 'selected' : ''}>${w} (sem. ${wl(w)})</option>`).join('')}</select></label></div>
      <div class="kp">${kpi('Share CN ' + (kind === 'sos' ? 'SOS' : 'SOE'), f1(T[key]), w0 ? delta(T[key], acum(W[w0])[key]) + ' vs anterior' : '', T[key] >= meta * 100 ? 'var(--cE)' : 'var(--cP)')}${kpi('Total caras', fN(T[blk].tot), '')}${kpi('Meta', (meta * 100).toFixed(0) + '%', '')}${kpi('Bajo la meta', fN(L.filter((x) => x.v < meta * 100).length), `de ${L.length}`, 'var(--cP)')}</div>
      <div class="g2"><div class="card"><h3>Share CN por ${dims.find((d) => d[0] === dm)[1].toLowerCase()} · menor a mayor</h3>${hbar(L.slice(0, 15).map((x) => ({ l: x.k || '—', v: x.v, t: f1(x.v), c: x.v >= meta * 100 ? 'var(--cE)' : 'var(--cP)', tip: `${x.k}\nShare CN ${f1(x.v)}${x.d != null ? '\nvs anterior ' + (x.d >= 0 ? '+' : '') + x.d.toFixed(1) + ' pp' : ''}` })), { max: 100, meta: meta * 100 })}</div>
      <div class="card"><h3>Composición por grupo</h3>${stack(L.slice(0, 12).map((x) => ({ l: x.k || '—', segs: GRP.map((g) => ({ v: x.a[blk][g], c: GC[g], n: g })) })))}${legend(GRP.map((g) => [g, GC[g]]))}</div></div>
      <div class="card">${table([{ h: dims.find((d) => d[0] === dm)[1] }, { h: 'Total', n: 1 }, ...GRP.map((g) => ({ h: g, n: 1 })), { h: 'Share CN', n: 1 }, { h: 'vs semana ant.', n: 1 }, { h: 'vs meta', n: 1 }], L.map((x) => ({ c: [esc(x.k || '—'), fN(x.a[blk].tot), ...GRP.map((g) => fN(x.a[blk][g])), sc(x.v, meta), delta(x.v, x.b ? x.b[key] : null), `${(x.v - meta * 100 >= 0 ? '+' : '') + (x.v - meta * 100).toFixed(1)} pp`], s: [x.k, x.a[blk].tot, ...GRP.map((g) => x.a[blk][g]), x.v, x.d ?? -999, x.v - meta * 100], x: [x.k, x.a[blk].tot, ...GRP.map((g) => x.a[blk][g]), +x.v.toFixed(2), x.d == null ? '' : +x.d.toFixed(2), +(x.v - meta * 100).toFixed(2)] })), { name: `${key}_${dm}_${w1}`, max: 300 })}</div>`;
  }

  async function marcas(nivel) {
    const dim = nivel === 'sku' ? 'sku' : 'marca', rows = (await agg(dim)).filter((r) => r.tipo === 'PERCHA'), W = bySem(rows), ws = Object.keys(W).sort(); if (!ws.length) return vacio();
    const w1 = ws[ws.length - 1], tot = (W[w1] || []).reduce((a, r) => a + Number(r.caras), 0), prevTot = ws.length > 1 ? W[ws[ws.length - 2]].reduce((a, r) => a + Number(r.caras), 0) : 0;
    const m = {}; (W[w1] || []).forEach((r) => { const o = (m[r.dim] ||= { g: r.grupo, c: 0, marca: r.marca }); o.c += Number(r.caras); });
    const m0 = {}; ws.length > 1 && W[ws[ws.length - 2]].forEach((r) => { m0[r.dim] = (m0[r.dim] || 0) + Number(r.caras); });
    const L = Object.entries(m).map(([k, o]) => ({ k, ...o, sh: pc(o.c, tot), d: ws.length > 1 ? pc(o.c, tot) - pc(m0[k] || 0, prevTot) : null })).sort((a, b) => b.c - a.c);
    const top = L.slice(0, 6).map((x) => x.k), ser = top.map((k, i) => ({ n: k, c: COL[i], d: ws.map((w) => { const t = W[w].reduce((a, r) => a + Number(r.caras), 0), c = W[w].filter((r) => r.dim === k).reduce((a, r) => a + Number(r.caras), 0); return t ? (c / t) * 100 : null; }) }));
    return `<div class="bar"><button data-snivel="marca" class="${nivel === 'marca' ? 'pri' : ''}">Por segmento / marca</button><button data-snivel="sku" class="${nivel === 'sku' ? 'pri' : ''}">Por producto (SKU)</button><span class="note">Participación en la percha · semana ${wl(w1)}.</span></div>
      <div class="g2"><div class="card"><h3>Participación por ${nivel === 'sku' ? 'producto' : 'marca'} · ${fN(tot)} caras</h3>${hbar(L.slice(0, 15).map((x) => ({ l: x.k, v: x.sh, t: f1(x.sh), c: GC[x.g] || COL[0], tip: `${x.k} (${x.g})\n${fN(x.c)} caras · ${f1(x.sh)}` })), { max: Math.max(...L.slice(0, 15).map((x) => x.sh)) || 100 })}${legend(GRP.map((g) => [g, GC[g]]))}</div>
      <div class="card"><h3>Evolución de las 6 principales</h3>${line(ws.map(wl), ser, { pct: true, tipfy: (v) => v.toFixed(1) + '%', aria: 'Participación por marca en el tiempo' })}</div></div>
      <div class="card">${table([{ h: nivel === 'sku' ? 'Producto' : 'Marca' }, ...(nivel === 'sku' ? [{ h: 'Marca' }] : []), { h: 'Grupo' }, { h: 'Caras', n: 1 }, { h: 'Participación', n: 1 }, { h: 'vs sem. ant.', n: 1 }], L.map((x) => ({ c: [esc(x.k), ...(nivel === 'sku' ? [esc(x.marca)] : []), x.g, fN(x.c), f1(x.sh), delta(x.d == null ? null : x.sh, x.d == null ? null : x.sh - x.d)], s: [x.k, ...(nivel === 'sku' ? [x.marca] : []), x.g, x.c, x.sh, x.d ?? -999], x: [x.k, ...(nivel === 'sku' ? [x.marca] : []), x.g, x.c, +x.sh.toFixed(2)] })), { name: `participacion_${dim}`, max: 400 })}</div>`;
  }

  async function pdv() {
    const rows0 = await agg('TOTAL'), ws = [...new Set(rows0.map((r) => r.sem))].sort(); if (!ws.length) return vacio();
    const w1 = ST.sem && ws.includes(ST.sem) ? ST.sem : ws[ws.length - 1], rows = await agg('pdv', { from: w1, to: add(w1, 6) }), D = byDim(rows), q = norm(ST.q);
    let L = Object.keys(D).map((k) => { const a = acum(D[k]); return { k, nom: D[k][0].nombre || '', a }; }).filter((x) => !q || norm(x.k + ' ' + x.nom).includes(q)).sort((p, q2) => (p.a.sos ?? 999) - (q2.a.sos ?? 999));
    const canEdit = (can('admin', 'gerencia', 'supervisor') && CN.puede('sos_editar'));
    return `<div class="bar"><label>Semana<select id="s_sem">${[...ws].reverse().map((w) => `<option value="${w}" ${w === w1 ? 'selected' : ''}>${w} (sem. ${wl(w)})</option>`).join('')}</select></label><label>Buscar PDV<input id="s_q" value="${esc(ST.q)}" placeholder="Código o nombre"></label><span class="note">${fN(L.length)} PDV con encuesta esa semana.</span></div>
      <div class="card">${table([{ h: 'Código' }, { h: 'PDV' }, { h: 'Percha', n: 1 }, { h: 'CN', n: 1 }, { h: 'SOS', n: 1 }, { h: 'Espacios', n: 1 }, { h: 'CN', n: 1 }, { h: 'SOE', n: 1 }, ...(canEdit ? [{ h: '' }] : [])], L.map((x) => ({ c: [x.k, esc(x.nom), fN(x.a.p.tot), fN(x.a.p.CN), sc(x.a.sos, metaS()), fN(x.a.e.tot), fN(x.a.e.CN), sc(x.a.soe, metaE()), ...(canEdit ? [`<button data-ep="${x.k}|${w1}">Corregir</button>`] : [])], s: [x.k, x.nom, x.a.p.tot, x.a.p.CN, x.a.sos ?? -1, x.a.e.tot, x.a.e.CN, x.a.soe ?? -1, ''], x: [x.k, x.nom, x.a.p.tot, x.a.p.CN, x.a.sos == null ? '' : +x.a.sos.toFixed(2), x.a.e.tot, x.a.e.CN, x.a.soe == null ? '' : +x.a.soe.toFixed(2)] })), { name: 'share_pdv_' + w1, max: 300 })}</div>`;
  }

  async function alertas() {
    const rows0 = await agg('TOTAL'), ws = [...new Set(rows0.map((r) => r.sem))].sort(); if (ws.length < 1) return vacio();
    const w1 = ws[ws.length - 1], w0 = ws[ws.length - 2], [r1, r0, rE] = await Promise.all([agg('pdv', { from: w1, to: add(w1, 6) }), w0 ? agg('pdv', { from: w0, to: add(w0, 6) }) : [], agg('ecm')]);
    const D1 = byDim(r1), D0 = byDim(r0), al = [];
    Object.keys(D1).forEach((k) => { const a = acum(D1[k]), b = D0[k] ? acum(D0[k]) : null, nom = D1[k][0].nombre || '';
      if (a.sos != null && a.p.tot >= 10 && a.sos < metaS() * 100 - 20) al.push({ t: 'SOS muy bajo', k, nom, d: `SOS ${f1(a.sos)} con ${a.p.tot} caras (meta ${(metaS() * 100).toFixed(0)}%)`, s: 2 });
      if (b && a.sos != null && b.sos != null && b.sos - a.sos >= 15) al.push({ t: 'Caída de SOS', k, nom, d: `${f1(b.sos)} → ${f1(a.sos)} (${(a.sos - b.sos).toFixed(1)} pp)`, s: 3 });
      if (a.e.tot > 0 && a.soe != null && a.soe < metaE() * 100 - 30) al.push({ t: 'SOE muy bajo', k, nom, d: `SOE ${f1(a.soe)} con ${a.e.tot} espacios`, s: 1 }); });
    const e1 = new Set(rE.filter((r) => r.sem === w1).map((r) => r.dim)); const sinDato = [...new Set(rE.map((r) => r.dim))].filter((k) => k && !e1.has(k));
    const dist = [0, 20, 40, 60, 80].map((lo) => ({ l: `${lo}–${lo + 20}%`, n: Object.keys(D1).filter((k) => { const v = acum(D1[k]).sos; return v != null && v >= lo && (v < lo + 20 || (lo === 80 && v <= 100)); }).length }));
    const wsE = byDim(rE), integral = Object.keys(wsE).map((k) => { const a = acum(wsE[k].filter((r) => r.sem === w1)), wS = Number(S.cfg.w_sos || 10), wE = Number(S.cfg.w_soe || 10); const v = [[a.sos, wS], [a.soe, wE]].filter((x) => x[0] != null); return { k, v: v.length ? v.reduce((s, x) => s + x[0] * x[1], 0) / v.reduce((s, x) => s + x[1], 0) : null, sos: a.sos, soe: a.soe }; }).filter((x) => x.v != null && x.k).sort((a, b) => b.v - a.v);
    const best = rows0.length ? (() => { const W = bySem(rows0), A = Object.keys(W).map((w) => ({ w, ...acum(W[w]) })).filter((x) => x.sos != null).sort((a, b) => b.sos - a.sos)[0]; return A; })() : null;
    return `<div class="kp">${kpi('Alertas', fN(al.length), 'semana ' + wl(w1), 'var(--cP)')}${kpi('ECM sin datos esta semana', fN(sinDato.length), '', 'var(--cF)')}${best ? kpi('Mejor semana del rango', f1(best.sos), 'SOS · sem. ' + wl(best.w), 'var(--cE)') : ''}</div>
      <div class="g2"><div class="card"><h3>Distribución del SOS por PDV</h3>${hbar(dist.map((d) => ({ l: d.l, v: d.n, t: fN(d.n), c: 'var(--s1)' })))}</div>
      <div class="card"><h3>Share integral SOS + SOE por ECM · mejores</h3>${hbar(integral.slice(0, 10).map((x) => ({ l: x.k, v: x.v, t: f1(x.v), c: 'var(--s3)', tip: `${x.k}\nSOS ${f1(x.sos)} · SOE ${f1(x.soe)}` })), { max: 100 })}</div></div>
      <div class="card"><h3>Alertas por PDV (${fN(al.length)})</h3>${table([{ h: 'Alerta' }, { h: 'Código' }, { h: 'PDV' }, { h: 'Detalle' }], al.sort((a, b) => b.s - a.s).map((x) => ({ c: [x.t, x.k, esc(x.nom), esc(x.d)], s: [x.t, x.k, x.nom, x.d], x: [x.t, x.k, x.nom, x.d] })), { name: 'alertas_share', max: 300 })}</div>
      <div class="card"><h3>ECM sin encuestas la semana ${wl(w1)}</h3><p>${sinDato.length ? esc(sinDato.join(', ')) : 'Todos reportaron.'}</p></div>`;
  }

  /* ---------- corrección de un PDV (supervisor, gerencia, admin) ---------- */
  async function editarPdv(codigo, w) {
    const { data, error } = await sb.from('share_detalle').select('*').eq('codigo', codigo).gte('fecha', w).lte('fecha', add(w, 6)).order('tipo').order('grupo'); if (error) return fail(error);
    const el = document.createElement('div'); el.className = 'modal';
    el.innerHTML = `<div class="box" style="max-width:720px"><h3>Corregir PDV ${esc(codigo)} · semana ${wl(w)}</h3><p class="note">Los cambios quedan en el historial. Para quitar una fila pon 0 caras y guarda.</p><div class="tw"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Grupo</th><th>Marca</th><th>Producto</th><th>Caras</th></tr></thead><tbody>
      ${data.map((r) => `<tr><td>${r.fecha}</td><td>${esc(r.tipo)}</td><td>${esc(r.grupo)}</td><td>${esc(r.marca)}</td><td>${esc(r.sku)}</td><td><input type="number" min="0" style="width:80px" data-id="${r.id}" value="${r.caras}"></td></tr>`).join('') || '<tr><td colspan="6" class="note">Sin filas.</td></tr>'}</tbody></table></div>
      <div class="bar" style="margin:0"><button class="pri" id="ep_ok">Guardar cambios</button><button id="ep_x">Cerrar</button></div></div>`;
    document.body.appendChild(el); $('#ep_x', el).onclick = () => el.remove();
    $('#ep_ok', el).onclick = async () => {
      try { for (const i of el.querySelectorAll('input[data-id]')) { const orig = data.find((r) => String(r.id) === i.dataset.id), v = Math.max(0, parseInt(i.value, 10) || 0); if (v === orig.caras) continue; const q = v === 0 ? sb.from('share_detalle').delete().eq('id', orig.id) : sb.from('share_detalle').update({ caras: v }).eq('id', orig.id); const { error: e } = await q; if (e) throw e; }
        CN.invalidarShare(); el.remove(); toast('PDV corregido'); draw(); } catch (e) { fail(e); }
    };
  }

  /* ---------- detalle editable: usa los filtros del panel (sin barra propia) ---------- */
  async function detalle() {
    if (!(can('admin', 'gerencia', 'supervisor') && CN.puede('sos_editar'))) return '<div class="card"><p>Solo supervisión, gerencia y administración pueden corregir el detalle.</p></div>';
    let q = sb.from('share_detalle').select('*', { count: 'exact' }).gte('fecha', ST.from).lte('fecha', ST.to).order('fecha', { ascending: false }).order('id').range(ST.dp * 50, ST.dp * 50 + 49);
    if (ST.sup.length) q = q.in('supervisor', ST.sup.map((x) => x.toUpperCase())); if (ST.ecm.length) q = q.in('ecm', ST.ecm.map((x) => x.toUpperCase()));
    const s = String(ST.q || '').replace(/[,()%]/g, ' ').trim(); if (s) q = q.or(`codigo.ilike.%${s}%,pdv.ilike.%${s}%`);
    const { data, error, count } = await q; if (error) throw error; const rows = data || [], tot = count ?? rows.length, np = Math.max(1, Math.ceil(tot / 50));
    setTimeout(() => { document.querySelectorAll('[data-dp]').forEach((b) => (b.onclick = () => { ST.dp = Math.max(0, ST.dp + +b.dataset.dp); draw(); })); const i = $('#s_qd'); if (i) { i.oninput = () => { ST.dp = 0; ST.q = i.value; clearTimeout(i.t); i.t = setTimeout(() => draw(), 450); }; } document.querySelectorAll('[data-id]').forEach((el) => (el.onchange = async () => { const v = el.dataset.f === 'caras' ? Math.max(0, parseInt(el.value, 10) || 0) : el.value; const { error: e } = await sb.from('share_detalle').update({ [el.dataset.f]: v }).eq('id', el.dataset.id); e ? fail(e) : (CN.invalidarShare(), toast('Guardado')); })); }, 0);
    return `<div class="bar"><label>Buscar PDV<input id="s_qd" value="${esc(ST.q)}" placeholder="Código o nombre del PDV"></label><span class="note">${fN(tot)} filas · <span class="pager"><button data-dp="-1" ${ST.dp === 0 ? 'disabled' : ''}>‹</button> Pág. ${ST.dp + 1} de ${np} <button data-dp="1" ${ST.dp >= np - 1 ? 'disabled' : ''}>›</button></span> Los cambios se guardan al salir del campo.</span></div>
      <div class="card"><div class="tws"><table><thead><tr><th>Fecha</th><th>Código</th><th>PDV</th><th>ECM</th><th>Tipo</th><th>Grupo</th><th>Marca</th><th>Producto</th><th class="n">Caras</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r.fecha)}</td><td>${esc(r.codigo)}</td><td>${esc(r.pdv || '')}</td><td>${esc(r.ecm || '')}</td><td>${esc(r.tipo)}</td>
        <td><select data-id="${r.id}" data-f="grupo" aria-label="Grupo de ${esc(r.sku || r.marca || r.tipo)} en ${esc(r.pdv || r.codigo)}">${GRP.concat('EXCLUIR').map((x) => `<option ${x === r.grupo ? 'selected' : ''}>${x}</option>`).join('')}</select></td><td>${esc(r.marca || '')}</td><td>${esc(r.sku || '')}</td><td class="n"><input type="number" min="0" style="width:90px" data-id="${r.id}" data-f="caras" aria-label="Caras de ${esc(r.sku || r.marca || r.tipo)} en ${esc(r.pdv || r.codigo)}" value="${r.caras}"></td></tr>`).join('') || '<tr><td colspan="9" class="note">Sin filas con estos filtros.</td></tr>'}</tbody></table></div></div>`;
  }

  /* ---------- exportar detalle ---------- */
  async function exportar() {
    const rows = await CN.fetchPar((o) => sb.from('share_detalle').select('fecha,codigo,pdv,ecm,supervisor,tipo,grupo,marca,sku,caras', o).gte('fecha', ST.from).lte('fecha', ST.to).order('id'));
    VZ.dl(`detalle_share_${ST.from}_${ST.to}`, ['Fecha', 'Código', 'PDV', 'ECM', 'Supervisor', 'Tipo', 'Grupo', 'Marca', 'Producto', 'Caras'], rows.map((r) => [r.fecha, r.codigo, r.pdv, r.ecm, r.supervisor, r.tipo, r.grupo, r.marca, r.sku, r.caras]));
  }

  /* ---------- hub ---------- */
  const TABS = [['sem', 'Resumen semanal'], ['res', 'Evolución'], ['sos', 'SOS · percha'], ['soe', 'SOE · espacios'], ['mar', 'Segmentos y marcas'], ['sku', 'Productos (SKU)'], ['pdv', 'PDV'], ['bi', 'Análisis'], ['ale', 'Alertas'], ['det', 'Detalle editable']];
  let M = null;
  async function draw() {
    const o = await opciones();
    M.innerHTML = '<p class="note">Cargando…</p>';
    { const ok = TABS.filter(([k]) => CN.tabOk('sos', k)); if (ok.length && !ok.some((x) => x[0] === ST.tab)) ST.tab = ok[0][0]; }
    let body = ''; try { const t = ST.tab; body = t === 'sem' ? await CN.shareTabs.sem() : t === 'bi' ? await CN.shareTabs.bi() : t === 'res' ? await resumen() : t === 'sos' ? await grupos('sos') : t === 'soe' ? await grupos('soe') : t === 'mar' ? await marcas('marca') : t === 'sku' ? await marcas('sku') : t === 'pdv' ? await pdv() : t === 'ale' ? await alertas() : await detalle(); }
    catch (e) { console.error(e); body = `<div class="card">No se pudo armar este panel: ${esc(e.message)}</div>`; }
    M.innerHTML = `<div class="fbar">${ST.tab === 'sem' ? CN.shareTabs.weekNav() : `<label>Desde<input type="date" id="s_from" value="${ST.from}"></label><label>Hasta<input type="date" id="s_to" value="${ST.to}"></label>${VZ.quick()}`}${VZ.msel('reg', 'Región', o.region || [], ST.reg)}${VZ.msel('cad', 'Cadena', o.cadena || [], ST.cad)}${VZ.msel('sup', 'Supervisor', o.supervisor || [], ST.sup)}${VZ.msel('ecm', 'ECM', o.ecm || [], ST.ecm)}<button id="s_clr">Limpiar filtros</button>${can('admin', 'gerencia') ? '<button id="s_exp">Exportar detalle</button>' : ''}</div>${tabs(TABS.filter(([k]) => (k !== 'det' || (can('admin', 'gerencia', 'supervisor') && CN.puede('sos_editar'))) && CN.tabOk('sos', k)), ST.tab)}<div id="pan">${body}</div>`;
    const B = (id, fn) => { const e = $('#' + id); if (e) e.onchange = fn; };
    VZ.rangeHandler = (a, b) => { ST.from = a; ST.to = b; draw(); }; B('s_from', (e) => { ST.dp = 0; ST.from = e.target.value; draw(); }); B('s_to', (e) => { ST.dp = 0; ST.to = e.target.value; draw(); });
    B('s_sem', (e) => { ST.sem = e.target.value; draw(); });
    const q = $('#s_q'); if (q) { let t; q.oninput = () => { ST.q = q.value; clearTimeout(t); t = setTimeout(draw, 400); }; }
    const c = $('#s_clr'); if (c) c.onclick = () => { Object.assign(ST, { reg: [], cad: [], sup: [], ecm: [] }); draw(); };
    const x = $('#s_exp'); if (x) x.onclick = () => exportar().catch(fail);
    document.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { ST.tab = b.dataset.tab; draw(); }));
    document.querySelectorAll('[data-sdim]').forEach((b) => (b.onclick = () => { ST.dim = b.dataset.sdim; draw(); }));
    document.querySelectorAll('[data-snivel]').forEach((b) => (b.onclick = () => { ST.tab = b.dataset.snivel === 'sku' ? 'sku' : 'mar'; draw(); }));
    document.querySelectorAll('[data-ep]').forEach((b) => (b.onclick = () => { const [c2, w] = b.dataset.ep.split('|'); editarPdv(c2, w); }));
    CN.sideRefresh();
  }
  VIEWS.sos = async function () {
    M = $('#main'); await opciones();
    if (CN.pendingTab && CN.pendingTab[0] === 'sos') { ST.tab = CN.pendingTab[1]; CN.pendingTab = null; }
    CN.sub.sos = { tabs: () => TABS.filter(([k]) => (k !== 'det' || (can('admin', 'gerencia', 'supervisor') && CN.puede('sos_editar'))) && CN.tabOk('sos', k)), cur: () => ST.tab, set: (k) => { ST.tab = k; draw(); } };
    VZ.mselHandler = (id, vals) => { ST[id] = vals; ST.dp = 0; draw(); };
    if (ST.tab === 'sem') CN.shareTabs.anclar(OPTS && OPTS.hasta);
    await draw();
  };
  CN.shareAgg = rpcPar; CN.shareAcum = acum;
  CN.shareCtx = { ST, agg, acum, bySem, byDim, add, ymd, wl, metaS, metaE, GRP, ESP, redraw: () => draw() };
})();
