'use strict';
/* Fase 2: encuestas SOS/SOE con catálogo, espacios ganados, evidencias, pendientes/WhatsApp, informe mensual, rutero y catálogo. */
(function () {
  const ALL = ['admin', 'gerencia', 'supervisor', 'asesor'], SUP = ['admin', 'gerencia', 'supervisor'], GER = ['admin', 'gerencia'];
  const tail = { carga: NAV.carga, admin: NAV.admin }; delete NAV.carga; delete NAV.admin;
  NAV.ganancias = ['Espacios ganados', ALL];
  NAV.pend = ['Pendientes y WhatsApp', SUP];
  NAV.informe = ['Informe mensual', SUP];
  NAV.rutero = ['Rutero y ubicación', ALL];
  NAV.catalogo = ['Catálogo de marcas', ['admin']];
  NAV.carga = tail.carga; NAV.admin = tail.admin;

  async function fetchAll(mk) {
    let out = [], from = 0;
    for (;;) { const { data, error } = await mk().range(from, from + 999); if (error) throw error; out = out.concat(data); if (data.length < 1000 || out.length >= 30000) break; from += 1000; }
    return out;
  }
  const sel = (id, opts, cur, extra = '') => `<select id="${id}" ${extra}>${opts.map((o) => `<option ${o === cur ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  const GRUPOS = ['CN', 'HNK', 'MERC', 'OTROS', 'EXCLUIR'], GRUPOS_CAT = [...['CN', 'HNK', 'MERC', 'OTROS', 'EXCLUIR'], 'SIN CLASIFICAR'], TIPOS = ['PERCHA', 'RUMA', 'BANDEJA FRÍO', 'BANDEJA SECO'];
  const chunks = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };

  /* ======================= Encuestas SOS / SOE ======================= */
  const KW_MERC = ['OTRAS MARCAS DEL MERCADO', 'OTRAS MARCAS DE MERCADO', 'MERCADO', 'MERC', 'ROYAL DUTCH', 'ARTESANAL', 'ARTESANALES', 'PERONI', 'PRIMA', 'PONY MALTA', 'ESTRELLA GALICIA', 'WEIDMAN', 'WIERQUER', 'HORSE', 'LATITUD CERO', 'X MARK', 'HOFFEN'];
  const KW_HNK = ['HEINEKEN', 'HNK', 'HK', 'AMSTEL', 'AMS', 'BIELA', 'BL', 'DORADA', 'SOL', 'ANDINA', 'DOR'];
  const KW_CN = ['PILSENER', 'CLUB', 'PLATINO', 'CORONA', 'BUDWEISER', 'BUD', 'MODELO', 'STELLA', 'QUILMES', 'BECKS', 'SIEMBRA', 'CONQUER', 'ARCHER', 'INTERNACIONELS', 'INTERNACIONALES', 'GLOBALES', 'OTRAS MARCAS CN', 'OTRAS CN', 'MARCAS DE CN', 'MARCAS CN'];
  const kwFind = (t, list) => list.find((w) => new RegExp('(^|[^A-Z0-9])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^A-Z0-9]|$)').test(t)) || null;
  function clasificar(q, survey) {
    const k = norm(q).replace(/\?/g, '');
    if (/^OBSERVACION/.test(k)) return { grupo: 'EXCLUIR', tipo: survey === 'SOS' ? 'PERCHA' : 'RUMA', marca: 'OBSERVACIÓN', visual: 'OBSERVACIÓN' };
    const h = survey === 'SOS' && window.HOMOLOG && window.HOMOLOG[norm(q)];
    if (h) return { grupo: h[0] === 'Racional' ? 'EXCLUIR' : h[0], tipo: 'PERCHA', marca: h[1], visual: h[2] };
    const t = k.replace(/([A-Z])HAY /g, '$1 HAY ').replace(/^¿?CUANT[AO]S (CARAS|SKUS|COLUMNAS|EXHIBIDORES) DE /, '').replace(/ HAY$/, '').trim();
    let kw = kwFind(t, KW_MERC), grupo = 'MERC';
    if (!kw) { kw = kwFind(t, KW_HNK); grupo = 'HNK'; }
    if (!kw) { kw = kwFind(t, KW_CN); grupo = 'CN'; }
    if (!kw) return null;
    if (survey === 'SOS') return { grupo, tipo: 'PERCHA', marca: kw, visual: t };
    const tipo = /EXHIBIDOR|COLUMNA|VENTANAL/.test(k) ? null : /RUMA/.test(k) ? 'RUMA' : /FRIO/.test(k) ? 'BANDEJA FRÍO' : /SECO/.test(k) ? 'BANDEJA SECO' : null;
    return tipo ? { grupo, tipo, marca: kw, visual: t } : { grupo: 'EXCLUIR', tipo: 'RUMA', marca: kw, visual: t };
  }
  function surveyOfRow(en, q) {
    en = norm(en); if (/SOE|ESPACIO/.test(en)) return 'SOE'; if (/SOS|PERCHA/.test(en)) return 'SOS';
    q = norm(q); if (/^INGRESA LAS CARAS POR/.test(q)) return 'SOS'; if (/BANDEJ|EQUIPO DE FRIO|EQUIPO DE FR/.test(q)) return 'SOE'; return '';
  }
  const dayAdd = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  function opStart(iso, wsd) { const d = new Date(iso + 'T00:00:00Z'); const opDay = (d.getUTCDay() - wsd + 7) % 7; return { start: dayAdd(iso, -opDay), opDay }; }

  async function cargarEncuesta(file, out) {
    out.textContent = 'Leyendo archivo…';
    const rows = await leerExcel(file);
    if (!rows.length) throw new Error('El archivo está vacío');
    const wsd = Number(S.cfg.semana_inicio ?? 3);
    const excl = new Set(String(S.cfg.excluir_pdv || '').split(/[,\s;]+/).filter(Boolean));
    const st = { total: rows.length, fueraDia: 0, sinFecha: 0, excluidos: 0, anteriores: 0, sinValor: 0, sinTipo: 0 };
    const recs = [], maxD = {}, fixF = CN.mapaFechas(rows.map((r) => toISO(g(r, 'Fecha Encuesta'))));
    rows.forEach((r) => {
      const cod = TXT(g(r, 'CodigoCliente')).replace(/\.0+$/, ''), q = TXT(g(r, 'DescripcionPregunta'));
      if (!q) return;
      const sv = surveyOfRow(g(r, 'NombreEncuesta'), q); if (!sv) { st.sinTipo++; return; }
      const f = fixF(toISO(g(r, 'Fecha Encuesta'))); if (!f || !/^\d+$/.test(cod)) { st.sinFecha++; return; }
      if (excl.has(cod)) { st.excluidos++; return; }
      const w = opStart(f, wsd); if (wsd === 3 && w.opDay > 4) { st.fueraDia++; return; }
      const k = `${sv}|${cod}|${w.start}`; if (!maxD[k] || f > maxD[k]) maxD[k] = f;
      recs.push({ sv, cod, f, ws: w.start, q, r });
    });
    const keep = recs.filter((x) => { if (x.f !== maxD[`${x.sv}|${x.cod}|${x.ws}`]) { st.anteriores++; return false; } return true; });
    if (!keep.length) throw new Error('No quedaron filas válidas. Revisa CodigoCliente, Fecha Encuesta, DescripcionPregunta y Respuesta.');

    out.textContent = 'Clasificando preguntas…';
    const cat = await CN.fetchPar((o) => sb.from('catalogo_share').select('*', o).order('clave'));
    const cmap = Object.fromEntries(cat.map((c) => [c.clave + '|' + c.encuesta, c]));
    const nuevas = [], sin = {};
    const info = (sv, q) => {
      const k = norm(q), mk = k + '|' + sv;
      if (cmap[mk]) { if (cmap[mk].grupo === 'SIN CLASIFICAR') { (sin[mk] ||= { pregunta: q, sv, filas: 0, enCatalogo: true }).filas++; return null; } return cmap[mk]; }
      const c = clasificar(q, sv);
      if (!c) { /* toda pregunta nueva entra al catálogo: queda «SIN CLASIFICAR» (no se cuenta) hasta que se elija su marca */
        const rec = { clave: k, pregunta: q.slice(0, 300), encuesta: sv, grupo: 'SIN CLASIFICAR', tipo: sv === 'SOS' ? 'PERCHA' : 'RUMA', marca: q.slice(0, 80), visual: q.slice(0, 120), origen: 'auto' };
        cmap[mk] = rec; nuevas.push(rec); (sin[mk] ||= { pregunta: q, sv, filas: 0 }).filas++; return null; }
      const rec = { clave: k, pregunta: q.slice(0, 300), encuesta: sv, grupo: c.grupo, tipo: c.tipo, marca: c.marca, visual: (c.visual || '').slice(0, 120), origen: 'auto' };
      cmap[mk] = rec; nuevas.push(rec); return rec;
    };
    const acc = {}, codesByWeek = {};
    keep.forEach((x) => {
      (codesByWeek[`${x.sv}|${x.ws}`] ||= new Set()).add(x.cod);
      const nv = Math.round(parseFloat(String(g(x.r, 'Respuesta')).replace(/^\\+|\\+$/g, '').replace(',', '.')));
      if (!(nv > 0)) { st.sinValor++; return; }
      const c = info(x.sv, x.q); if (!c || c.grupo === 'EXCLUIR') return;
      const ecm = ecmNorm(g(x.r, 'BDR'));
      const marca = TXT(c.marca).slice(0, 80), sku = TXT(c.visual).slice(0, 120), k = `${x.f}|${x.cod}|${c.tipo}|${c.grupo}|${marca}|${sku}`;
      (acc[k] ||= { fecha: x.f, codigo: x.cod, pdv: TXT(g(x.r, 'NombreCliente')), ecm, supervisor: supDeEcm(ecm, ''), tipo: c.tipo, grupo: c.grupo, marca, sku, caras: 0 }).caras += nv;
    });
    let data = Object.values(acc);
    if (nuevas.length) await sb.from('catalogo_share').upsert(nuevas, { onConflict: 'clave,encuesta' }).then(({ error }) => { if (error) throw error; });

    // reemplaza lo anterior de esa semana y esos PDV (la visita más reciente manda)
    const T = { SOS: ['PERCHA'], SOE: ['RUMA', 'BANDEJA FRÍO', 'BANDEJA SECO'] };
    // por local y semana manda la visita más reciente: si lo ya guardado es más nuevo, se conserva y se descarta lo del archivo
    const skip = new Set(); let conservados = 0; out.textContent = 'Comparando con lo ya guardado…';
    for (const [k, set] of Object.entries(codesByWeek)) {
      const [sv, ws] = k.split('|');
      for (const part of chunks([...set], 200)) {
        const { data: ex, error } = await sb.rpc('share_ultima_fecha', { p_codigos: part, p_desde: ws, p_hasta: dayAdd(ws, 6), p_tipos: T[sv] }); if (error) throw error;
        (ex || []).forEach((x) => { if (x.fecha > maxD[`${sv}|${x.codigo}|${ws}`]) { skip.add(`${sv}|${x.codigo}|${ws}`); set.delete(x.codigo); conservados++; } });
      }
    }
    if (skip.size) data = data.filter((r) => !skip.has(`${r.tipo === 'PERCHA' ? 'SOS' : 'SOE'}|${r.codigo}|${opStart(r.fecha, wsd).start}`));
    let i = 0; const total = Object.keys(codesByWeek).length;
    for (const [k, set] of Object.entries(codesByWeek)) {
      const [sv, ws] = k.split('|'); out.textContent = `Reemplazando semanas (${++i}/${total})…`;
      for (const part of chunks([...set], 100)) {
        const { error } = await sb.from('share_detalle').delete().in('codigo', part).gte('fecha', ws).lte('fecha', dayAdd(ws, 6)).in('tipo', T[sv]);
        if (error) throw error;
      }
    }
    for (const part of chunks(data, 500)) {
      out.textContent = `Subiendo ${Math.min(data.length, data.indexOf(part[0]) + 500)} de ${data.length}…`;
      const { error } = await sb.from('share_detalle').upsert(part, { onConflict: 'fecha,codigo,tipo,grupo,marca,sku' }); if (error) throw error;
    }
    /* el archivo puede traer SOS y SOE juntos: cada uno queda en su propio registro de cargas */
    try { const por = (fn) => data.filter(fn).length, ls = []; const nS = por((r) => r.tipo === 'PERCHA'), nE = por((r) => r.tipo !== 'PERCHA');
      if (nS) ls.push({ tipo: 'sos', archivo: file.name.slice(0, 200), filas: nS }); if (nE) ls.push({ tipo: 'soe', archivo: file.name.slice(0, 200), filas: nE }); if (ls.length) await sb.from('cargas').insert(ls); } catch (e) { /* el registro de cargas no es crítico */ }
    const sinL = Object.values(sin);
    out.innerHTML = `Listo: <b>${data.length}</b> registros de caras cargados (${keep.length} respuestas): <b>SOS · percha ${data.filter((r) => r.tipo === 'PERCHA').length}</b> · <b>SOE · espacios ${data.filter((r) => r.tipo !== 'PERCHA').length}</b>.<br>
      <span class="note">PDV con visita más reciente ya guardada (se conserva): ${conservados} · Fuera de mié–dom: ${st.fueraDia} · visitas anteriores descartadas: ${st.anteriores} · filas en 0: ${st.sinValor} · PDV excluidos: ${st.excluidos} · sin fecha/código: ${st.sinFecha} · sin tipo de encuesta: ${st.sinTipo}.
      ${nuevas.length ? `<br>${nuevas.length} preguntas se clasificaron solas por palabras clave: revísalas en «Catálogo de marcas».` : ''}</span>
      ${sinL.length ? `<div class="card" style="margin-top:8px"><b>${sinL.length} preguntas sin clasificar</b>: ya están en el <b>Catálogo de marcas</b> con la marca «SIN CLASIFICAR» y no se contaron. Clasifícalas aquí o allá y vuelve a cargar el archivo:
      <div class="tw"><table><tbody>${sinL.map((u, n) => `<tr><td>${esc(u.pregunta)}<div class="note">${u.sv} · ${u.filas} filas</div></td><td>${sel('sg' + n, GRUPOS, 'OTROS')}</td><td>${sel('st' + n, u.sv === 'SOS' ? ['PERCHA'] : TIPOS.slice(1), '')}</td><td><button data-sn="${n}">Guardar</button></td></tr>`).join('')}</tbody></table></div></div>` : ''}`;
    out.querySelectorAll('[data-sn]').forEach((b) => b.onclick = async () => {
      const u = sinL[b.dataset.sn], n = b.dataset.sn;
      const { error } = await sb.from('catalogo_share').upsert({ clave: norm(u.pregunta), pregunta: u.pregunta.slice(0, 300), encuesta: u.sv, grupo: $('#sg' + n).value, tipo: $('#st' + n).value, marca: u.pregunta.slice(0, 80), visual: u.pregunta.slice(0, 120), origen: 'manual' }, { onConflict: 'clave,encuesta' });
      if (error) return fail(error); b.textContent = '✓'; b.disabled = true;
    });
    toast('Encuesta cargada');
  }
  CARGAS.encuesta = { t: 'Encuestas SOS / SOE (reporte original)', ayuda: 'Reporte de encuestas con CodigoCliente, Fecha Encuesta, DescripcionPregunta, Respuesta, BDR, Supervision, NombreCliente y NombreEncuesta. Aplica las reglas del BI: solo mié–dom, una visita por PDV y semana (la más reciente), PDV excluidos fuera.', run: cargarEncuesta };

  /* ======================= Espacios ganados ======================= */
  const num = (v) => { const n = Math.round(parseFloat(String(v == null ? '' : v).replace(',', '.'))); return isFinite(n) && n > 0 ? n : 0; };
  const url = (v) => { const s = TXT(v); return /^https?:\/\/\S+$/i.test(s) ? s.slice(0, 600) : null; };
  function ganFecha(v) {
    if (v instanceof Date) { const f = toISO(v); const h = String(v.getHours()).padStart(2, '0') + ':' + String(v.getMinutes()).padStart(2, '0'); return f ? { f, h } : null; }
    const s = String(v == null ? '' : v).trim(), f = toISO(s); if (!f) return null;
    const m = s.match(/(\d{1,2}):(\d{2})/); return { f, h: m ? m[1].padStart(2, '0') + ':' + m[2] : '00:00' };
  }
  async function cargarGanancias(file, out) {
    out.textContent = 'Leyendo archivo…';
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: true });
    if (data.length < 2) throw new Error('El archivo no trae filas');
    const head = data[0].map(norm), find = (fn) => head.findIndex(fn);
    const col = {
      codigo: find((h) => h === 'PERFIL DEL PDV' || h === 'CODIGO'), pdv: find((h) => h === 'PDV' || h === 'NOMBRE PDV'), cadena: find((h) => h === 'CADENA'),
      fecha: find((h) => h.indexOf('FECHA') === 0), ecm: find((h) => h === 'EMPLEADO' || h === 'ECM'),
      percha: find((h) => /CARAS GANADAS EN PERCHA/.test(h)), foto_percha: find((h) => /^FOTO/.test(h) && /PERCHA/.test(h)),
      frio: find((h) => /CARAS GANADAS EN BANDEJA DE FRIO/.test(h)), foto_frio: find((h) => /^FOTO/.test(h) && /FRIO/.test(h)),
      seco: find((h) => /CARAS GANADAS EN BANDEJA EN SECO/.test(h)), foto_seco: find((h) => /^FOTO/.test(h) && /SECO/.test(h)),
      ruma: find((h) => /RUMAS GANADAS/.test(h)), foto_ruma: find((h) => /^FOTO/.test(h) && /RUMA/.test(h)),
      obs: find((h) => h.indexOf('OBSERVACION') === 0), foto_obs: find((h) => /^FOTO DE LA OBSERVACION/.test(h))
    };
    if (col.codigo < 0 || col.fecha < 0) throw new Error('No encontré «Perfil del PDV» y «Fecha y hora de la encuesta». Usa el reporte «Respuestas de encuestas».');
    if (col.percha < 0 && col.frio < 0 && col.seco < 0 && col.ruma < 0) throw new Error('No encontré columnas de caras o rumas ganadas');
    const v = (r, j) => (j < 0 || r[j] == null ? '' : r[j]);
    const nuevos = {}; let sinFecha = 0, sinCodigo = 0; const fixG = CN.mapaFechas(data.slice(1).map((r) => { const d0 = ganFecha(v(r, col.fecha)); return d0 && d0.f; }));
    data.slice(1).forEach((r) => {
      const cod = TXT(v(r, col.codigo)).replace(/\.0+$/, ''); if (!/^\d{1,12}$/.test(cod)) { sinCodigo++; return; }
      const d = ganFecha(v(r, col.fecha)); if (!d) { sinFecha++; return; } d.f = fixG(d.f);
      const ecm = ecmNorm(v(r, col.ecm));
      const o = { fecha: d.f, hora: d.h, codigo: cod, pdv: TXT(v(r, col.pdv)).slice(0, 100), cadena: TXT(v(r, col.cadena)).slice(0, 60), ecm, supervisor: supDeEcm(ecm, ''),
        percha: num(v(r, col.percha)), frio: num(v(r, col.frio)), seco: num(v(r, col.seco)), ruma: num(v(r, col.ruma)),
        foto_percha: url(v(r, col.foto_percha)), foto_frio: url(v(r, col.foto_frio)), foto_seco: url(v(r, col.foto_seco)), foto_ruma: url(v(r, col.foto_ruma)),
        observacion: TXT(v(r, col.obs)).slice(0, 300) || null, foto_obs: url(v(r, col.foto_obs)), fuente: 'archivo' };
      const k = o.fecha + '|' + o.codigo; if (!nuevos[k] || nuevos[k].hora <= o.hora) nuevos[k] = o;
    });
    let list = Object.values(nuevos); if (!list.length) throw new Error('No encontré filas válidas (revisa código y fecha)');
    const fs = list.map((x) => x.fecha).sort();
    const man = await fetchAll(() => sb.from('ganancias').select('id,fecha,codigo').eq('fuente', 'manual').gte('fecha', fs[0]).lte('fecha', fs[fs.length - 1]).order('id'));
    const ms = new Set(man.map((x) => x.fecha + '|' + x.codigo)); const antes = list.length;
    list = list.filter((x) => !ms.has(x.fecha + '|' + x.codigo));
    for (const part of chunks(list, 500)) { out.textContent = 'Subiendo…'; const { error } = await sb.from('ganancias').upsert(part, { onConflict: 'fecha,codigo' }); if (error) throw error; }
    out.textContent = `Listo: ${list.length} registros cargados · ${antes - list.length} manuales conservados · sin código: ${sinCodigo} · sin fecha: ${sinFecha}.`;
  }
  CARGAS.ganancias = { t: 'Espacios ganados', ayuda: 'Reporte «Respuestas de encuestas» de espacios ganados (Perfil del PDV, Fecha y hora, Empleado, Caras ganadas en percha / bandeja de frío / bandeja en seco, Rumas ganadas, fotos y observación). Los registros editados a mano no se pisan.', run: cargarGanancias };

  VIEWS.ganancias = async function () {
    const m = $('#main'), puede = CN.puede('ganancias');
    m.innerHTML = `<div class="bar"><label>Mes<input type="month" id="mes" value="${monthNow()}"></label><label>Buscar<input id="q" placeholder="ECM, código o PDV"></label>
      <button class="pri" id="nuevo">Registrar espacio ganado</button></div><div id="res"></div><div class="card"><div class="tws" id="tb"></div><p class="note" id="info"></p></div>`;
    let pgG = 0;
    const load = async () => {
      const [d, h] = range($('#mes').value);
      let rows = CN.sinOff(await fetchAll(() => sb.from('ganancias').select('*').gte('fecha', d).lte('fecha', h).order('id')));
      const q = norm($('#q').value); if (q) rows = rows.filter((r) => norm(`${r.ecm} ${r.codigo} ${r.pdv}`).includes(q));
      const A = {}; rows.forEach((r) => { const e = (A[r.ecm || '—'] ||= { sup: r.supervisor, n: 0, p: 0, f: 0, s: 0, r: 0 }); e.n++; e.p += r.percha; e.f += r.frio; e.s += r.seco; e.r += r.ruma; });
      const VE = {}; CN.sinOff(await CN.fetchPar((o) => sb.from('visitas').select('ecm', o).eq('categoria', 'E').gte('fecha', d).lte('fecha', h).order('id'))).forEach((x) => (VE[x.ecm] = (VE[x.ecm] || 0) + 1));
      const T = Object.values(A).reduce((a, e) => ({ p: a.p + e.p, f: a.f + e.f, s: a.s + e.s, r: a.r + e.r }), { p: 0, f: 0, s: 0, r: 0 });
      $('#res').innerHTML = `<div class="grid" style="margin-bottom:16px"><div class="kpi"><b>${T.p}</b><span>Caras de percha</span></div><div class="kpi"><b>${T.f}</b><span>Bandeja frío</span></div><div class="kpi"><b>${T.s}</b><span>Bandeja seco</span></div><div class="kpi"><b>${T.r}</b><span>Rumas</span></div></div>
      <div class="card"><div class="tw"><table><thead><tr><th>ECM</th><th>Supervisor</th><th class="n">Visitas con ganancia</th><th class="n">Efectividad</th><th class="n">Percha</th><th class="n">Frío</th><th class="n">Seco</th><th class="n">Ruma</th></tr></thead><tbody>${Object.entries(A).sort().map(([k, e]) => `<tr><td>${esc(k)}</td><td>${esc(e.sup || '')}</td><td class="n">${e.n}</td><td class="n">${VE[k] ? Math.min(100, (e.n / VE[k]) * 100).toFixed(1) + '%' : '—'}</td><td class="n">${e.p}</td><td class="n">${e.f}</td><td class="n">${e.s}</td><td class="n">${e.r}</td></tr>`).join('') || '<tr><td colspan="8" class="note">Sin datos.</td></tr>'}</tbody></table></div><p class="note">Efectividad = visitas con ganancia ÷ visitas efectivas del ECM en el mes.</p></div>`;
      const PS = 25, np = Math.max(1, Math.ceil(rows.length / PS)); pgG = Math.min(pgG, np - 1); const shown = rows.slice(pgG * PS, (pgG + 1) * PS);
      const links = (r) => [['foto_percha', 'Percha'], ['foto_frio', 'Frío'], ['foto_seco', 'Seco'], ['foto_ruma', 'Ruma'], ['foto_obs', 'Obs.']].filter((x) => r[x[0]]).map((x) => `<a href="${esc(safeUrl(r[x[0]]))}" target="_blank" rel="noopener noreferrer">${x[1]}</a>`).join(' · ');
      $('#tb').innerHTML = `<table><thead><tr><th>Fecha</th><th>Código</th><th>PDV</th><th>ECM</th><th class="n">Percha</th><th class="n">Frío</th><th class="n">Seco</th><th class="n">Ruma</th><th>Fotos</th><th>Obs.</th><th></th></tr></thead><tbody>${shown.map((r) => `<tr><td>${esc(r.fecha)}</td><td>${esc(r.codigo)}</td><td>${esc(r.pdv || '')}</td><td>${esc(r.ecm || '')}</td><td class="n">${r.percha || ''}</td><td class="n">${r.frio || ''}</td><td class="n">${r.seco || ''}</td><td class="n">${r.ruma || ''}</td><td>${links(r)}</td><td>${esc((r.observacion || '').slice(0, 40))}</td><td><button data-e="${r.id}">Editar</button></td></tr>`).join('')}</tbody></table>`;
      $('#info').innerHTML = `${rows.length} registros${np > 1 ? ` · <span class="pager"><button data-gp="-1" ${pgG === 0 ? 'disabled' : ''}>‹</button> Pág. ${pgG + 1} de ${np} <button data-gp="1" ${pgG >= np - 1 ? 'disabled' : ''}>›</button></span>` : ''}`; document.querySelectorAll('[data-gp]').forEach((b) => (b.onclick = () => { pgG += +b.dataset.gp; load().catch(fail); }));
      if (!puede) { const nb = $('#nuevo'); if (nb) nb.style.display = 'none'; document.querySelectorAll('[data-e]').forEach((b) => b.remove()); }
      document.querySelectorAll('[data-e]').forEach((b) => b.onclick = () => modalGan(rows.find((x) => String(x.id) === b.dataset.e), load));
    };
    $('#mes').onchange = () => { pgG = 0; load().catch(fail); }; let dt; $('#q').oninput = () => { clearTimeout(dt); dt = setTimeout(() => { pgG = 0; load().catch(fail); }, 350); };
    $('#nuevo').onclick = () => modalGan(null, load);
    await load();
  };
  async function modalGan(r, done) {
    const el = document.createElement('div'); el.className = 'modal';
    const n = r || { fecha: new Date().toISOString().slice(0, 10), codigo: '', pdv: '', cadena: '', ecm: S.me.rol === 'asesor' ? S.me.ecm_code : '', percha: 0, frio: 0, seco: 0, ruma: 0, observacion: '' };
    const inp = (id, lbl, val, t = 'text', ex = '') => `<label>${lbl}<input id="${id}" type="${t}" value="${esc(val ?? '')}" ${ex}></label>`;
    el.innerHTML = `<form class="box"><h3>${r ? 'Editar' : 'Registrar'} espacio ganado</h3>
      ${inp('gf', 'Fecha', n.fecha, 'date', 'required')}${inp('gc', 'Código del PDV', n.codigo, 'text', `required ${r ? 'readonly' : ''}`)}<p class="note" id="gp">${esc(n.pdv || '')}</p>
      ${inp('ge', 'ECM', n.ecm, 'text', S.me.rol === 'asesor' ? 'readonly' : '')}
      <div class="grid">${inp('g1', 'Caras percha', n.percha, 'number', 'min="0"')}${inp('g2', 'Bandeja frío', n.frio, 'number', 'min="0"')}${inp('g3', 'Bandeja seco', n.seco, 'number', 'min="0"')}${inp('g4', 'Rumas', n.ruma, 'number', 'min="0"')}</div>
      ${inp('go', 'Observación', n.observacion, 'text', 'maxlength="300"')}
      <div class="bar" style="margin:0"><button class="pri">Guardar</button><button type="button" id="cx">Cancelar</button>${r && can('admin', 'gerencia', 'supervisor') ? '<button type="button" class="bad" id="dl">Eliminar</button>' : ''}</div></form>`;
    document.body.appendChild(el); $('#cx', el).onclick = () => el.remove();
    if (!r) $('#gc', el).onblur = async () => {
      const c = $('#gc', el).value.trim(); if (!c) return;
      const { data } = await sb.from('rutero').select('*').eq('codigo', c).maybeSingle();
      if (data) { n.pdv = data.pdv; n.cadena = data.cadena; $('#gp', el).textContent = data.pdv || ''; if (!$('#ge', el).value && data.ecm) $('#ge', el).value = data.ecm; } else $('#gp', el).textContent = 'Código no está en el rutero';
    };
    const dl = $('#dl', el); if (dl) dl.onclick = async () => { if (!confirm('¿Eliminar este registro?')) return; const { error } = await sb.from('ganancias').delete().eq('id', r.id); if (error) return fail(error); el.remove(); done(); };
    $('form', el).onsubmit = async (ev) => {
      ev.preventDefault();
      const ecm = ecmNorm($('#ge', el).value);
      const row = { fecha: $('#gf', el).value, codigo: $('#gc', el).value.trim(), pdv: n.pdv || null, cadena: n.cadena || null, ecm, supervisor: supDeEcm(ecm, n.supervisor || (S.me.rol === 'supervisor' ? S.me.supervisor : '')) || null,
        percha: num($('#g1', el).value), frio: num($('#g2', el).value), seco: num($('#g3', el).value), ruma: num($('#g4', el).value), observacion: $('#go', el).value.trim() || null, fuente: 'manual', hora: new Date().toTimeString().slice(0, 5) };
      if (S.me.rol === 'supervisor' && norm(row.supervisor) !== teamName()) return toast('Ese ECM no pertenece a tu equipo');
      const { error } = await sb.from('ganancias').upsert(row, { onConflict: 'fecha,codigo' });
      if (error) return fail(error); el.remove(); toast('Guardado'); done();
    };
  }

  /* ======================= Evidencias (fotos) en la justificación ======================= */
  async function reducir(file) {
    const bmp = await createImageBitmap(file); const k = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('No se pudo leer la imagen'))), 'image/jpeg', 0.75));
  }
  const _mj = modalJust;
  modalJust = function (tipo, reg, jj, done) {
    _mj(tipo, reg, jj, () => { if (window.CN && CN.invalidarAnalisis) CN.invalidarAnalisis(); done(); });
    const el = [...document.querySelectorAll('.modal')].pop(), anchor = $('.bar', el), sec = document.createElement('div');
    sec.innerHTML = `<label>Evidencias (fotos)<input type="file" id="evf" accept="image/*" multiple></label><div id="evl" class="bar" style="margin:8px 0 0"></div><p class="note" id="evm"></p>`;
    anchor.parentNode.insertBefore(sec, anchor);
    const pintar = async () => {
      const { data } = await sb.from('evidencias').select('*').eq('tipo', tipo).eq('registro_id', reg.id).order('creado_en');
      const list = data || []; const box = $('#evl', sec); box.innerHTML = '';
      if (!list.length) return;
      const { data: urls } = await sb.storage.from('evidencias').createSignedUrls(list.map((x) => x.path), 3600);
      list.forEach((e, i) => {
        const u = urls && urls[i] && urls[i].signedUrl; if (!u) return;
        const w = document.createElement('div'); w.style.cssText = 'position:relative';
        w.innerHTML = `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer"><img src="${esc(u)}" alt="Evidencia ${i + 1}" style="width:84px;height:84px;object-fit:cover;border-radius:8px;border:1px solid var(--line)"></a><button type="button" class="bad" aria-label="Quitar evidencia ${i + 1}" style="position:absolute;top:2px;right:2px;min-height:28px;padding:0 8px">✕</button>`;
        $('button', w).onclick = async () => { if (!confirm('¿Quitar esta foto?')) return; const r1 = await sb.from('evidencias').delete().eq('id', e.id); if (r1.error) return fail(r1.error); await sb.storage.from('evidencias').remove([e.path]); pintar(); };
        box.appendChild(w);
      });
    };
    pintar().catch(() => { });
    $('#evf', sec).onchange = async (ev) => {
      const files = [...ev.target.files]; const msg = $('#evm', sec);
      for (let i = 0; i < files.length; i++) {
        try {
          msg.textContent = `Subiendo foto ${i + 1} de ${files.length}…`;
          const blob = await reducir(files[i]), path = `${tipo}/${reg.id}/${crypto.randomUUID()}.jpg`;
          const up = await sb.storage.from('evidencias').upload(path, blob, { contentType: 'image/jpeg' }); if (up.error) throw up.error;
          const ins = await sb.from('evidencias').insert({ tipo, registro_id: reg.id, path }); if (ins.error) { await sb.storage.from('evidencias').remove([path]); throw ins.error; }
        } catch (e) { fail(e); }
      }
      msg.textContent = ''; ev.target.value = ''; pintar();
    };
  };

  /* ======================= Pendientes y WhatsApp ======================= */
  VIEWS.pend = async function () {
    const m = $('#main');
    m.innerHTML = `<div class="bar"><label>Mes<input type="month" id="mes" value="${monthNow()}"></label></div><div class="card"><div class="tw" id="tb"></div><p class="note">Novedades (no efectivas) que el mercaderista aún no justificó. El botón abre WhatsApp con el mensaje escrito.</p></div>`;
    const load = async () => {
      const [d, h] = range($('#mes').value);
      const [V, T, J] = await Promise.all([
        fetchAll(() => sb.from('visitas').select('id,ecm,supervisor').neq('categoria', 'E').gte('fecha', d).lte('fecha', h).order('id')),
        fetchAll(() => sb.from('tareas').select('id,ecm,supervisor').neq('categoria', 'E').gte('fecha', d).lte('fecha', h).order('id')),
        fetchAll(() => sb.from('justificaciones').select('tipo,registro_id').gte('fecha', d).lte('fecha', h).order('id'))]);
      const hecho = new Set(J.map((x) => x.tipo + '|' + x.registro_id)), A = {};
      CN.sinOff(V).filter((x) => !hecho.has('vis|' + x.id)).forEach((x) => { (A[x.ecm] ||= { sup: x.supervisor, v: 0, t: 0 }).v++; });
      CN.sinOff(T).filter((x) => !hecho.has('tar|' + x.id)).forEach((x) => { (A[x.ecm] ||= { sup: x.supervisor, v: 0, t: 0 }).t++; });
      const mes = $('#mes').value;
      $('#tb').innerHTML = `<table><thead><tr><th>ECM</th><th>Nombre</th><th>Supervisor</th><th class="n">Visitas</th><th class="n">Tareas</th><th>Aviso</th></tr></thead><tbody>${Object.entries(A).sort((a, b) => (b[1].v + b[1].t) - (a[1].v + a[1].t)).map(([k, e]) => {
        const mp = S.ecmMap.find((x) => ecmNorm(x.ecm) === k) || {}; let tel = String(mp.telefono || '').replace(/\D/g, ''); if (tel.startsWith('0')) tel = '593' + tel.slice(1);
        const txt = encodeURIComponent(`Hola ${mp.nombre || k}, tienes ${e.v} visitas y ${e.t} tareas sin justificar de ${mes}. Ingresa a la plataforma (${location.origin}) y justifícalas, por favor.`);
        return `<tr><td>${esc(k)}</td><td>${esc(mp.nombre || '')}</td><td>${esc(e.sup || '')}</td><td class="n">${e.v}</td><td class="n">${e.t}</td><td>${tel ? `<a href="https://wa.me/${tel}?text=${txt}" target="_blank" rel="noopener noreferrer"><button>WhatsApp</button></a>` : '<span class="note">Sin teléfono en ECM→Supervisor</span>'}</td></tr>`;
      }).join('') || '<tr><td colspan="6" class="note">Todo justificado 🎉</td></tr>'}</tbody></table>`;
    };
    $('#mes').onchange = () => load().catch(fail); await load();
  };

  /* ======================= Informe mensual ======================= */
  VIEWS.informe = async function () {
    const m = $('#main');
    m.innerHTML = `<div class="bar"><label>Mes<input type="month" id="mes" value="${monthNow()}"></label><button id="xl">Descargar Excel</button></div><div class="card"><div class="tw" id="tb"></div><p class="note">Efectividad = efectivas ÷ programadas · «Con just. CN» = (efectivas + justificadas CN) ÷ programadas · «Sin CN» = efectivas ÷ (programadas − justificadas CN) · «Ajust. final» además resta los motivos marcados «excluye adicional».</p></div>`;
    let SUPS = [], ECMS = [];
    const load = async () => {
      const [d, h] = range($('#mes').value);
      const { data, error } = await sb.rpc('score_ecm', { p_desde: d, p_hasta: h }); if (error) return fail(error);
      ECMS = (data || []).filter((r) => S.me.rol !== 'supervisor' || norm(r.supervisor) === teamName());
      const G = {};
      ECMS.forEach((r) => { const e = (G[r.supervisor || '—'] ||= { n: 0, vp: 0, ve: 0, vj: 0, tp: 0, te: 0, tj: 0, fp: 0, fe: 0, fj: 0, sc: [] }); e.n++; e.vp += r.vis_prog; e.ve += r.vis_efec; e.vj += r.vis_just; e.tp += r.tar_prog; e.te += r.tar_efec; e.tj += r.tar_just; e.fp += r.frio_prog; e.fe += r.frio_efec; e.fj += r.frio_just; if (r.score != null) e.sc.push(Number(r.score)); });
      const f = (a, b) => (b > 0 ? a / b : null);
      SUPS = Object.entries(G).sort().map(([k, e]) => ({ Supervisor: k, ECM: e.n, 'Visitas prog.': e.vp, 'Visitas efec.': e.ve, 'Visitas justif.': e.vj, 'Efect. visitas': f(e.ve, e.vp), 'Efect. visitas ajust.': f(e.ve, e.vp - e.vj),
        'Tareas prog.': e.tp, 'Tareas efec.': e.te, 'Tareas justif.': e.tj, 'Efect. tareas': f(e.te, e.tp), 'Efect. tareas ajust.': f(e.te, e.tp - e.tj),
        'Frío prog.': e.fp, 'Frío efec.': e.fe, 'Frío justif.': e.fj, 'Efect. frío ajust.': f(e.fe, e.fp - e.fj), 'Puntaje prom.': e.sc.length ? e.sc.reduce((a, b) => a + b, 0) / e.sc.length : null }));
      const [V, T] = await Promise.all([CN.cargarVT('vis', d, h), CN.cargarVT('tar', d, h)]);
      const EE = (R) => { const o = {}; R.forEach((r) => { const e = (o[r.sup || '—'] ||= { p: 0, E: 0, j: 0, ad: 0 }); e.p++; if (r.c === 'E') e.E++; if (r.jv) e.j++; if (r.jad) e.ad++; }); return o; }, ev = EE(V.R), et = EE(T.R), z = { p: 0, E: 0, j: 0, ad: 0 };
      SUPS.forEach((s) => { const a = ev[s.Supervisor] || z, b = et[s.Supervisor] || z; s['Visitas sin CN'] = a.p - a.j > 0 ? a.E / (a.p - a.j) : null; s['Visitas ajust. final'] = a.p - a.j - a.ad > 0 ? a.E / (a.p - a.j - a.ad) : null; s['Tareas sin CN'] = b.p - b.j > 0 ? b.E / (b.p - b.j) : null; s['Tareas ajust. final'] = b.p - b.j - b.ad > 0 ? b.E / (b.p - b.j - b.ad) : null; });
      const P = (x) => (x == null ? '—' : (x * 100).toFixed(1) + '%');
      $('#tb').innerHTML = `<table><thead><tr><th>Supervisor</th><th class="n">ECM</th><th class="n">Visitas efec./prog.</th><th class="n">Efectividad</th><th class="n">Con just. CN</th><th class="n">Sin CN</th><th class="n">Ajust. final</th><th class="n">Tareas efec./prog.</th><th class="n">Efectividad</th><th class="n">Con just. CN</th><th class="n">Sin CN</th><th class="n">Ajust. final</th><th class="n">Frío (con just.)</th><th class="n">Puntaje</th></tr></thead><tbody>${SUPS.map((s) => `<tr><td>${esc(s.Supervisor)}</td><td class="n">${s.ECM}</td><td class="n">${s['Visitas efec.']}/${s['Visitas prog.']}</td><td class="n">${P(s['Efect. visitas'])}</td><td class="n">${P(s['Efect. visitas ajust.'])}</td><td class="n">${P(s['Visitas sin CN'])}</td><td class="n"><b>${P(s['Visitas ajust. final'])}</b></td><td class="n">${s['Tareas efec.']}/${s['Tareas prog.']}</td><td class="n">${P(s['Efect. tareas'])}</td><td class="n">${P(s['Efect. tareas ajust.'])}</td><td class="n">${P(s['Tareas sin CN'])}</td><td class="n"><b>${P(s['Tareas ajust. final'])}</b></td><td class="n">${P(s['Efect. frío ajust.'])}</td><td class="n"><b>${s['Puntaje prom.'] == null ? '—' : s['Puntaje prom.'].toFixed(1)}</b></td></tr>`).join('') || '<tr><td colspan="14" class="note">Sin datos.</td></tr>'}</tbody></table>`;
    };
    $('#mes').onchange = () => load().catch(fail);
    $('#xl').onclick = () => {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(SUPS), 'Supervisores');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ECMS.map((r) => ({ ECM: r.ecm, Nombre: r.nombre, Supervisor: r.supervisor, 'Efect. visitas': r.vis_pct, 'Efect. tareas': r.tar_pct, 'Efect. frío': r.frio_pct, SOS: r.sos_pct, SOE: r.soe_pct, Puntaje: r.score }))), 'ECM');
      XLSX.writeFile(wb, `informe_${$('#mes').value}.xlsx`);
    };
    await load();
  };

  /* ======================= Rutero y ubicación ======================= */
  VIEWS.rutero = async function () {
    const m = $('#main');
    const adm = S.me.rol === 'admin'; let est = 'todos';
    m.innerHTML = `<div id="rk"></div><div class="bar"><label>Buscar PDV<input id="q" placeholder="Código, nombre, ECM o ciudad"></label><label>Estado<select id="fe"><option value="todos">Todos</option><option value="act">Activos</option><option value="ina">Inactivos</option></select></label>${adm ? '<button type="button" id="rc" title="Vuelve a calcular qué PDV llevan varias semanas sin datos">Recalcular estado</button>' : ''}</div><div class="card"><div class="tws" id="tb"></div><p class="note" id="info"></p><p class="note">Un PDV pasa a <b>inactivo</b> solo cuando lleva ${S.cfg.pdv_semanas_inactivo || 3} semanas sin datos (visitas, tareas, encuestas o espacios ganados) y vuelve a <b>activo</b> si reaparecen datos. Si lo cambias a mano, la regla automática no lo toca hasta que lo devuelvas a «automático».</p></div>`;
    let pgR = 0; const PSR = 25;
    const load = async () => {
      let q = sb.from('rutero').select('*', { count: 'exact' }).order('codigo').range(pgR * PSR, pgR * PSR + PSR - 1);
      if (est === 'act') q = q.eq('activo', true); else if (est === 'ina') q = q.eq('activo', false);
      const t = $('#q').value.trim().replace(/[,()%]/g, ' ');
      if (t) q = q.or(`codigo.ilike.%${t}%,pdv.ilike.%${t}%,ecm.ilike.%${t}%,ciudad.ilike.%${t}%`);
      const { data, error, count } = await q; if (error) return fail(error); const totR = count ?? data.length, npR = Math.max(1, Math.ceil(totR / PSR));
      const cods = (data || []).map((x) => x.codigo);
      const U = cods.length ? Object.fromEntries(((await sb.from('ubicaciones').select('*').in('codigo', cods)).data || []).map((x) => [x.codigo, x])) : {};
      $('#info').innerHTML = `${totR} PDV${npR > 1 ? ` · <span class="pager"><button data-gr="-1" ${pgR === 0 ? 'disabled' : ''}>‹</button> Pág. ${pgR + 1} de ${npR} <button data-gr="1" ${pgR >= npR - 1 ? 'disabled' : ''}>›</button></span>` : ''}`; document.querySelectorAll('[data-gr]').forEach((b) => (b.onclick = () => { pgR = Math.max(0, pgR + +b.dataset.gr); load(); }));
      $('#tb').innerHTML = `<table><thead><tr><th>Código</th><th>PDV</th><th>Cadena</th><th>Ciudad</th><th>ECM</th><th>Día</th><th>Estado</th><th>Ubicación</th></tr></thead><tbody>${data.map((r) => { const u = U[r.codigo], ina = r.activo === false, fd = (d) => (d ? String(d).split('-').reverse().join('/') : '—');
        const estC = `<span class="st ${ina ? 'pend' : 'jf'}">${ina ? 'Inactivo' : 'Activo'}</span>${r.estado_manual ? ` <small class="mu" title="${esc((r.estado_motivo || 'Fijado a mano') + ' · la regla automática no lo cambia')}">fijo</small>` : ''}<br><small class="mu">${ina ? 'Sin datos desde ' + fd(r.inactivo_desde || r.ult_dato) : 'Último dato ' + fd(r.ult_dato)}</small>${adm ? `<br><button data-est="${esc(r.codigo)}|${ina ? 1 : 0}">${ina ? 'Activar' : 'Desactivar'}</button>${r.estado_manual ? ` <button data-auto="${esc(r.codigo)}" title="Vuelve a decidirse por los datos">Automático</button>` : ''}` : ''}`;
        return `<tr class="${ina ? 'ina' : ''}"><td>${esc(r.codigo)}</td><td>${esc(r.pdv || '')}</td><td>${esc(r.cadena || '')}</td><td>${esc(r.ciudad || '')}</td><td>${esc(r.ecm || '')}</td><td>${esc(r.dia_visita || '')}</td><td>${estC}</td>
        <td>${u ? `<a href="https://www.google.com/maps?q=${u.lat},${u.lng}" target="_blank" rel="noopener noreferrer">Ver mapa</a> ` : ''}<button data-u="${esc(r.codigo)}">${u ? 'Cambiar' : 'Agregar'}</button></td></tr>`; }).join('') || '<tr><td colspan="8" class="note">Sin resultados.</td></tr>'}</tbody></table>`;
      const cnt = async (v) => (await sb.from('rutero').select('codigo', { count: 'exact', head: true }).eq('activo', v)).count;
      Promise.all([cnt(true), cnt(false)]).then(([a, i]) => { const k = $('#rk'); if (k) k.innerHTML = `<div class="kp"><div class="k" style="--a:var(--cE)"><span>PDV activos</span><b>${(a ?? 0).toLocaleString('es-EC')}</b><i>con datos recientes</i></div><div class="k" style="--a:var(--cP)"><span>PDV inactivos</span><b>${(i ?? 0).toLocaleString('es-EC')}</b><i>${S.cfg.pdv_semanas_inactivo || 3} semanas o más sin datos, o desactivados a mano</i></div></div>`; });
      document.querySelectorAll('[data-est]').forEach((b) => (b.onclick = async () => { const [c, act] = b.dataset.est.split('|'); const mot = act === '1' ? 'Activado a mano' : (prompt('Motivo para desactivar este PDV (opcional):', 'Cerrado / ya no se visita') || 'Desactivado a mano');
        const { error } = await sb.from('rutero').update({ activo: act === '1', estado_manual: true, inactivo_desde: act === '1' ? null : new Date().toISOString().slice(0, 10), estado_motivo: mot, estado_actualizado: new Date().toISOString() }).eq('codigo', c); if (error) return fail(error); if (CN.PLAN && CN.PLAN.invalidar) CN.PLAN.invalidar(); if (CN.invalidarShare) CN.invalidarShare(); toast(act === '1' ? 'PDV activado' : 'PDV desactivado'); load(); }));
      document.querySelectorAll('[data-auto]').forEach((b) => (b.onclick = async () => { const { error } = await sb.from('rutero').update({ estado_manual: false }).eq('codigo', b.dataset.auto); if (error) return fail(error); const r = await sb.rpc('pdv_recalcular_estado'); if (r.error) return fail(r.error); if (CN.PLAN && CN.PLAN.invalidar) CN.PLAN.invalidar(); if (CN.invalidarShare) CN.invalidarShare(); toast('El PDV vuelve a decidirse por los datos'); load(); }));
      document.querySelectorAll('[data-u]').forEach((b) => b.onclick = async () => {
        const t2 = prompt('Pega las coordenadas (ej. -0.1807, -78.4678) o el enlace de Google Maps:'); if (!t2) return;
        const mm = t2.match(/(-?\d{1,2}\.\d+)\s*[,;\s]\s*(-?\d{1,3}\.\d+)/); if (!mm) return toast('No pude leer las coordenadas');
        const { error: e2 } = await sb.from('ubicaciones').upsert({ codigo: b.dataset.u, lat: Number(mm[1]), lng: Number(mm[2]), fecha: new Date().toISOString() }, { onConflict: 'codigo' });
        e2 ? fail(e2) : (toast('Ubicación guardada'), load());
      });
    };
    let dt; $('#q').oninput = () => { clearTimeout(dt); dt = setTimeout(() => { pgR = 0; load().catch(fail); }, 350); }; await load();
    $('#fe').onchange = (e) => { est = e.target.value; pgR = 0; load(); };
    if ($('#rc')) $('#rc').onclick = async () => { const { data, error } = await sb.rpc('pdv_recalcular_estado'); if (error) return fail(error); if (CN.PLAN && CN.PLAN.invalidar) CN.PLAN.invalidar(); if (CN.invalidarShare) CN.invalidarShare(); toast(data && data.historial_suficiente === false ? `Aún no hay ${data.semanas} semanas de datos para decidir.` : `${data.desactivados} desactivados · ${data.reactivados} reactivados`); load(); };
  };

  /* ======================= Catálogo de marcas ======================= */
  VIEWS.catalogo = async function () {
    const m = $('#main');
    let ord = null; /* orden por encabezado: { k, dir } */
    m.innerHTML = `<div class="bar"><label>Encuesta<select id="en"><option value="">Todas</option><option>SOS</option><option>SOE</option></select></label><label>Origen<select id="or"><option value="">Todos</option><option value="auto">Por revisar (auto)</option><option value="sin">Sin clasificar</option><option value="manual">Manual</option></select></label><label>Buscar pregunta, SKU o producto<input id="q"></label></div><div class="card"><div class="tw" id="tb"></div><p class="note" id="info"></p></div>`;
    const load = async () => {
      let rows = await fetchAll(() => sb.from('catalogo_share').select('*').order('clave'));
      const en = $('#en').value, or = $('#or').value, q = norm($('#q').value);
      rows = rows.filter((r) => (!en || r.encuesta === en) && (!or || (or === 'sin' ? r.grupo === 'SIN CLASIFICAR' : r.origen === or)) && (!q || norm(r.pregunta + ' ' + (r.marca || '')).includes(q)));
      const VK = { pregunta: (r) => norm(r.pregunta), encuesta: (r) => r.encuesta, grupo: (r) => r.grupo, tipo: (r) => r.tipo, marca: (r) => norm(r.marca || ''), origen: (r) => r.origen };
      if (ord) rows.sort((a, b) => ord.dir * String(VK[ord.k](a) ?? '').localeCompare(String(VK[ord.k](b) ?? ''), 'es', { numeric: true })); else rows.sort((a, b) => (b.grupo === 'SIN CLASIFICAR') - (a.grupo === 'SIN CLASIFICAR')); const nSin = rows.filter((r) => r.grupo === 'SIN CLASIFICAR').length;
      $('#info').textContent = `${rows.length} preguntas${nSin ? ` (${nSin} sin clasificar: elige su marca y vuelve a cargar la encuesta)` : ''}. Al cambiar la marca, el tipo o el SKU, vuelve a cargar la encuesta de esas semanas para aplicar el cambio.`;
      $('#tb').innerHTML = `<table><thead><tr>${[['pregunta', 'Pregunta'], ['encuesta', 'Enc.'], ['grupo', 'Marca'], ['tipo', 'Tipo'], ['marca', 'SKU / producto'], ['origen', 'Origen']].map(([k, t]) => `<th aria-sort="${ord && ord.k === k ? (ord.dir > 0 ? 'ascending' : 'descending') : 'none'}"><button type="button" class="th-sort" data-o="${k}" title="Ordenar por ${t}">${t} ${ord && ord.k === k ? (ord.dir > 0 ? '▲' : '▼') : '↕'}</button></th>`).join('')}</tr></thead><tbody>${rows.slice(0, 300).map((r, i) => `<tr><td style="white-space:normal;min-width:260px">${esc(r.pregunta)}</td><td>${r.encuesta}</td><td>${sel('cg' + i, GRUPOS_CAT, r.grupo, `data-k="${esc(r.clave)}" aria-label="Marca de ${esc(r.pregunta)}"`)}</td><td>${sel('ct' + i, TIPOS, r.tipo, `data-k="${esc(r.clave)}" aria-label="Tipo de ${esc(r.pregunta)}"`)}</td><td><input id="cs${i}" value="${esc(r.marca || '')}" maxlength="80" style="min-width:180px" aria-label="SKU o producto de ${esc(r.pregunta)}"></td><td><span class="pill ${r.origen === 'auto' ? 'F' : 'E'}">${r.origen}</span></td></tr>`).join('')}</tbody></table>`;
      document.querySelectorAll('#tb [data-o]').forEach((b) => (b.onclick = () => { ord = ord && ord.k === b.dataset.o ? (ord.dir > 0 ? { k: ord.k, dir: -1 } : null) : { k: b.dataset.o, dir: 1 }; load().catch(fail); }));
      rows.slice(0, 300).forEach((r, i) => ['cg', 'ct', 'cs'].forEach((p) => { $('#' + p + i).onchange = async () => {
        const { error } = await sb.from('catalogo_share').update({ grupo: $('#cg' + i).value, tipo: $('#ct' + i).value, marca: $('#cs' + i).value.trim().slice(0, 80), origen: 'manual' }).eq('clave', r.clave).eq('encuesta', r.encuesta); error ? fail(error) : toast('Guardado'); }; }));
    };
    ['en', 'or'].forEach((id) => $('#' + id).onchange = () => load().catch(fail)); let dt; $('#q').oninput = () => { clearTimeout(dt); dt = setTimeout(() => load().catch(fail), 350); };
    await load();
  };
})();
