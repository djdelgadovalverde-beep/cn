'use strict';
/* Configuración: pesos del puntaje (suman 100, con vista previa), metas, semana y exclusiones, regla de equipo de frío y umbrales de análisis. */
(function () {
  NAV.config = ['Pesos, metas y configuración', ['admin']];
  const PESOS = [['w_vis', 'Efectividad de visitas', 20], ['w_tar', 'Efectividad de tareas', 30], ['w_frio', 'Tareas de equipo de frío', 30], ['w_sos', 'SOS · share de percha', 10], ['w_soe', 'SOE · share de espacios', 10]];
  const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const TABS = [['pesos', 'Pesos del puntaje'], ['metas', 'Metas'], ['semana', 'Semana y exclusiones'], ['frio', 'Tareas de equipo de frío'], ['analisis', 'Umbrales de análisis'], ['otros', 'Otros ajustes']];
  const CONOCIDAS = new Set(['w_vis', 'w_tar', 'w_frio', 'w_sos', 'w_soe', 'meta_vis', 'meta_tar', 'meta_frio', 'meta_sos', 'meta_soe', 'score_vs_meta', 'semana_inicio', 'excluir_pdv', 'frio_regex', 'rei_min', 'dur_min', 'dias_antiguedad']);
  const ST = { tab: 'pesos', mes: '' }; let C = {}, D = {}, PREV = {};
  const n = (k, d) => (D[k] == null || D[k] === '' ? d : Number(D[k]));
  const cambios = () => Object.keys(D).filter((k) => String(D[k]) !== String(C[k] ?? ''));
  const sumaPesos = () => PESOS.reduce((a, [k, , d]) => a + n(k, d), 0);

  async function cargar() { const { data, error } = await sb.from('config').select('*'); if (error) throw error; C = Object.fromEntries((data || []).map((r) => [r.clave, r.valor])); D = { ...C }; }

  /* ---------- vista previa del puntaje con los pesos en edición ---------- */
  const puntaje = (r, w, vsm, m) => {
    const c = (x, meta) => (x == null ? null : Math.min(1, x / (meta || 1)));
    const P = [[w.w_vis, c(r.vis_pct, vsm ? m.vis : 1)], [w.w_tar, c(r.tar_pct, vsm ? m.tar : 1)], [w.w_frio, c(r.frio_pct, vsm ? m.frio : 1)], [w.w_sos, c(r.sos_pct, Number(r.meta_sos_ecm) || m.sos)], [w.w_soe, c(r.soe_pct, Number(r.meta_soe_ecm) || m.soe)]].filter((x) => x[1] != null);
    const t = P.reduce((a, x) => a + x[0], 0); return t ? (100 * P.reduce((a, x) => a + x[0] * x[1], 0)) / t : null;
  };
  async function vistaPrevia() {
    const mes = ST.mes || monthNow(), [d, h] = CN.monthRange(mes);
    if (!PREV[mes]) { const { data, error } = await sb.rpc('score_ecm', { p_desde: d, p_hasta: h }); if (error) throw error; PREV[mes] = (data || []).filter((r) => r.score != null); }
    const rows = PREV[mes]; if (!rows.length) return '<p class="note">No hay datos en ese mes para la vista previa.</p>';
    const w = Object.fromEntries(PESOS.map(([k, , def]) => [k, n(k, def)])), wc = Object.fromEntries(PESOS.map(([k, , def]) => [k, Number(C[k] ?? def)]));
    const mm = (cfg) => ({ vis: Number(cfg.meta_vis || 0.9), tar: Number(cfg.meta_tar || 0.9), frio: Number(cfg.meta_frio || 0.9), sos: Number(cfg.meta_sos || 0.8), soe: Number(cfg.meta_soe || 0.8) });
    const L = rows.map((r) => ({ r, nuevo: puntaje(r, w, D.score_vs_meta === '1', mm(D)), actual: puntaje(r, wc, C.score_vs_meta === '1', mm(C)) })).filter((x) => x.nuevo != null).sort((a, b) => b.nuevo - a.nuevo);
    const avg = (k) => L.reduce((a, x) => a + x[k], 0) / L.length, f = (x) => x.toFixed(1), dl = (a, b) => { const v = a - b; return `<span style="color:var(--${v >= 0.05 ? 'cE' : v <= -0.05 ? 'cP' : 'mut'})">${v >= 0 ? '+' : ''}${v.toFixed(1)}</span>`; };
    const tabla = (X) => `<table><thead><tr><th>ECM</th><th>Nombre</th><th class="n">Guardado</th><th class="n">Con estos pesos</th><th class="n">Cambio</th></tr></thead><tbody>${X.map((x) => `<tr><td>${esc(x.r.ecm)}</td><td>${esc(x.r.nombre || '')}</td><td class="n">${f(x.actual)}</td><td class="n"><b>${f(x.nuevo)}</b></td><td class="n">${dl(x.nuevo, x.actual)}</td></tr>`).join('')}</tbody></table>`;
    return `<div class="kp">${VZ.kpi('Puntaje promedio guardado', f(avg('actual')), `${L.length} ECM`)}${VZ.kpi('Con los pesos en edición', f(avg('nuevo')), '', 'var(--brand)')}${VZ.kpi('Cambio promedio', (avg('nuevo') - avg('actual') >= 0 ? '+' : '') + f(avg('nuevo') - avg('actual')), '')}</div>
      <div class="g2"><div class="card"><h3>5 mejores</h3><div class="tw">${tabla(L.slice(0, 5))}</div></div><div class="card"><h3>5 con menor puntaje</h3><div class="tw">${tabla(L.slice(-5).reverse())}</div></div></div>`;
  }

  /* ---------- pestañas ---------- */
  const campoPct = (k, l, ayuda, def) => `<label>${l}<span style="display:flex;gap:6px;align-items:center"><input type="number" min="0" max="100" step="0.5" data-pct="${k}" value="${+(n(k, def) * 100).toFixed(2)}" style="width:110px"> %</span><span class="note">${ayuda}</span></label>`;
  const campoNum = (k, l, ayuda, def, min = 0) => `<label>${l}<input type="number" min="${min}" data-num="${k}" value="${n(k, def)}" style="width:130px"><span class="note">${ayuda}</span></label>`;

  async function pesos() {
    const tot = sumaPesos(), ok = Math.abs(tot - 100) < 0.001;
    const colores = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)'];
    return `<div class="card"><h3>Peso de cada componente en el puntaje por persona</h3><p class="note">El puntaje va de 0 a 100. Cada componente aporta según su peso; si a una persona le falta un componente (sin datos), su peso se reparte entre los demás.</p>
      <div class="stk" style="height:22px;margin:10px 0">${PESOS.map(([k, l, d], i) => `<i style="width:${Math.max(0, n(k, d))}%;background:${colores[i]}" data-tip="${esc(l)}: ${n(k, d)}%"></i>`).join('')}</div>
      ${PESOS.map(([k, l, d], i) => `<div class="comp w3"><div><span class="semaforo" style="--c:${colores[i]}"></span><b>${l}</b></div><input type="range" min="0" max="100" step="1" data-w="${k}" value="${n(k, d)}" aria-label="Peso de ${esc(l)}"><div class="n"><input type="number" aria-label="Peso de ${esc(l)} en porcentaje" min="0" max="100" step="1" data-w="${k}" value="${n(k, d)}" style="width:76px"> %</div></div>`).join('')}
      <div class="bar" style="margin-top:12px"><span class="pill ${ok ? 'E' : 'P'}" style="font-size:14px;padding:4px 12px">Suma: ${tot}% ${ok ? '✓' : tot > 100 ? `· sobran ${tot - 100}` : `· faltan ${100 - tot}`}</span><button id="w_norm">Normalizar a 100</button><button id="w_def">Restablecer 20 / 30 / 30 / 10 / 10</button></div></div>
      <div class="card"><h3>Cómo se mide cada componente</h3><div class="bar" style="margin:0">
        <label class="mso"><input type="radio" name="vsm" value="0" ${D.score_vs_meta !== '1' ? 'checked' : ''}> <span><b>Porcentaje directo</b><br><span class="note">Visitas, tareas y frío puntúan con su efectividad (90 % de efectividad = 90 % del componente).</span></span></label>
        <label class="mso"><input type="radio" name="vsm" value="1" ${D.score_vs_meta === '1' ? 'checked' : ''}> <span><b>Contra la meta</b><br><span class="note">Cumplir la meta de efectividad = 100 % del componente (con meta 95 %, una efectividad de 95 % aporta todo).</span></span></label></div>
        <p class="note" style="margin-top:8px">SOS y SOE siempre se miden contra su <b>meta personalizada del periodo</b> (semanal o mensual); si no hay, se usa la meta por defecto. La efectividad cuenta como (efectivas + justificadas CN) ÷ programadas, topada en 100 %.</p></div>
      <div class="bar"><label>Vista previa con datos de<input type="month" id="pv_mes" value="${ST.mes || monthNow()}"></label></div><div id="pv"><p class="note">Calculando vista previa…</p></div>`;
  }
  async function metas() {
    const { data } = await sb.from('metas').select('mes,modo,tipos').limit(3000), per = {};
    (data || []).forEach((m) => { const o = (per[m.mes] ||= { sos: 0, soe: 0, gan: 0, otras: 0 }); if (m.modo === 'ganadas') o.gan++; else if (m.modo === 'share' && m.tipos === 'PERCHA') o.sos++; else if (m.modo === 'share') o.soe++; else o.otras++; });
    const P = Object.entries(per).sort().reverse().slice(0, 10);
    return `<div class="card"><h3>Metas de efectividad</h3><p class="note">Se usan en los semáforos y líneas de meta de Visitas y Tareas, y en el puntaje cuando eliges «Contra la meta».</p><div class="grid" style="margin-top:8px">${campoPct('meta_vis', 'Visitas', 'Efectividad de visitas', 0.9)}${campoPct('meta_tar', 'Tareas', 'Efectividad de tareas', 0.9)}${campoPct('meta_frio', 'Tareas de equipo de frío', 'Efectividad de frío', 0.9)}</div></div>
      <div class="card"><h3>SOS, SOE y espacios ganados: metas personalizadas por semana o mes</h3><p>Estas metas no son un valor único: se definen por <b>semana o mes</b>, con su responsable y su alcance (región, cadena, supervisor, ECM). Se administran en <b>Metas y alcance</b>.</p>
        <div class="bar"><button class="pri" id="ir_metas">Administrar metas personalizadas</button></div>
        ${P.length ? `<div class="tw"><table><thead><tr><th>Periodo</th><th class="n">SOS</th><th class="n">SOE</th><th class="n">Espacios ganados</th><th class="n">Otras</th></tr></thead><tbody>${P.map(([k, o]) => `<tr><td>${esc(k)}</td><td class="n">${o.sos}</td><td class="n">${o.soe}</td><td class="n">${o.gan}</td><td class="n">${o.otras}</td></tr>`).join('')}</tbody></table></div>` : '<p class="note">Aún no hay metas personalizadas.</p>'}
        <h3 style="margin-top:14px">Meta por defecto</h3><p class="note">Solo se usa cuando para un periodo <b>no existe</b> una meta personalizada.</p><div class="grid">${campoPct('meta_sos', 'SOS por defecto', 'Share de percha', 0.8)}${campoPct('meta_soe', 'SOE por defecto', 'Share de espacios', 0.8)}</div></div>`;
  }
  async function semana() {
    const pdv = String(D.excluir_pdv || '').split(/[,\s;]+/).filter(Boolean);
    return `<div class="card"><h3>Semana operativa</h3><label>La semana empieza el<select data-sel="semana_inicio" style="max-width:220px">${DIAS.map((d, i) => `<option value="${i}" ${String(n('semana_inicio', 3)) === String(i) ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
      <p class="note">Define cómo se numeran las semanas (metas «AAAA-Wnn») y cómo se agrupan SOS/SOE. Con inicio en miércoles solo cuentan las visitas de miércoles a domingo, como en el sistema anterior.</p></div>
      <div class="card"><h3>PDV excluidos de SOS y SOE</h3><label>Códigos de PDV (separados por coma, espacio o salto de línea)<textarea data-txt="excluir_pdv" rows="3">${esc(D.excluir_pdv || '')}</textarea></label>
      <p class="note">${pdv.length} PDV excluidos${pdv.some((x) => !/^\d+$/.test(x)) ? ' · <b style="color:var(--bad)">hay códigos no numéricos</b>' : ''}. No entran en ningún cálculo de share.</p></div>`;
  }
  async function frio() {
    const { data } = await sb.from('tareas').select('pilar,descripcion').order('fecha', { ascending: false }).limit(4000); let re = null, err = '';
    try { re = new RegExp(D.frio_regex || '(?!)'); } catch (e) { err = e.message; }
    const m = {}; (data || []).forEach((t) => { const k = (t.pilar || '') + '||' + (t.descripcion || ''); m[k] = (m[k] || 0) + 1; });
    const L = Object.entries(m).map(([k, c]) => { const [p, d] = k.split('||'); return { p, d, c, frio: !!re && re.test(norm(p + ' ' + d)) }; }).sort((a, b) => b.c - a.c), tot = L.reduce((a, x) => a + x.c, 0), f = L.filter((x) => x.frio).reduce((a, x) => a + x.c, 0);
    return `<div class="card"><h3>Qué tareas son de equipo de frío</h3><label>Expresión (se busca en pilar + descripción, sin tildes y en mayúsculas)<input data-txt="frio_regex" value="${esc(D.frio_regex || '')}" placeholder="COOLER|ESPACIO FRIO|NEVERA"></label>
      ${err ? `<p style="color:var(--bad)">Expresión no válida: ${esc(err)}</p>` : `<p class="note">Marca <b>${f.toLocaleString('es-EC')}</b> de ${tot.toLocaleString('es-EC')} tareas recientes (${tot ? ((100 * f) / tot).toFixed(1) : 0}%). Separa alternativas con «|».</p>`}
      <div class="bar"><button id="fr_re">Guardar y recalcular las tareas ya cargadas</button><span class="note">Las tareas se marcan al cargarlas: para aplicar un cambio a las anteriores, recalcula.</span></div></div>
      <div class="card"><h3>Prueba con las descripciones reales</h3><div class="tw"><table><thead><tr><th>Equipo de frío</th><th>Pilar</th><th>Descripción</th><th class="n">Tareas</th></tr></thead><tbody>${L.slice(0, 60).map((x) => `<tr><td>${x.frio ? '<span class="pill E">Sí ❄</span>' : '<span class="pill">No</span>'}</td><td style="white-space:normal">${esc(x.p)}</td><td style="white-space:normal;min-width:320px">${esc(x.d)}</td><td class="n">${x.c}</td></tr>`).join('')}</tbody></table></div></div>`;
  }
  async function analisis() {
    return `<div class="card"><h3>Umbrales de análisis y auditoría</h3><div class="grid" style="margin-top:8px">
      ${campoNum('rei_min', 'Fallas para ser reincidente', 'Clientes con esta cantidad o más de visitas/tareas no efectivas aparecen en Reincidencias.', 2, 1)}${campoNum('dur_min', 'Duración mínima de una visita (min)', 'Menos que esto se considera atención sin ejecución.', 2, 0)}${campoNum('dias_antiguedad', 'Días para considerar antigua una novedad', 'Pendientes sin justificar con más días se marcan como antiguas.', 15, 1)}</div></div>`;
  }
  async function otros() {
    const R = Object.keys(D).filter((k) => !CONOCIDAS.has(k)).sort();
    return `<div class="card"><h3>Otros ajustes</h3><div class="grid" style="margin-top:8px">${R.map((k) => `<label>${esc(k === 'titulo' ? 'Título de la plataforma' : k)}<input data-txt="${esc(k)}" value="${esc(D[k] || '')}"></label>`).join('') || '<p class="note">Sin otros ajustes.</p>'}</div>
      <p class="note">Incluye filtros fijos de paneles y días libres heredados del sistema anterior.</p></div>`;
  }

  /* ---------- pantalla ---------- */
  VIEWS.config = async function () {
    if (CN.pendingTab && CN.pendingTab[0] === 'config') { ST.tab = CN.pendingTab[1]; CN.pendingTab = null; }
    CN.sub.config = { tabs: () => TABS.filter(([k]) => CN.tabOk('config', k)), cur: () => ST.tab, set: (k) => { ST.tab = k; draw().catch(fail); } };
    await cargar(); await draw();
  };
  async function draw() {
    const m = $('#main'), keep = window.scrollY; const body = await ({ pesos, metas, semana, frio, analisis, otros })[ST.tab]();
    const nc = cambios().length;
    m.innerHTML = `${VZ.tabs(TABS.filter(([k]) => CN.tabOk('config', k)), ST.tab)}<div id="pan">${body}</div><div class="savebar ${nc ? 'on' : ''}"><span>${nc ? `${nc} cambio${nc === 1 ? '' : 's'} sin guardar` : 'Sin cambios'}</span><button id="cf_x" ${nc ? '' : 'disabled'}>Descartar</button><button class="pri" id="cf_ok" ${nc ? '' : 'disabled'}>Guardar cambios</button></div>`;
    enlazar(); CN.sideRefresh(); window.scrollTo(0, keep);
    if (ST.tab === 'pesos') vistaPrevia().then((h) => { const e = $('#pv'); if (e) e.innerHTML = h; }).catch((e) => { const x = $('#pv'); if (x) x.innerHTML = `<p class="note">${esc(e.message)}</p>`; });
  }
  const refrescar = () => { const nc = cambios().length, b = $('.savebar'); if (!b) return; b.classList.toggle('on', nc > 0); b.querySelector('span').textContent = nc ? `${nc} cambio${nc === 1 ? '' : 's'} sin guardar` : 'Sin cambios'; $('#cf_ok').disabled = $('#cf_x').disabled = !nc; };
  function enlazar() {
    document.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { ST.tab = b.dataset.tab; draw().catch(fail); }));
    document.querySelectorAll('[data-w]').forEach((i) => (i.oninput = () => { D[i.dataset.w] = String(Math.max(0, Math.min(100, Number(i.value) || 0))); if (i.type === 'range') draw().catch(fail); else { clearTimeout(i.t); i.t = setTimeout(() => draw().catch(fail), 500); } }));
    document.querySelectorAll('[data-pct]').forEach((i) => (i.onchange = () => { D[i.dataset.pct] = String(Math.max(0, Math.min(100, Number(i.value) || 0)) / 100); refrescar(); }));
    document.querySelectorAll('[data-num]').forEach((i) => (i.onchange = () => { D[i.dataset.num] = String(Math.max(0, Number(i.value) || 0)); refrescar(); }));
    document.querySelectorAll('[data-sel]').forEach((i) => (i.onchange = () => { D[i.dataset.sel] = i.value; refrescar(); }));
    document.querySelectorAll('[data-txt]').forEach((i) => (i.onchange = () => { D[i.dataset.txt] = i.value.trim(); draw().catch(fail); }));
    document.querySelectorAll('[name=vsm]').forEach((i) => (i.onchange = () => { D.score_vs_meta = i.value; draw().catch(fail); }));
    const nz = $('#w_norm'); if (nz) nz.onclick = () => { const t = sumaPesos() || 1; let acc = 0; PESOS.forEach(([k, , d], i) => { const v = i === PESOS.length - 1 ? 100 - acc : Math.round((n(k, d) * 100) / t); D[k] = String(v); acc += v; }); draw().catch(fail); };
    const df = $('#w_def'); if (df) df.onclick = () => { PESOS.forEach(([k, , d]) => (D[k] = String(d))); draw().catch(fail); };
    const pm = $('#pv_mes'); if (pm) pm.onchange = () => { ST.mes = pm.value; draw().catch(fail); };
    const im = $('#ir_metas'); if (im) im.onclick = () => (location.hash = '#metas');
    $('#cf_x').onclick = () => { D = { ...C }; draw().catch(fail); };
    $('#cf_ok').onclick = () => guardar(false);
    const fr = $('#fr_re'); if (fr) fr.onclick = () => guardar(true);
  }
  async function guardar(recalcular) {
    if (PESOS.some(([k]) => String(D[k]) !== String(C[k] ?? '')) && Math.abs(sumaPesos() - 100) > 0.001) return toast(`Los pesos deben sumar 100 (suman ${sumaPesos()}). Usa «Normalizar a 100».`);
    for (const k of ['meta_vis', 'meta_tar', 'meta_frio', 'meta_sos', 'meta_soe']) if (D[k] != null && (Number(D[k]) < 0 || Number(D[k]) > 1)) return toast('Las metas deben estar entre 0 y 100 %.');
    if (D.excluir_pdv && String(D.excluir_pdv).split(/[,\s;]+/).filter(Boolean).some((x) => !/^\d+$/.test(x))) return toast('Los PDV excluidos deben ser códigos numéricos.');
    try { new RegExp(D.frio_regex || ''); } catch (e) { return toast('La expresión de equipo de frío no es válida.'); }
    const filas = cambios().map((k) => ({ clave: k, valor: String(D[k]) }));
    try {
      if (filas.length) { const { error } = await sb.from('config').upsert(filas, { onConflict: 'clave' }); if (error) throw error; }
      let extra = ''; if (recalcular) { const { data, error } = await sb.rpc('recalcular_frio'); if (error) throw error; extra = ` · ${data} tareas actualizadas`; }
      await cargar(); Object.assign(S.cfg, C); CN.invalidarAnalisis && CN.invalidarAnalisis(); CN.invalidarShare && CN.invalidarShare(); PREV = {}; toast('Configuración guardada' + extra); await draw();
    } catch (e) { fail(e); }
  }
})();
