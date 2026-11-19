'use strict';
/* SOS y SOE · Resumen semanal (como el sistema anterior): share de percha y de espacios con variación contra la semana anterior,
   PDV por debajo de la meta, tendencia, espacios ganados, penetración por tipo, metas de la semana, copiar resumen e imprimir. */
(function () {
  const { n: fN, p: f1, pc, kpi, hbar } = VZ;
  const C = () => CN.shareCtx, ST = () => C().ST;
  const TIPOS = [['PERCHA', 'Percha'], ['BANDEJA FRÍO', 'Bandeja frío'], ['BANDEJA SECO', 'Bandeja seco'], ['RUMA', 'Ruma']];
  const wsd = () => Number(S.cfg.semana_inicio ?? 3);
  const dow = (d) => new Date(d + 'T00:00:00Z').getUTCDay();
  const iniSem = (d) => C().add(d, -((dow(d) - wsd() + 7) % 7));
  const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const corta = (d) => `${+d.slice(8)} ${MES[+d.slice(5, 7) - 1]}`;
  /* número de semana operativa: la semana 1 es la que contiene el 1 de enero */
  function claveSem(ini) {
    for (const y of [+ini.slice(0, 4) + 1, +ini.slice(0, 4)]) { const j1 = (dow(`${y}-01-01`) - wsd() + 7) % 7, s1 = C().add(`${y}-01-01`, -j1); if (ini >= s1) return { y, w: Math.round((Date.parse(ini) - Date.parse(s1)) / 6048e5) + 1 }; }
    return { y: +ini.slice(0, 4), w: 1 };
  }
  const pk = (k) => `${k.y}-W${String(k.w).padStart(2, '0')}`;
  const sp = (vals, color) => { const v = vals.filter((x) => x != null); if (v.length < 2) return ''; const W = 150, H = 38, mn = Math.min(...v), mx = Math.max(...v), r = mx - mn || 1, pts = vals.map((x, i) => (x == null ? null : [(i / (vals.length - 1)) * (W - 10) + 5, H - 7 - ((x - mn) / r) * (H - 14)])).filter(Boolean), l = pts[pts.length - 1]; return `<svg class="spark" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Tendencia de las últimas semanas"><polyline points="${pts.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${l[0]}" cy="${l[1]}" r="3.5" fill="${color}"/></svg>`; };
  const dpp = (v) => (v == null ? '<span class="mu">—</span>' : `<span style="color:var(${v >= 0 ? '--cE' : '--cP'})">${v >= 0 ? '▲' : '▼'} ${Math.abs(v).toFixed(1)} pp</span>`);
  const barra = (v, meta, c) => `<div class="pbar" role="img" aria-label="${f1(v)}"><div class="pfill" style="width:${Math.max(0, Math.min(100, v || 0))}%;background:${c}"></div>${meta ? `<div class="pmark" style="left:${meta}%" title="Meta ${meta}%"></div>` : ''}</div>`;
  let DATA = null;

  /* ---------- navegador de semana dentro de la barra de filtros ---------- */
  function weekNav() {
    const s = ST(), ini = iniSem(s.from || C().ymd(new Date())), k = claveSem(ini), hoy = iniSem(C().ymd(new Date()));
    return `<div class="wknav"><button type="button" class="icon" data-wk="-1" aria-label="Semana anterior">‹</button><div class="wk"><strong>Semana ${k.w}</strong><span class="note">${corta(ini)} – ${corta(C().add(ini, 6))} ${k.y}</span></div><button type="button" class="icon" data-wk="1" aria-label="Semana siguiente">›</button>${ini !== hoy ? '<button type="button" data-wk="hoy">Esta semana</button>' : ''}</div>`;
  }
  function anclar(hasta) { const s = ST(); if (s.semAnc) return; s.semAnc = 1; const ini = iniSem(hasta || C().ymd(new Date())); s.from = ini; s.to = C().add(ini, 6); }
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest && ev.target.closest('[data-wk]'); if (!b || !CN.shareCtx) return; const s = ST(), ini = iniSem(s.from);
    const nu = b.dataset.wk === 'hoy' ? iniSem(C().ymd(new Date())) : C().add(ini, 7 * Number(b.dataset.wk)); s.from = nu; s.to = C().add(nu, 6); C().redraw();
  });

  /* ---------- cálculo por PDV ---------- */
  const porPdv = (rows) => { const m = {}; rows.forEach((r) => { const o = (m[r.dim] ||= { n: r.nombre, t: {} }), t = (o.t[r.tipo] ||= { CN: 0, tot: 0 }), c = Number(r.caras); t.tot += c; if (r.grupo === 'CN') t.CN += c; }); return m; };
  const share = (pdvs, tipos) => { let cn = 0, tot = 0; pdvs.forEach((p) => tipos.forEach((t) => { const x = p.t[t]; if (x) { cn += x.CN; tot += x.tot; } })); return tot ? (cn / tot) * 100 : null; };
  const ESPT = ['BANDEJA FRÍO', 'BANDEJA SECO', 'RUMA'];

  async function cargar() {
    const s = ST(), a = s.from, b = s.to, pa = C().add(a, -7), pb = C().add(a, -1), sa = C().add(a, -49);
    const [cur, prev, serie] = await Promise.all([C().agg('pdv', { from: a, to: b }), C().agg('pdv', { from: pa, to: pb }), C().agg('TOTAL', { from: sa, to: b })]);
    const Cu = porPdv(cur), Pr = porPdv(prev), k = claveSem(a);
    /* serie semanal */
    const W = C().bySem(serie), ws = Object.keys(W).sort(), A = ws.map((w) => C().acum(W[w]));
    /* metas de la semana (de la semana o de su mes) */
    const mesK = a.slice(0, 7), { data: MT } = await sb.from('metas').select('*').in('mes', [pk(k), mesK]);
    const metas = await Promise.all((MT || []).map(async (m) => { try { return { m, r: await CN.metaAvance(m) }; } catch (e) { return { m, r: null }; } }));
    /* espacios ganados de la semana */
    const G = await CN.fetchPar((o) => { let q = sb.from('ganancias').select('fecha,codigo,ecm,supervisor,cadena,percha,frio,seco,ruma', o).gte('fecha', a).lte('fecha', b); if (s.ecm.length) q = q.in('ecm', s.ecm.map((x) => x.toUpperCase())); if (s.sup.length) q = q.in('supervisor', s.sup.map((x) => x.toUpperCase())); return q.order('id'); });
    let nV = 0; try { nV = (await CN.fetchPar((o) => { let q = sb.from('visitas').select('ecm', o).eq('categoria', 'E').gte('fecha', a).lte('fecha', b); if (s.ecm.length) q = q.in('ecm', s.ecm.map((x) => x.toUpperCase())); if (s.sup.length) q = q.in('supervisor', s.sup); if (s.reg.length) q = q.in('region', s.reg); return q.order('id'); })).length; } catch (e) { /* sin visitas */ }
    return (DATA = { a, b, k, Cu, Pr, A, ws, metas, G, nV });
  }

  /* ---------- Resumen semanal ---------- */
  async function sem() {
    const D = await cargar(), { Cu, Pr, A } = D, cur = Object.values(Cu), ms = C().metaS() * 100, me = C().metaE() * 100;
    if (!cur.length && !Object.keys(Pr).length) return `<div class="card"><h3>Sin encuesta en esta semana</h3><p>No hay datos de SOS/SOE entre el ${D.a} y el ${D.b} con estos filtros. Usa las flechas para ir a otra semana.</p></div>`;
    /* SOS (solo PDV medidos en las dos semanas, como el sistema anterior) */
    const comp = Object.keys(Cu).filter((c) => Pr[c] && (Cu[c].t.PERCHA || { tot: 0 }).tot > 0 && (Pr[c].t.PERCHA || { tot: 0 }).tot > 0), sosC = share(comp.map((c) => Cu[c]), ['PERCHA']), sosP = share(comp.map((c) => Pr[c]), ['PERCHA']);
    const sosAll = share(cur, ['PERCHA']), pdvS = cur.filter((p) => p.t.PERCHA && p.t.PERCHA.tot > 0), bajo = pdvS.filter((p) => (p.t.PERCHA.CN / p.t.PERCHA.tot) * 100 < ms).length;
    const serS = A.map((x) => x.sos), serE = A.map((x) => x.soe);
    const sosV = sosC != null && sosP != null ? sosC - sosP : null;
    const cardS = pdvS.length ? `<div class="big"><div class="big-t">Share de percha CN <span class="note">SOS · semana ${D.k.w}</span></div><div class="big-v">${f1(sosAll)}</div><div class="big-d">${comp.length ? dpp(sosV) + ' vs semana anterior' : '<span class="mu">Sin semana anterior comparable</span>'}</div>${barra(sosAll, ms, sosAll >= ms ? 'var(--cE)' : 'var(--cF)')}<p class="big-l">Meta ${ms.toFixed(0)}% · ${fN(bajo)} de ${fN(pdvS.length)} PDV por debajo</p><p class="note">${fN(pdvS.length)} PDV medidos${comp.length ? ' · ' + fN(comp.length) + ' comparables con la semana anterior' : ''}</p>${sp(serS, 'var(--s1)')}</div>` : '<div class="big empty"><div class="big-t">Share de percha CN</div><p class="note">Todavía no hay encuesta de percha en esta semana.</p></div>';
    /* SOE */
    const pdvE = cur.filter((p) => ESPT.some((t) => p.t[t] && p.t[t].tot > 0)), sinCn = pdvE.filter((p) => !ESPT.some((t) => p.t[t] && p.t[t].CN > 0)).length, compE = Object.keys(Cu).filter((c) => Pr[c] && ESPT.some((t) => (Cu[c].t[t] || { tot: 0 }).tot > 0) && ESPT.some((t) => (Pr[c].t[t] || { tot: 0 }).tot > 0));
    const soeAll = share(cur, ESPT), soeC = share(compE.map((c) => Cu[c]), ESPT), soeP = share(compE.map((c) => Pr[c]), ESPT);
    const tipoRows = ESPT.map((t) => ({ t, v: share(cur, [t]), d: compE.length ? (share(compE.map((c) => Cu[c]), [t]) ?? NaN) - (share(compE.map((c) => Pr[c]), [t]) ?? NaN) : null })).filter((x) => x.v != null);
    const cardE = pdvE.length ? `<div class="big"><div class="big-t">Share de espacios CN <span class="note">SOE · semana ${D.k.w}</span></div><div class="big-v">${f1(soeAll)}</div><div class="big-d">${compE.length ? dpp(soeC != null && soeP != null ? soeC - soeP : null) + ' vs semana anterior' : '<span class="mu">Sin semana anterior comparable</span>'}</div>${barra(soeAll, me, soeAll >= me ? 'var(--cE)' : 'var(--cF)')}<div class="mini">${tipoRows.map((x) => `<div class="mrow"><span>${esc(x.t)}</span><strong>${f1(x.v)}</strong><span>${isNaN(x.d) || x.d == null ? '' : dpp(x.d)}</span></div>`).join('')}</div><p class="note">${fN(sinCn)} PDV sin espacios CN · ${fN(pdvE.length)} PDV medidos</p>${sp(serE, 'var(--s3)')}</div>` : '<div class="big empty"><div class="big-t">Share de espacios CN</div><p class="note">Todavía no hay encuesta de espacios en esta semana.</p></div>';
    /* espacios ganados */
    const G = D.G, T = { percha: 0, frio: 0, seco: 0, ruma: 0 }; G.forEach((g) => ['percha', 'frio', 'seco', 'ruma'].forEach((k) => (T[k] += g[k] || 0)));
    const tot = T.percha + T.frio + T.seco + T.ruma, dias = {}; G.forEach((g) => (dias[g.fecha] = (dias[g.fecha] || 0) + (g.percha || 0) + (g.frio || 0) + (g.seco || 0) + (g.ruma || 0)));
    const dl = Object.keys(dias).sort(), mxd = Math.max(1, ...dl.map((d) => dias[d])), WD = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'], porE = {}; G.forEach((g) => (porE[g.ecm] = (porE[g.ecm] || 0) + (g.percha || 0) + (g.frio || 0) + (g.seco || 0) + (g.ruma || 0)));
    const top = Object.entries(porE).sort((a, b) => b[1] - a[1]).slice(0, 3), conG = new Set(G.map((g) => g.ecm + '|' + g.codigo + '|' + g.fecha)).size;
    const secG = `<section class="rs-sec"><div class="rs-h"><h2>Espacios ganados</h2><span class="src rep">Reportes de ECM</span><span class="note">Lo que se logró al visitar los PDV</span></div>${G.length ? `<div class="rs-gan"><div class="big"><div class="big-t">Caras y espacios ganados</div><div class="big-v">${fN(tot)}</div><div class="tiles">${[['Percha', T.percha], ['Bandeja frío', T.frio], ['Bandeja seco', T.seco], ['Ruma', T.ruma]].map(([n, v]) => `<div class="tile"><span class="note">${n}</span><strong>${fN(v)}</strong></div>`).join('')}</div><p class="big-l">${fN(D.nV)} visitas efectivas · ${fN(conG)} con ganancia (${D.nV ? f1(pc(conG, D.nV)).replace('.0', '') : '—'})</p></div><div class="big"><div class="big-t">Por día</div><div class="daybars">${dl.map((d) => `<div class="db"><div class="dbn">${fN(dias[d])}</div><div class="dbb" style="height:${Math.max(4, (dias[d] / mxd) * 80)}px"></div><div class="dbl">${WD[dow(d)]} ${d.slice(8)}</div></div>`).join('')}</div>${top.length ? `<p class="note" style="margin-top:10px">Más ganancias: ${top.map(([e, v]) => esc(e) + ' (' + fN(v) + ')').join(' · ')}</p>` : ''}</div></div>` : '<div class="big empty"><p>Aún no hay ganancias reportadas esta semana.</p></div>'}<p class="note rs-foot">Esto lo reportan los ECM al visitar; el share de arriba sale de la encuesta. Son datos complementarios y no tienen por qué coincidir.</p></section>`;
    /* penetración */
    const tiles = TIPOS.map(([t, n]) => { const med = cur.filter((p) => p.t[t] && p.t[t].tot > 0), alc = med.filter((p) => p.t[t].CN > 0).length, pm = Object.values(Pr).filter((p) => p.t[t] && p.t[t].tot > 0), pa = pm.filter((p) => p.t[t].CN > 0).length; if (!med.length) return ''; const pen = (alc / med.length) * 100, pp = pm.length ? (pa / pm.length) * 100 : null; return `<div class="big sm"><div class="big-t">${n}</div><div class="big-v">${f1(pen).replace('.0', '')}</div>${barra(pen, 0, 'var(--s1)')}<p class="big-l">${fN(alc)} de ${fN(med.length)} locales medidos con CN</p><p class="note">${dpp(pp == null ? null : pen - pp)} vs semana anterior</p></div>`; }).join('');
    const secP = tiles ? `<section class="rs-sec"><div class="rs-h"><h2>Penetración</h2><span class="src enc">Encuesta</span><span class="note">En cuántos locales está CN</span></div><div class="rs-grid4">${tiles}</div></section>` : '';
    /* metas de la semana */
    const esP = (m) => m.modo === 'share' || m.modo === 'penetracion', fv = (m, v) => (v == null ? '—' : esP(m) ? (v * 100).toFixed(1) + '%' : fN(Math.round(v)));
    const filasM = D.metas.filter((x) => x.r).map(({ m, r }) => { const p = r.actual == null ? null : esP(m) ? r.actual / m.valor : r.actual / (m.valor || 1), c = p == null ? 'var(--mut)' : p >= 1 ? 'var(--cE)' : p >= 0.7 ? 'var(--cF)' : 'var(--cP)', st = p == null ? 'Sin dato' : p >= 1 ? '✓ En meta' : p >= 0.7 ? '! En riesgo' : '✕ Atrasado'; return `<div class="mrow2"><div class="mn"><strong>${esc(m.nombre)}</strong><span class="note">${esc(m.responsable || '')}</span></div>${barra(p == null ? 0 : p * 100, 0, c)}<div class="mv"><strong style="color:${c}">${p == null ? '—' : f1(p * 100).replace('.0', '')}</strong><span class="note">${fv(m, r.actual)} de ${fv(m, m.valor)}</span></div><span class="chip" style="color:${c}">${st}</span></div>`; }).join('');
    const secM = `<section class="rs-sec"><div class="rs-h"><h2>Metas de la semana</h2><span class="src plan">Plan</span><span class="note">Cuánto falta para llegar a la meta</span></div>${filasM ? `<div class="big"><div class="mlist">${filasM}</div></div>` : '<div class="big empty"><p>No hay metas definidas para esta semana ni para su mes.</p></div>'}<p class="note"><a href="#metas">Ver metas y avance por equipo</a></p></section>`;
    return `<div class="bar noprint"><span class="note">Los datos respetan los filtros de región, cadena, supervisor y ECM.</span><span style="flex:1"></span><button type="button" data-cs>Copiar resumen</button><button type="button" data-pr>Imprimir / PDF</button></div>
      <section class="rs-sec"><div class="rs-h"><h2>Share en góndola</h2><span class="src enc">Encuesta</span><span class="note">Cómo está CN frente a la competencia</span></div><div class="rs-grid">${cardS}${cardE}</div></section>${secG}${secP}${secM}`;
  }

  /* ---------- copiar resumen / imprimir ---------- */
  function copiar() {
    const D = DATA; if (!D) return; const ms = C().metaS() * 100, me = C().metaE() * 100, cur = Object.values(D.Cu);
    const sosAll = share(cur, ['PERCHA']), soeAll = share(cur, ESPT), L = [`*Resumen · semana ${D.k.w} (${corta(D.a)} – ${corta(D.b)} ${D.k.y})*`];
    const s = ST(), fl = [['Región', s.reg], ['Cadena', s.cad], ['Supervisor', s.sup], ['ECM', s.ecm]].filter(([, v]) => v.length); if (fl.length) L.push('Filtro: ' + fl.map(([k, v]) => k + ' ' + v.join(', ')).join(' · '));
    if (sosAll != null) L.push(`Share de percha CN: ${f1(sosAll)} · meta ${ms.toFixed(0)}% · ${fN(cur.filter((p) => p.t.PERCHA && p.t.PERCHA.tot > 0 && (p.t.PERCHA.CN / p.t.PERCHA.tot) * 100 < ms).length)} PDV por debajo`);
    if (soeAll != null) L.push(`Share de espacios CN: ${f1(soeAll)} · meta ${me.toFixed(0)}% · ${fN(cur.filter((p) => ESPT.some((t) => p.t[t] && p.t[t].tot > 0) && !ESPT.some((t) => p.t[t] && p.t[t].CN > 0)).length)} PDV sin espacios CN`);
    const g = D.G.reduce((a, x) => a + (x.percha || 0) + (x.frio || 0) + (x.seco || 0) + (x.ruma || 0), 0); if (g) L.push(`Espacios ganados (reportes ECM): ${fN(g)} · ${fN(D.nV)} visitas efectivas`);
    const mm = D.metas.filter((x) => x.r && x.r.actual != null && x.m.valor).map(({ m, r }) => `${m.nombre} ${f1((r.actual / m.valor) * 100).replace('.0', '')}`); if (mm.length) L.push('Avance de metas: ' + mm.join(' · '));
    const txt = L.join('\n'), ok = () => toast('Resumen copiado. Pégalo en WhatsApp o correo.');
    const fb = () => { const t = document.createElement('textarea'); t.style.cssText = 'position:fixed;opacity:0;left:-999px'; t.value = txt; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); ok(); } catch (e) { toast('No se pudo copiar. Selecciona y copia el texto manualmente.'); } t.remove(); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok).catch(fb); else fb();
  }
  document.addEventListener('click', (ev) => { if (ev.target.closest && ev.target.closest('[data-cs]')) copiar(); if (ev.target.closest && ev.target.closest('[data-pr]')) window.print(); });
  CN.shareTabs = { sem, weekNav, anclar };
})();
