'use strict';
/* Metas y alcance. Modos del sistema anterior: share (SOS/SOE), penetración (PDV alcanzados), caras_total (caras CN) y ganadas (espacios ganados).
   El periodo puede ser una semana operativa (AAAA-Wnn) o un mes (AAAA-MM). */
(function () {
  const { n: fN, p: f1, kpi, hbar, table, legend } = VZ;
  NAV.metas = ['Metas y alcance', ['admin', 'gerencia', 'supervisor', 'asesor']];
  const MODOS = { share: 'Share CN', penetracion: 'Penetración', caras_total: 'Caras CN (total)', ganadas: 'Caras ganadas' }, TIPOS = ['PERCHA', 'RUMA', 'BANDEJA FRÍO', 'BANDEJA SECO'];
  const ST = { per: '' }, puede = () => CN.puede('metas') && !can('asesor') || can('admin');
  const lista = (v) => String(v || '').split('|').map((x) => x.trim()).filter(Boolean);
  const ymd = (d) => d.toISOString().slice(0, 10), add = (iso, n) => { const t = new Date(iso + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return ymd(t); };
  const wsd = () => Number(S.cfg.semana_inicio ?? 3);

  function rango(per) {
    let m = per.match(/^(\d{4})-W(\d{1,2})$/);
    if (m) { const y = +m[1], w = +m[2], j1 = (new Date(Date.UTC(y, 0, 1)).getUTCDay() - wsd() + 7) % 7, s = ymd(new Date(Date.UTC(y, 0, 1) + ((w - 1) * 7 - j1) * 864e5)); return { d: s, h: add(s, 6), sem: true }; }
    if (/^\d{4}-\d{2}$/.test(per)) { const [d, h] = CN.monthRange(per); return { d, h, sem: false }; }
    return { d: per, h: per, sem: false };
  }
  const semNum = (per) => { const m = per.match(/^(\d{4})-W(\d{1,2})$/); return m ? `Semana ${+m[2]} de ${m[1]}` : per; };

  /* ---------- carga de metas desde Excel ---------- */
  CN.cargarMetas = async function (rows, say) {
    const first = (r, names) => { for (const n of names) { const v = r[key(n)]; if (v !== undefined && v !== null && String(v).trim() !== '') return v; } return ''; };
    const out = {}; let desc = 0;
    rows.forEach((r) => {
      let per = TXT(first(r, ['PERIODO', 'MES', 'MES O SEMANA'])); if (/^\d{1,2}$/.test(per)) per = `${TXT(first(r, ['ANIO', 'AÑO', 'YEAR'])) || new Date().getFullYear()}-W${per.padStart(2, '0')}`;
      if (r instanceof Object && per && /^\d{4}-\d{2}-\d{2}/.test(per)) per = per.slice(0, 7);
      let valor = parseFloat(String(first(r, ['VALOR', 'META', 'OBJETIVO'])).replace('%', '').replace(',', '.')); if (!per || !isFinite(valor)) { desc++; return; }
      const tipos = TXT(first(r, ['TIPOS', 'TIPO', 'INDICADOR', 'TIPO DE ESPACIO'])).toUpperCase(), nombre = TXT(first(r, ['NOMBRE', 'DETALLE'])) || `${tipos} ${per}`;
      let modo = norm(first(r, ['MODO', 'TIPO DE META', 'METODO'])).toLowerCase().replace(/[^a-z_]/g, '_'); if (/penetra/.test(modo) || /PENETRACI/.test(norm(nombre))) modo = 'penetracion'; else if (/caras/.test(modo)) modo = 'caras_total'; else if (/ganad/.test(modo)) modo = 'ganadas'; else modo = 'share';
      if ((modo === 'share' || modo === 'penetracion') && valor > 1) valor /= 100;
      const o = { nombre, mes: per, ambito: (norm(first(r, ['AMBITO'])) || 'GRUPO').toLowerCase(), clave: TXT(first(r, ['CLAVE'])), tipo: '', modo, valor, responsable: TXT(first(r, ['RESPONSABLE'])), tipos,
        regiones: TXT(first(r, ['REGIONES', 'REGION'])), cadenas: TXT(first(r, ['CADENAS', 'CADENA'])), supervisores: TXT(first(r, ['SUPERVISORES', 'SUPERVISOR'])), ecms: TXT(first(r, ['ECMS', 'ECM'])), pdvs: TXT(first(r, ['PDVS', 'PDV'])), excluir: TXT(first(r, ['EXCLUIR', 'EXCLUIR PDV'])), base: TXT(first(r, ['BASE', 'MEDIR'])) };
      out[[o.nombre, o.mes, o.ambito, o.clave, o.tipo, o.modo].join('|')] = o;
    });
    const L = Object.values(out); if (!L.length) throw new Error('Ninguna meta válida. Columnas: NOMBRE, TIPOS, TIPO DE META, VALOR, REGIONES, CADENAS, SUPERVISORES, ECM, PDV, EXCLUIR, PERIODO, RESPONSABLE.');
    for (let i = 0; i < L.length; i += 300) { say && say(`Guardando metas ${Math.min(i + 300, L.length)} de ${L.length}…`); const { error } = await sb.from('metas').upsert(L.slice(i, i + 300), { onConflict: 'clave_uk' }); if (error) throw error; }
    return { tp: 'meta', filas: L.length, descartadas: desc, nuevas: L.length, actualizadas: 0, iguales: 0 };
  };

  /* ---------- cálculo del avance de cada meta ---------- */
  async function avance(m) {
    const r = rango(m.mes), tipos = lista(m.tipos).length ? lista(m.tipos) : [];
    if (m.modo === 'ganadas') {
      const G = CN.sinOff(await CN.fetchPar((o) => sb.from('ganancias').select('fecha,codigo,ecm,supervisor,cadena,percha,frio,seco,ruma', o).gte('fecha', r.d).lte('fecha', r.h).order('id')));
      const e = lista(m.ecms).map((x) => ecmNorm(x)), s = lista(m.supervisores).map(norm), c = lista(m.cadenas).map(norm), p = lista(m.pdvs), t = tipos.map((x) => ({ PERCHA: 'percha', 'BANDEJA FRÍO': 'frio', 'BANDEJA SECO': 'seco', RUMA: 'ruma' })[x]).filter(Boolean);
      const sel = G.filter((g) => (!e.length || e.includes(ecmNorm(g.ecm || ''))) && (!s.length || s.includes(norm(g.supervisor || ''))) && (!c.length || c.includes(norm(g.cadena || ''))) && (!p.length || p.includes(g.codigo)));
      return { actual: sel.reduce((a, g) => a + (t.length ? t : ['percha', 'frio', 'seco', 'ruma']).reduce((b, k) => b + (g[k] || 0), 0), 0), meta: m.valor, pct: true === false ? null : null, rango: r };
    }
    const args = { p_desde: r.d, p_hasta: r.h, p_region: lista(m.regiones).length ? lista(m.regiones) : null, p_cadena: lista(m.cadenas).length ? lista(m.cadenas) : null, p_supervisor: lista(m.supervisores).length ? lista(m.supervisores).map((x) => x.toUpperCase()) : null,
      p_ecm: lista(m.ecms).length ? lista(m.ecms).map((x) => x.toUpperCase()) : null, p_pdv: lista(m.pdvs).length ? lista(m.pdvs) : null, p_excluir: lista(m.excluir).length ? lista(m.excluir) : null };
    const rows = await CN.shareAgg({ ...args, p_dim: m.modo === 'penetracion' ? 'pdv' : 'TOTAL' }), sel = rows.filter((x) => !tipos.length || tipos.includes(x.tipo));
    if (m.modo === 'penetracion') { const P = {}; sel.forEach((x) => { const o = (P[x.dim] ||= 0); if (x.grupo === 'CN' && Number(x.caras) > 0) P[x.dim] = 1; }); const n = new Set(sel.map((x) => x.dim)).size, ok = Object.values(P).reduce((a, b) => a + b, 0); return { actual: n ? ok / n : null, n, ok, meta: m.valor, rango: r }; }
    const tot = sel.reduce((a, x) => a + Number(x.caras), 0), cn = sel.filter((x) => x.grupo === 'CN').reduce((a, x) => a + Number(x.caras), 0);
    return m.modo === 'caras_total' ? { actual: cn, meta: m.valor, rango: r } : { actual: tot ? cn / tot : null, tot, cn, meta: m.valor, rango: r };
  }
  CN.metaAvance = avance; CN.metaRango = rango;
  const esPct = (m) => m.modo === 'share' || m.modo === 'penetracion';
  const fmtV = (m, v) => (v == null ? '—' : esPct(m) ? (v * 100).toFixed(1) + '%' : fN(Math.round(v)));

  VIEWS.metas = async function () {
    const mt = $('#main');
    const draw = async () => {
      mt.innerHTML = '<p class="note">Cargando…</p>';
      const { data: all, error } = await sb.from('metas').select('*').order('mes', { ascending: false }).limit(2000); if (error) throw error;
      const pers = [...new Set((all || []).map((x) => x.mes))].sort().reverse(); if (!ST.per || (!pers.includes(ST.per) && pers.length)) ST.per = pers[0] || monthNow();
      const L = (all || []).filter((x) => x.mes === ST.per), R = await Promise.all(L.map(async (m) => { try { return { m, ...(await avance(m)) }; } catch (e) { return { m, err: e.message }; } }));
      const cum = (x) => (x.err || x.actual == null || !x.meta ? null : (x.actual / x.meta) * 100), tone = (c) => (c == null ? 'var(--mut)' : c >= 100 ? 'var(--cE)' : c >= 85 ? 'var(--cF)' : 'var(--cP)');
      const resp = [...new Set(L.map((x) => x.responsable).filter(Boolean))];
      mt.innerHTML = `<div class="fbar"><label>Periodo<select id="m_per">${[...new Set([...pers, ST.per])].map((p) => `<option value="${esc(p)}" ${p === ST.per ? 'selected' : ''}>${esc(semNum(p))}</option>`).join('')}</select></label>
        ${puede() ? '<button class="pri" id="m_new">Nueva meta</button><button id="m_copy">Copiar a otro periodo</button>' : ''}<span class="note">${esc(rango(ST.per).d)} → ${esc(rango(ST.per).h)} · ${fN(L.length)} metas${resp.length ? ' · responsables: ' + esc(resp.join(', ')) : ''}</span></div>
        <div class="kp">${kpi('Metas', fN(L.length), '')}${kpi('Cumplidas', fN(R.filter((x) => cum(x) >= 100).length), '', 'var(--cE)')}${kpi('Cerca (85–99%)', fN(R.filter((x) => cum(x) >= 85 && cum(x) < 100).length), '', 'var(--cF)')}${kpi('Por debajo de 85%', fN(R.filter((x) => cum(x) != null && cum(x) < 85).length), '', 'var(--cP)')}</div>
        <div class="card"><h3>Alcance por meta</h3>${hbar(R.filter((x) => cum(x) != null).sort((a, b) => cum(b) - cum(a)).map((x) => ({ l: x.m.nombre, v: Math.min(cum(x), 100), t: `${f1(cum(x))} · ${fmtV(x.m, x.actual)} / ${fmtV(x.m, x.meta)}`, c: tone(cum(x)), tip: `${x.m.nombre}\nActual ${fmtV(x.m, x.actual)} · meta ${fmtV(x.m, x.meta)}` })), { max: 100 }) || '<p class="note">No hay metas para este periodo. Agrégalas o súbelas en «Cargar bases».</p>'}${legend([['Cumplida (≥ 100%)', 'var(--cE)'], ['Cerca (85–99%)', 'var(--cF)'], ['Por debajo de 85%', 'var(--cP)']])}</div>
        <div class="card">${table([{ h: 'Meta' }, { h: 'Responsable' }, { h: 'Tipo' }, { h: 'Espacios' }, { h: 'Alcance' }, { h: 'Meta', n: 1 }, { h: 'Actual', n: 1 }, { h: 'Cumplimiento', n: 1 }, ...(puede() ? [{ h: '' }] : [])],
          R.map((x) => { const c = cum(x); return { c: [`<span style="white-space:normal">${esc(x.m.nombre)}</span>`, esc(x.m.responsable || '—'), MODOS[x.m.modo] || x.m.modo, esc(lista(x.m.tipos).join(' · ') || '—'), `<span class="note" style="white-space:normal">${esc([x.m.regiones, lista(x.m.cadenas).length > 3 ? lista(x.m.cadenas).length + ' cadenas' : x.m.cadenas, lista(x.m.ecms).length ? lista(x.m.ecms).length + ' ECM' : ''].filter(Boolean).join(' · ') || 'Todo')}</span>`,
            puede() ? `<input type="number" step="any" style="width:90px" data-mv="${x.m.id}" aria-label="Valor de la meta ${esc(x.m.nombre)}" value="${esPct(x.m) ? +(x.m.valor * 100).toFixed(2) : x.m.valor}">${esPct(x.m) ? '%' : ''}` : fmtV(x.m, x.m.valor), x.err ? `<span class="note">${esc(x.err)}</span>` : fmtV(x.m, x.actual), c == null ? '—' : `<span class="semaforo" style="--c:${tone(c)}"></span>${f1(c)}`, ...(puede() ? [`<button class="bad" data-md="${x.m.id}">Quitar</button>`] : [])],
            s: [x.m.nombre, x.m.responsable || '', x.m.modo, x.m.tipos, '', x.m.valor, x.actual ?? -1, c ?? -1, ''], x: [x.m.nombre, x.m.responsable, MODOS[x.m.modo], x.m.tipos, x.m.regiones, x.m.cadenas, x.m.valor, x.actual == null ? '' : +x.actual.toFixed(4), c == null ? '' : +c.toFixed(1)] }; }), { name: 'metas_' + ST.per, max: 300 })}</div>`;
      $('#m_per').onchange = (e) => { ST.per = e.target.value; draw().catch(fail); };
      const n = $('#m_new'); if (n) n.onclick = () => modal(draw).catch(fail); const cp = $('#m_copy'); if (cp) cp.onclick = () => copiar(all || [], draw);
      document.querySelectorAll('[data-mv]').forEach((i) => (i.onchange = async () => { const m = L.find((x) => String(x.id) === i.dataset.mv); let v = parseFloat(i.value); if (!isFinite(v)) return; if (esPct(m)) v /= 100; const { error: e } = await sb.from('metas').update({ valor: v }).eq('id', m.id); e ? fail(e) : (toast('Guardado'), draw().catch(fail)); }));
      document.querySelectorAll('[data-md]').forEach((b) => (b.onclick = async () => { if (!confirm('¿Quitar esta meta?')) return; const { error: e } = await sb.from('metas').delete().eq('id', b.dataset.md); e ? fail(e) : draw().catch(fail); }));
    };
    await draw();
  };
  /* ---------- semanas operativas y creación guiada ---------- */
  const opWeek = (iso) => { const p = iso.split('-').map(Number), d = new Date(Date.UTC(p[0], p[1] - 1, p[2])), W = wsd(), opDay = (d.getUTCDay() - W + 7) % 7, jan1 = new Date(Date.UTC(p[0], 0, 1)), j1 = (jan1.getUTCDay() - W + 7) % 7, doy = Math.round((d - jan1) / 864e5); return { year: p[0], week: Math.floor((doy + j1) / 7) + 1, start: ymd(new Date(d.getTime() - opDay * 864e5)) }; };
  const clavSem = (iso) => { const w = opWeek(iso); return `${w.year}-W${String(w.week).padStart(2, '0')}`; };
  const semanasOpc = () => { const hoy = ymd(new Date()), seen = new Set(), o = []; for (let i = -6; i <= 12; i++) { const w = opWeek(add(hoy, i * 7)), k = `${w.year}-W${String(w.week).padStart(2, '0')}`; if (seen.has(k)) continue; seen.add(k); o.push([k, `Semana ${w.week} · ${w.start.slice(8)}/${w.start.slice(5, 7)} → ${add(w.start, 6).slice(8)}/${add(w.start, 6).slice(5, 7)}`]); } return o; };
  const TIPOS_META = { sos: ['SOS · share de percha', 'share', 'PERCHA'], soe: ['SOE · share de espacios', 'share', 'RUMA|BANDEJA FRÍO|BANDEJA SECO'], gan: ['Espacios ganados (caras)', 'ganadas', ''], pen: ['Penetración de espacios (% de PDV con espacio CN)', 'penetracion', 'RUMA|BANDEJA FRÍO|BANDEJA SECO'], car: ['Caras CN totales', 'caras_total', 'PERCHA'] };
  const siguiente = (per, k) => { if (/^\d{4}-W\d+$/.test(per)) return clavSem(add(rango(per).d, 7 * k)); const [y, mo] = per.split('-').map(Number), d = new Date(Date.UTC(y, mo - 1 + k, 1)); return d.toISOString().slice(0, 7); };
  const renombrar = (nom, per) => { const w = per.match(/-W(\d+)$/); return w ? nom.replace(/\b(SEM|SEMANA)\s*\d+/i, (x, a) => `${a} ${+w[1]}`) : nom; };

  async function opciones() { const { data } = await sb.rpc('share_opts'); return data || {}; }
  async function modal(done) {
    const O = await opciones(), el = document.createElement('div'); el.className = 'modal';
    const ms = (id, l, list) => `<label>${l}<select multiple size="4" id="${id}">${(list || []).map((x) => `<option>${esc(x)}</option>`).join('')}</select><span class="note">Sin selección = todos</span></label>`;
    el.innerHTML = `<form class="box" style="max-width:560px"><h3>Nueva meta personalizada</h3>
      <label>Qué se mide<select id="mm_k">${Object.entries(TIPOS_META).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}</select></label>
      <div class="bar" style="margin:0"><label class="mso"><input type="radio" name="mm_f" value="sem" checked> Semanal</label><label class="mso"><input type="radio" name="mm_f" value="mes"> Mensual</label></div>
      <label id="mm_ps">Semana<select id="mm_sem">${semanasOpc().map(([k, t]) => `<option value="${k}" ${k === ST.per ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
      <label id="mm_pm" hidden>Mes<input type="month" id="mm_mes" value="${monthNow()}"></label>
      <label>Repetir en los siguientes periodos<input id="mm_rep" type="number" min="0" max="12" value="0" style="width:90px"><span class="note">0 = solo este periodo. Crea la misma meta en las semanas o meses siguientes.</span></label>
      <label>Nombre (opcional)<input id="mm_n" placeholder="Se arma solo, por ejemplo «SOS · semana 47»"></label>
      <div class="grid">${ms('mm_r', 'Regiones', O.region)}${ms('mm_c', 'Cadenas', O.cadena)}${ms('mm_s', 'Supervisores', O.supervisor)}${ms('mm_e', 'ECM', O.ecm)}</div>
      <label>Responsable<input id="mm_o"></label><label id="mm_vl">Valor (%)<input id="mm_v" type="number" step="any" min="0" required></label>
      <div class="bar" style="margin:0"><button class="pri">Guardar</button><button type="button" id="mm_x">Cancelar</button></div></form>`;
    document.body.appendChild(el); $('#mm_x', el).onclick = () => el.remove();
    const k = () => TIPOS_META[$('#mm_k', el).value], pctMode = () => k()[1] === 'share' || k()[1] === 'penetracion';
    const sync = () => { const sem = el.querySelector('[name=mm_f]:checked').value === 'sem'; $('#mm_ps', el).hidden = !sem; $('#mm_pm', el).hidden = sem; $('#mm_vl', el).firstChild.textContent = pctMode() ? 'Valor (% de share o penetración)' : 'Valor (número de caras)'; };
    el.querySelectorAll('[name=mm_f],#mm_k').forEach((x) => (x.onchange = sync)); sync();
    const sel = (id) => [...$('#' + id, el).selectedOptions].map((x) => x.value).join('|');
    $('form', el).onsubmit = async (ev) => {
      ev.preventDefault(); const [lbl, modo, tipos] = k(), per0 = el.querySelector('[name=mm_f]:checked').value === 'sem' ? $('#mm_sem', el).value : $('#mm_mes', el).value; let v = parseFloat($('#mm_v', el).value); if (!isFinite(v)) return; if (pctMode()) v /= 100;
      const reps = Math.max(0, Math.min(12, parseInt($('#mm_rep', el).value, 10) || 0)), base = $('#mm_n', el).value.trim(), rows = [];
      for (let i = 0; i <= reps; i++) { const per = siguiente(per0, i); rows.push({ nombre: renombrar(base || `${lbl.split(' · ')[0].split(' (')[0]} · ${semNum(per).toLowerCase()}`, per), mes: per, ambito: 'grupo', clave: '', tipo: '', modo, valor: v, responsable: $('#mm_o', el).value.trim(), tipos, regiones: sel('mm_r'), cadenas: sel('mm_c'), supervisores: sel('mm_s'), ecms: sel('mm_e'), pdvs: '', excluir: '', base: '' }); }
      const { error } = await sb.from('metas').upsert(rows, { onConflict: 'clave_uk' }); if (error) return fail(error); el.remove(); ST.per = per0; toast(`${rows.length} meta${rows.length === 1 ? '' : 's'} guardada${rows.length === 1 ? '' : 's'}`); done().catch(fail);
    };
  }
  async function copiar(todas, done) {
    const origen = todas.filter((x) => x.mes === ST.per); if (!origen.length) return toast('No hay metas en este periodo para copiar.');
    const el = document.createElement('div'); el.className = 'modal';
    el.innerHTML = `<form class="box"><h3>Copiar las ${origen.length} metas de ${esc(semNum(ST.per))}</h3><div class="bar" style="margin:0"><label class="mso"><input type="radio" name="cp_f" value="sem" ${/-W/.test(ST.per) ? 'checked' : ''}> Semanal</label><label class="mso"><input type="radio" name="cp_f" value="mes" ${/-W/.test(ST.per) ? '' : 'checked'}> Mensual</label></div>
      <label id="cp_ps">Semana destino<select id="cp_sem">${semanasOpc().map(([k, t]) => `<option value="${k}" ${k === siguiente(/-W/.test(ST.per) ? ST.per : clavSem(ymd(new Date())), 1) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
      <label id="cp_pm" hidden>Mes destino<input type="month" id="cp_mes" value="${siguiente(/-W/.test(ST.per) ? monthNow() : ST.per, 1)}"></label><p class="note">Se copian valores, alcance y responsables; el número de semana del nombre se actualiza.</p>
      <div class="bar" style="margin:0"><button class="pri">Copiar</button><button type="button" id="cp_x">Cancelar</button></div></form>`;
    document.body.appendChild(el); $('#cp_x', el).onclick = () => el.remove();
    el.querySelectorAll('[name=cp_f]').forEach((x) => (x.onchange = () => { const s = el.querySelector('[name=cp_f]:checked').value === 'sem'; $('#cp_ps', el).hidden = !s; $('#cp_pm', el).hidden = s; })); el.querySelector('[name=cp_f]:checked').onchange();
    $('form', el).onsubmit = async (ev) => {
      ev.preventDefault(); const per = el.querySelector('[name=cp_f]:checked').value === 'sem' ? $('#cp_sem', el).value : $('#cp_mes', el).value; if (per === ST.per) return toast('Elige un periodo distinto.');
      const rows = origen.map(({ id, clave_uk, ...r }) => ({ ...r, mes: per, nombre: renombrar(r.nombre, per) })); const { error } = await sb.from('metas').upsert(rows, { onConflict: 'clave_uk' }); if (error) return fail(error); el.remove(); ST.per = per; toast(`${rows.length} metas copiadas`); done().catch(fail);
    };
  }
  /* orden final del menú */
  const ORDER = ['dashboard', 'visitas', 'tareas', 'audit', 'sos', 'ganancias', 'metas', 'registro', 'pend', 'informe', 'rutero', 'catalogo', 'ecm', 'carga', 'config', 'admin'], copy = { ...NAV };
  Object.keys(NAV).forEach((k) => delete NAV[k]); ORDER.forEach((k) => { if (copy[k]) NAV[k] = copy[k]; });
  NAV.audit[0] = 'Auditoría de justificaciones'; NAV.sos[0] = 'SOS y SOE'; NAV.visitas[0] = 'Visitas'; NAV.tareas[0] = 'Tareas'; NAV.ganancias[0] = 'Espacios ganados'; NAV.carga[0] = 'Cargar bases';
})();
