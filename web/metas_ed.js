'use strict';
/* Editor de metas: el mismo de la versión anterior. Cada meta es un grupo: tipos que se miden juntos, tipo de meta, valor, periodo
   (siempre / un mes / desde un mes / una semana), responsable y alcance (región, cadena, supervisor, ECM, solo estos PDV, excluir PDV).
   Incluye meta general de share, copiar de un mes a otro, filtros, duplicar, expandir/minimizar y archivo de metas. */
(function () {
  const { n: fN } = VZ;
  const ST = { tab: 'alc', rows: [], orig: [], opts: {}, dirty: false, q: '', f: { per: '', cad: '', reg: '', tipo: '', alc: '' }, nuevo: false };
  const MODO_LABEL = { share: 'Share % (meta de participación)', caras_pdv: 'Caras por PDV', caras_total: 'Caras totales (se reparten)', penetracion: 'Penetración % de locales', ganadas: 'Caras ganadas (espacios ganados)' };
  const TIPOS_ED = [['PERCHA', 'Percha'], ['BANDEJA FRÍO', 'Bandeja frío'], ['BANDEJA SECO', 'Bandeja seco'], ['RUMA', 'Ruma']], TLAB = Object.fromEntries(TIPOS_ED);
  const DIMS = [['region', 'Región'], ['cadena', 'Cadena'], ['supervisor', 'Supervisor'], ['ecm', 'ECM (asesor)']];
  const modosDe = (ts) => (ts[0] === 'PERCHA' ? ['share', 'caras_pdv', 'caras_total', 'ganadas'] : ['share', 'caras_pdv', 'caras_total', 'penetracion', 'ganadas']);
  const puede = () => (S.me.rol === 'admin' || CN.puede('metas')) && S.me.rol !== 'asesor';
  const puedeEd = () => puede() && (S.me.rol === 'admin' || !((S.me.def && S.me.def.ver) || []).some((k) => String(k).startsWith('metas:')) || CN.tabOk('metas', 'edit'));
  const lista = (v) => String(v || '').split('|').map((x) => x.trim()).filter(Boolean);
  const parsePdvs = (s) => String(s || '').split(/[\s,;|]+/).filter(Boolean);
  const pct = (v) => (Math.round(Number(v) * 10000) / 100).toString().replace('.', ',');
  const fp = (v, d = 0) => (Number(v) * 100).toFixed(d).replace('.', ',') + '%';
  const U = () => CN.metasUtil;
  const curMonth = () => new Date().toISOString().slice(0, 7);
  const tipoCanon = (x) => { const k = norm(x); return /PERCHA/.test(k) ? 'PERCHA' : /FRIO/.test(k) ? 'BANDEJA FRÍO' : /SECO/.test(k) ? 'BANDEJA SECO' : /RUMA/.test(k) ? 'RUMA' : /^ESPACIOS$/.test(k) ? 'ESPACIOS' : ''; };
  const tiposDe = (s) => { const L = lista(s).flatMap((x) => { const c = tipoCanon(x); return c === 'ESPACIOS' ? ['BANDEJA FRÍO', 'BANDEJA SECO', 'RUMA'] : c ? [c] : []; }); return L.length ? [...new Set(L)] : ['PERCHA']; };
  const fromDb = (r) => ({ id: r.id, nombre: r.nombre || '', tipos: tiposDe(r.tipos), modo: r.modo || 'share', valor: Number(r.valor), mes: r.mes || '', responsable: r.responsable || '', base: r.base || 'pdv', excluir: lista(r.excluir), sel: { region: lista(r.regiones), cadena: lista(r.cadenas), supervisor: lista(r.supervisores), ecm: lista(r.ecms), pdv: lista(r.pdvs) } });
  const newGoal = () => ({ _open: true, nombre: '', tipos: ['PERCHA'], modo: 'share', valor: Number(S.cfg.meta_sos || 0.8), mes: '', responsable: '', base: 'pdv', excluir: [], sel: { region: [], cadena: [], supervisor: [], ecm: [], pdv: [] } });
  const tiposTxt = (ts) => ts.map((t) => (TLAB[t] || t).toLowerCase()).join(' + ');
  const goalTitle = (g) => g.nombre || (tiposTxt(g.tipos).charAt(0).toUpperCase() + tiposTxt(g.tipos).slice(1));
  const isGlobal = (g) => !g.sel.pdv.length && DIMS.every(([k]) => !g.sel[k].length);
  const goalScope = (g) => { const p = []; DIMS.forEach(([k, l]) => { const a = g.sel[k]; if (a.length) p.push(l + ': ' + (a.length > 3 ? a.slice(0, 3).join(', ') + ' y ' + (a.length - 3) + ' más' : a.join(', '))); }); if (g.sel.pdv.length) p.push('solo ' + g.sel.pdv.length + ' PDV elegidos'); if (g.excluir.length) p.push('sin ' + g.excluir.length + ' PDV excluidos'); return p.length ? p.join(' · ') : 'Todos los PDV'; };
  const goalRule = (g) => {
    const pm = g.modo === 'share' || g.modo === 'penetracion', v = pm ? fp(g.valor, 0) : fN(g.valor), multi = g.tipos.length > 1;
    if (g.modo === 'share') return 'Share de ' + tiposTxt(g.tipos) + ' ≥ ' + v + (g.base === 'grupo' ? ' entre todos los PDV del grupo' : multi ? ' en cada PDV (los tipos suman juntos: da igual si llega por uno o por otro)' : ' en cada PDV');
    if (g.modo === 'caras_pdv') return v + ' caras CN por PDV' + (multi ? ' entre ' + tiposTxt(g.tipos) : '');
    if (g.modo === 'caras_total') return v + ' caras CN en total, repartidas entre los PDV' + (multi ? ' (' + tiposTxt(g.tipos) + ')' : '');
    if (g.modo === 'ganadas') return v + ' caras ganadas (espacios ganados)' + (multi ? ' en ' + tiposTxt(g.tipos) : '');
    return 'CN en al menos ' + v + ' de los locales (' + tiposTxt(g.tipos) + ')';
  };
  const perLabel = (m) => (m ? U().semNum(m) : 'Siempre');
  const kindOf = (m) => (!m ? 'all' : /\+$/.test(m) ? 'from' : /-W/.test(m) ? 'week' : 'month');

  async function cargar() {
    const [{ data, error }, o] = await Promise.all([sb.from('metas').select('*').order('id', { ascending: false }).limit(3000), sb.rpc('share_opts')]); if (error) throw error;
    ST.rows = (data || []).map(fromDb); ST.orig = (data || []).map((x) => x.id); ST.opts = o.data || {}; ST.dirty = false;
  }
  const opt = (v, t, cur) => `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(t)}</option>`;
  const gf = (label, ctl, cls) => `<div class="gf ${cls || ''}"><span class="gl">${esc(label)}</span>${ctl}</div>`;
  const msel = (label, i, key, options, sel) => gf(label, `<select multiple size="4" data-i="${i}" data-ms="${key}" aria-label="${esc(label)}">${options.map((x) => `<option ${sel.includes(x) ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select><span class="note">Sin selección = todos</span>`);
  const pdvBox = (label, i, key, arr) => gf(label, `<textarea rows="2" data-i="${i}" data-pdv="${key}" aria-label="${esc(label)}" placeholder="Códigos de PDV separados por coma, espacio o salto de línea">${esc(arr.join(', '))}</textarea>`, 'gwide');

  function periodCell(r, i) {
    const k = kindOf(r.mes), W = U().semanasOpc();
    const ctl = k === 'from' ? `<input type="month" data-i="${i}" data-f="mes_from" value="${esc(r.mes.slice(0, 7))}" aria-label="Desde el mes">` : k === 'month' ? `<input type="month" data-i="${i}" data-f="mes_month" value="${esc(r.mes)}" aria-label="Mes">`
      : k === 'week' ? `<select data-i="${i}" data-f="mes_week" aria-label="Semana">${(W.some(([x]) => x === r.mes) ? W : [[r.mes, U().semNum(r.mes)]].concat(W)).map(([x, t]) => opt(x, t, r.mes)).join('')}</select>` : '';
    return `<div style="display:flex;gap:6px;flex-wrap:wrap"><select data-i="${i}" data-f="kind" aria-label="Periodo de la meta">${opt('all', 'Siempre', k)}${opt('month', 'Solo un mes', k)}${opt('from', 'Desde un mes en adelante', k)}${opt('week', 'Una semana', k)}</select>${ctl}</div>`;
  }
  function editor(r, i, admin) {
    const pctMode = r.modo === 'share' || r.modo === 'penetracion', chip = `<span class="chip">${isGlobal(r) ? 'Global' : 'Específica'}</span>`;
    if (!admin) return `<div class="ge"><h3>${esc(goalTitle(r))} ${chip}</h3><p>${esc(goalRule(r))}</p><p class="note">${esc(goalScope(r))} · ${esc(perLabel(r.mes))}${r.responsable ? ' · ' + esc(r.responsable) : ''}</p></div>`;
    const btns = (open) => `<button type="button" data-a="tog" data-i="${i}" aria-expanded="${open}">${open ? '▲ Minimizar' : '▼ Expandir'}</button><button type="button" data-a="dup" data-i="${i}">Duplicar</button><button type="button" class="bad" data-a="del" data-i="${i}" aria-label="Quitar meta">Quitar</button>`;
    if (!r._open) return `<div class="ge ge-min"><div class="ge-h"><div class="ge-t"><strong>${esc(goalTitle(r))}</strong> ${chip}<div class="note">${esc(goalRule(r) + ' · ' + goalScope(r) + ' · ' + perLabel(r.mes))}</div></div>${btns(false)}</div></div>`;
    const tiposF = gf('Tipos que se miden juntos', `<select multiple size="4" data-i="${i}" data-f="tipos" aria-label="Tipos que se miden juntos">${TIPOS_ED.map(([v, t]) => `<option value="${esc(v)}" ${r.tipos.includes(v) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select><span class="note">Percha va sola; frío, seco y ruma se pueden combinar.</span>`);
    return `<div class="ge"><div class="ge-h"><input type="text" data-i="${i}" data-f="nombre" value="${esc(r.nombre)}" maxlength="80" aria-label="Nombre de la meta" placeholder="Nombre de la meta (opcional)">${btns(true)}</div>
      <div class="gsec">1 · Qué se mide y cuánto</div>
      <div class="ggrid">${tiposF}${gf('Tipo de meta', `<select data-i="${i}" data-f="modo" aria-label="Tipo de meta">${modosDe(r.tipos).map((m) => opt(m, MODO_LABEL[m], r.modo)).join('')}</select>`)}
        ${gf('Valor', `<span><input type="text" inputmode="decimal" data-i="${i}" data-f="valor" aria-label="Valor" style="width:90px" value="${pctMode ? pct(r.valor) : esc(String(r.valor).replace('.', ','))}">${pctMode ? ' %' : ''}</span>`)}
        ${r.modo === 'share' ? gf('Cómo se mide el share', `<select data-i="${i}" data-f="base" aria-label="Cómo se mide">${opt('pdv', 'Cada PDV debe llegar (los tipos suman juntos)', r.base || 'pdv')}${opt('grupo', 'Todo el grupo junto', r.base)}</select>`) : ''}
        ${gf('Periodo', periodCell(r, i))}${gf('Responsable', `<input type="text" data-i="${i}" data-f="responsable" value="${esc(r.responsable)}" aria-label="Responsable">`)}</div>
      <div class="gsec">2 · A qué PDV aplica (vacío = todos)</div>
      <div class="ggrid">${DIMS.map(([k, l]) => msel(l, i, k, ST.opts[k] || [], r.sel[k])).join('')}${pdvBox('Solo estos PDV', i, 'pdv', r.sel.pdv)}${pdvBox('Excluir estos PDV de la meta', i, 'exc', r.excluir)}</div>
      <p class="gsum"><strong>Resumen: </strong>${esc(goalRule(r))}. ${esc(goalScope(r))}.</p></div>`;
  }
  function generalBox(admin, tipo) {
    const soe = tipo === 'SOE', nm = soe ? 'espacios' : 'percha', k = soe ? 'meta_soe' : 'meta_sos', v = Number(S.cfg[k] || 0.8);
    return `<div class="goal"><div style="flex:1 1 280px"><strong>Meta CN · share de ${nm} · ${fp(v)}</strong> <span class="chip">Global</span><div class="note">${soe ? 'Share de espacios de CN (ruma + frío + seco) que se exige a todos los PDV.' : 'Share de percha de CN que se exige a todos los PDV.'} Las metas de abajo (generales o específicas) tienen prioridad sobre ella.</div></div>
      <label>Meta de ${nm} (%)<input type="text" inputmode="decimal" data-mg="${k}" value="${pct(v)}" style="width:110px;text-align:right" ${admin ? '' : 'disabled'} aria-label="Meta general de share de ${nm} (%)"></label>${admin ? `<button type="button" class="pri" data-a="mg" data-k="${k}">Guardar meta de ${nm}</button>` : ''}</div>`;
  }
  function copiarBox() {
    const meses = {}; ST.rows.forEach((r) => { if (r.mes && !/-W/.test(r.mes)) meses[r.mes.slice(0, 7)] = 1; }); const ks = Object.keys(meses).sort().reverse(); if (!ks.length) return '';
    return `<div class="ge" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">${gf('Copiar las metas de', `<select id="cp_a" aria-label="Copiar desde el mes">${ks.map((x) => opt(x, U().semNum(x), ks[0])).join('')}</select>`)}${gf('al mes', `<input type="month" id="cp_b" value="${U().siguiente(ks[0], 1)}" aria-label="Copiar al mes">`)}<button type="button" data-a="copiar">Copiar metas al mes</button><span class="note" id="cp_msg" role="status"></span></div>`;
  }
  const csv = (name, head, rows) => { const q = (x) => { const s = String(x ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }; const t = '﻿' + [head, ...rows].map((r) => r.map(q).join(';')).join('\r\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([t], { type: 'text/csv;charset=utf-8' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1500); };
  const HEAD = ['NOMBRE', 'TIPOS', 'TIPO DE META', 'VALOR', 'MEDIR', 'REGIONES', 'CADENAS', 'SUPERVISORES', 'ECM', 'PDV', 'EXCLUIR PDV', 'PERIODO', 'RESPONSABLE'];
  const plantilla = () => { csv('plantilla_metas.csv', HEAD, [
    ['Percha Costa', 'Percha', 'Share %', 80, 'Cada PDV', 'COSTA', '', '', '', '', '', '', 'Gerencia'], ['Frío + seco', 'Bandeja frío + Bandeja seco', 'Share %', 65, 'Cada PDV', '', 'TIA|SUPERMAXI', '', '', '', '', '2026-11', 'Gerencia'],
    ['Espacios del grupo', 'Ruma + Bandeja frío + Bandeja seco', 'Share %', 70, 'Todo el grupo', 'SIERRA', '', '', '', '', '11935916', '2026-W46', ''], ['Ruma del asesor', 'Ruma', 'Caras por PDV', 2, '', '', '', '', 'ECM029', '', '', '2026-11', ''],
    ['Penetración seco', 'Bandeja seco', 'Penetración', 40, '', '', '', 'ERWIN LASCANO', '', '', '', '', ''], ['Solo estos PDV', 'Percha', 'Caras por PDV', 10, '', '', '', '', '', '11935916|11816380', '', '2026-W46', '']]);
    toast('Plantilla descargada. Deja vacío lo que aplique a todos. MEDIR (solo en share): «Cada PDV» o «Todo el grupo». PERIODO: vacío (siempre), 2026-11 (mes), 2026-11+ (desde ese mes) o 2026-W46 (semana).'); };
  const actuales = () => csv('metas_actuales.csv', HEAD, ST.rows.map((r) => [r.nombre, r.tipos.map((t) => TLAB[t]).join(' + '), MODO_LABEL[r.modo].split(' (')[0].replace(' %', ' %'), r.modo === 'share' || r.modo === 'penetracion' ? +(r.valor * 100).toFixed(2) : r.valor, r.modo === 'share' ? (r.base === 'grupo' ? 'Todo el grupo' : 'Cada PDV') : '', r.sel.region.join('|'), r.sel.cadena.join('|'), r.sel.supervisor.join('|'), r.sel.ecm.join('|'), r.sel.pdv.join('|'), r.excluir.join('|'), r.mes, r.responsable]));

  async function guardar() {
    const b = $('#mg_save'), msg = $('#mg_msg'); if (b) b.disabled = true; msg.textContent = 'Guardando…';
    try {
      const vistos = new Set(), filas = ST.rows.map((r) => { let n = r.nombre.trim() || goalTitle(r).replace(/^./, (c) => c.toUpperCase()), k = n + '|' + r.mes + '|' + r.modo, j = 1; while (vistos.has(k)) { j++; k = n + ' (' + j + ')|' + r.mes + '|' + r.modo; } vistos.add(k); if (j > 1) n += ' (' + j + ')';
        return { id: r.id, row: { nombre: n, mes: r.mes, ambito: 'grupo', clave: '', tipo: '', modo: r.modo, valor: r.valor, responsable: r.responsable, tipos: r.tipos.join('|'), regiones: r.sel.region.join('|'), cadenas: r.sel.cadena.join('|'), supervisores: r.sel.supervisor.join('|'), ecms: r.sel.ecm.join('|'), pdvs: r.sel.pdv.join('|'), excluir: r.excluir.join('|'), base: r.modo === 'share' ? r.base || 'pdv' : '' } }; });
      const ids = new Set(filas.map((x) => x.id).filter(Boolean)), borrar = ST.orig.filter((id) => !ids.has(id));
      for (let i = 0; i < borrar.length; i += 200) { const { error } = await sb.from('metas').delete().in('id', borrar.slice(i, i + 200)); if (error) throw error; }
      for (const f of filas.filter((x) => x.id)) { const { error } = await sb.from('metas').update(f.row).eq('id', f.id); if (error) throw error; }
      const nuevas = filas.filter((x) => !x.id).map((x) => x.row); for (let i = 0; i < nuevas.length; i += 200) { const { error } = await sb.from('metas').insert(nuevas.slice(i, i + 200)); if (error) throw error; }
      if (CN.PLAN && CN.PLAN.invalidar) CN.PLAN.invalidar(); await cargar(); draw(); $('#mg_msg').textContent = '✓ ' + fN(ST.rows.length) + ' metas guardadas.'; toast('Metas guardadas');
    } catch (e) { msg.textContent = '✕ No se guardó: ' + String((e && e.message) || e); if (b) b.disabled = false; }
  }
  async function subirArchivo(f) {
    const out = $('#mg_up'); if (!f) return; out.textContent = 'Leyendo archivo…';
    try {
      let wb; if (/\.csv$/i.test(f.name)) { const buf = await f.arrayBuffer(); let t; try { t = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { t = new TextDecoder('windows-1252').decode(buf); } if (t.charCodeAt(0) === 0xfeff) t = t.slice(1); const l1 = t.split('\n', 1)[0]; wb = XLSX.read(t, { type: 'string', raw: true, FS: l1.split(';').length >= l1.split(',').length ? ';' : ',' }); } else wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
      const j = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: false }); if (!j.length) throw new Error('El archivo no trae filas');
      const rows = j.map((r) => { const o = {}; Object.keys(r).forEach((k) => (o[key(k)] = r[k])); return o; });
      if ($('#mg_rep').checked) { if (!confirm('Se reemplazarán TODAS las metas actuales por las del archivo. ¿Continuar?')) { out.textContent = ''; return; } const { error } = await sb.from('metas').delete().gte('id', 0); if (error) throw error; }
      const r = await CN.cargarMetas(rows, (t) => (out.textContent = t)); if (CN.PLAN && CN.PLAN.invalidar) CN.PLAN.invalidar(); await cargar(); draw(); $('#mg_up').textContent = `✓ ${r.filas} metas cargadas${r.descartadas ? ' · ' + r.descartadas + ' filas sin valor omitidas' : ''}.`;
    } catch (e) { out.textContent = '✕ ' + String((e && e.message) || e); }
  }

  function draw() {
    const m = $('#main'), admin = puedeEd(), F = ST.f, q = ST.q.toUpperCase();
    const vis = ST.rows.map((r, i) => ({ r, i })).filter(({ r }) => {
      if (F.per !== '' && (F.per === '_all' ? !!r.mes : r.mes !== F.per)) return false; if (F.cad && r.sel.cadena.length && !r.sel.cadena.includes(F.cad)) return false; if (F.reg && r.sel.region.length && !r.sel.region.includes(F.reg)) return false;
      if (F.tipo && !r.tipos.includes(F.tipo)) return false; if (F.alc && (F.alc === 'global') !== isGlobal(r)) return false; return !q || (goalTitle(r) + ' ' + goalScope(r) + ' ' + r.tipos.join(' ')).toUpperCase().includes(q); });
    const pers = [...new Set(ST.rows.map((r) => r.mes).filter(Boolean))].sort().reverse(), shown = vis.slice(0, 60), anyOpen = ST.rows.some((r) => r._open);
    m.innerHTML = `<div class="card" id="mg"><div class="head" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center"><h2 style="flex:1;margin:0">Metas del plan</h2>
      <input type="search" id="mg_q" placeholder="Filtrar metas" aria-label="Filtrar metas" value="${esc(ST.q)}"><button type="button" data-a="all">${anyOpen ? 'Minimizar todas' : 'Expandir todas'}</button>
      ${admin ? `<button type="button" data-a="add">Agregar meta</button><button type="button" class="pri" id="mg_save" data-a="save" ${ST.dirty ? '' : 'title="Sin cambios por guardar"'}>Guardar metas${ST.dirty ? ' •' : ''}</button>` : ''}</div>
      <p class="note">Cada meta es un grupo: eliges uno o varios tipos que se miden juntos (por ejemplo frío + seco al 65 %: da igual que llegue por uno o por otro) y a qué PDV aplica (regiones, cadenas, supervisores, ECM, solo algunos PDV o todos menos algunos). Si dos metas cubren el mismo PDV y tipo, gana la más específica (PDV, ECM, supervisor, región, cadena); a igual especificidad, la de semana pisa a la del mes, esta a la «desde un mes», esta a la general y, si empatan, gana la que está más arriba en la lista. Share: meta = INT(total × %) menos lo que CN ya tiene. Caras totales se reparten entre los PDV; caras por PDV se piden a cada PDV; penetración es el % de locales con al menos 1 espacio CN.</p>
      ${generalBox(admin, 'SOS')}${generalBox(admin, 'SOE')}${admin ? copiarBox() : ''}
      <div class="mfil">${gf('Periodo (semana o mes)', `<select id="f_per" aria-label="Filtrar por periodo">${opt('', 'Todos los periodos', F.per)}${opt('_all', 'Solo «Siempre»', F.per)}${pers.map((p) => opt(p, U().semNum(p), F.per)).join('')}</select>`)}
        ${gf('Cadena', `<select id="f_cad" aria-label="Filtrar por cadena">${opt('', 'Todas las cadenas', F.cad)}${(ST.opts.cadena || []).map((o) => opt(o, o, F.cad)).join('')}</select>`)}${gf('Región', `<select id="f_reg" aria-label="Filtrar por región">${opt('', 'Todas las regiones', F.reg)}${(ST.opts.region || []).map((o) => opt(o, o, F.reg)).join('')}</select>`)}
        ${gf('Alcance', `<select id="f_alc" aria-label="Filtrar por alcance">${opt('', 'Globales y específicas', F.alc)}${opt('global', 'Solo globales (todos los PDV)', F.alc)}${opt('esp', 'Solo específicas (un grupo de PDV)', F.alc)}</select>`)}
        ${gf('Tipo', `<select id="f_tipo" aria-label="Filtrar por tipo">${opt('', 'Todos los tipos', F.tipo)}${TIPOS_ED.map(([v, t]) => opt(v, t, F.tipo)).join('')}</select>`)}${F.per || F.cad || F.reg || F.tipo || F.alc ? '<button type="button" data-a="nofil" style="align-self:end">Quitar filtros</button>' : ''}</div>
      <p class="note">Mostrando ${fN(vis.length)} de ${fN(ST.rows.length)} metas. El filtro de cadena y región muestra las metas que aplican a ellas (también las que valen para todas).</p>
      <div class="glist">${shown.map(({ r, i }) => editor(r, i, admin)).join('')}</div>
      ${vis.length > shown.length ? `<p class="note">Se muestran las primeras ${shown.length}. Usa los filtros para encontrar una meta.</p>` : vis.length ? '' : `<p class="note">${ST.rows.length ? 'Ninguna meta cumple estos filtros.' : 'No hay metas todavía.'}</p>`}<p id="mg_msg" class="note"></p></div>
      ${admin ? `<div class="card"><h2>Subir metas desde un archivo</h2><p class="note">Descarga la plantilla, llénala (una fila por meta) y súbela en Excel o CSV. En TIPOS puedes poner varios separados por «+»; en REGIONES, CADENAS, SUPERVISORES, ECM, PDV y EXCLUIR PDV varios valores separados por «|». Una meta igual (mismo nombre, periodo y tipo de meta) se actualiza; las demás se conservan.</p>
        <label class="mso" style="flex-direction:row"><input type="checkbox" id="mg_rep"> Reemplazar todas las metas actuales</label><div class="bar" style="margin-top:10px"><button type="button" data-a="tpl">Descargar plantilla</button><button type="button" data-a="act">Descargar metas actuales</button><button type="button" class="pri" data-a="pick">Subir archivo de metas</button><input id="mg_file" type="file" accept=".csv,.xlsx,.xls" hidden><span id="mg_up" class="note"></span></div></div>` : ''}`;
  }
  const mark = () => { ST.dirty = true; };
  function onChange(e) {
    const t = e.target, i = t.dataset.i != null ? +t.dataset.i : null, r = i != null ? ST.rows[i] : null;
    if (t.id === 'f_per') ST.f.per = t.value; else if (t.id === 'f_cad') ST.f.cad = t.value; else if (t.id === 'f_reg') ST.f.reg = t.value; else if (t.id === 'f_alc') ST.f.alc = t.value; else if (t.id === 'f_tipo') ST.f.tipo = t.value;
    else if (t.id === 'mg_file') { subirArchivo(t.files[0]); t.value = ''; return; }
    else if (t.dataset.mg) { return; }
    else if (r && t.dataset.ms) { r.sel[t.dataset.ms] = [...t.selectedOptions].map((o) => o.value); mark(); }
    else if (r && t.dataset.pdv) { const a = parsePdvs(t.value); if (t.dataset.pdv === 'pdv') r.sel.pdv = a; else r.excluir = a; mark(); }
    else if (r && t.dataset.f) { const f = t.dataset.f;
      if (f === 'nombre') r.nombre = t.value; else if (f === 'responsable') r.responsable = t.value; else if (f === 'base') r.base = t.value; else if (f === 'modo') r.modo = t.value;
      else if (f === 'valor') { const v = parseFloat(String(t.value).replace(',', '.')), pm = r.modo === 'share' || r.modo === 'penetracion'; r.valor = isFinite(v) ? (pm ? v / 100 : v) : 0; }
      else if (f === 'tipos') { const prev = r.tipos.slice(); let a = [...t.selectedOptions].map((o) => o.value); if (!a.length) a = prev; if (a.length > 1 && a.includes('PERCHA')) a = prev.includes('PERCHA') ? a.filter((x) => x !== 'PERCHA') : ['PERCHA']; r.tipos = a; const ok = modosDe(a); if (!ok.includes(r.modo)) r.modo = ok[0]; }
      else if (f === 'kind') { r.mes = t.value === 'all' ? '' : t.value === 'month' ? curMonth() : t.value === 'from' ? curMonth() + '+' : U().clavSem(new Date().toISOString().slice(0, 10)); }
      else if (f === 'mes_from') { if (t.value) r.mes = t.value + '+'; } else if (f === 'mes_month') { if (t.value) r.mes = t.value; } else if (f === 'mes_week') r.mes = t.value;
      mark(); }
    else return;
    draw();
  }
  function onClick(e) {
    const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a, i = b.dataset.i != null ? +b.dataset.i : null;
    if (a === 'tog') ST.rows[i]._open = !ST.rows[i]._open; else if (a === 'all') { const any = ST.rows.some((r) => r._open); ST.rows.forEach((r) => (r._open = !any)); }
    else if (a === 'add') { ST.rows.unshift(newGoal()); ST.q = ''; ST.f = { per: '', cad: '', reg: '', tipo: '', alc: '' }; mark(); }
    else if (a === 'dup') { const c = JSON.parse(JSON.stringify(ST.rows[i])); c.nombre = (c.nombre ? c.nombre + ' ' : goalTitle(c) + ' ') + '(copia)'; delete c.id; c._open = true; ST.rows.splice(i + 1, 0, c); mark(); }
    else if (a === 'del') { ST.rows.splice(i, 1); mark(); } else if (a === 'nofil') ST.f = { per: '', cad: '', reg: '', tipo: '', alc: '' };
    else if (a === 'pick') return $('#mg_file').click(); else if (a === 'save') return guardar(); else if (a === 'tpl') return plantilla(); else if (a === 'act') return actuales();
    else if (a === 'mg') { const k = b.dataset.k, inp = document.querySelector(`[data-mg="${k}"]`), v = parseFloat(String(inp.value).replace(',', '.')) / 100; if (!isFinite(v) || v < 0 || v > 1) return toast('Escribe un porcentaje entre 0 y 100.');
      return sb.from('config').upsert({ clave: k, valor: String(v) }, { onConflict: 'clave' }).then(({ error }) => { if (error) return fail(error); S.cfg[k] = String(v); if (CN.PLAN && CN.PLAN.invalidar) CN.PLAN.invalidar(); toast('Meta general guardada'); draw(); }); }
    else if (a === 'copiar') { const x = $('#cp_a').value, y = $('#cp_b').value, msg = $('#cp_msg'); if (!y) { msg.textContent = 'Elige el mes de destino'; return; } if (x === y) { msg.textContent = 'El mes de origen y el de destino son el mismo'; return; }
      const ya = ST.rows.filter((r) => r.mes === y || r.mes === y + '+').length; if (ya) { msg.textContent = U().semNum(y) + ' ya tiene ' + ya + ' metas: quítalas primero o duplica una por una'; return; }
      const copias = ST.rows.filter((r) => r.mes === x || r.mes === x + '+').map((r) => { const c = JSON.parse(JSON.stringify(r)); delete c.id; c.mes = y; c._open = false; return c; }); ST.rows = copias.concat(ST.rows); mark(); ST.f = { per: y, cad: '', reg: '', tipo: '', alc: '' }; draw(); $('#mg_msg').textContent = '✓ ' + copias.length + ' metas copiadas a ' + U().semNum(y) + '. Revisa los valores y pulsa «Guardar metas».'; return; }
    else return; draw();
  }
  async function editar(nueva) { ST.tab = 'edit'; await VIEWS.metas(); if (nueva) { ST.rows.unshift(newGoal()); ST.dirty = true; draw(); } }
  CN.metasEditar = (nueva) => editar(nueva).catch(fail);

  const alcance = VIEWS.metas;
  VIEWS.metas = async function () {
    if (CN.pendingTab && CN.pendingTab[0] === 'metas') { ST.tab = CN.pendingTab[1]; CN.pendingTab = null; }
    const admin = puedeEd(); if (!admin) ST.tab = 'alc';
    CN.sub.metas = { tabs: () => [['alc', 'Alcance de las metas'], ...(admin ? [['edit', 'Editar metas']] : [])], cur: () => ST.tab, set: (k) => { ST.tab = k; VIEWS.metas().then(() => CN.sideRefresh()).catch(fail); } };
    if (ST.tab !== 'edit') return alcance();
    const m = $('#main'); m.innerHTML = '<p class="note">Cargando…</p>'; await cargar();
    if (!m.dataset.ed) { m.dataset.ed = '1'; }
    draw(); const host = $('#main'); if (!host._edBound) { host._edBound = true; host.addEventListener('change', (e) => { if (ST.tab === 'edit') onChange(e); }); host.addEventListener('click', (e) => { if (ST.tab === 'edit') onClick(e); }); host.addEventListener('input', (e) => { if (ST.tab === 'edit' && e.target.id === 'mg_q') { ST.q = e.target.value; clearTimeout(ST.t); ST.t = setTimeout(() => { draw(); const q = $('#mg_q'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }, 300); } }); }
  };
})();
