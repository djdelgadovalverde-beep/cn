'use strict';
/* SOS y SOE · Análisis (BI): share acumulado del mes contra el mes anterior, distribución por PDV, tendencia por grupo,
   share integral SOS + SOE, rendimiento máximo y mínimo, alertas y ranking por segmento. */
(function () {
  const { n: fN, p: f1, pc, kpi, hbar, table, line, legend, COL } = VZ;
  const C = () => CN.shareCtx, ST = () => C().ST;
  const wsd = () => Number(S.cfg.semana_inicio ?? 3);
  const dow = (d) => new Date(d + 'T00:00:00Z').getUTCDay();
  const iniSem = (d) => C().add(d, -((dow(d) - wsd() + 7) % 7));
  const MESN = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const arr = (x, up) => (x.length ? (up ? x.map((v) => String(v).toUpperCase()) : x) : null);
  const dpp = (v) => (v == null || isNaN(v) ? '<span class="mu">—</span>' : `<span style="color:var(${v >= 0 ? '--cE' : '--cP'})">${v >= 0 ? '▲' : '▼'} ${Math.abs(v).toFixed(1)} pp</span>`);
  const sh = (cn, tot) => (tot ? (cn / tot) * 100 : null);
  const sumR = (L) => L.reduce((a, r) => ({ cn: a.cn + r.cn, tot: a.tot + r.tot }), { cn: 0, tot: 0 });
  const CACHE = {};
  async function datos(desde, hasta) {
    const s = ST(), k = JSON.stringify([desde, hasta, s.reg, s.cad, s.sup, s.ecm]); if (CACHE[k]) return CACHE[k];
    const { data, error } = await sb.rpc('share_pdv_sem', { p_desde: desde, p_hasta: hasta, p_region: arr(s.reg), p_cadena: arr(s.cad), p_supervisor: arr(s.sup, 1), p_ecm: arr(s.ecm, 1) }); if (error) throw error;
    return (CACHE[k] = (data || []).map((r) => ({ c: r[0], w: r[1], p: r[2], tot: r[3], cn: r[4], n: r[5], cad: r[6] || '—', reg: r[7] || '—', sup: r[8] || '—', ecm: r[9] || '—' })));
  }
  const grupoCSV = [['CN', 'var(--s1)'], ['HNK', 'var(--s2)'], ['MERC', 'var(--s3)'], ['OTROS', 'var(--s4)']];

  async function bi() {
    const s = ST(), isS = (s.biSv || 'SOS') === 'SOS', meta = (isS ? C().metaS() : C().metaE()) * 100, wk = iniSem(s.to), hasta = C().add(wk, 6);
    const mIni = wk.slice(0, 7) + '-01', pm = new Date(Date.UTC(+wk.slice(0, 4), +wk.slice(5, 7) - 2, 1)).toISOString().slice(0, 10), desde = [s.from, pm].sort()[0];
    const [all, grp] = await Promise.all([datos(desde, hasta), C().agg('TOTAL', { from: C().add(wk, -49), to: hasta })]);
    const R = all.filter((r) => r.p === isS), ws = [...new Set(R.map((r) => r.w))].sort();
    if (!R.some((r) => r.w === wk)) return `<div class="card"><h3>Sin datos de ${isS ? 'percha' : 'espacios'} en la semana del ${wk}</h3><p>Cambia el periodo (las fechas de arriba) o la encuesta.</p></div>${sel(isS)}`;
    const byW = {}; R.forEach((r) => (byW[r.w] ||= []).push(r)); const cur = byW[wk] || [], iPrev = ws.indexOf(wk) - 1, prevW = iPrev >= 0 ? ws[iPrev] : null, prev = prevW ? byW[prevW] : [];
    const pm0 = {}; prev.forEach((r) => (pm0[r.c] = r));
    /* 1. MTD */
    const mesW = ws.filter((w) => w.slice(0, 7) === wk.slice(0, 7) && w <= wk), pmK = pm.slice(0, 7), pMesW = ws.filter((w) => w.slice(0, 7) === pmK).slice(0, mesW.length);
    const mtd = sumR(mesW.flatMap((w) => byW[w])), mtdP = sumR(pMesW.flatMap((w) => byW[w])), mS = sh(mtd.cn, mtd.tot), mP = mtdP.tot ? sh(mtdP.cn, mtdP.tot) : null;
    /* 2. histograma de share por PDV */
    const sc = cur.filter((r) => r.tot > 0).map((r) => ({ ...r, s: (r.cn / r.tot) * 100 })), bk = Array.from({ length: 10 }, (_, i) => ({ l: `${i * 10}–${i * 10 + 10}%`, n: 0 })); sc.forEach((r) => bk[Math.min(9, Math.floor(r.s / 10))].n++);
    const bajo = sc.filter((r) => r.s < meta).length, cero = sc.filter((r) => r.cn === 0).length;
    /* 3. tendencia por grupo (sobre la encuesta elegida) */
    const GW = {}; grp.filter((r) => (isS ? r.tipo === 'PERCHA' : r.tipo !== 'PERCHA')).forEach((r) => { const o = (GW[r.sem] ||= { CN: 0, HNK: 0, MERC: 0, OTROS: 0, tot: 0 }); o[r.grupo] += Number(r.caras); o.tot += Number(r.caras); }); const gws = Object.keys(GW).sort();
    /* 4. integral SOS + SOE por PDV (semana analizada) */
    const P1 = all.filter((r) => r.w === wk), mp = {}; P1.forEach((r) => { const o = (mp[r.c] ||= { c: r.c, n: r.n, sup: r.sup, ecm: r.ecm }); o[r.p ? 'p' : 'e'] = r.tot ? (r.cn / r.tot) * 100 : null; });
    const ms = C().metaS() * 100, me = C().metaE() * 100, IN = Object.values(mp).filter((o) => o.p != null && o.e != null), cumple = IN.filter((o) => o.p >= ms && o.e >= me).length, soloP = IN.filter((o) => o.p >= ms && o.e < me).length, soloE = IN.filter((o) => o.p < ms && o.e >= me).length, ninguno = IN.filter((o) => o.p < ms && o.e < me).length;
    const worst = IN.map((o) => ({ ...o, avg: (o.p + o.e) / 2 })).sort((a, b) => a.avg - b.avg).slice(0, 40);
    /* 5. rendimiento máximo / mínimo por PDV en la ventana */
    const hist = {}; R.forEach((r) => { if (r.tot > 0) (hist[r.c] ||= []).push({ w: r.w, s: (r.cn / r.tot) * 100 }); });
    let enMax = 0, enMin = 0, an = 0; const cntMax = {}; Object.values(hist).forEach((h) => { if (h.length < 2) return; const mx = Math.max(...h.map((x) => x.s)), mn = Math.min(...h.map((x) => x.s)), c = h.find((x) => x.w === wk); if (!c || mx === mn) return; an++; if (c.s === mx) enMax++; if (c.s === mn) enMin++; h.filter((x) => x.s === mx).forEach((x) => (cntMax[x.w] = (cntMax[x.w] || 0) + 1)); });
    const mejorSem = Object.entries(cntMax).sort((a, b) => b[1] - a[1])[0];
    /* 6. alertas */
    const caida = sc.filter((r) => pm0[r.c] && pm0[r.c].tot > 0 && r.s - (pm0[r.c].cn / pm0[r.c].tot) * 100 <= -10).map((r) => ({ ...r, ant: (pm0[r.c].cn / pm0[r.c].tot) * 100, d: r.s - (pm0[r.c].cn / pm0[r.c].tot) * 100 })).sort((a, b) => a.d - b.d);
    const zero = sc.filter((r) => r.cn === 0), vistos = new Set(cur.map((r) => r.c)), sinV = [...new Map(R.filter((r) => r.w < wk && !vistos.has(r.c)).map((r) => [r.c, r])).values()];
    const consec = Object.entries(hist).filter(([, h]) => { const H = h.sort((a, b) => (a.w < b.w ? -1 : 1)); let n = 0; for (let i = H.length - 1; i >= 0 && H[i].w <= wk; i--) { if (H[i].s < meta) n++; else break; } return n >= 3 && H.some((x) => x.w === wk); }).map(([c, h]) => ({ c, n: cur.find((r) => r.c === c) || {}, h }));
    /* 7. ranking por segmento */
    const dims = [['reg', 'Región'], ['cad', 'Cadena'], ['sup', 'Supervisor'], ['ecm', 'ECM']], dm = s.biDim || 'sup';
    const seg = (rows) => { const m = {}; rows.forEach((r) => { const o = (m[r[dm]] ||= { cn: 0, tot: 0, n: new Set() }); o.cn += r.cn; o.tot += r.tot; o.n.add(r.c); }); return m; }, SC = seg(cur), SP = seg(prev);
    const RK = Object.entries(SC).map(([k, o]) => { const a = sh(o.cn, o.tot), p = SP[k] ? sh(SP[k].cn, SP[k].tot) : null; return { k, n: o.n.size, a, p, d: a != null && p != null ? a - p : null, tot: o.tot }; }).sort((a, b) => (a.a ?? 999) - (b.a ?? 999));
    const tb = (cols, rows, name) => rows.length ? table(cols, rows, { name, ps: 10 }) : '<p class="note">Sin casos.</p>';
    return `${sel(isS)}
      <div class="kp">${kpi('Share acumulado del mes (MTD)', f1(mS), `${MESN[+wk.slice(5, 7) - 1]} · ${mesW.length} sem.${mP != null ? ' · ' + dpp(mS - mP) + ' vs ' + MESN[+pmK.slice(5) - 1] + ' (' + pMesW.length + ' sem.)' : ''}`, mS >= meta ? 'var(--cE)' : 'var(--cF)')}${kpi('PDV medidos', fN(sc.length), `semana del ${wk.slice(8)}/${wk.slice(5, 7)}`, 'var(--s1)')}${kpi('Bajo la meta', fN(bajo), `${f1(pc(bajo, sc.length))} de los PDV · meta ${meta.toFixed(0)}%`, 'var(--cP)')}${kpi('Sin CN', fN(cero), 'PDV medidos sin caras CN', 'var(--cF)')}${kpi('Caras totales', fN(sumR(cur).tot), 'en la semana', 'var(--mut)')}</div>
      <div class="g2"><div class="card"><h3>Distribución de share CN por PDV</h3>${hbar(bk.map((b, i) => ({ l: b.l, v: b.n, t: fN(b.n) + ' PDV', c: i * 10 + 10 <= meta ? 'var(--cP)' : 'var(--cE)' })))}<p class="note">Rojo: tramos por debajo de la meta.</p></div>
      <div class="card"><h3>Tendencia de share por grupo (${isS ? 'percha' : 'espacios'})</h3>${gws.length > 1 ? line(gws.map((w) => w.slice(8) + '/' + w.slice(5, 7)), grupoCSV.map(([g, c]) => ({ n: g, c, d: gws.map((w) => sh(GW[w][g], GW[w].tot)) })), { ymax: 100, pct: true, tipfy: (v) => (v == null ? '' : v.toFixed(1) + '%') }) + legend(grupoCSV) : '<p class="note">Se necesitan al menos dos semanas.</p>'}</div></div>
      <div class="card"><h3>Share integral SOS + SOE</h3><p class="note">Cruce de share de percha y espacios por PDV en la misma semana. Meta: percha ${ms.toFixed(0)}% · espacios ${me.toFixed(0)}%. ${fN(IN.length)} PDV con ambas encuestas.</p>
        <div class="kp">${kpi('Cumple ambos', fN(cumple), f1(pc(cumple, IN.length)), 'var(--cE)')}${kpi('Solo percha', fN(soloP), 'cumple percha, no espacios', 'var(--s1)')}${kpi('Solo espacios', fN(soloE), 'cumple espacios, no percha', 'var(--s3)')}${kpi('No cumple ninguno', fN(ninguno), f1(pc(ninguno, IN.length)), 'var(--cP)')}</div>
        ${tb([{ h: 'PDV' }, { h: 'Supervisor' }, { h: 'ECM' }, { h: 'Share percha', n: 1 }, { h: 'Share espacios', n: 1 }, { h: 'Promedio', n: 1 }], worst.map((o) => ({ c: [`${esc(o.n)}<small class="mu">${esc(o.c)}</small>`, esc(o.sup), esc(o.ecm), f1(o.p), f1(o.e), f1(o.avg)], s: [o.n, o.sup, o.ecm, o.p, o.e, o.avg] })), 'integral_sos_soe')}</div>
      <div class="card"><h3>Rendimiento máximo en el periodo</h3><div class="kp">${kpi('En su mejor semana', fN(enMax), 'PDV en su máximo share esta semana', 'var(--cE)')}${kpi('En su peor semana', fN(enMin), 'PDV en su mínimo share esta semana', 'var(--cP)')}${kpi('Semana con más máximos', mejorSem ? `${mejorSem[0].slice(8)}/${mejorSem[0].slice(5, 7)}` : '—', mejorSem ? fN(mejorSem[1]) + ' PDV' : '', 'var(--s1)')}${kpi('PDV analizados', fN(an), 'con 2 o más semanas y variación', 'var(--mut)')}</div></div>
      <div class="card"><h3>Alertas (${fN(caida.length + zero.length + sinV.length + consec.length)})</h3>
        <h4>Caída de 10 pp o más contra la semana anterior · ${fN(caida.length)}</h4>${tb([{ h: 'PDV' }, { h: 'Supervisor' }, { h: 'Share actual', n: 1 }, { h: 'Share anterior', n: 1 }, { h: 'Variación', n: 1 }], caida.map((r) => ({ c: [`${esc(r.n)}<small class="mu">${esc(r.c)}</small>`, esc(r.sup), f1(r.s), f1(r.ant), dpp(r.d)], s: [r.n, r.sup, r.s, r.ant, r.d] })), 'alerta_caida')}
        <h4>Sin caras CN en la semana · ${fN(zero.length)}</h4>${tb([{ h: 'PDV' }, { h: 'Supervisor' }, { h: 'ECM' }, { h: 'Caras totales', n: 1 }], zero.map((r) => ({ c: [`${esc(r.n)}<small class="mu">${esc(r.c)}</small>`, esc(r.sup), esc(r.ecm), fN(r.tot)], s: [r.n, r.sup, r.ecm, r.tot] })), 'alerta_sin_cn')}
        <h4>Medidos antes y sin visita esta semana · ${fN(sinV.length)}</h4>${tb([{ h: 'PDV' }, { h: 'Supervisor' }, { h: 'ECM' }, { h: 'Última semana medido' }], sinV.map((r) => ({ c: [`${esc(r.n)}<small class="mu">${esc(r.c)}</small>`, esc(r.sup), esc(r.ecm), r.w], s: [r.n, r.sup, r.ecm, r.w] })), 'alerta_sin_visita')}
        <h4>3 o más semanas seguidas bajo la meta · ${fN(consec.length)}</h4>${tb([{ h: 'PDV' }, { h: 'Supervisor' }, { h: 'Semanas bajo meta', n: 1 }, { h: 'Share actual', n: 1 }], consec.map((o) => ({ c: [`${esc(o.n.n || o.c)}<small class="mu">${esc(o.c)}</small>`, esc(o.n.sup || ''), (() => { const H = o.h.sort((a, b) => (a.w < b.w ? -1 : 1)); let n = 0; for (let i = H.length - 1; i >= 0; i--) { if (H[i].s < meta) n++; else break; } return fN(n); })(), f1(o.h.find((x) => x.w === wk).s)], s: [o.n.n || o.c, o.n.sup || '', 0, 0] })), 'alerta_bajo_meta')}</div>
      <div class="card"><div class="bar" style="margin:0 0 8px"><h3 style="flex:1">Ranking por segmento</h3>${dims.map(([k, t]) => `<button type="button" data-bid="${k}" class="${k === dm ? 'pri' : ''}">${t}</button>`).join('')}</div>${tb([{ h: dims.find((d) => d[0] === dm)[1] }, { h: 'PDV', n: 1 }, { h: 'Share CN', n: 1 }, { h: 'Semana anterior', n: 1 }, { h: 'Variación', n: 1 }, { h: 'Caras', n: 1 }], RK.map((r) => ({ c: [esc(r.k), fN(r.n), f1(r.a), r.p == null ? '—' : f1(r.p), dpp(r.d), fN(r.tot)], s: [r.k, r.n, r.a ?? 0, r.p ?? 0, r.d ?? 0, r.tot] })), 'ranking_segmento')}<p class="note">Ordenado de menor a mayor share: los peores arriba.</p></div>`;
  }
  const sel = (isS) => `<div class="bar"><div class="seg" role="group" aria-label="Encuesta"><button type="button" data-bsv="SOS" class="${isS ? 'pri' : ''}">SOS · percha</button><button type="button" data-bsv="SOE" class="${!isS ? 'pri' : ''}">SOE · espacios</button></div><span class="note">Se analiza la semana del final del periodo elegido arriba.</span></div>`;
  document.addEventListener('click', (ev) => { const a = ev.target.closest && ev.target.closest('[data-bsv]'), b = ev.target.closest && ev.target.closest('[data-bid]'); if ((!a && !b) || !CN.shareCtx) return; if (a) ST().biSv = a.dataset.bsv; if (b) ST().biDim = b.dataset.bid; C().redraw(); });
  CN.shareTabs.bi = bi; CN.shareCache = CACHE;
})();
