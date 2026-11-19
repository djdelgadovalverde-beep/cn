'use strict';
/* Análisis de Visitas y Tareas: reglas del sistema anterior (E efectiva · P perdida · F fuera de rango / justificada · M menos de 2 min / mal ejecutada). */
(function () {
  const { n: fN, p: f1, pc, kpi, hbar, stack, line, vstack, heat, table, tabs, legend, tone, COL, CAT } = VZ;
  const WDS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'], MN = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const CATL = CN.CATL;
  const wk = (d) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7)); return t.toISOString().slice(0, 10); };
  const dow = (d) => new Date(d + 'T00:00:00Z').getUTCDay();
  const dayAdd = (d, n) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
  const lab = (g, k) => (g === 'month' ? MN[+k.slice(5, 7) - 1] + ' ' + k.slice(2, 4) : g === 'week' ? 'Sem ' + k.slice(8) + '/' + k.slice(5, 7) : k.slice(8) + '/' + k.slice(5, 7));
  const monthRange = (m) => { const [y, mo] = m.split('-').map(Number); return [`${m}-01`, `${m}-${String(new Date(Date.UTC(y, mo, 0)).getUTCDate()).padStart(2, '0')}`]; };

  const ST = {}, CACHE = {}; let VER = 0;
  const DIMS = { vis: [['sup', 'Supervisor'], ['ecm', 'BDR / ECM'], ['reg', 'Región'], ['ger', 'Gerencia'], ['cli', 'Cliente']], tar: [['sup', 'Supervisor'], ['ecm', 'ECM'], ['reg', 'Región'], ['pil', 'Pilar'], ['task', 'Tarea'], ['cli', 'Cliente']] };
  const TABS = { vis: [['dash', 'Dashboard'], ['sbd', 'Ranking'], ['inf', 'Informe de motivos'], ['jus', 'Justificaciones'], ['par', 'Motivos'], ['cal', 'Calidad'], ['rei', 'Reincidencias'], ['afe', 'Clientes afectados'], ['dur', 'Duración'], ['time', 'Línea de tiempo'], ['heat', 'Mapa de calor'], ['pen', 'Antigüedad'], ['pry', 'Proyección'], ['ins', 'Insights'], ['cmp', 'Cruce antifraude'], ['det', 'Registro y justificación']],
    tar: [['dash', 'Dashboard'], ['sbd', 'Ranking'], ['inf', 'Informe de motivos'], ['jus', 'Justificaciones'], ['par', 'Motivos'], ['cal', 'Calidad'], ['pil', 'Pilares y frío'], ['rei', 'Reincidencias'], ['time', 'Línea de tiempo'], ['heat', 'Mapa de calor'], ['pen', 'Antigüedad'], ['pry', 'Proyección'], ['ins', 'Insights'], ['cmp', 'Cruce antifraude'], ['det', 'Registro y justificación']] };

  /* ---------- datos ---------- */
  /* filtros que viajan al servidor (si incluyen «—» se filtran en el navegador) */
  const FSV = (f) => { const o = {}; if (f) ['reg', 'ger', 'sup', 'ecm'].forEach((k) => { if (f[k] && f[k].length && !f[k].includes('—')) o[k] = f[k]; }); return o; };
  const sigF = (f) => JSON.stringify(FSV(f));
  const SVC = { reg: 'region', ger: 'gerencia', sup: 'supervisor', ecm: 'ecm' };
  const OPTS = {};
  async function opciones(tp, d, h) {
    const k = `${tp}|${d}|${h}`; if (OPTS[k]) return OPTS[k];
    const { data, error } = await sb.rpc('vt_opts', { p_tipo: tp, p_desde: d, p_hasta: h }); if (error) throw error;
    return (OPTS[k] = data || []);
  }
  async function cargar(tp, d, h, f) {
    const sv = FSV(f), sg = JSON.stringify(sv), vacio = sg === '{}', k = `${tp}|${d}|${h}|${sg}`, k0 = `${tp}|${d}|${h}|{}`;
    if (CACHE[k]) return CACHE[k];
    if (!vacio && CACHE[k0]) return CACHE[k0]; /* ya está todo el periodo en memoria: se filtra en el navegador */
    const tabla = tp === 'vis' ? 'visitas' : 'tareas';
    const cols = tp === 'vis' ? 'id,fecha,region,gerencia,supervisor,ecm,codigo_cliente,cliente,estado,categoria,detalle' : 'id,fecha,region,supervisor,ecm,codigo_cliente,cliente,pilar,descripcion,estado,categoria,es_frio,detalle';
    const aplicar = (q, cs) => { Object.entries(sv).forEach(([kk, v]) => { if (cs.includes(kk)) q = q.in(SVC[kk], v); }); return q; };
    const [rows, js] = await Promise.all([CN.fetchPar((o) => aplicar(sb.from(tabla).select(cols, o).gte('fecha', d).lte('fecha', h), ['reg', 'ger', 'sup', 'ecm']).order('id')),
      CN.fetchPar((o) => aplicar(sb.from('justificaciones').select('id,registro_id,motivo,responsable,observacion,estado,creado_en,revisado_en', o).eq('tipo', tp).gte('fecha', d).lte('fecha', h), ['sup', 'ecm']).order('id'))]);
    const J = {}; js.forEach((j) => (J[j.registro_id] = j));
    const R = rows.map((x) => {
      const j = J[x.id] || null, dt = x.detalle || {};
      return { id: x.id, d: x.fecha, day: x.fecha, reg: x.region || '—', ger: x.gerencia || '—', sup: x.supervisor || '—', ecm: x.ecm, cli: x.codigo_cliente || '—', cn: x.cliente || '—', c: x.categoria, min: dt.min == null ? null : Number(dt.min),
        pil: x.pilar || '—', task: x.descripcion || '—', jtxt: dt.just_nc || dt.just_fr || x.estado || '', frio: !!x.es_frio, jus: dt.justificacion || 'SIN JUSTIFICACIÓN', st: x.estado || '', j, jv: !!j && j.estado !== 'rechazada' && j.responsable === 'CN' && x.categoria !== 'E', jad: !!j && j.estado !== 'rechazada' && j.responsable !== 'CN' && x.categoria !== 'E' && !!(S.motivos.find((mo) => mo.motivo === j.motivo) || {}).excluye_adicional, gps: dt.gps, ejec: dt.ejecucion, fotos: dt.estado_fotos || '' };
    });
    return (CACHE[k] = { R, J, d, h, ver: VER, sig: sg });
  }
  const invalidar = () => { VER++; Object.keys(CACHE).forEach((k) => delete CACHE[k]); };
  CN.invalidarAnalisis = invalidar;

  const ag = (rs) => { const a = { p: 0, E: 0, P: 0, M: 0, F: 0, jP: 0, jF: 0, jM: 0, jAd: 0 }; for (const r of rs) { a.p++; a[r.c]++; if (r.jv) a['j' + r.c]++; if (r.jad) a.jAd++; } a.j = a.jP + a.jF + a.jM; a.ef = pc(a.E, a.p); a.ea = pc(a.E + a.j, a.p); a.e1 = pc(a.E, a.p - a.j); a.e2 = pc(a.E, a.p - a.j - a.jAd); return a; };
  const grp = (rs, f) => { const m = new Map(); rs.forEach((r) => { const k = typeof f === 'function' ? f(r) : r[f]; if (!m.has(k)) m.set(k, []); m.get(k).push(r); }); return m; };
  const pill = (v, meta) => `<span class="semaforo" style="--c:${tone(v, meta)}"></span>${f1(v)}`;
  const meta0 = (tp) => Math.round(Number(S.cfg[tp === 'vis' ? 'meta_vis' : 'meta_tar'] || 0.9) * 100);

  /* ---------- filtros ---------- */
  const inA = (a, v) => !a || !a.length || a.includes(v);
  function filtrar(X) {
    const s = X.S, o = X.D;
    return o.R.filter((r) => inA(s.reg, r.reg) && inA(s.ger, r.ger) && inA(s.sup, r.sup) && inA(s.ecm, r.ecm) && inA(s.dow, String(dow(r.d))) &&
      (!s.fr.length || s.fr.includes(r.frio ? '1' : '0')) && (!s.dur.length || s.dur.some((v) => durOk(v, r))) && (!s.cat || (s.cat === 'NE' ? r.c !== 'E' : r.c === s.cat)));
  }
  const durOk = (v, r) => { const m = r.min; if (v === 'nd') return m == null; if (m == null) return false; const p = v.split('-'); return m >= +p[0] && (p[1] === '' || m < +p[1]); };
  const uq = (X, k, fn) => [...new Set(X.D.R.filter((r) => fn(r)).map((r) => r[k]))].sort((a, b) => String(a).localeCompare(String(b), 'es'));
  const sel = (id, l, opts, cur) => `<label>${l}<select id="${id}">${opts.map((o) => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(t)}</option>`; }).join('')}</select></label>`;
  const DURB = [['0-2', 'Menos de 2 min'], ['2-10', '2 a 10 min'], ['10-30', '10 a 30 min'], ['30-60', '30 a 60 min'], ['60-90', '60 a 90 min'], ['90-', 'Más de 90 min'], ['nd', 'Sin dato']];
  function barra(tp, X) {
    const s = X.S, r = X.O || X.D.R, uq = (k, fn) => [...new Set(r.filter(fn).map((x) => x[k]))].sort((a, b) => String(a).localeCompare(String(b), 'es'));
    const reg = uq('reg', () => true), ger = uq('ger', (x) => inA(s.reg, x.reg)), sup = uq('sup', (x) => inA(s.reg, x.reg) && inA(s.ger, x.ger)), ecm = uq('ecm', (x) => inA(s.reg, x.reg) && inA(s.ger, x.ger) && inA(s.sup, x.sup));
    return `<div class="fbar"><label>Desde<input type="date" id="f_from" value="${s.from}"></label><label>Hasta<input type="date" id="f_to" value="${s.to}"></label>${VZ.quick()}
      ${VZ.msel('reg', 'Región', reg, s.reg)}${tp === 'vis' ? VZ.msel('ger', 'Gerencia de ventas', ger, s.ger) : ''}${VZ.msel('sup', 'Supervisor', sup, s.sup)}${VZ.msel('ecm', tp === 'vis' ? 'BDR' : 'ECM', ecm, s.ecm)}
      ${VZ.msel('dow', 'Día de la semana', WDS.map((d, i) => [String(i), d]), s.dow)}
      ${tp === 'vis' ? VZ.msel('dur', 'Duración', DURB, s.dur) : VZ.msel('fr', 'Tipo de tarea', [['1', 'Equipo de frío'], ['0', 'Resto']], s.fr)}
      <label>Meta efectividad %<input type="number" id="f_meta" value="${s.meta}" min="0" max="100" style="width:90px"></label><label class="ck" style="flex-direction:row;align-items:center;gap:6px"><input type="checkbox" id="f_adj" ${s.adj ? 'checked' : ''}> Ver ajuste por justificaciones</label>
      <button id="f_clr">Limpiar filtros</button><button id="f_ref" title="Vuelve a leer los datos">Actualizar</button></div>`;
  }

  /* ---------- períodos ---------- */
  const span = (X) => (new Date(X.D.h) - new Date(X.D.d)) / 864e5 + 1;
  const gran = (X) => (X.S.gran !== 'auto' ? X.S.gran : span(X) > 92 ? 'month' : span(X) > 31 ? 'week' : 'day');
  const per = (g, d) => (g === 'month' ? d.slice(0, 7) : g === 'week' ? wk(d) : d);
  function serie(rs, g) { const m = grp(rs, (r) => per(g, r.d)); const ks = [...m.keys()].sort(); return { ks, a: ks.map((k) => ag(m.get(k))) }; }

  /* ---------- pestañas ---------- */
  function ejecutivo(tp, X, rs, a) {
    const meta = X.S.meta; if (!a.p) return '<div class="card ex"><h3>Resumen ejecutivo</h3><p>Sin datos para los filtros seleccionados.</p></div>';
    const T = a.p - a.E, B = [...grp(rs, 'ecm')].map(([n, x]) => ({ n, ne: x.length - ag(x).E })).sort((p, q) => q.ne - p.ne);
    let c = 0, k = 0; while (k < B.length && c < T * 0.6) c += B[k++].ne;
    const cs = (tp === 'vis' ? [['fuera de rango', a.F], ['perdidas', a.P], ['atenciones de menos de 2 min', a.M]] : [['abiertas', a.P], ['mal ejecutadas', a.M], ['justificadas', a.F]]).sort((p, q) => q[1] - p[1])[0], gap = a.ef - meta;
    return `<div class="card ex"><h3>Resumen ejecutivo</h3><p>La efectividad es de <b>${f1(a.ef)}</b>, ${gap >= 0 ? gap.toFixed(1) + ' pts sobre' : (-gap).toFixed(1) + ' pts bajo'} la meta de ${meta}%. ${T ? `De ${fN(a.p)} ${tp === 'vis' ? 'visitas programadas' : 'tareas'}, ${fN(T)} no fueron efectivas; la causa principal es ${cs[0]} (${f1(pc(cs[1], T))}). ${k} de ${B.length} ${tp === 'vis' ? 'BDR' : 'ECM'} concentran el 60% de las no efectivas.${a.j ? ` Con las ${fN(a.j)} justificadas validadas la efectividad ajustada sería <b>${f1(a.ea)}</b> (${a.ea - a.ef >= 0 ? '+' : ''}${(a.ea - a.ef).toFixed(1)} pts).` : ' Aún no hay justificaciones validadas que ajustar.'}` : 'Todo fue efectivo.'}</p></div>`;
  }
  const kpis = (tp, a, meta) => `<div class="kp">${kpi(tp === 'vis' ? 'Programadas' : 'Tareas', fN(a.p))}${kpi('Efectivas', fN(a.E), f1(a.ef), 'var(--cE)')}${tp === 'vis' ? kpi('Perdidas', fN(a.P), f1(pc(a.P, a.p)), 'var(--cP)') + kpi('Fuera de rango', fN(a.F), f1(pc(a.F, a.p)), 'var(--cF)') + kpi('Menos de 2 min', fN(a.M), f1(pc(a.M, a.p)), 'var(--cM)') : kpi('Abiertas', fN(a.P), f1(pc(a.P, a.p)), 'var(--cP)') + kpi('Mal ejecutadas', fN(a.M), f1(pc(a.M, a.p)), 'var(--cM)') + kpi('Justificadas (estado)', fN(a.F), f1(pc(a.F, a.p)), 'var(--cF)')}
    ${kpi('Efectividad', f1(a.ef), `Meta ${meta}%`, tone(a.ef, meta))}${kpi('Con justificadas CN', f1(a.ea), `${fN(a.j)} justificadas válidas`, tone(a.ea, meta))}${a.j ? kpi('Sin las CN', f1(a.e1), `restando ${fN(a.j)} del total`, tone(a.e1, meta)) : ''}${a.jAd ? kpi('Ajustada (sin CN ni adicionales)', f1(a.e2), `restando ${fN(a.j)} CN y ${fN(a.jAd)} adicionales`, tone(a.e2, meta)) : ''}</div>`;
  const ADJ = (X, a) => (X.S.adj ? ` <span class="note">(aj. ${f1(a.ea)})</span>` : '');

  function dash(tp, X, rs) {
    const a = ag(rs), g = gran(X), s = serie(rs, g), meta = X.S.meta;
    const sups = [...grp(rs, 'sup')].map(([n, x]) => ({ n, ...ag(x) })).sort((p, q) => p.ef - q.ef);
    const bdr = [...grp(rs, 'ecm')].map(([n, x]) => ({ n, ...ag(x) })).filter((x) => x.p >= 5).sort((p, q) => p.ef - q.ef).slice(0, 5);
    const comp = tp === 'vis' ? [['E', 'Efectivas'], ['P', 'Perdidas'], ['F', 'Fuera de rango'], ['M', 'Menos de 2 min']] : [['E', 'Efectivas'], ['M', 'Mal ejecutadas'], ['F', 'Justificadas'], ['P', 'Abiertas']];
    return ejecutivo(tp, X, rs, a) + kpis(tp, a, meta) +
      `<div class="g2"><div class="card"><h3>Efectividad por ${g === 'day' ? 'día' : g === 'week' ? 'semana' : 'mes'}</h3>${line(s.ks.map((k) => lab(g, k)), [{ n: 'Efectividad', c: COL[0], d: s.a.map((x) => x.ef) }, ...(X.S.adj ? [{ n: 'Ajustada', c: COL[2], d: s.a.map((x) => x.ea) }] : [])], { meta, ymax: 100, pct: true, tipfy: (v) => v.toFixed(1) + '%', aria: 'Tendencia de efectividad' })}</div>
      <div class="card"><h3>Composición por periodo</h3>${vstack(s.ks.map((k) => lab(g, k)), comp.map(([c, n]) => ({ n, c: CAT[c], d: s.a.map((x) => x[c]) })), { aria: 'Composición por estado' })}</div></div>
      <div class="g2"><div class="card"><h3>Supervisores · menor a mayor efectividad</h3>${hbar(sups.slice(0, 12).map((x) => ({ l: x.n, v: x.ef, t: f1(x.ef), c: tone(x.ef, meta), tip: `${x.n}\n${fN(x.p)} · efectividad ${f1(x.ef)} · ajustada ${f1(x.ea)}` })), { max: 100, meta })}</div>
      <div class="card"><h3>5 ${tp === 'vis' ? 'BDR' : 'ECM'} con menor efectividad (mín. 5)</h3>${hbar(bdr.map((x) => ({ l: x.n, v: x.ef, t: f1(x.ef), c: tone(x.ef, meta), tip: `${x.n}\n${fN(x.p)} · ${f1(x.ef)}` })), { max: 100, meta }) || '<p class="note">Sin datos suficientes.</p>'}</div></div>`;
  }

  function sbd(tp, X, rs) {
    const dm = X.S.dim, meta = X.S.meta, key = dm;
    const G = [...grp(rs, key)].map(([n, x]) => ({ n, sup: x[0].sup, ...ag(x) })).sort((a, b) => a.ef - b.ef);
    const cols = [{ h: DIMS[tp].find((d) => d[0] === dm)[1] }, { h: 'Supervisor' }, { h: 'Prog.', n: 1 }, { h: 'Efectivas', n: 1 }, ...(tp === 'vis' ? [{ h: 'Perdidas', n: 1 }, { h: 'Fuera rango', n: 1 }, { h: '&lt;2 min', n: 1 }] : [{ h: 'Abiertas', n: 1 }, { h: 'Mal ejec.', n: 1 }, { h: 'Justif.', n: 1 }]), { h: 'Efectividad', n: 1 }, { h: 'Justif. válidas', n: 1 }, { h: 'Ajustada', n: 1 }];
    const rows = G.map((x) => ({ c: [esc(x.n), esc(x.sup), fN(x.p), fN(x.E), fN(tp === 'vis' ? x.P : x.P), fN(tp === 'vis' ? x.F : x.M), fN(tp === 'vis' ? x.M : x.F), pill(x.ef, meta), fN(x.j), pill(x.ea, meta)],
      s: [x.n, x.sup, x.p, x.E, x.P, tp === 'vis' ? x.F : x.M, tp === 'vis' ? x.M : x.F, x.ef, x.j, x.ea], x: [x.n, x.sup, x.p, x.E, x.P, tp === 'vis' ? x.F : x.M, tp === 'vis' ? x.M : x.F, +x.ef.toFixed(2), x.j, +x.ea.toFixed(2)] }));
    if (dm === 'sup') { cols.splice(1, 1); rows.forEach((r) => { r.c.splice(1, 1); r.s.splice(1, 1); r.x.splice(1, 1); }); }
    return `<div class="bar">${DIMS[tp].map(([k, t]) => `<button data-dim="${k}" class="${k === dm ? 'pri' : ''}">${t}</button>`).join('')}</div><div class="card">${table(cols, rows, { name: `ranking_${tp}_${dm}`, max: 400 })}</div>`;
  }

  function reiList(rs, crit, min) { const m = new Map(); rs.forEach((r) => { const k = r.cli + '|' + r.ecm; if (!m.has(k)) m.set(k, { cli: r.cli, cn: r.cn, ecm: r.ecm, sup: r.sup, all: [], f: [] }); const o = m.get(k); o.all.push(r); if (crit(r)) o.f.push(r); }); return [...m.values()].filter((o) => o.f.length >= min); }
  /* desglose del tipo de falla de un conjunto de registros: «3 Perdida · 1 Fuera de rango» (con pastillas de color) */
  const tipoFalla = (tp, f, plano) => { const n = {}; f.forEach((r) => (n[r.c] = (n[r.c] || 0) + 1)); const L = Object.entries(n).filter(([c]) => c !== 'E').sort((a, b) => b[1] - a[1]); return plano ? L.map(([c, v]) => `${v} ${CATL[tp][c]}`).join(' · ') : L.map(([c, v]) => `<span class="pill ${c}">${v} ${CATL[tp][c]}</span>`).join(' '); };
  function rei(tp, X, rs) {
    const min = Number(S.cfg.rei_min || 2), crit = X.S.rei === 'P' ? (r) => r.c === 'P' || (tp === 'tar' && r.c === 'P') : (r) => r.c !== 'E';
    const L = reiList(rs, crit, min).sort((a, b) => b.f.length - a.f.length), B = [...grp(L.flatMap((o) => o.f), 'ecm')].map(([n, x]) => ({ n, sup: x[0].sup, v: x.length, cl: new Set(x.map((r) => r.cli)).size, tf: x })).sort((a, b) => b.v - a.v);
    return `<div class="bar"><button data-rei="NE" class="${X.S.rei === 'NE' ? 'pri' : ''}">Todas las no efectivas</button><button data-rei="P" class="${X.S.rei === 'P' ? 'pri' : ''}">Solo ${tp === 'vis' ? 'perdidas' : 'abiertas'}</button><span class="note">Cliente con ${min} o más ${X.S.rei === 'P' ? (tp === 'vis' ? 'visitas perdidas' : 'tareas abiertas') : 'visitas/tareas no efectivas'} con el mismo ${tp === 'vis' ? 'BDR' : 'ECM'}.</span></div>
      <div class="kp">${kpi('Clientes reincidentes', fN(L.length), 'con ' + min + '+ fallas', 'var(--cP)')}${kpi('Fallas en reincidentes', fN(L.reduce((a, o) => a + o.f.length, 0)), '')}${kpi('Clientes con 5+ fallas', fN(L.filter((o) => o.f.length >= 5).length), '', 'var(--cF)')}</div>
      <div class="g2"><div class="card"><h3>Reincidencia por ${tp === 'vis' ? 'BDR' : 'ECM'}</h3>${table([{ h: tp === 'vis' ? 'BDR' : 'ECM' }, { h: 'Supervisor' }, { h: 'Clientes', n: 1 }, { h: 'Fallas', n: 1 }, { h: 'Tipo de falla' }], B.map((x) => ({ c: [esc(x.n), esc(x.sup), fN(x.cl), fN(x.v), tipoFalla(tp, x.tf)], s: [x.n, x.sup, x.cl, x.v, tipoFalla(tp, x.tf, true)] })), { name: 'reincidencia_ecm', max: 100 })}</div>
      <div class="card"><h3>Clientes con más reincidencias</h3>${table([{ h: 'Cliente' }, { h: tp === 'vis' ? 'BDR' : 'ECM' }, { h: 'Fallas', n: 1 }, { h: 'Tipo de falla' }, { h: 'Programadas', n: 1 }, { h: 'Fechas' }], L.map((o) => ({ c: [`${esc(o.cn)}<br><small class="mu">${esc(o.cli)}</small>`, esc(o.ecm), fN(o.f.length), tipoFalla(tp, o.f), fN(o.all.length), esc(o.f.map((r) => r.d.slice(5)).sort().join(', '))], s: [o.cn, o.ecm, o.f.length, tipoFalla(tp, o.f, true), o.all.length, ''], x: [o.cn, o.cli, o.ecm, o.f.length, tipoFalla(tp, o.f, true), o.all.length, o.f.map((r) => r.d).sort().join(', ')] })), { name: 'reincidencia_clientes', max: 150 })}</div></div>`;
  }

  function afe(tp, X, rs) {
    const T = X.S.at, A = rs.filter((r) => T.includes(r.c)), B = [...grp(A, 'ecm')].map(([n, x]) => { const fb = ag(rs.filter((r) => r.ecm === n)); return { n, sup: x[0].sup, v: x.length, cl: new Set(x.map((r) => r.cli)).size, ...fb }; }).sort((a, b) => b.v - a.v);
    const bs = X.S.ab ? A.filter((r) => r.ecm === X.S.ab) : A, J = {}; bs.forEach((r) => { const k = r.j ? r.j.motivo : r.jus; J[k] = (J[k] || 0) + 1; });
    const C = [...grp(bs, (r) => r.ecm + '|' + r.cli)].map(([k, x]) => ({ x, a: ag(x) })).sort((p, q) => q.a.p - p.a.p);
    const tipos = tp === 'vis' ? [['P', 'Perdidas'], ['F', 'Fuera de rango'], ['M', 'Menos de 2 min']] : [['P', 'Abiertas'], ['M', 'Mal ejecutadas'], ['F', 'Justificadas']];
    return `<div class="bar">${tipos.map(([c, n]) => `<label style="flex-direction:row;align-items:center;gap:6px"><input type="checkbox" data-at="${c}" ${T.includes(c) ? 'checked' : ''}> ${n}</label>`).join('')}<span class="note">${fN(bs.length)} afectadas · ${fN(new Set(bs.map((r) => r.cli)).size)} clientes</span></div>
      <div class="g2"><div class="card">${table([{ h: tp === 'vis' ? 'BDR' : 'ECM' }, { h: 'Supervisor' }, { h: 'Clientes', n: 1 }, { h: 'Prog.', n: 1 }, { h: 'Afectadas', n: 1 }, { h: 'Efectividad', n: 1 }, { h: 'Ajustada', n: 1 }], B.map((b) => ({ c: [esc(b.n), esc(b.sup), fN(b.cl), fN(b.p), fN(b.v), pill(b.ef, X.S.meta), pill(b.ea, X.S.meta)], s: [b.n, b.sup, b.cl, b.p, b.v, b.ef, b.ea] })), { name: 'afectados_ecm', max: 150 })}</div>
      <div class="card"><h3>Justificaciones</h3>${table([{ h: 'Motivo / justificación' }, { h: 'Registros', n: 1 }, { h: '%', n: 1 }], Object.entries(J).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ c: [esc(k), fN(v), f1(pc(v, bs.length))], s: [k, v, pc(v, bs.length)] })), { name: 'justificaciones' })}</div></div>
      <div class="card"><h3>Clientes afectados</h3>${table([{ h: 'Cliente' }, { h: tp === 'vis' ? 'BDR' : 'ECM' }, { h: 'Afectadas', n: 1 }, { h: 'Fechas' }, { h: 'Motivo' }], C.map((o) => { const r = o.x[0]; return { c: [`${esc(r.cn)}<br><small class="mu">${esc(r.cli)}</small>`, esc(r.ecm), fN(o.a.p), esc(o.x.map((q) => q.d.slice(5)).sort().join(', ')), esc([...new Set(o.x.map((q) => (q.j ? q.j.motivo : q.jus)))].join(' · '))], s: [r.cn, r.ecm, o.a.p, '', ''] }; }), { name: 'clientes_afectados', max: 200 })}</div>`;
  }

  function dur(tp, X, rs) {
    const D = rs.filter((r) => r.min != null), b = [['< 2 min', 0, 2], ['2–10', 2, 10], ['10–30', 10, 30], ['30–60', 30, 60], ['60–90', 60, 90], ['> 90', 90, 1e9]], avg = D.length ? D.reduce((a, r) => a + r.min, 0) / D.length : 0;
    const E = D.filter((r) => r.c === 'E'), med = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
    const B = [...grp(D, 'ecm')].map(([n, x]) => ({ n, sup: x[0].sup, v: x.length, avg: x.reduce((a, r) => a + r.min, 0) / x.length, cor: pc(x.filter((r) => r.min < 2).length, x.length) })).filter((x) => x.v >= 5).sort((p, q) => p.avg - q.avg);
    return `<div class="kp">${kpi('Visitas con dato de duración', fN(D.length), f1(pc(D.length, rs.length)) + ' del total')}${kpi('Duración promedio', avg.toFixed(1) + ' min', '')}${kpi('Mediana', med(D.map((r) => r.min)).toFixed(1) + ' min', '')}${kpi('Promedio en efectivas', (E.length ? E.reduce((a, r) => a + r.min, 0) / E.length : 0).toFixed(1) + ' min', '', 'var(--cE)')}${kpi('Menos de 2 min', f1(pc(D.filter((r) => r.min < 2).length, D.length)), '', 'var(--cM)')}</div>
      <div class="g2"><div class="card"><h3>Distribución de la duración</h3>${stack(b.map(([n, lo, hi]) => { const x = D.filter((r) => r.min >= lo && r.min < hi); return { l: n, segs: [{ v: x.filter((r) => r.c === 'E').length, c: CAT.E, n: 'Efectivas' }, { v: x.filter((r) => r.c !== 'E').length, c: CAT.P, n: 'No efectivas' }] }; }))}${legend([['Efectivas', CAT.E], ['No efectivas', CAT.P]])}</div>
      <div class="card"><h3>Duración por BDR (mín. 5 visitas con dato) · menor a mayor</h3>${table([{ h: 'BDR' }, { h: 'Supervisor' }, { h: 'Visitas', n: 1 }, { h: 'Promedio (min)', n: 1 }, { h: '% &lt; 2 min', n: 1 }], B.map((x) => ({ c: [esc(x.n), esc(x.sup), fN(x.v), x.avg.toFixed(1), f1(x.cor)], s: [x.n, x.sup, x.v, x.avg, x.cor] })), { name: 'duracion_bdr', max: 100 })}</div></div>`;
  }

  function time(tp, X, rs) {
    const g = gran(X), s = serie(rs, g), D = [0, 1, 2, 3, 4, 5, 6].map((d) => ({ d, ...ag(rs.filter((r) => dow(r.d) === d)) })).filter((x) => x.p);
    const comp = tp === 'vis' ? [['E', 'Efectivas'], ['P', 'Perdidas'], ['F', 'Fuera de rango'], ['M', 'Menos de 2 min']] : [['E', 'Efectivas'], ['M', 'Mal ejecutadas'], ['F', 'Justificadas'], ['P', 'Abiertas']];
    return `<div class="bar">${[['auto', 'Auto'], ['day', 'Día'], ['week', 'Semana'], ['month', 'Mes']].map(([k, t]) => `<button data-gran="${k}" class="${X.S.gran === k ? 'pri' : ''}">${t}</button>`).join('')}</div>
      <div class="card"><h3>Efectividad en el tiempo</h3>${line(s.ks.map((k) => lab(g, k)), [{ n: 'Efectividad', c: COL[0], d: s.a.map((x) => x.ef) }, { n: 'Ajustada', c: COL[2], d: s.a.map((x) => x.ea) }], { meta: X.S.meta, ymax: 100, pct: true, tipfy: (v) => v.toFixed(1) + '%' })}</div>
      <div class="g2"><div class="card"><h3>Volumen por estado</h3>${vstack(s.ks.map((k) => lab(g, k)), comp.map(([c, n]) => ({ n, c: CAT[c], d: s.a.map((x) => x[c]) })))}</div>
      <div class="card"><h3>Efectividad por día de la semana</h3>${hbar(D.map((x) => ({ l: WDS[x.d], v: x.ef, t: f1(x.ef), c: tone(x.ef, X.S.meta), tip: `${WDS[x.d]}: ${fN(x.p)} · ${f1(x.ef)}` })), { max: 100, meta: X.S.meta })}</div></div>`;
  }

  function heatmap(tp, X, rs) {
    const dm = X.S.hdim, rowsK = [...grp(rs, dm).keys()].sort((a, b) => String(a).localeCompare(String(b), 'es')).slice(0, 60), meta = X.S.meta;
    const m = grp(rs, (r) => r[dm] + '|' + dow(r.d)), cols = [1, 2, 3, 4, 5, 6, 0];
    return `<div class="bar">${DIMS[tp].filter((d) => ['sup', 'ecm', 'reg'].includes(d[0])).map(([k, t]) => `<button data-hdim="${k}" class="${k === dm ? 'pri' : ''}">${t}</button>`).join('')}<span class="note">Efectividad por día de la semana · más oscuro = mejor.</span></div>
      <div class="card">${heat(rowsK, cols.map((d) => WDS[d]), (r, c) => { const x = m.get(r + '|' + WDS.indexOf(c)); if (!x) return null; const a = ag(x); return { v: a.ef, t: Math.round(a.ef) + '', tip: `${r} · ${c}\n${fN(a.p)} · efectividad ${f1(a.ef)}` }; })}</div>
      <div class="card"><h3>Efectividad por semana</h3>${(() => { const ws = [...new Set(rs.map((r) => wk(r.d)))].sort(), mw = grp(rs, (r) => r[dm] + '|' + wk(r.d)); return heat(rowsK, ws.map((w) => lab('week', w)), (r, c) => { const w = ws[ws.map((x) => lab('week', x)).indexOf(c)], x = mw.get(r + '|' + w); if (!x) return null; const a = ag(x); return { v: a.ef, t: Math.round(a.ef) + '', tip: `${r} · ${c}\n${fN(a.p)} · ${f1(a.ef)}` }; }); })()}</div>`;
  }

  /* pendientes sin justificar por antigüedad */
  function pen(tp, X, rs) {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0); const age = (d) => Math.max(0, Math.floor((hoy - new Date(d + 'T00:00:00')) / 864e5));
    const AG = [['0–3 días', 0, 3], ['4–7 días', 4, 7], ['8–15 días', 8, 15], ['Más de 15', 16, 1e9]], pd = rs.filter((r) => r.c !== 'E' && !r.j), dm = X.S.dim;
    const bk = (r) => AG.findIndex((x) => age(r.d) >= x[1] && age(r.d) <= x[2]), old = pd.filter((r) => age(r.d) > 15).length;
    const G = [...grp(pd, dm)].map(([n, x]) => { const c = [0, 0, 0, 0]; x.forEach((r) => c[bk(r)]++); return { n, t: x.length, c, av: x.reduce((a, r) => a + age(r.d), 0) / x.length, mx: Math.max(...x.map((r) => age(r.d))) }; }).sort((a, b) => b.c[3] - a.c[3] || b.t - a.t);
    return `<div class="bar">${DIMS[tp].filter((d) => ['sup', 'ecm', 'reg'].includes(d[0])).map(([k, t]) => `<button data-dim="${k}" class="${k === dm ? 'pri' : ''}">${t}</button>`).join('')}</div>
      <div class="kp">${kpi('Sin justificar', fN(pd.length), f1(pc(pd.length, rs.filter((r) => r.c !== 'E').length)) + ' de las no efectivas', 'var(--cP)')}${kpi('Más de 15 días', fN(old), f1(pc(old, pd.length)) + ' de los pendientes', 'var(--cP)')}${kpi('Antigüedad promedio', (pd.length ? pd.reduce((a, r) => a + age(r.d), 0) / pd.length : 0).toFixed(1) + ' días', '', 'var(--cF)')}${kpi('Más antigua', (pd.length ? Math.max(...pd.map((r) => age(r.d))) : 0) + ' días', '', 'var(--cF)')}</div>
      <div class="g2"><div class="card"><h3>Pendientes por antigüedad</h3>${stack(G.slice(0, 15).map((x) => ({ l: x.n, segs: x.c.map((v, i) => ({ v, c: ['var(--cE)', 'var(--cM)', 'var(--cF)', 'var(--cP)'][i], n: AG[i][0] })) })))}${legend(AG.map((a, i) => [a[0], ['var(--cE)', 'var(--cM)', 'var(--cF)', 'var(--cP)'][i]]))}</div>
      <div class="card"><p>Cuenta las novedades que todavía no tienen justificación. Cuanto más antiguas, más difícil conseguir evidencia. Prioriza los grupos con más pendientes de «Más de 15 días».</p></div></div>
      <div class="card">${table([{ h: DIMS[tp].find((d) => d[0] === dm)[1] }, { h: 'Pendientes', n: 1 }, ...AG.map((a) => ({ h: a[0], n: 1 })), { h: 'Prom. (días)', n: 1 }, { h: 'Máx. (días)', n: 1 }], G.map((x) => ({ c: [esc(x.n), `<b>${x.t}</b>`, ...x.c.map((v) => v || '<span class="mu">0</span>'), x.av.toFixed(1), x.mx], s: [x.n, x.t, ...x.c, x.av, x.mx] })), { name: 'antiguedad', max: 200 })}</div>`;
  }

  /* proyección de cierre del mes */
  function pry(tp, X, rs) {
    if (!rs.length) return '<div class="card"><p>Sin datos.</p></div>';
    const s = X.S, ms = rs.map((r) => r.d.slice(0, 7)).sort(), rm = ms[ms.length - 1], B = rs.filter((r) => r.d.slice(0, 7) === rm), a = ag(B), ds = B.map((r) => r.d).sort();
    const ld = +ds[ds.length - 1].slice(8, 10), dim = new Date(+rm.slice(0, 4), +rm.slice(5, 7), 0).getDate(), rem = Math.max(0, dim - ld);
    const L = Math.min(6, Math.max(0, s.pyL === '' ? 2 : +s.pyL)), labRem = (rem * (7 - L)) / 7;
    const est = Math.round([...grp(B, 'ecm')].reduce((t, [k, x]) => t + (x.length / (new Set(x.map((r) => r.d)).size || 1)) * labRem, 0)), R = s.pyR === '' ? est : Math.max(0, Math.round(+s.pyR)), meta = s.meta;
    const E = a.E + a.j, tot = a.p + R, need = Math.ceil((meta / 100) * tot - 1e-9), nr = Math.max(0, need - E), ok = nr <= R, margen = ok ? R - nr : 0, best = pc(E + R, tot);
    const fl = margen > 0 ? [0, Math.round(margen * 0.25), Math.round(margen * 0.5), Math.round(margen * 0.75), margen, Math.round(margen * 1.5)] : [0, 0.01, 0.02, 0.05, 0.1].map((x) => Math.round(R * x));
    const esc2 = [...new Set(fl)].filter((f) => f <= R).map((f) => ({ f, fin: pc(E + R - f, tot) }));
    return `<div class="fbar"><label>Días libres por semana<input type="number" id="py_l" min="0" max="6" value="${s.pyL}" placeholder="2"></label><label>Visitas/tareas restantes (manual)<input type="number" id="py_r" min="0" value="${s.pyR}" placeholder="${est}"></label></div>
      <div class="card ex"><h3>Proyección de cierre de ${MN[+rm.slice(5, 7) - 1]} ${rm.slice(0, 4)}</h3><p>Con datos hasta el día ${ld} (faltan ${rem} días, ${labRem.toFixed(1)} laborables), se estiman <b>${fN(R)}</b> ${tp === 'vis' ? 'visitas' : 'tareas'} más. Hoy: ${fN(a.p)} programadas, efectividad ${f1(pc(E, a.p))} (con justificadas). Para cerrar en la meta de ${meta}% hacen falta <b>${fN(need)}</b> efectivas en total: ${ok ? `deben ser efectivas <b>${fN(nr)}</b> de las ${fN(R)} restantes (${f1(R ? (nr / R) * 100 : 0)}), con un margen de ${fN(margen)} fallas.` : `<b style="color:var(--cP)">no alcanza</b>: aun siendo todas efectivas cerrarías en ${f1(best)}.`}</p></div>
      <div class="kp">${kpi('Efectivas + justificadas', fN(E), f1(pc(E, a.p)))}${kpi('Restantes estimadas', fN(R), s.pyR === '' ? 'por ritmo actual' : 'manual')}${kpi('Necesarias efectivas', fN(nr), `de ${fN(R)}`, ok ? 'var(--cE)' : 'var(--cP)')}${kpi('Mejor cierre posible', f1(best), '', 'var(--brand)')}</div>
      <div class="card"><h3>Escenarios de cierre</h3>${table([{ h: 'Fallas en lo que resta', n: 1 }, { h: 'Cierre', n: 1 }, { h: 'Cumple meta' }], esc2.map((x) => ({ c: [fN(x.f), f1(x.fin), x.fin >= meta - 1e-9 ? '<span class="pill E">Sí</span>' : '<span class="pill P">No</span>'], s: [x.f, x.fin, x.fin >= meta ? 1 : 0] })), { name: 'escenarios' })}</div>`;
  }

  /* insights: lectura automática con reglas explícitas */
  function ins(tp, X, rs) {
    const a = ag(rs), meta = X.S.meta, out = []; if (!a.p) return '<div class="card"><p>Sin datos para analizar.</p></div>';
    const add = (n, t, x, r) => out.push({ n, t, x, r });
    add(a.ef >= meta ? 'ok' : a.ef >= meta - 15 ? 'warn' : 'bad', 'Cumplimiento general', `Efectividad de ${f1(a.ef)} frente a una meta de ${meta}% (${a.ef - meta >= 0 ? '+' : ''}${(a.ef - meta).toFixed(1)} pts). Ajustada por justificaciones: ${f1(a.ea)}.`, a.ef < meta ? 'Revisar primero las causas principales y a los supervisores bajo la meta.' : 'Mantener el ritmo y vigilar a los casos individuales.');
    const T = a.p - a.E, cs = (tp === 'vis' ? [['visitas fuera de rango', a.F], ['visitas perdidas', a.P], ['atenciones de menos de 2 minutos', a.M]] : [['tareas abiertas (sin ejecutar)', a.P], ['tareas mal ejecutadas', a.M], ['tareas justificadas', a.F]]).sort((p, q) => q[1] - p[1]);
    if (T) add(cs[0][1] / T > 0.5 ? 'bad' : 'warn', 'Causa principal', `${f1(pc(cs[0][1], T))} de lo no efectivo corresponde a ${cs[0][0]}; luego ${cs[1][0]} (${f1(pc(cs[1][1], T))}).`, tp === 'vis' ? 'Fuera de rango suele ser GPS/ruta; menos de 2 min apunta a visitas sin ejecución real.' : 'Abiertas indica falta de gestión; mal ejecutadas, falla técnica en pilares.');
    const S_ = [...grp(rs, 'sup')].map(([n, x]) => { const E = [...grp(x, 'ecm')].map(([b, y]) => ag(y)); return { n, ...ag(x), nb: E.length, nc: E.filter((q) => q.ef < meta).length }; }).filter((x) => x.p >= 20);
    const zona = S_.find((x) => x.nb >= 3 && x.nc / x.nb >= 0.6 && x.ef < meta); if (zona) add('bad', 'Patrón de zona', `En ${zona.n} la mayoría del equipo (${zona.nc} de ${zona.nb}) está bajo la meta: apunta a gestión, rutas o cobertura y no a casos individuales.`, 'Plan de zona con el supervisor.');
    const bajo = S_.filter((x) => x.ef < meta).sort((p, q) => p.ef - q.ef); if (bajo.length) add('warn', 'Supervisores bajo meta', `${bajo.length} de ${S_.length}: ${bajo.slice(0, 3).map((x) => `${x.n} (${f1(x.ef)})`).join(', ')}.`, 'Acompañamiento a los de menor efectividad.');
    const B = [...grp(rs, 'ecm')].map(([n, x]) => ({ n, ne: x.length - ag(x).E })).sort((p, q) => q.ne - p.ne); let c = 0, k = 0; while (k < B.length && c < T * 0.6) c += B[k++].ne;
    if (T && B.length >= 5) add(k / B.length <= 0.25 ? 'warn' : 'info', 'Concentración', `${k} de ${B.length} ${tp === 'vis' ? 'BDR' : 'ECM'} (${f1(pc(k, B.length))}) concentran el 60% de las no efectivas.`, k / B.length <= 0.25 ? 'El problema está en pocas personas: intervenir caso por caso.' : 'El problema está repartido: revisar proceso.');
    const D = [0, 1, 2, 3, 4, 5, 6].map((d) => ({ d, ...ag(rs.filter((r) => dow(r.d) === d)) })).filter((x) => x.p >= 10).sort((p, q) => p.ef - q.ef); if (D.length > 2) add('info', 'Día de la semana', `Peor día: ${WDS[D[0].d]} (${f1(D[0].ef)}); mejor: ${WDS[D[D.length - 1].d]} (${f1(D[D.length - 1].ef)}).`, 'Revisar planificación del día más débil.');
    const R = reiList(rs, (r) => r.c !== 'E', 3); if (R.length) add('warn', 'Reincidencia', `${R.length} clientes con 3 o más fallas con el mismo ${tp === 'vis' ? 'BDR' : 'ECM'}.`, 'Ver pestaña Reincidencias: posible local cerrado o mal ubicado.');
    const NJ = rs.filter((r) => r.c !== 'E' && !r.j).length; if (T) add(NJ / T > 0.5 ? 'bad' : 'info', 'Justificaciones', `${fN(a.j)} justificadas válidas; ${fN(NJ)} (${f1(pc(NJ, T))}) de las no efectivas aún sin justificar.`, 'Asignar motivos antes de cerrar el periodo.');
    if (tp === 'vis') { const D2 = rs.filter((r) => r.min != null); if (D2.length) { const c2 = pc(D2.filter((r) => r.min < 2).length, D2.length); add(c2 > 15 ? 'warn' : 'info', 'Duración', `${f1(c2)} de las visitas con dato duran menos de 2 minutos.`, 'Contrastar con la pestaña Cruce antifraude.'); } }
    else { const P = [...grp(rs, 'pil')].map(([n, x]) => ({ n, ...ag(x) })).filter((x) => x.p >= 20).sort((p, q) => p.ef - q.ef); if (P.length > 1) add('info', 'Pilares', `Mejor pilar: ${P[P.length - 1].n} (${f1(P[P.length - 1].ef)}). Peor: ${P[0].n} (${f1(P[0].ef)}).`, 'Reforzar la capacitación en el peor pilar.'); const F = rs.filter((r) => r.frio); if (F.length) add('info', 'Equipo de frío', `Efectividad de tareas de frío: ${f1(ag(F).ef)} sobre ${fN(F.length)} tareas.`, ''); }
    const C = { ok: 'var(--cE)', info: 'var(--s1)', warn: 'var(--cF)', bad: 'var(--cP)' }, I = { ok: '✓', info: 'ℹ', warn: '⚠', bad: '✕' };
    return out.map((o) => `<div class="card" style="border-left:4px solid ${C[o.n]}"><h3><span style="color:${C[o.n]}">${I[o.n]}</span> ${o.t}</h3><p>${esc(o.x)}</p>${o.r ? `<p class="note">Acción: ${esc(o.r)}</p>` : ''}</div>`).join('');
  }

  /* cruce antifraude: visitas y tareas del mismo cliente y día */
  async function cmp(tp, X) {
    const [V, T] = await Promise.all([cargar('vis', X.D.d, X.D.h), cargar('tar', X.D.d, X.D.h)]);
    const keep = (r) => inA(X.S.sup, r.sup) && inA(X.S.reg, r.reg) && inA(X.S.ecm, r.ecm), m = {};
    V.R.filter(keep).forEach((v) => { const k = v.cli + '|' + v.d; (m[k] ||= { v: [], t: [] }).v.push(v); }); T.R.filter(keep).forEach((t) => { const k = t.cli + '|' + t.d; (m[k] ||= { v: [], t: [] }).t.push(t); });
    const ff = [], fp = []; Object.values(m).forEach((o) => {
      const ve = o.v.some((x) => x.c === 'E'), vb = o.v.some((x) => x.c === 'F' || x.c === 'M'), te = o.t.some((x) => x.c === 'E');
      if (te && vb && !ve) o.t.filter((x) => x.c === 'E').forEach((x) => ff.push({ ...x, vj: o.v[0].st || '—', vc: CATL.vis[o.v[0].c] }));
      if (ve && o.t.length && !te) o.v.filter((x) => x.c === 'E').forEach((x) => fp.push({ ...x, tc: o.t.length }));
    });
    return `<div class="kp">${kpi('Tareas «fantasma»', fN(ff.length), 'Efectiva pero visita fuera de rango o &lt; 2 min', 'var(--cP)')}${kpi('Visitas de «paseo»', fN(fp.length), 'Efectiva sin ninguna tarea efectiva', 'var(--cF)')}</div><p class="note">Se detectan cruzando el mismo cliente y fecha entre visitas y tareas. Son señales para auditar, no prueba de fraude.</p>
      <div class="g2"><div class="card"><h3 style="color:var(--cP)">Tareas «fantasma» (posible fraude GPS)</h3>${table([{ h: 'Fecha' }, { h: 'ECM' }, { h: 'Cliente' }, { h: 'Tarea' }, { h: 'Visita' }], ff.map((x) => ({ c: [x.d, esc(x.ecm), `${esc(x.cn)}<br><small class="mu">${esc(x.cli)}</small>`, esc(x.task.slice(0, 60)), esc(x.vc)], s: [x.d, x.ecm, x.cn, x.task, x.vc], x: [x.d, x.ecm, x.cli, x.cn, x.task, x.vc] })), { name: 'tareas_fantasma', max: 200 })}</div>
      <div class="card"><h3 style="color:var(--cF)">Visitas de «paseo» (sin ejecución)</h3>${table([{ h: 'Fecha' }, { h: 'BDR' }, { h: 'Cliente' }, { h: 'Tareas cargadas', n: 1 }], fp.map((x) => ({ c: [x.d, esc(x.ecm), `${esc(x.cn)}<br><small class="mu">${esc(x.cli)}</small>`, fN(x.tc)], s: [x.d, x.ecm, x.cn, x.tc], x: [x.d, x.ecm, x.cli, x.cn, x.tc] })), { name: 'visitas_paseo', max: 200 })}</div></div>`;
  }

  function pilares(X, rs) {
    const meta = X.S.meta, P = [...grp(rs, 'pil')].map(([n, x]) => ({ n, ...ag(x) })).sort((a, b) => a.ef - b.ef), F = rs.filter((r) => r.frio), N = rs.filter((r) => !r.frio), af = ag(F), an = ag(N);
    const fs = [...grp(F, 'ecm')].map(([n, x]) => ({ n, sup: x[0].sup, ...ag(x) })).sort((a, b) => a.ef - b.ef);
    return `<div class="kp">${kpi('Tareas de equipo de frío', fN(F.length), 'Efectividad ' + f1(af.ef), tone(af.ef, meta))}${kpi('Resto de tareas', fN(N.length), 'Efectividad ' + f1(an.ef), tone(an.ef, meta))}${kpi('Frío ajustada', f1(af.ea), fN(af.j) + ' justificadas válidas')}</div>
      <div class="g2"><div class="card"><h3>Efectividad por pilar</h3>${hbar(P.map((x) => ({ l: x.n, v: x.ef, t: f1(x.ef), c: tone(x.ef, meta), tip: `${x.n}\n${fN(x.p)} tareas · ${f1(x.ef)} · mal ejecutadas ${fN(x.M)}` })), { max: 100, meta })}</div>
      <div class="card"><h3>Equipo de frío por ECM · menor a mayor</h3>${hbar(fs.slice(0, 15).map((x) => ({ l: x.n, v: x.ef, t: f1(x.ef), c: tone(x.ef, meta), tip: `${x.n} (${x.sup})\n${fN(x.p)} tareas de frío · ${f1(x.ef)}` })), { max: 100, meta }) || '<p class="note">No hay tareas marcadas como equipo de frío. Revisa la expresión «frio_regex» en Administración.</p>'}</div></div>
      <div class="card">${table([{ h: 'Pilar' }, { h: 'Tareas', n: 1 }, { h: 'Efectivas', n: 1 }, { h: 'Mal ejec.', n: 1 }, { h: 'Abiertas', n: 1 }, { h: 'Efectividad', n: 1 }, { h: 'Ajustada', n: 1 }], P.map((x) => ({ c: [esc(x.n), fN(x.p), fN(x.E), fN(x.M), fN(x.P), pill(x.ef, meta), pill(x.ea, meta)], s: [x.n, x.p, x.E, x.M, x.P, x.ef, x.ea] })), { name: 'pilares' })}</div>`;
  }

  const FN = () => ({ dash, sbd, rei, afe, dur, time, heat: heatmap, pen, pry, ins, pil: (a, b, c) => pilares(b, c), ...(CN.vtTabs || {}) });
  CN.vtFn = FN; CN.vtTabsLista = (tp) => TABS[tp];
  /* ---------- hub ---------- */
  async function hub(tp) {
    const m = $('#main'); const X = (ST[tp] ||= { S: { from: monthRange(monthNow())[0], to: monthRange(monthNow())[1], reg: [], ger: [], sup: [], ecm: [], dow: [], dur: [], fr: [], meta: meta0(tp), adj: true, gran: 'auto', tab: 'dash', dim: 'sup', hdim: 'sup', rei: 'NE', at: ['P', 'F', 'M'], ab: '', pyL: '', pyR: '', pyM: '', idim: 'ger', idm: '', ifl: [], je: '', jr: '', jm: '', jq: '', calf: '' }, D: null });
    if (S.me.rol === 'asesor') X.S.dim = X.S.dim === 'sup' ? 'ecm' : X.S.dim;
    const modulo = tp === 'vis' ? 'visitas' : 'tareas';
    if (CN.pendingTab && CN.pendingTab[0] === modulo) { X.S.tab = CN.pendingTab[1]; CN.pendingTab = null; }
    const tabsDe = () => TABS[tp].filter(([k]) => !(k === 'cmp' && S.me.rol === 'asesor') && CN.tabOk(modulo, k));
    CN.sub[modulo] = { tabs: tabsDe, cur: () => X.S.tab, set: (k) => { X.S.tab = k; draw().catch(fail); } };
    VZ.mselHandler = (id, vals) => {
      const s = X.S; s[id] = vals; const keep = (k, f) => { if (s[k].length) { const ok = new Set(X.O.filter(f).map((r) => r[k])); s[k] = s[k].filter((v) => ok.has(v)); } };
      keep('ger', (r) => inA(s.reg, r.reg)); keep('sup', (r) => inA(s.reg, r.reg) && inA(s.ger, r.ger)); keep('ecm', (r) => inA(s.reg, r.reg) && inA(s.ger, r.ger) && inA(s.sup, r.sup)); draw().catch(fail);
    };
    const draw = async () => {
      if (!X.D || X.D.ver !== VER || X.D.d !== X.S.from || X.D.h !== X.S.to || (X.D.sig !== sigF(X.S) && !(X.D.sig === '{}'))) { m.innerHTML = '<p class="note">Cargando datos…</p>'; const [dd, oo] = await Promise.all([cargar(tp, X.S.from, X.S.to, X.S), opciones(tp, X.S.from, X.S.to)]); X.D = dd; X.O = oo; }
      else if (!X.O) X.O = await opciones(tp, X.S.from, X.S.to);
      const rs = filtrar(X), tabsL = tabsDe(); if (tabsL.length && !tabsL.some((t) => t[0] === X.S.tab)) X.S.tab = tabsL[0][0];
      let body = ''; const t = X.S.tab;
      try {
        if (t === 'cmp') body = await cmp(tp, X);
        else if (t === 'det') body = '<div id="detx"></div>';
        else body = await FN()[t](tp, X, rs);
      } catch (e) { console.error(e); body = `<div class="card">No se pudo armar este panel: ${esc(e.message)}</div>`; }
      m.innerHTML = `${t === 'det' ? '' : `<p class="dq">${fN(X.D.R.length)} registros cargados del ${X.S.from} al ${X.S.to}${rs.length !== X.D.R.length ? ` · ${fN(rs.length)} con los filtros` : ''}.</p>${barra(tp, X)}`}${tabs(tabsL, t)}<div id="pan">${body}</div>`;
      if (t === 'det') { if (CN.registro) CN.registro.render(tp, $('#detx'), { from: X.S.from, to: X.S.to, embedded: true }); else registros(tp, $('#detx')); }
      enlazar(); if (CN.vtAfter) CN.vtAfter(t, tp, X, rs); CN.sideRefresh();
    };
    const enlazar = () => {
      const s = X.S, B = (id, fn) => { const el = $('#' + id); if (el) el.onchange = fn; }; X.draw = () => draw().catch(fail);
      VZ.rangeHandler = (a, b) => { s.from = a; s.to = b; draw().catch(fail); }; B('f_from', (e) => { s.from = e.target.value || s.from; draw().catch(fail); }); B('f_to', (e) => { s.to = e.target.value || s.to; draw().catch(fail); });
      B('f_meta', (e) => { s.meta = Number(e.target.value) || 0; draw().catch(fail); }); B('f_adj', (e) => { s.adj = e.target.checked; draw().catch(fail); });
      B('py_l', (e) => { s.pyL = e.target.value; draw().catch(fail); }); B('py_r', (e) => { s.pyR = e.target.value; draw().catch(fail); });
      const c = $('#f_clr'); if (c) c.onclick = () => { Object.assign(s, { reg: [], ger: [], sup: [], ecm: [], dow: [], dur: [], fr: [] }); draw().catch(fail); };
      const rf = $('#f_ref'); if (rf) rf.onclick = () => { invalidar(); X.D = null; draw().catch(fail); };
      document.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { s.tab = b.dataset.tab; draw().catch(fail); }));
      document.querySelectorAll('[data-dim]').forEach((b) => (b.onclick = () => { s.dim = b.dataset.dim; draw().catch(fail); }));
      document.querySelectorAll('[data-hdim]').forEach((b) => (b.onclick = () => { s.hdim = b.dataset.hdim; draw().catch(fail); }));
      document.querySelectorAll('[data-gran]').forEach((b) => (b.onclick = () => { s.gran = b.dataset.gran; draw().catch(fail); }));
      document.querySelectorAll('[data-rei]').forEach((b) => (b.onclick = () => { s.rei = b.dataset.rei; draw().catch(fail); }));
      document.querySelectorAll('[data-at]').forEach((b) => (b.onchange = () => { s.at = [...document.querySelectorAll('[data-at]:checked')].map((x) => x.dataset.at); draw().catch(fail); }));
    };
    await draw();
  }
  VIEWS.visitas = () => hub('vis');
  VIEWS.tareas = () => hub('tar');
  CN.cargarVT = cargar; CN.optsVT = opciones; CN.agVT = ag; CN.grp = grp; CN.monthRange = monthRange; CN.dayAdd = dayAdd; CN.wk = wk; CN.pill = pill;
})();
