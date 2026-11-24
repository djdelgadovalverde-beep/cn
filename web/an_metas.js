'use strict';
/* Metas y alcance. Modos del sistema anterior: share (SOS/SOE), penetración (PDV alcanzados), caras_total (caras CN) y ganadas (espacios ganados).
   El periodo puede ser una semana operativa (AAAA-Wnn) o un mes (AAAA-MM). */
(function () {
  const { n: fN, p: f1, kpi, hbar, table, legend } = VZ;
  NAV.metas = ['Metas y alcance', ['admin', 'gerencia', 'supervisor', 'asesor']];
  const MODOS = { share: 'Share CN', penetracion: 'Penetración', caras_total: 'Caras CN (total)', caras_pdv: 'Caras CN por PDV', ganadas: 'Caras ganadas' }, TIPOS = ['PERCHA', 'RUMA', 'BANDEJA FRÍO', 'BANDEJA SECO'];
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
  const semNum = (per) => { if (!per) return 'Siempre'; if (/^\d{4}-\d{2}\+$/.test(per)) return 'Desde ' + per.slice(0, 7) + ' en adelante'; const m = per.match(/^(\d{4})-W(\d{1,2})$/); return m ? `Semana ${+m[2]} de ${m[1]}` : per; };

  /* ---------- carga de metas desde Excel ---------- */
  CN.cargarMetas = async function (rows, say) {
    const first = (r, names) => { for (const n of names) { const v = r[key(n)]; if (v !== undefined && v !== null && String(v).trim() !== '') return v; } return ''; };
    const out = {}; let desc = 0;
    rows.forEach((r) => {
      let per = TXT(first(r, ['PERIODO', 'MES', 'MES O SEMANA'])); if (/^siempre$/i.test(per)) per = ''; if (/^\d{1,2}$/.test(per)) per = `${TXT(first(r, ['ANIO', 'AÑO', 'YEAR'])) || new Date().getFullYear()}-W${per.padStart(2, '0')}`;
      if (r instanceof Object && per && /^\d{4}-\d{2}-\d{2}/.test(per)) per = per.slice(0, 7);
      let valor = parseFloat(String(first(r, ['VALOR', 'META', 'OBJETIVO'])).replace('%', '').replace(',', '.')); if (!isFinite(valor)) { desc++; return; }
      const tipos = TXT(first(r, ['TIPOS', 'TIPO', 'INDICADOR', 'TIPO DE ESPACIO'])).toUpperCase(), nombre = TXT(first(r, ['NOMBRE', 'DETALLE'])) || `${tipos} ${per}`;
      let modo = norm(first(r, ['MODO', 'TIPO DE META', 'METODO'])).toLowerCase().replace(/[^a-z_]/g, '_'); if (/penetra/.test(modo) || /PENETRACI/.test(norm(nombre))) modo = 'penetracion'; else if (/caras/.test(modo) && /pdv/.test(modo)) modo = 'caras_pdv'; else if (/caras/.test(modo)) modo = 'caras_total'; else if (/ganad/.test(modo)) modo = 'ganadas'; else modo = 'share';
      if ((modo === 'share' || modo === 'penetracion') && valor > 1) valor /= 100;
      const o = { nombre, mes: per, ambito: (norm(first(r, ['AMBITO'])) || 'GRUPO').toLowerCase(), clave: TXT(first(r, ['CLAVE'])), tipo: '', modo, valor, responsable: TXT(first(r, ['RESPONSABLE'])), tipos,
        regiones: TXT(first(r, ['REGIONES', 'REGION'])), cadenas: TXT(first(r, ['CADENAS', 'CADENA'])), supervisores: TXT(first(r, ['SUPERVISORES', 'SUPERVISOR'])), ecms: TXT(first(r, ['ECMS', 'ECM'])), pdvs: TXT(first(r, ['PDVS', 'PDV'])), excluir: TXT(first(r, ['EXCLUIR', 'EXCLUIR PDV'])), base: /grupo/i.test(TXT(first(r, ['BASE', 'MEDIR']))) ? 'grupo' : 'pdv' };
      out[[o.nombre, o.mes, o.ambito, o.clave, o.tipo, o.modo].join('|')] = o;
    });
    const L = Object.values(out); if (!L.length) throw new Error('Ninguna meta válida. Columnas: NOMBRE, TIPOS, TIPO DE META, VALOR, REGIONES, CADENAS, SUPERVISORES, ECM, PDV, EXCLUIR, PERIODO, RESPONSABLE.');
    for (let i = 0; i < L.length; i += 300) { say && say(`Guardando metas ${Math.min(i + 300, L.length)} de ${L.length}…`); const { error } = await sb.from('metas').upsert(L.slice(i, i + 300), { onConflict: 'clave_uk' }); if (error) throw error; }
    return { tp: 'meta', filas: L.length, descartadas: desc, nuevas: L.length, actualizadas: 0, iguales: 0 };
  };

  /* ---------- cálculo del avance de cada meta ---------- */
  const mesDe = (per) => (/-W/.test(per) ? rango(per).d.slice(0, 7) : per);
  /* una meta aplica a un periodo si es de ese periodo, de su mes, «siempre» o «desde un mes en adelante» */
  const aplica = (m, per) => !m.mes || m.mes === per || (/-W/.test(per) && m.mes === mesDe(per)) || (/^\d{4}-\d{2}\+$/.test(m.mes) && m.mes.slice(0, 7) <= mesDe(per));
  CN.metaAplica = aplica;
  async function avance(m, per) {
    const pp = per || (m.mes && !/\+$/.test(m.mes) ? m.mes : monthNow()), r = rango(pp), tipos = lista(m.tipos).length ? lista(m.tipos) : [];
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
    if (m.modo === 'caras_pdv') { const P = {}; sel.forEach((x) => { const o = (P[x.dim] ||= 0); if (x.grupo === 'CN') P[x.dim] += Number(x.caras); }); const pdvs = new Set(sel.map((x) => x.dim)).size, ok = Object.values(P).reduce((a, b) => a + Math.min(b, m.valor), 0); return { actual: ok, meta: m.valor * pdvs, rango: r }; }
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
      const pers = [...new Set((all || []).map((x) => x.mes).filter((p) => p && !/\+$/.test(p)))].sort().reverse(); if (!ST.per || (!pers.includes(ST.per) && pers.length)) ST.per = pers[0] || monthNow();
      const L = (all || []).filter((x) => aplica(x, ST.per)), R = await Promise.all(L.map(async (m) => { try { return { m, ...(await avance(m, !m.mes || /\+$/.test(m.mes) ? ST.per : undefined)) }; } catch (e) { return { m, err: e.message }; } }));
      const cum = (x) => (x.err || x.actual == null || !x.meta ? null : (x.actual / x.meta) * 100), tone = (c) => (c == null ? 'var(--mut)' : c >= 100 ? 'var(--cE)' : c >= 85 ? 'var(--cF)' : 'var(--cP)');
      const resp = [...new Set(L.map((x) => x.responsable).filter(Boolean))];
      mt.innerHTML = `<div class="fbar"><label>Periodo<select id="m_per">${[...new Set([...pers, ST.per])].map((p) => `<option value="${esc(p)}" ${p === ST.per ? 'selected' : ''}>${esc(semNum(p))}</option>`).join('')}</select></label>
        ${puede() ? '<button class="pri" id="m_new">Nueva meta</button><button id="m_edit">Editar todas las metas</button>' : ''}<span class="note">${esc(rango(ST.per).d)} → ${esc(rango(ST.per).h)} · ${fN(L.length)} metas${resp.length ? ' · responsables: ' + esc(resp.join(', ')) : ''}</span></div>
        <div class="kp">${kpi('Metas', fN(L.length), '')}${kpi('Cumplidas', fN(R.filter((x) => cum(x) >= 100).length), '', 'var(--cE)')}${kpi('Cerca (85–99%)', fN(R.filter((x) => cum(x) >= 85 && cum(x) < 100).length), '', 'var(--cF)')}${kpi('Por debajo de 85%', fN(R.filter((x) => cum(x) != null && cum(x) < 85).length), '', 'var(--cP)')}</div>
        <div class="card"><h3>Alcance por meta</h3>${hbar(R.filter((x) => cum(x) != null).sort((a, b) => cum(b) - cum(a)).map((x) => ({ l: x.m.nombre, v: Math.min(cum(x), 100), t: `${f1(cum(x))} · ${fmtV(x.m, x.actual)} / ${fmtV(x.m, x.meta)}`, c: tone(cum(x)), tip: `${x.m.nombre}\nActual ${fmtV(x.m, x.actual)} · meta ${fmtV(x.m, x.meta)}` })), { max: 100 }) || '<p class="note">No hay metas para este periodo. Agrégalas o súbelas en «Cargar bases».</p>'}${legend([['Cumplida (≥ 100%)', 'var(--cE)'], ['Cerca (85–99%)', 'var(--cF)'], ['Por debajo de 85%', 'var(--cP)']])}</div>
        <div class="card">${table([{ h: 'Meta' }, { h: 'Responsable' }, { h: 'Tipo' }, { h: 'Espacios' }, { h: 'Alcance' }, { h: 'Meta', n: 1 }, { h: 'Actual', n: 1 }, { h: 'Cumplimiento', n: 1 }, ...(puede() ? [{ h: '' }] : [])],
          R.map((x) => { const c = cum(x); return { c: [`<span style="white-space:normal">${esc(x.m.nombre)}</span>`, esc(x.m.responsable || '—'), MODOS[x.m.modo] || x.m.modo, esc(lista(x.m.tipos).join(' · ') || '—'), `<span class="note" style="white-space:normal">${esc([x.m.regiones, lista(x.m.cadenas).length > 3 ? lista(x.m.cadenas).length + ' cadenas' : x.m.cadenas, lista(x.m.ecms).length ? lista(x.m.ecms).length + ' ECM' : ''].filter(Boolean).join(' · ') || 'Todo')}</span>`,
            puede() ? `<input type="number" step="any" style="width:90px" data-mv="${x.m.id}" aria-label="Valor de la meta ${esc(x.m.nombre)}" value="${esPct(x.m) ? +(x.m.valor * 100).toFixed(2) : x.m.valor}">${esPct(x.m) ? '%' : ''}` : fmtV(x.m, x.m.valor), x.err ? `<span class="note">${esc(x.err)}</span>` : fmtV(x.m, x.actual), c == null ? '—' : `<span class="semaforo" style="--c:${tone(c)}"></span>${f1(c)}`, ...(puede() ? [`<button class="bad" data-md="${x.m.id}">Quitar</button>`] : [])],
            s: [x.m.nombre, x.m.responsable || '', x.m.modo, x.m.tipos, '', x.m.valor, x.actual ?? -1, c ?? -1, ''], x: [x.m.nombre, x.m.responsable, MODOS[x.m.modo], x.m.tipos, x.m.regiones, x.m.cadenas, x.m.valor, x.actual == null ? '' : +x.actual.toFixed(4), c == null ? '' : +c.toFixed(1)] }; }), { name: 'metas_' + ST.per, max: 300 })}</div>`;
      $('#m_per').onchange = (e) => { ST.per = e.target.value; draw().catch(fail); };
      const n = $('#m_new'); if (n) n.onclick = () => CN.metasEditar(true); const ed = $('#m_edit'); if (ed) ed.onclick = () => CN.metasEditar(false);
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
  CN.metasUtil = { semanasOpc, siguiente, clavSem, semNum, rango, MODOS };
  /* orden final del menú */
  const ORDER = ['dashboard', 'visitas', 'tareas', 'audit', 'sos', 'ganancias', 'metas', 'registro', 'pend', 'informe', 'rutero', 'catalogo', 'ecm', 'carga', 'config', 'admin'], copy = { ...NAV };
  Object.keys(NAV).forEach((k) => delete NAV[k]); ORDER.forEach((k) => { if (copy[k]) NAV[k] = copy[k]; });
  NAV.audit[0] = 'Auditoría de justificaciones'; NAV.sos[0] = 'SOS y SOE'; NAV.visitas[0] = 'Visitas'; NAV.tareas[0] = 'Tareas'; NAV.ganancias[0] = 'Espacios ganados'; NAV.carga[0] = 'Cargar bases';
})();
