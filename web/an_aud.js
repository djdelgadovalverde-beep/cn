'use strict';
/* Auditoría de justificaciones: motivos, evolución, reincidencia, cola de revisión con banderas, observaciones repetidas y bitácora. */
(function () {
  const { n: fN, p: f1, pc, kpi, hbar, stack, vstack, table, tabs, legend, COL, CAT } = VZ;
  NAV.audit = ['Auditoría de justificaciones', ['admin', 'gerencia', 'supervisor']];
  const tail = { carga: NAV.carga, admin: NAV.admin }; delete NAV.carga; delete NAV.admin; NAV.carga = tail.carga; NAV.admin = tail.admin;
  const TN = { vis: 'Visita', tar: 'Tarea' };
  const ST = { from: '', to: '', tab: 'mot', tipo: [], sup: [], responsable: '', estado: '', umbralDias: 7, pctCN: 60, tabla: '', accion: '' };
  let DATA = null, SUPS = [];

  async function cargar() {
    if (!ST.from) { const r = CN.monthRange(monthNow()); ST.from = r[0]; ST.to = r[1]; }
    /* solo se piden los tipos y supervisores seleccionados; las fotos solo de los registros justificados */
    const f = { sup: ST.sup }, quiere = (t) => !ST.tipo.length || ST.tipo.includes(t);
    const [V, T, O1, O2] = await Promise.all([quiere('vis') ? CN.cargarVT('vis', ST.from, ST.to, f) : { R: [] }, quiere('tar') ? CN.cargarVT('tar', ST.from, ST.to, f) : { R: [] }, CN.optsVT('vis', ST.from, ST.to), CN.optsVT('tar', ST.from, ST.to)]);
    SUPS = [...new Set([...O1, ...O2].map((x) => x.sup))].sort();
    const conJ = [...V.R.map((r) => ['vis', r]), ...T.R.map((r) => ['tar', r])].filter(([, r]) => r.j).map(([t, r]) => [t, r.id]), E = [];
    for (const tp of ['vis', 'tar']) { const ids = conJ.filter((x) => x[0] === tp).map((x) => x[1]); for (let i = 0; i < ids.length; i += 80) E.push(...(await CN.conReintento(() => sb.from('evidencias').select('tipo,registro_id').eq('tipo', tp).in('registro_id', ids.slice(i, i + 80)))).data || []); }
    const ev = new Set(E.map((x) => x.tipo + '|' + x.registro_id));
    const R = [...V.R.map((r) => ({ ...r, tp: 'vis' })), ...T.R.map((r) => ({ ...r, tp: 'tar' }))].map((r) => ({ ...r, ev: ev.has(r.tp + '|' + r.id) }));
    DATA = { R };
  }
  const filtrar = () => DATA.R.filter((r) => (!ST.tipo.length || ST.tipo.includes(r.tp)) && (!ST.sup.length || ST.sup.includes(r.sup)));
  const dias = (r) => (r.j && r.j.creado_en ? Math.max(0, Math.round((new Date(r.j.creado_en) - new Date(r.d + 'T00:00:00')) / 864e5)) : null);
  const open = (r) => `<button data-rv="${esc(r.tp + '|' + r.id)}">Revisar</button>`;

  function motivos(rs) {
    const J = rs.filter((r) => r.j), NE = rs.filter((r) => r.c !== 'E'), M = {};
    J.forEach((r) => { const o = (M[r.j.motivo] ||= { n: 0, vis: 0, tar: 0, resp: r.j.responsable, est: {} }); o.n++; o[r.tp]++; o.est[r.j.estado] = (o.est[r.j.estado] || 0) + 1; });
    const L = Object.entries(M).sort((a, b) => b[1].n - a[1].n), cn = J.filter((r) => r.j.responsable === 'CN').length;
    return `<div class="kp">${kpi('No efectivas', fN(NE.length), '')}${kpi('Con justificación', fN(J.length), f1(pc(J.length, NE.length)) + ' de las no efectivas', 'var(--brand)')}${kpi('Responsable CN (válidas)', fN(cn), f1(pc(cn, J.length)) + ' de las justificadas', 'var(--cE)')}${kpi('Pendientes de revisión', fN(J.filter((r) => r.j.estado === 'pendiente').length), '', 'var(--cF)')}${kpi('Rechazadas', fN(J.filter((r) => r.j.estado === 'rechazada').length), '', 'var(--cP)')}</div>
      <div class="g2"><div class="card"><h3>Motivos más usados</h3>${hbar(L.slice(0, 12).map(([k, o]) => ({ l: k, v: o.n, t: fN(o.n) + ' · ' + f1(pc(o.n, J.length)), c: o.resp === 'CN' ? 'var(--cE)' : 'var(--cP)', tip: `${k}\n${o.n} registros · responsable ${o.resp}` })))}${legend([['Responsable CN (no penaliza)', 'var(--cE)'], ['Otro responsable (penaliza)', 'var(--cP)']])}</div>
      <div class="card"><h3>Estado de las justificaciones</h3>${stack(['pendiente', 'aprobada', 'rectificada', 'rechazada'].map((e) => ({ l: e, segs: [{ v: J.filter((r) => r.j.estado === e).length, c: { pendiente: 'var(--cF)', aprobada: 'var(--cE)', rectificada: 'var(--s1)', rechazada: 'var(--cP)' }[e], n: e }] })))}</div></div>
      <div class="card">${table([{ h: 'Motivo' }, { h: 'Responsable' }, { h: 'Visitas', n: 1 }, { h: 'Tareas', n: 1 }, { h: 'Total', n: 1 }, { h: '%', n: 1 }], L.map(([k, o]) => ({ c: [esc(k), esc(o.resp), fN(o.vis), fN(o.tar), fN(o.n), f1(pc(o.n, J.length))], s: [k, o.resp, o.vis, o.tar, o.n, pc(o.n, J.length)] })), { name: 'motivos' })}</div>`;
  }

  async function evolucion() {
    const hasta = ST.to, d = new Date(hasta + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() - 11); const desde = d.toISOString().slice(0, 8) + '01';
    const J = await CN.fetchPar((o) => (() => { let q = sb.from('justificaciones').select('tipo,fecha,motivo,responsable,estado,ecm,supervisor', o).gte('fecha', desde).lte('fecha', hasta); if (ST.sup.length) q = q.in('supervisor', ST.sup); if (ST.tipo.length) q = q.in('tipo', ST.tipo); return q.order('id'); })());
    const L = J.filter((x) => (!ST.sup.length || ST.sup.includes(x.supervisor)) && (!ST.tipo.length || ST.tipo.includes(x.tipo))), ms = [...new Set(L.map((x) => x.fecha.slice(0, 7)))].sort();
    const top = Object.entries(L.reduce((a, x) => ((a[x.motivo] = (a[x.motivo] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1]).slice(0, 7).map((x) => x[0]);
    const lab = (m) => ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][+m.slice(5) - 1] + ' ' + m.slice(2, 4);
    const segs = top.map((m, i) => ({ n: m, c: COL[i], d: ms.map((k) => L.filter((x) => x.fecha.slice(0, 7) === k && x.motivo === m).length) }));
    const otros = { n: 'Otros', c: 'var(--mut)', d: ms.map((k) => L.filter((x) => x.fecha.slice(0, 7) === k && !top.includes(x.motivo)).length) };
    return `<div class="card"><h3>Evolución por mes (últimos 12 meses)</h3>${ms.length ? vstack(ms.map(lab), [...segs, otros], { aria: 'Justificaciones por mes y motivo' }) : '<p class="note">Sin justificaciones.</p>'}</div>
      <div class="card">${table([{ h: 'Mes' }, { h: 'Justificaciones', n: 1 }, { h: 'Responsable CN', n: 1 }, { h: '% CN', n: 1 }], ms.map((k) => { const x = L.filter((y) => y.fecha.slice(0, 7) === k), c = x.filter((y) => y.responsable === 'CN').length; return { c: [lab(k), fN(x.length), fN(c), f1(pc(c, x.length))], s: [k, x.length, c, pc(c, x.length)] }; }), { name: 'evolucion_justificaciones' })}</div>`;
  }

  const tfa = (x, plano) => { const n = {}; x.forEach((r) => { const k = r.tp + '|' + r.c; n[k] = (n[k] || 0) + 1; }); const L = Object.entries(n).filter(([k]) => !k.endsWith('|E')).sort((p, q) => q[1] - p[1]); return L.map(([k, v]) => { const [t, c] = k.split('|'); return plano ? `${v} ${CN.CATL[t][c]}` : `<span class="pill ${c}">${v} ${CN.CATL[t][c]}</span>`; }).join(plano ? ' · ' : ' '); };
  function reincidencia(rs) {
    const m = {}; rs.filter((r) => r.j).forEach((r) => { const k = r.cli + '|' + r.j.motivo; (m[k] ||= []).push(r); });
    const L = Object.values(m).filter((x) => x.length >= 2).sort((a, b) => b.length - a.length);
    return `<div class="card"><h3>Mismo cliente con el mismo motivo, 2 o más veces</h3><p class="note">Un motivo que se repite en el mismo punto de venta puede ser real (local cerrado) o un recurso fácil. Revisa con evidencia.</p>${table([{ h: 'Cliente' }, { h: 'Motivo' }, { h: 'Veces', n: 1 }, { h: 'Tipo de falla' }, { h: 'ECM' }, { h: 'Fechas' }, { h: 'Responsable' }], L.map((x) => ({ c: [`${esc(x[0].cn)}<br><small class="mu">${esc(x[0].cli)}</small>`, esc(x[0].j.motivo), fN(x.length), tfa(x), esc([...new Set(x.map((r) => r.ecm))].join(', ')), esc(x.map((r) => r.d.slice(5)).sort().join(', ')), esc(x[0].j.responsable)], s: [x[0].cn, x[0].j.motivo, x.length, tfa(x, 1), '', '', x[0].j.responsable], x: [x[0].cn, x[0].cli, x[0].j.motivo, x.length, tfa(x, 1), [...new Set(x.map((r) => r.ecm))].join(', '), x.map((r) => r.d).sort().join(', '), x[0].j.responsable] })), { name: 'reincidencia_motivo', max: 200 })}</div>`;
  }

  /* banderas de revisión (reglas explícitas, no acusaciones) */
  function revisar(rs) {
    const out = [], J = rs.filter((r) => r.j);
    const porEcm = {}; rs.filter((r) => r.c !== 'E').forEach((r) => { const o = (porEcm[r.ecm] ||= { ne: 0, cn: 0 }); o.ne++; if (r.jv) o.cn++; });
    const alto = new Set(Object.entries(porEcm).filter(([k, o]) => o.ne >= 10 && pc(o.cn, o.ne) >= ST.pctCN).map((x) => x[0]));
    const rep = {}; J.forEach((r) => { const k = r.cli + '|' + r.j.motivo; rep[k] = (rep[k] || 0) + 1; });
    J.forEach((r) => {
      const f = [], dd = dias(r);
      if (r.j.responsable === 'CN' && !(r.j.observacion || '').trim() && !r.ev) f.push('Válida (CN) sin observación ni evidencia');
      if (alto.has(r.ecm) && r.j.responsable === 'CN') f.push(`ECM con ${ST.pctCN}%+ de sus novedades justificadas como CN`);
      if (rep[r.cli + '|' + r.j.motivo] >= 2) f.push('Mismo cliente y motivo repetido');
      if (dd != null && dd > ST.umbralDias) f.push(`Justificada ${dd} días después de la visita`);
      if (r.j.estado === 'pendiente' && r.j.responsable === 'CN') f.push('Válida pero aún sin revisión del supervisor');
      if (f.length) out.push({ r, f });
    });
    out.sort((a, b) => b.f.length - a.f.length);
    return `<div class="fbar"><label>Días máx. entre visita y justificación<input type="number" id="a_dias" min="0" value="${ST.umbralDias}" style="width:90px"></label><label>% CN que alerta por ECM<input type="number" id="a_pct" min="0" max="100" value="${ST.pctCN}" style="width:90px"></label></div>
      <div class="card"><h3>Justificaciones para revisar (${fN(out.length)})</h3><p class="note">Son señales para revisar, no sanciones. Se marcan por: validada sin observación ni evidencia · ECM con alto porcentaje de justificadas CN · mismo cliente y motivo repetido · justificada tarde · válida pendiente de revisión.</p>
      ${table([{ h: 'Tipo' }, { h: 'Fecha' }, { h: 'ECM' }, { h: 'Cliente' }, { h: 'Motivo' }, { h: 'Estado' }, { h: 'Banderas', n: 1 }, { h: '' }], out.map(({ r, f }) => ({ c: [TN[r.tp], r.d, esc(r.ecm), `${esc(r.cn)}<br><small class="mu">${esc(r.cli)}</small>`, `${esc(r.j.motivo)} <small class="mu">(${esc(r.j.responsable)})</small>`, `<span class="pill ${r.j.estado}">${r.j.estado}</span>`, `<ul style="margin:0;padding-left:16px;white-space:normal">${f.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`, open(r)], s: [r.tp, r.d, r.ecm, r.cn, r.j.motivo, r.j.estado, f.length, ''], x: [TN[r.tp], r.d, r.ecm, r.cli, r.cn, r.j.motivo, r.j.responsable, r.j.estado, f.join(' | ')] })), { name: 'justificaciones_para_revisar', max: 300 })}</div>`;
  }

  function observaciones(rs) {
    const m = {}; rs.filter((r) => r.j && (r.j.observacion || '').trim()).forEach((r) => { const k = r.j.observacion.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 160); (m[k] ||= []).push(r); });
    const L = Object.entries(m).filter(([, x]) => x.length >= 2).sort((a, b) => b[1].length - a[1].length);
    return `<div class="card"><h3>Textos de observación que más se repiten</h3><p class="note">Observaciones idénticas en muchos registros suelen ser copiadas y pegadas.</p>${table([{ h: 'Observación' }, { h: 'Veces', n: 1 }, { h: 'ECM distintos', n: 1 }, { h: 'Motivos' }], L.map(([k, x]) => ({ c: [`<span style="white-space:normal">${esc(k)}</span>`, fN(x.length), fN(new Set(x.map((r) => r.ecm)).size), esc([...new Set(x.map((r) => r.j.motivo))].join(' · '))], s: [k, x.length, new Set(x.map((r) => r.ecm)).size, ''], x: [k, x.length, new Set(x.map((r) => r.ecm)).size, [...new Set(x.map((r) => r.j.motivo))].join(' · ')] })), { name: 'observaciones_repetidas', max: 150 })}</div>`;
  }

  function avance(rs) {
    const G = [...CN.grp(rs.filter((r) => r.c !== 'E'), 'sup')].map(([n, x]) => ({ n, t: x.length, j: x.filter((r) => r.j).length, pend: x.filter((r) => r.j && r.j.estado === 'pendiente').length })).sort((a, b) => pc(a.j, a.t) - pc(b.j, b.t));
    return `<div class="card"><h3>Avance de asignación de motivos por supervisor</h3>${hbar(G.map((x) => ({ l: x.n, v: pc(x.j, x.t), t: `${f1(pc(x.j, x.t))} · ${fN(x.j)}/${fN(x.t)}`, c: 'var(--s1)', tip: `${x.n}\n${fN(x.j)} justificadas de ${fN(x.t)} no efectivas` })), { max: 100 })}</div>
      <div class="card">${table([{ h: 'Supervisor' }, { h: 'No efectivas', n: 1 }, { h: 'Justificadas', n: 1 }, { h: '%', n: 1 }, { h: 'Pend. revisión', n: 1 }], G.map((x) => ({ c: [esc(x.n), fN(x.t), fN(x.j), f1(pc(x.j, x.t)), fN(x.pend)], s: [x.n, x.t, x.j, pc(x.j, x.t), x.pend] })), { name: 'avance_asignacion' })}</div>`;
  }

  async function historial() {
    if (!can('admin', 'gerencia')) return '<div class="card"><p>El historial de cambios es solo para gerencia y administración.</p></div>';
    let q = sb.from('bitacora').select('*').gte('fecha', ST.from + 'T00:00:00').lte('fecha', ST.to + 'T23:59:59').order('fecha', { ascending: false }).limit(1000); if (ST.tabla) q = q.eq('tabla', ST.tabla); if (ST.accion) q = q.eq('accion', ST.accion);
    const [{ data, error }, pr] = await Promise.all([q, sb.from('profiles').select('id,usuario,nombre')]); if (error) throw error;
    const U = Object.fromEntries((pr.data || []).map((p) => [p.id, p.nombre || p.usuario]));
    const fx = (d) => new Date(d).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' });
    const filas = (data || []).map((b) => ({ b, i: CN.bitInfo(b), u: U[b.usuario] || (b.usuario && b.usuario.length > 12 ? '' : b.usuario) || ((b.nuevo && b.nuevo.usuario) || '—') }));
    const plano = (h) => String(h).replace(/<[^>]+>/g, '');
    const opt = (o, cur, todas) => `<option value="">${todas}</option>` + Object.entries(o).map(([k, t]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${esc(Array.isArray(t) ? t[0] : t)}</option>`).join('');
    return `<div class="bar"><label>Dónde<select id="a_tabla">${opt(CN.bitTablas, ST.tabla, 'Todo')}</select></label><label>Qué se hizo<select id="a_accion">${opt(CN.bitAcciones, ST.accion, 'Todo')}</select></label><span class="note">${fN(filas.length)} cambios${filas.length >= 1000 ? ' (los 1.000 más recientes; acota las fechas)' : ''}.</span></div>
      <div class="card"><h3>Historial de cambios</h3>${table([{ h: 'Fecha' }, { h: 'Quién' }, { h: 'Qué hizo' }, { h: 'Dónde' }, { h: 'Detalle' }], filas.map(({ b, i, u }) => ({ c: [`<span style="white-space:nowrap">${fx(b.fecha)}</span>`, esc(u), `<span class="acc ${i.tono}">${esc(i.acc)}</span>`, `<span style="white-space:normal;display:block;min-width:150px;max-width:260px">${esc(i.donde)}</span>`, `<span class="det">${i.det}</span>`], s: [b.fecha, u, i.acc, i.donde, plano(i.det)], x: [fx(b.fecha), u, i.acc, i.donde, plano(i.det)] })), { name: 'historial', ps: 25 })}</div>`;
  }

  const TL0 = () => [['mot', 'Motivos y responsable'], ['evo', 'Evolución'], ['rei', 'Reincidencia por motivo'], ['rev', 'Para revisar'], ['obs', 'Observaciones repetidas'], ['ava', 'Avance por supervisor'], ['his', 'Historial de cambios']].filter(([k]) => k !== 'his' || can('admin', 'gerencia'));
  const TL = () => TL0().filter(([k]) => CN.tabOk('audit', k));
  VIEWS.audit = async function () {
    if (CN.pendingTab && CN.pendingTab[0] === 'audit') { ST.tab = CN.pendingTab[1]; CN.pendingTab = null; }
    VZ.mselHandler = (id, vals) => { ST[id] = vals; draw(id === 'sup' || id === 'tipo').catch(fail); };
    CN.sub.audit = { tabs: TL, cur: () => ST.tab, set: (k) => { ST.tab = k; draw().catch(fail); } };
    const m = $('#main'); if (!ST.from) { const r = CN.monthRange(monthNow()); ST.from = r[0]; ST.to = r[1]; }
    const draw = async (recargar) => {
      if (recargar || !DATA) { m.innerHTML = '<p class="note">Cargando…</p>'; await cargar(); }
      const rs = filtrar(), sups = SUPS;
      const tl = TL(); if (tl.length && !tl.some((t) => t[0] === ST.tab)) ST.tab = tl[0][0];
      let body = ''; try { body = ST.tab === 'mot' ? motivos(rs) : ST.tab === 'evo' ? await evolucion() : ST.tab === 'rei' ? reincidencia(rs) : ST.tab === 'rev' ? revisar(rs) : ST.tab === 'obs' ? observaciones(rs) : ST.tab === 'ava' ? avance(rs) : await historial(); } catch (e) { body = `<div class="card">No se pudo armar este panel: ${esc(e.message)}</div>`; }
      m.innerHTML = `<div class="fbar"><label>Desde<input type="date" id="a_from" value="${ST.from}"></label><label>Hasta<input type="date" id="a_to" value="${ST.to}"></label>${VZ.quick()}
        ${VZ.msel('tipo', 'Tipo', [['vis', 'Visitas'], ['tar', 'Tareas']], ST.tipo)}${VZ.msel('sup', 'Supervisor', sups, ST.sup)}</div>${tabs(tl, ST.tab)}<div id="pan">${body}</div>`;
      const B = (id, fn) => { const el = $('#' + id); if (el) el.onchange = fn; };
      VZ.rangeHandler = (a, b) => { ST.from = a; ST.to = b; draw(true).catch(fail); }; B('a_from', (e) => { ST.from = e.target.value; draw(true).catch(fail); }); B('a_to', (e) => { ST.to = e.target.value; draw(true).catch(fail); });
      B('a_dias', (e) => { ST.umbralDias = Number(e.target.value) || 0; draw().catch(fail); }); B('a_pct', (e) => { ST.pctCN = Number(e.target.value) || 0; draw().catch(fail); }); B('a_accion', (e) => { ST.accion = e.target.value; draw().catch(fail); }); B('a_tabla', (e) => { ST.tabla = e.target.value; draw().catch(fail); });
      document.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { ST.tab = b.dataset.tab; draw().catch(fail); }));
      CN.sideRefresh();
      document.querySelectorAll('[data-rv]').forEach((b) => (b.onclick = () => {
        const [tp, id] = b.dataset.rv.split('|'), r = DATA.R.find((x) => x.tp === tp && x.id === id); if (!r) return;
        modalJust(tp, { id: r.id, fecha: r.d, ecm: r.ecm, cliente: r.cn, codigo_cliente: r.cli }, r.j, () => { CN.invalidarAnalisis(); draw(true).catch(fail); });
      }));
    };
    await draw(true);
  };
})();
