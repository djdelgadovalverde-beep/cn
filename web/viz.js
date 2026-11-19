'use strict';
/* Componentes de visualización sin dependencias: barras, apiladas, líneas, mapa de calor y tablas ordenables/exportables. */
(function () {
  const VZ = (window.VZ = {});
  const COL = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)', 'var(--s8)'];
  const CAT = { E: 'var(--cE)', P: 'var(--cP)', F: 'var(--cF)', M: 'var(--cM)' };
  VZ.COL = COL; VZ.CAT = CAT;
  const e = (s) => esc(s);
  VZ.n = (x) => (x == null || isNaN(x) ? '—' : Number(x).toLocaleString('es-EC'));
  VZ.p = (x, d = 1) => (x == null || isNaN(x) ? '—' : Number(x).toFixed(d) + '%');
  VZ.pc = (a, b) => (b ? (a / b) * 100 : 0);
  VZ.tone = (v, meta) => (v >= meta ? 'var(--cE)' : v >= meta - 15 ? 'var(--cF)' : 'var(--cP)');

  VZ.kpi = (t, v, s, c) => `<div class="k" style="--a:${c || 'var(--brand)'}"><span>${e(t)}</span><b>${v}</b><i>${s || ''}</i></div>`;
  VZ.legend = (items) => `<div class="lg">${items.map(([n, c]) => `<span style="--c:${c}">${e(n)}</span>`).join('')}</div>`;

  /* barras horizontales: items [{l, v, t (texto), c (color), tip}] ; meta = marca vertical */
  VZ.hbar = (items, o = {}) => {
    const max = o.max || Math.max(1, ...items.map((i) => i.v));
    return items.map((i) => `<div class="hb" data-tip="${e(i.tip || i.l + ': ' + (i.t != null ? i.t : i.v))}" tabindex="0"><div class="l" title="${e(i.l)}">${e(i.l)}</div>
      <div class="t"><i style="width:${Math.max(0, Math.min(100, (i.v / max) * 100))}%;background:${i.c || COL[0]}"></i>${o.meta != null ? `<u style="left:${(o.meta / max) * 100}%"></u>` : ''}</div><div class="v">${i.t != null ? i.t : VZ.n(i.v)}</div></div>`).join('');
  };
  /* barras apiladas horizontales: rows [{l, segs:[{v,c,n}]}] */
  VZ.stack = (rows, o = {}) => rows.map((r) => {
    const tot = r.segs.reduce((a, s) => a + s.v, 0) || 1;
    return `<div class="hb" style="grid-template-columns:minmax(90px,200px) 1fr auto"><div class="l" title="${e(r.l)}">${e(r.l)}</div><div class="stk">${r.segs.map((s) => s.v ? `<i style="width:${(s.v / tot) * 100}%;background:${s.c}" data-tip="${e(r.l + ' · ' + s.n + ': ' + VZ.n(s.v) + ' (' + ((s.v / tot) * 100).toFixed(1) + '%)')}"></i>` : '').join('')}</div><div class="v">${VZ.n(tot)}</div></div>`;
  }).join('');

  /* línea: labels[], series [{n, c, d:[...]}], meta (valor), ymax */
  VZ.line = (labels, series, o = {}) => {
    const W = 720, H = 240, L = 40, R = 12, T = 12, B = 30, ymax = o.ymax || Math.max(1, ...series.flatMap((s) => s.d.filter((v) => v != null)));
    const x = (i) => L + (labels.length <= 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (labels.length - 1)), y = (v) => T + (H - T - B) * (1 - v / ymax);
    const fy = o.fy || ((v) => Math.round(v) + (o.pct ? '%' : ''));
    const step = Math.max(1, Math.ceil(labels.length / 12));
    const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => `<line class="gl" x1="${L}" x2="${W - R}" y1="${y(ymax * f)}" y2="${y(ymax * f)}"/><text x="${L - 6}" y="${y(ymax * f) + 4}" text-anchor="end">${fy(ymax * f)}</text>`).join('');
    const xl = labels.map((l, i) => (i % step === 0 ? `<text x="${x(i)}" y="${H - 10}" text-anchor="middle">${e(l)}</text>` : '')).join('');
    const meta = o.meta != null ? `<line x1="${L}" x2="${W - R}" y1="${y(o.meta)}" y2="${y(o.meta)}" stroke="var(--ink)" stroke-dasharray="5 4" opacity=".6"/><text x="${W - R}" y="${y(o.meta) - 4}" text-anchor="end">Meta ${fy(o.meta)}</text>` : '';
    const lines = series.map((s, k) => {
      const pts = s.d.map((v, i) => (v == null ? null : [x(i), y(v), v, i])).filter(Boolean);
      return `<path d="${pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('')}" fill="none" stroke="${s.c || COL[k]}" stroke-width="2" stroke-linejoin="round"/>` +
        pts.map((p) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${pts.length > 40 ? 0 : 3.5}" fill="${s.c || COL[k]}" stroke="var(--card)" stroke-width="2"/><circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="10" fill="transparent" data-tip="${e(labels[p[3]] + '\n' + s.n + ': ' + (o.tipfy || fy)(p[2]))}"/>`).join('');
    }).join('');
    return `<svg class="ch" viewBox="0 0 ${W} ${H}" role="img" aria-label="${e(o.aria || 'Gráfico de líneas')}">${grid}${xl}${meta}${lines}</svg>` + (series.length > 1 ? VZ.legend(series.map((s, k) => [s.n, s.c || COL[k]])) : '');
  };
  /* barras verticales apiladas por periodo: labels[], segs [{n,c,d:[..]}] */
  VZ.vstack = (labels, segs, o = {}) => {
    const W = 720, H = 240, L = 40, R = 8, T = 10, B = 30, tot = labels.map((_, i) => segs.reduce((a, s) => a + (s.d[i] || 0), 0)), max = Math.max(1, ...tot);
    const bw = Math.min(40, ((W - L - R) / labels.length) * 0.7), step = Math.max(1, Math.ceil(labels.length / 14));
    const sx = (i) => L + ((i + 0.5) * (W - L - R)) / labels.length;
    let bars = '';
    labels.forEach((l, i) => { let acc = 0; segs.forEach((s) => { const v = s.d[i] || 0; if (!v) return; const h = ((H - T - B) * v) / max, yy = T + (H - T - B) - ((H - T - B) * (acc + v)) / max; acc += v; bars += `<rect x="${(sx(i) - bw / 2).toFixed(1)}" y="${(yy + 1).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0, h - 2).toFixed(1)}" rx="3" fill="${s.c}" data-tip="${e(l + ' · ' + s.n + ': ' + VZ.n(v))}"/>`; }); if (i % step === 0) bars += `<text x="${sx(i)}" y="${H - 10}" text-anchor="middle">${e(l)}</text>`; });
    const grid = [0, 0.5, 1].map((f) => `<line class="gl" x1="${L}" x2="${W - R}" y1="${T + (H - T - B) * (1 - f)}" y2="${T + (H - T - B) * (1 - f)}"/><text x="${L - 6}" y="${T + (H - T - B) * (1 - f) + 4}" text-anchor="end">${VZ.n(Math.round(max * f))}</text>`).join('');
    return `<svg class="ch" viewBox="0 0 ${W} ${H}" role="img" aria-label="${e(o.aria || 'Barras apiladas por periodo')}">${grid}${bars}</svg>` + VZ.legend(segs.map((s) => [s.n, s.c]));
  };
  /* mapa de calor: rows[], cols[], f(r,c) -> {v (0..100 o null), t (texto), tip} */
  VZ.heat = (rows, cols, f, o = {}) => {
    const mx = o.max || 100;
    return `<div class="tw"><table class="heat"><thead><tr><th></th>${cols.map((c) => `<th>${e(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr><th style="text-align:left;white-space:nowrap">${e(r)}</th>${cols.map((c) => {
      const x = f(r, c); if (!x || x.v == null) return '<td class="mu">·</td>';
      const k = Math.max(0, Math.min(1, x.v / mx)), bg = o.inv ? `color-mix(in oklab, var(--cP) ${Math.round(k * 70)}%, var(--card))` : `color-mix(in oklab, var(--s1) ${Math.round(8 + k * 62)}%, var(--card))`;
      return `<td style="background:${bg}" data-tip="${e(x.tip || r + ' · ' + c + ': ' + x.t)}">${x.t}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`;
  };

  /* tabla ordenable y exportable. cols: [{h, k (clave de orden), n (numérica)}]; rows: [{c:[html...], s:[valores de orden], x:[valores export]}] */
  const REG = {}; let seq = 0;
  VZ.table = (cols, rows, o = {}) => {
    const id = 'vt' + ++seq; REG[id] = { cols, rows, name: o.name || 'datos', sort: null, asc: true, max: o.max || 100000, pg: 0, ps: o.ps || 25 };
    return `<div class="tw" id="${id}">${tableHTML(id)}</div>`;
  };
  VZ.tableData = (id) => { const T = REG[id]; return T ? { name: T.name, head: T.cols.map((c) => String(c.h).replace(/<[^>]+>/g, '').trim()), rows: T.rows.map((r) => r.x || r.s) } : null; };
  function tableHTML(id) {
    const T = REG[id]; let r = T.rows.slice();
    if (T.sort != null) r.sort((a, b) => { const x = a.s[T.sort], y = b.s[T.sort]; const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'es'); return T.asc ? c : -c; });
    r = r.slice(0, T.max); const np = Math.max(1, Math.ceil(r.length / T.ps)); T.pg = Math.min(T.pg, np - 1); const shown = r.slice(T.pg * T.ps, (T.pg + 1) * T.ps);
    const pager = r.length > 10 ? `<span class="pager"><button data-pgn="${id}|-1" ${T.pg === 0 ? 'disabled' : ''} aria-label="Página anterior">‹</button><span>Pág. ${T.pg + 1} de ${np}</span><button data-pgn="${id}|1" ${T.pg >= np - 1 ? 'disabled' : ''} aria-label="Página siguiente">›</button><select data-ps="${id}" aria-label="Filas por página">${[10, 25, 50, 100].map((n) => `<option value="${n}" ${n === T.ps ? 'selected' : ''}>${n} filas</option>`).join('')}</select></span>` : '';
    return `<div class="bar" style="margin:0 0 6px"><span class="note">${VZ.n(T.rows.length)} ${T.rows.length === 1 ? 'fila' : 'filas'}</span><span style="flex:1"></span>${pager}<button data-xl="${id}" title="Descargar a Excel" aria-label="Descargar a Excel">Descargar Excel</button></div>
    <div class="twin">    <table class="vtb"><thead><tr>${T.cols.map((c, i) => `<th class="${c.n ? 'n' : ''}" data-so="${id}|${i}" tabindex="0">${c.h}${T.sort === i ? (T.asc ? ' ▲' : ' ▼') : ''}</th>`).join('')}</tr></thead><tbody>${shown.map((x) => `<tr>${x.c.map((c, i) => `<td class="${T.cols[i].n ? 'n' : ''}">${c}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${T.cols.length}" class="note">Sin datos.</td></tr>`}</tbody></table></div>`;
  }
  document.addEventListener('click', (ev) => {
    const th = ev.target.closest('[data-so]'); if (th) { const [id, i] = th.dataset.so.split('|'), T = REG[id]; if (!T) return; T.asc = T.sort === +i ? !T.asc : !T.cols[+i].n; T.sort = +i; document.getElementById(id).innerHTML = tableHTML(id); return; }
    const pn = ev.target.closest('[data-pgn]'); if (pn) { const [id, d] = pn.dataset.pgn.split('|'); if (REG[id]) { REG[id].pg = Math.max(0, REG[id].pg + +d); document.getElementById(id).innerHTML = tableHTML(id); } return; }
    const x = ev.target.closest('[data-xl]'); if (x) { const T = REG[x.dataset.xl]; if (!T) return; const wb = XLSX.utils.book_new(); const head = T.cols.map((c) => String(c.h).replace(/<[^>]+>/g, ''));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([head, ...T.rows.map((r) => r.x || r.s)]), 'Datos'); XLSX.writeFile(wb, T.name + '.xlsx'); }
  });
  document.addEventListener('change', (ev) => { const ps = ev.target.closest && ev.target.closest('[data-ps]'); if (ps && REG[ps.dataset.ps]) { REG[ps.dataset.ps].ps = +ps.value; REG[ps.dataset.ps].pg = 0; document.getElementById(ps.dataset.ps).innerHTML = tableHTML(ps.dataset.ps); } });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && ev.target.dataset && ev.target.dataset.so) ev.target.click(); });

  /* tooltip global */
  const tip = document.createElement('div'); tip.id = 'tip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip);
  const show = (t, x, y) => { tip.textContent = t; tip.style.opacity = 1; const w = tip.offsetWidth; tip.style.left = Math.min(innerWidth - w - 8, Math.max(8, x + 12)) + 'px'; tip.style.top = Math.max(8, y - 36) + 'px'; };
  document.addEventListener('mousemove', (ev) => { const t = ev.target.closest && ev.target.closest('[data-tip]'); if (t) show(t.dataset.tip, ev.clientX, ev.clientY); else tip.style.opacity = 0; });
  document.addEventListener('focusin', (ev) => { const t = ev.target.closest && ev.target.closest('[data-tip]'); if (t) { const r = t.getBoundingClientRect(); show(t.dataset.tip, r.left, r.top); } });
  document.addEventListener('focusout', () => (tip.style.opacity = 0));

  VZ.tabs = (list, cur) => `<div class="tabs hubtabs" role="tablist">${list.map(([k, t]) => `<button role="tab" aria-selected="${k === cur}" data-tab="${k}" class="${k === cur ? 'on' : ''}">${t}</button>`).join('')}</div>`;
  VZ.dl = (name, head, rows) => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([head, ...rows]), 'Datos'); XLSX.writeFile(wb, name + '.xlsx'); };

  /* ---------- selección múltiple con búsqueda (como el sistema anterior): vacío = todos ---------- */
  VZ.msel = (id, label, opts, sel = []) => {
    const P = opts.map((o) => (Array.isArray(o) ? o : [o, o])), set = new Set(sel.map(String));
    const txt = !sel.length ? `Todos (${P.length})` : sel.length === 1 ? ((P.find((p) => String(p[0]) === String(sel[0])) || [0, sel[0]])[1]) : `${sel.length} de ${P.length}`;
    return `<div class="msw"><span class="lbl">${e(label)}</span><details class="ms" data-ms="${e(id)}"><summary>${e(txt)}</summary><div class="msp">
      <input type="search" class="mss" placeholder="Buscar…" aria-label="Buscar en ${e(label)}"><div class="msb"><button type="button" data-msa="all">Todos</button><button type="button" data-msa="none">Ninguno</button></div>
      <div class="msl">${P.map(([v, t]) => `<label class="mso"><input type="checkbox" value="${e(v)}" ${!sel.length || set.has(String(v)) ? 'checked' : ''}><span>${e(t)}</span></label>`).join('') || '<span class="note">Sin opciones</span>'}</div>
      <button type="button" class="pri" data-msa="ok">Aplicar</button></div></details></div>`;
  };
  VZ.mselHandler = null;
  /* atajos de periodo: cargan menos datos. Cada vista fija VZ.rangeHandler(desde, hasta) */
  VZ.rangeHandler = null;
  VZ.quick = () => '<span class="quick" role="group" aria-label="Periodo rápido"><button type="button" data-rq="sem">Semana actual</button><button type="button" data-rq="sem0">Semana pasada</button><button type="button" data-rq="mes">Mes actual</button><button type="button" data-rq="mes0">Mes pasado</button></span>';
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest && ev.target.closest('[data-rq]'); if (!b || !VZ.rangeHandler) return;
    const wsd = Number((typeof S !== 'undefined' && S.cfg && S.cfg.semana_inicio) ?? 3), f = (d) => d.toISOString().slice(0, 10), t = new Date(), h = new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()));
    const k = b.dataset.rq; let d1, d2;
    if (k.startsWith('sem')) { const off = (h.getUTCDay() - wsd + 7) % 7; d1 = new Date(h); d1.setUTCDate(h.getUTCDate() - off - (k === 'sem0' ? 7 : 0)); d2 = new Date(d1); d2.setUTCDate(d1.getUTCDate() + 6); }
    else { d1 = new Date(Date.UTC(h.getUTCFullYear(), h.getUTCMonth() - (k === 'mes0' ? 1 : 0), 1)); d2 = new Date(Date.UTC(d1.getUTCFullYear(), d1.getUTCMonth() + 1, 0)); }
    VZ.rangeHandler(f(d1), f(d2));
  });
  document.addEventListener('input', (ev) => { const i = ev.target.closest && ev.target.closest('.mss'); if (!i) return; const q = norm(i.value); i.closest('.msp').querySelectorAll('.mso').forEach((l) => (l.style.display = !q || norm(l.innerText).includes(q) ? '' : 'none')); });
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest && ev.target.closest('[data-msa]');
    if (b) {
      const d = b.closest('details.ms'), boxes = [...d.querySelectorAll('.mso')].filter((l) => l.style.display !== 'none').map((l) => l.querySelector('input'));
      if (b.dataset.msa === 'all') boxes.forEach((x) => (x.checked = true)); else if (b.dataset.msa === 'none') boxes.forEach((x) => (x.checked = false));
      else { const all = [...d.querySelectorAll('.mso input')], on = all.filter((x) => x.checked).map((x) => x.value); d.open = false; const vals = on.length === all.length || !on.length ? [] : on; if (VZ.mselHandler) VZ.mselHandler(d.dataset.ms, vals); }
      return;
    }
    document.querySelectorAll('details.ms[open]').forEach((d) => { if (!d.contains(ev.target)) d.open = false; });
    const sm = ev.target.closest && ev.target.closest('details.ms > summary'); if (sm) { const p = sm.parentNode.querySelector('.msp'); if (p) { p.classList.remove('r'); const r = sm.getBoundingClientRect(); if (r.left + 292 > innerWidth) p.classList.add('r'); } }
  });
})();
