'use strict';
/* Carga de bases: replica el procesamiento del sistema anterior.
   Detecta el tipo de archivo por sus encabezados, carga en orden (ECM → rutero → visitas → tareas → enlaces → espacios → encuestas)
   y informa nuevas / actualizadas / sin cambios y los cambios de estado. */
(function () {
  const CN = (window.CN = window.CN || {});
  const chunks = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  CN.chunks = chunks;

  /* lectura paralela de tablas grandes (1000 filas por página) */
  /* reintenta ante cortes de red / límites temporales (3 intentos con espera creciente) */
  const conReintento = async (fn) => { let ult; for (let i = 0; i < 3; i++) { try { const r = await fn(); if (!r.error) return r; ult = r.error; if (r.error.code && !/^(5|08|57|PGRST30)/.test(String(r.error.code)) && r.status && r.status < 500 && r.status !== 429) break; } catch (e) { ult = e; } await new Promise((ok) => setTimeout(ok, 600 * (i + 1))); } throw ult; };
  CN.conReintento = conReintento;
  CN.fetchPar = async function (mk) {
    const first = await conReintento(() => mk({ count: 'exact' }).range(0, 999));
    let out = first.data || []; const total = first.count || out.length;
    const pages = []; for (let f = 1000; f < total; f += 1000) pages.push(f);
    for (const grp of chunks(pages, 4)) {
      const rs = await Promise.all(grp.map((f) => conReintento(() => mk({}).range(f, f + 999))));
      rs.forEach((r) => { out = out.concat(r.data || []); });
    }
    return out;
  };

  const NOMBRE = { vis: 'Visitas', tar: 'Tareas', rut: 'Rutero', ecm: 'ECM → supervisor', enl: 'Enlaces de fotos (Involves)', gan: 'Espacios ganados', enc: 'Encuestas SOS / SOE', meta: 'Metas', pdv: 'PDV activos / inactivos' };
  const CATL = { vis: { P: 'Perdida', F: 'Fuera de rango', M: 'Menos de 2 min' }, tar: { M: 'Mal ejecutada', F: 'Justificada', P: 'Abierta' } };
  CN.CATL = CATL;
  const normReg = (v) => norm(v).replace(/^REGION\s+/, '').replace(/\s*KKAA.*$/, '');
  const ecmNum = (v) => { const t = String(v == null ? '' : v).toUpperCase().replace(/\s+/g, ''), m = t.match(/^[A-Z]*?0*(\d+)$/); return m ? m[1] : t; };
  const claveEnl = (e, c, d) => ecmNum(e) + '|' + String(c == null ? '' : c).trim().replace(/\.0+$/, '').replace(/^0+(?=\d)/, '') + '|' + String(d || '').slice(0, 10);
  const urls = (v) => String(v == null ? '' : v).split(/[\s,]+/).filter((x) => /^https?:/i.test(x));

  /* parecido entre nombres de cliente (0..1), igual que el sistema anterior */
  const normNom = (s) => String(s == null ? '' : s).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  function lev(a, b) { const m = a.length, n = b.length; let p = []; for (let j = 0; j <= n; j++) p.push(j); for (let i = 1; i <= m; i++) { const c = [i]; for (let j = 1; j <= n; j++) c.push(Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))); p = c; } return p[n]; }
  function dice(a, b) { if (a === b) return 1; if (a.length < 2 || b.length < 2) return 0; const g = (x) => { const o = {}; for (let i = 0; i < x.length - 1; i++) { const k = x.substr(i, 2); o[k] = (o[k] || 0) + 1; } return o; }; const A = g(a), B = g(b); let i = 0; Object.keys(A).forEach((k) => { if (B[k]) i += Math.min(A[k], B[k]); }); return 2 * i / (a.length - 1 + b.length - 1); }
  function simNom(x, y) {
    const a = normNom(x), b = normNom(y); if (!a || !b) return 0;
    const ta = a.split(' '), tb = b.split(' '), eq = (p, q) => p === q || (Math.min(p.length, q.length) >= 5 && lev(p, q) <= 1);
    const small = ta.length <= tb.length ? ta : tb, big = ta.length <= tb.length ? tb : ta; let hit = 0, hl = 0, tl = 0;
    small.forEach((t) => { tl += t.length; if (big.some((q) => eq(t, q))) { hit++; hl += t.length; } });
    const cont = (hit >= 2 || (small.length === 1 && hit === 1 && small[0].length >= 6)) ? hl / tl : 0;
    return Math.max(dice(a.replace(/ /g, ''), b.replace(/ /g, '')), cont * 0.97);
  }
  const UMBRAL = 0.8;

  /* fechas con hora → milisegundos (para la duración de la visita) */
  function ms(x) {
    if (x instanceof Date) return x.getTime();
    if (typeof x === 'number') return serialMs(x);
    const s = String(x == null ? '' : x).trim(); let m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
    return m ? Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +(m[6] || 0)) : NaN;
  }
  const minutos = (a, b) => { const x = ms(a), y = ms(b); return isNaN(x) || isNaN(y) || y < x ? null : Math.round((y - x) / 1000) / 60; };
  const dt = (v) => (typeof v === 'number' && !isNaN(serialMs(v)) ? new Date(serialMs(v)).toISOString().slice(0, 19).replace('T', ' ') : v instanceof Date ? new Date(v.getTime() - v.getTimezoneOffset() * 60000).toISOString().slice(0, 19).replace('T', ' ') : TXT(v));

  /* ---------- detección del tipo de archivo (por encabezados) ---------- */
  function detectar(keys) {
    const has = (k) => keys.includes(k), any = (re) => keys.some((k) => re.test(k));
    if (has('VISITDATE')) return 'vis';
    if (has('ESTADOTAREA')) return 'tar';
    if (has('PERFILDELPDV') && has('EMPLEADO')) return any(/CARASGANADAS|RUMASGANADAS/) ? 'gan' : 'enl';
    if (has('DESCRIPCIONPREGUNTA') && has('RESPUESTA') && has('CODIGOCLIENTE')) return 'enc';
    if (has('CLIENTESAP') && has('NOMBRECLIENTE3')) return 'rut';
    if (has('ECM') && has('TELEFONO')) return 'ecm';
    if (has('CODIGO') && (has('PDV') || has('REGION') || has('CADENA') || has('KAM'))) return 'rut';
    if ((has('TIPOS') || has('TIPO') || has('INDICADOR')) && (has('VALOR') || has('META')) && (has('PERIODO') || has('MES') || has('AMBITO') || has('CLAVE'))) return 'meta';
    return null;
  }
  const FALTAN = {
    vis: ['Region', 'Supervisor', 'BDR', 'CodigoCliente', 'Cliente', 'VISIT_DATE', 'FechaInicioVisita', 'FechaFinVisita', 'EstadoVisita', 'EN RANGO', 'VISITAS PROGRAMADAS', 'VISITAS PERDIDAS', 'VISITAS EFECTIVAS'],
    tar: ['SystemModstamp', 'CodigoCliente', 'NombreCliente3', 'SectorDesarrollo', 'Pilares', 'Descripcion', 'Estado_Tarea', 'ResultadoEfectividad_Tarea'],
    enl: ['EMPLEADO', 'PERFIL DEL PDV', 'FECHA Y HORA DE LA ENCUESTA', 'FOTO ANTES', 'FOTOS DESPUES', 'FOTO DE EFECTIVIDAD DE VISITA'],
    ecm: ['ECM', 'NOMBRE', 'TELEFONO']
  };

  /* lee el libro: por cada hoja con datos devuelve {tp, rows (objetos con claves normalizadas), ws, kk} */
  async function leerArchivo(f) {
    /* archivos .xlsx pesados (exportes de encuestas): lectura por flujo, fila a fila, sin armar el libro completo (no agota la memoria) */
    if (/\.xlsx$/i.test(f.name) && f.size > 12e6 && CN.xlsxFlujo) {
      try {
        const A = await CN.xlsxFlujo(await f.arrayBuffer(), (n) => CN.ocupado && CN.ocupado('Leyendo ' + f.name + ': ' + n.toLocaleString('es-EC') + ' filas…'));
        if (A.length > 1) { const orig = A[0].map((h, i) => String(h || '').trim() || 'COL' + i), keys = orig.map(key), tp = detectar(keys);
          if (tp && tp !== 'tar') { const rows = []; for (let i = 1; i < A.length; i++) { const o = {}; keys.forEach((k, c) => { const v = A[i][c]; if (v !== '' && v !== undefined) o[k] = v; }); rows.push(o); } return { tp, rows, keys, file: f }; } }
      } catch (e) { console.warn('Lectura por flujo no disponible; se usa el lector normal.', e); } finally { CN.ocupado && CN.ocupado(''); }
    }
    /* CSV: se detecta la codificación (UTF-8 o Windows-1252) para no dañar tildes y eñes, y el separador (; o ,) */
    let wb; if (/\.csv$/i.test(f.name)) { const buf = await f.arrayBuffer(); let txt; try { txt = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { txt = new TextDecoder('windows-1252').decode(buf); } if (txt.charCodeAt(0) === 0xfeff) txt = txt.slice(1); const l1 = txt.split('\n', 1)[0]; wb = XLSX.read(txt, { type: 'string', /* sin cellDates: SheetJS leería 01/11/2026 como mes/día (EE. UU.); así queda texto y toISO lo lee día/mes */ FS: l1.split(';').length >= l1.split(',').length ? ';' : ',' }); }
    else wb = XLSX.read(await f.arrayBuffer(), { type: 'array', cellDates: true });
    for (const n of wb.SheetNames) {
      const ws = wb.Sheets[n], j = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true }); if (!j.length) continue;
      const orig = Object.keys(j[0]), keys = orig.map(key), tp = detectar(keys); if (!tp) continue;
      const kk = {}; orig.forEach((k) => (kk[key(k)] = k));
      /* columnas numéricas (0, 1, -1…) con formato de fecha en Excel: SheetJS las devuelve como fechas de 1899-1900 → se vuelven al número */
      const cel = (v) => (v instanceof Date && v.getTime() < -2203891200000 ? Math.round(v.getTime() / 864e5 + 25569) : v);
      const rows = j.map((r) => { const o = {}; orig.forEach((k) => (o[key(k)] = cel(r[k]))); return o; });
      if (tp === 'tar' && kk.URLLINK) hipervinculos(ws, j, kk.URLLINK, rows);
      return { tp, rows, keys, file: f };
    }
    throw new Error('No reconozco el archivo. Debe ser: visitas (VISIT_DATE), tareas (Estado_Tarea), rutero, ECM (ECM y TELEFONO), enlaces o espacios ganados (Perfil del PDV y Empleado), encuestas (DescripcionPregunta y Respuesta) o metas.');
  }
  /* las tareas traen el link como hipervínculo de la celda: se toma su destino si el texto no es una URL */
  function hipervinculos(ws, j, header, rows) {
    try {
      const ref = XLSX.utils.decode_range(ws['!ref']);
      const hk = Object.keys(ws).find((a) => a[0] !== '!' && XLSX.utils.decode_cell(a).r === ref.s.r && String(ws[a].v) === header);
      if (!hk) return; const col = XLSX.utils.decode_cell(hk).c;
      rows.forEach((r, i) => { const c = ws[XLSX.utils.encode_cell({ r: ref.s.r + 1 + i, c: col })]; if (c && c.l && c.l.Target && !/^https?:/i.test(String(r.URLLINK || ''))) r.URLLINK = c.l.Target; });
    } catch (e) { /* sin hipervínculos */ }
  }
  const g = (r, ...n) => { for (const k of n) { const v = r[key(k)]; if (v !== undefined && v !== null && v !== '') return v; } return ''; };

  /* ---------- tablas de apoyo ---------- */
  async function apoyo() {
    const [rut, ecm] = await Promise.all([CN.fetchPar((o) => sb.from('rutero').select('codigo,pdv,region,ciudad', o).order('codigo')), sb.from('ecm_map').select('*')]);
    const R = {}; rut.forEach((x) => (R[x.codigo] = x));
    const E = {}; (ecm.data || []).forEach((x) => (E[ecmNorm(x.ecm)] = x));
    return { R, E };
  }
  const supDe = (E, ecm, file) => (E[ecm] && E[ecm].supervisor) || TXT(file);

  /* ---------- mapeo visitas / tareas ---------- */
  function mapVis(rows, A) {
    const seen = {}; let desc = 0;
    const out = rows.map((r) => {
      const fecha = toISO(g(r, 'VISIT_DATE')); const prog = Number(g(r, 'VISITAS PROGRAMADAS')) || 0;
      if (!fecha || prog <= 0) { desc++; return null; }
      const bdr = TXT(g(r, 'BDR')), ecm = ecmNorm(bdr), cli = TXT(g(r, 'CodigoCliente'));
      const ef = Number(g(r, 'VISITAS EFECTIVAS')) || 0, pe = Number(g(r, 'VISITAS PERDIDAS')) || 0, rango = Number(g(r, 'EN RANGO')) === 1;
      const categoria = ef > 0 ? 'E' : pe !== 0 ? 'P' : !rango ? 'F' : 'M';
      const base = `V|${fecha}|${cli}|${bdr}`; seen[base] = (seen[base] || 0) + 1; const id = seen[base] > 1 ? `${base}#${seen[base]}` : base;
      const ru = A.R[cli]; const ini = g(r, 'FechaInicioVisita'), fin = g(r, 'FechaFinVisita');
      return { id, fecha, region: normReg(g(r, 'Region')), gerencia: TXT(g(r, 'Gerencia_Ventas')), supervisor: supDe(A.E, ecm, g(r, 'Supervisor')), ecm,
        codigo_cliente: cli, cliente: (ru && TXT(ru.pdv)) || TXT(g(r, 'Cliente')), estado: TXT(g(r, 'EstadoVisita')), categoria, programadas: prog, programadas: prog,
        detalle: { justificacion: TXT(g(r, 'Justificacion')).toUpperCase(), just_nc: TXT(g(r, 'Justificacion NoCompletado')), just_fr: TXT(g(r, 'Justificacion FinalRuta')),
          en_rango: rango ? 1 : 0, inicio: dt(ini), fin: dt(fin), min: minutos(ini, fin), desp_h: Number(g(r, 'Tiempo Desplazamiento Horas')) || null, kmh: Number(g(r, 'Km/h distancia desde poc')) || null, dist_m: Number(g(r, 'Distancia Entre POCs Metros')) || null } };
    }).filter(Boolean);
    return { data: out, desc };
  }
  function mapTar(rows, A, re, regCli) {
    const seen = {}; let desc = 0;
    const out = rows.map((r) => {
      const ts = g(r, 'SystemModstamp'); const fecha = toISO(ts); const bdr = TXT(g(r, 'SectorDesarrollo')), ecm = ecmNorm(bdr), cli = TXT(g(r, 'CodigoCliente'));
      if (!fecha || !cli || !ecm) { desc++; return null; }
      const st = norm(g(r, 'Estado_Tarea')), res = norm(g(r, 'ResultadoEfectividad_Tarea'));
      const categoria = res === 'VALID' && st === 'FINISHED' ? 'E' : res === 'INVALID' && st === 'FINISHED' ? 'M' : st === 'JUSTIFIED' ? 'F' : st === 'AVAILABLE' ? 'P' : st === 'FINISHED' ? 'M' : 'P';
      const pilar = TXT(g(r, 'Pilares')), descr = TXT(g(r, 'Descripcion')).replace(/[<>"]/g, '');
      const base = `T|${fecha}|${cli}|${hash(descr)}`; seen[base] = (seen[base] || 0) + 1; const id = seen[base] > 1 ? `${base}#${seen[base]}` : base;
      const ru = A.R[cli]; const u = (v) => (/^https?:\/\//i.test(TXT(v)) ? TXT(v) : null);
      return { id, fecha, region: (ru && ru.region) || regCli[cli] || null, supervisor: supDe(A.E, ecm, g(r, 'Supervisor')), ecm, codigo_cliente: cli, cliente: (ru && TXT(ru.pdv)) || TXT(g(r, 'NombreCliente3')),
        pilar, descripcion: descr, estado: TXT(g(r, 'Estado_Tarea')), resultado: TXT(g(r, 'ResultadoEfectividad_Tarea')), categoria, es_frio: re.test(norm(pilar + ' ' + descr)),
        url_imagen: u(g(r, 'URL_Imagen')), url_link: u(g(r, 'URL_Link')),
        detalle: { ts: dt(ts), justificacion: TXT(g(r, 'Justificacion')).toUpperCase(), grupo: TXT(g(r, 'GrupoSupervision')), cargadas: Number(g(r, 'Tareas Cargadas')) || null,
          mal_tomada: g(r, '%Mal Tomada /Just /Abiertas') === '' ? null : Number(g(r, '%Mal Tomada /Just /Abiertas')), ejecucion: g(r, '%Ejecucion') === '' ? null : Number(g(r, '%Ejecucion')),
          gps: g(r, 'module_gps_compliant') === '' ? null : g(r, 'module_gps_compliant'), vision: g(r, 'module_vision_2_0') === '' ? null : g(r, 'module_vision_2_0'),
          en_validacion: g(r, 'Tareas en validacion') === '' ? null : g(r, 'Tareas en validacion'), estado_fotos: TXT(g(r, 'Estado Fotos')) } };
    }).filter(Boolean);
    return { data: out, desc };
  }

  /* comparación como igual_ del sistema anterior; los campos "derivados" no se pisan con vacíos */
  const DERIV = { visitas: ['supervisor', 'cliente'], tareas: ['supervisor', 'url_link', 'region'] };
  const COMP = { visitas: ['fecha', 'region', 'gerencia', 'supervisor', 'ecm', 'codigo_cliente', 'cliente', 'estado', 'categoria', 'programadas'], tareas: ['fecha', 'region', 'supervisor', 'ecm', 'codigo_cliente', 'cliente', 'pilar', 'descripcion', 'estado', 'resultado', 'categoria', 'es_frio', 'url_imagen', 'url_link'] };
  const eq = (a, b) => (a === '' || a == null) && (b === '' || b == null) ? true : typeof a === 'number' || typeof b === 'number' ? Number(a) === Number(b) : String(a == null ? '' : a).trim() === String(b == null ? '' : b).trim();
  const jeq = (a, b) => JSON.stringify(a || {}) === JSON.stringify(b || {});

  async function borrarRango(tabla, desde, hasta, say) {
    const d0 = new Date(desde + 'T00:00:00Z'), d1 = new Date(hasta + 'T00:00:00Z'); let n = 0;
    for (let d = d0; d <= d1; d = new Date(d.getTime() + 864e5)) {
      const f = d.toISOString().slice(0, 10); say(`Borrando ${tabla} ${f}…`);
      const { error, count } = await sb.from(tabla).delete({ count: 'exact' }).eq('fecha', f); if (error) throw error; n += count || 0;
    }
    return n;
  }

  async function cargarVT(tp, rows, modo, say, A, extra) {
    const tabla = tp === 'vis' ? 'visitas' : 'tareas';
    const { data, desc } = tp === 'vis' ? mapVis(rows, A) : mapTar(rows, A, extra.re, extra.regCli);
    if (!data.length) throw new Error('No hay filas válidas en el archivo.');
    const ds = data.map((x) => x.fecha).sort(), desde = ds[0], hasta = ds[ds.length - 1];
    const res = { tp, filas: data.length, descartadas: desc, desde, hasta, nuevas: 0, actualizadas: 0, iguales: 0, trans: {}, motivoEfectivas: 0, borradas: 0, modo };
    if (modo === 'rango') res.borradas = await borrarRango(tabla, desde, hasta, say);
    if (modo === 'todo') {
      const est = (await sb.from(tabla).select('fecha').order('fecha').limit(1)).data, ult = (await sb.from(tabla).select('fecha').order('fecha', { ascending: false }).limit(1)).data;
      if (est && est[0] && ult && ult[0]) res.borradas = await borrarRango(tabla, est[0].fecha, ult[0].fecha, say);
    }
    const sz = 1000;
    for (let i = 0; i < data.length; i += sz) {
      const lote = data.slice(i, i + sz); say(`${modo === 'actualizar' ? 'Comparando' : 'Cargando'} ${NOMBRE[tp].toLowerCase()}: ${Math.min(i + sz, data.length)} de ${data.length}…`);
      if (modo !== 'actualizar') { const { error } = await sb.from(tabla).upsert(lote, { onConflict: 'id' }); if (error) throw error; res.nuevas += lote.length; continue; }
      const ex = {};
      for (const ids of chunks(lote.map((x) => x.id), 300)) { const { data: e, error } = await sb.from(tabla).select('*').in('id', ids); if (error) throw error; e.forEach((x) => (ex[x.id] = x)); }
      const cambios = [], aE = [];
      lote.forEach((n) => {
        const o = ex[n.id]; if (!o) { cambios.push(n); res.nuevas++; return; }
        const m = { ...n }; DERIV[tabla].forEach((c) => { if (m[c] === '' || m[c] == null) m[c] = o[c]; });
        const dif = COMP[tabla].some((c) => !eq(o[c], m[c])) || !jeq(o.detalle, m.detalle);
        if (!dif) { res.iguales++; return; }
        if (o.categoria !== m.categoria) { const k = o.categoria + '>' + m.categoria; res.trans[k] = (res.trans[k] || 0) + 1; if (m.categoria === 'E') aE.push(m.id); }
        cambios.push(m); res.actualizadas++;
      });
      if (aE.length) for (const ids of chunks(aE, 300)) { const { data: j } = await sb.from('justificaciones').select('registro_id').eq('tipo', tp).in('registro_id', ids); res.motivoEfectivas += (j || []).length; }
      if (cambios.length) { const { error } = await sb.from(tabla).upsert(cambios, { onConflict: 'id' }); if (error) throw error; }
    }
    return res;
  }

  /* ---------- rutero (acepta el maestro SAP, el rutero del BI y el informe de punto de venta) ---------- */
  async function cargarRutero(rows, say, opcion) {
    const first = (r, names) => { for (const n of names) { const v = r[key(n)]; if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim(); } return ''; };
    const nuevo = {}, estCol = {}; let desc = 0;
    rows.forEach((r) => {
      const cod = first(r, ['CODIGO', 'CODIGO CLIENTE', 'CODIGOCLIENTE', 'CLIENTE_SAP', 'PERFIL DEL PDV']).replace(/\.0+$/, ''); if (!/^\d{1,12}$/.test(cod)) { desc++; return; }
      const regRaw = first(r, ['REGION', 'MACRORREGIONAL', 'NOMBRE_DIRECCION']);
      nuevo[cod] = { codigo: cod, pdv: first(r, ['PDV', 'NOMBRE PDV', 'NombreCliente3', 'NOMBRE DEL PDV', 'NOMBRE']).slice(0, 120), region: normReg(regRaw), cadena: first(r, ['CADENA']),
        ciudad: first(r, ['CIUDAD']), supervisor: first(r, ['SUPERVISOR']), ecm: ecmNorm(first(r, ['ECM', 'SectorDesarrollo'])), dia_visita: first(r, ['DIA DE VISITA', 'DiaVisitaBDR']),
        subcadena: first(r, ['SUBCADENA', 'TIPOLOGIA']), kam: first(r, ['KAM']), gerencia: first(r, ['GrupoGerencia']), grupo_supervision: first(r, ['GrupoSupervision']),
        semanas: first(r, ['SemanasVisita']), dia_entrega: first(r, ['Dia Entrega']), agrupacion: first(r, ['AGRUPACION']), gestor: first(r, ['GESTOR']) };
      const ev = norm(first(r, ['ESTADO PDV', 'ESTADO DEL PDV', 'ACTIVO', 'ESTADO', 'STATUS'])); if (ev) { if (/^(INACTIVO|INACTIVE|NO|0|FALSE|BAJA|CERRADO|DESACTIVADO)$/.test(ev)) estCol[cod] = false; else if (/^(ACTIVO|ACTIVE|SI|1|TRUE|ALTA|ACTIVADO)$/.test(ev)) estCol[cod] = true; }
    });
    const cods = Object.keys(nuevo); if (!cods.length) throw new Error('No encontré filas válidas en el rutero (el código debe ser numérico).');
    say('Leyendo rutero actual…');
    const act = {}; (await CN.fetchPar((o) => sb.from('rutero').select('*', o).order('codigo'))).forEach((x) => (act[x.codigo] = x));
    const out = []; let nuevos = 0, actualizados = 0;
    cods.forEach((c) => {
      const n = nuevo[c], o = act[c]; const m = { ...(o || {}) };
      Object.keys(n).forEach((k) => { if (n[k] !== '' && n[k] != null) m[k] = n[k]; });   // lo nuevo pisa solo lo que trae con valor
      m.codigo = c; Object.keys(n).forEach((k) => { if (m[k] === undefined) m[k] = null; });
      if (!o) { nuevos++; out.push(m); } else if (Object.keys(n).some((k) => (m[k] || '') !== (o[k] || ''))) { actualizados++; out.push(m); }
    });
    for (let i = 0; i < out.length; i += 1000) { say(`Guardando rutero: ${Math.min(i + 1000, out.length)} de ${out.length}…`); const { error } = await sb.from('rutero').upsert(out.slice(i, i + 1000), { onConflict: 'codigo' }); if (error) throw error; }
    /* activos / inactivos según este rutero: columna Estado/Activo por fila y, si se pide, «rutero completo» (los que no vienen quedan inactivos) */
    const hoy = new Date().toISOString().slice(0, 10), nota = 'Según rutero del ' + hoy.split('-').reverse().join('/'), ponActivo = new Set(), ponInactivo = new Set();
    cods.forEach((cd) => { if (estCol[cd] === true) ponActivo.add(cd); else if (estCol[cd] === false) ponInactivo.add(cd); else if (opcion === 'completo') ponActivo.add(cd); });
    if (opcion === 'completo') Object.keys(act).forEach((cd) => { if (!nuevo[cd]) ponInactivo.add(cd); });
    const activados = [...ponActivo].filter((cd) => !act[cd] || act[cd].activo === false).length, inactivados = [...ponInactivo].filter((cd) => !act[cd] || act[cd].activo !== false).length;
    for (const [conj, val] of [[ponActivo, true], [ponInactivo, false]]) {
      const lista = [...conj]; for (const part of chunks(lista, 300)) { say(`Actualizando estado de PDV (${val ? 'activos' : 'inactivos'})…`);
        const { error } = await sb.from('rutero').update({ activo: val, estado_manual: true, inactivo_desde: val ? null : hoy, estado_motivo: nota, estado_actualizado: new Date().toISOString() }).in('codigo', part); if (error) throw error; }
    }
    const estadoTxt = (ponActivo.size || ponInactivo.size) ? `Según el rutero: ${inactivados} PDV pasaron a inactivos y ${activados} a activos${opcion === 'completo' ? ' (rutero completo: los que no vienen quedan inactivos)' : ' (columna Estado del archivo)'}.` : '';
    return { tp: 'rut', filas: cods.length, descartadas: desc, nuevas: nuevos, actualizadas: actualizados, iguales: cods.length - nuevos - actualizados, estadoTxt };
  }

  /* ---------- ECM (nombre, teléfono, supervisor): una celda vacía no borra lo ya guardado ---------- */
  async function cargarEcm(rows, say) {
    const { data: cur } = await sb.from('ecm_map').select('*'); const act = {}; (cur || []).forEach((x) => (act[ecmNorm(x.ecm)] = x));
    const out = []; let nuevos = 0, actualizados = 0, desc = 0;
    rows.forEach((r) => {
      const e = ecmNorm(g(r, 'ECM')); if (!/^[A-Z0-9_-]{2,20}$/.test(e)) { desc++; return; }
      let tel = g(r, 'TELEFONO'); if (typeof tel === 'number') { tel = String(tel); if (/^9\d{8}$/.test(tel)) tel = '0' + tel; } tel = TXT(tel).slice(0, 30);
      const nom = TXT(g(r, 'NOMBRE')).replace(/\s+/g, ' ').slice(0, 120), sup = TXT(g(r, 'SUPERVISOR')).replace(/\s+/g, ' ').toUpperCase().slice(0, 120);
      const o = act[e], m = { ecm: e, nombre: (o && o.nombre) || '', telefono: (o && o.telefono) || '', supervisor: (o && o.supervisor) || '', origen: (o && o.origen) || 'manual' };
      if (nom) m.nombre = nom; if (tel) m.telefono = tel; if (sup) { m.supervisor = sup; m.origen = 'manual'; }
      if (!o) nuevos++; else if (['nombre', 'telefono', 'supervisor'].some((k) => (o[k] || '') !== (m[k] || ''))) actualizados++; else return;
      out.push(m);
    });
    if (out.length) { const { error } = await sb.from('ecm_map').upsert(out, { onConflict: 'ecm' }); if (error) throw error; }
    say('Aplicando supervisores a todas las bases…');
    const { data: prop, error: e2 } = await sb.rpc('ecm_propagar'); if (e2) throw e2;
    return { tp: 'ecm', filas: rows.length - desc, descartadas: desc, nuevas: nuevos, actualizadas: actualizados, iguales: rows.length - desc - nuevos - actualizados, propagado: prop };
  }

  /* ---------- enlaces de fotos de Involves: ECM + código + día; si no coincide, por parecido de nombre ---------- */
  async function cargarEnlaces(rows, say) {
    const F = ['FOTOANTES', 'FOTOSDESPUES', 'FOTODEEFECTIVIDADDEVISITA', 'FOTODECHECKINAMENOSDE20METROS', 'FOTODEFINDEVISITAAMENOSDE20METROS'];
    const mp = new Map(); let sin = 0;
    rows.forEach((r) => {
      const e = TXT(r.EMPLEADO), c = TXT(r.PERFILDELPDV).replace(/\.0+$/, ''), d = toISO(r.FECHAYHORADELAENCUESTA); if (!e || !c || !d) { sin++; return; }
      const k = claveEnl(e, c, d); let o = mp.get(k); if (!o) { o = { e, c, d, pdv: TXT(r.PDV), u: F.map(() => []), n: [] }; mp.set(k, o); }
      F.forEach((f, i) => urls(r[f]).forEach((x) => { if (!o.u[i].includes(x)) o.u[i].push(x); })); const nv = TXT(r.NOVEDADESDELPDV); if (nv && !o.n.includes(nv)) o.n.push(nv);
    });
    const lista = [...mp.values()]; if (!lista.length) throw new Error('No encontré filas válidas (Empleado, Perfil del PDV y fecha).');
    const ds = lista.map((x) => x.d).sort();
    say('Buscando las visitas del periodo…');
    const vis = await CN.fetchPar((o) => sb.from('visitas').select('id,ecm,codigo_cliente,fecha,cliente,categoria', o).gte('fecha', ds[0]).lte('fecha', ds[ds.length - 1]).order('id'));
    const idx = {}, efe = {}, porED = {};
    vis.forEach((v) => { const k = claveEnl(v.ecm, v.codigo_cliente, v.fecha); if (v.categoria === 'E') { efe[k] = 1; return; } (idx[k] = idx[k] || []).push(v.id); (porED[claveEnl(v.ecm, '', v.fecha)] = porED[claveEnl(v.ecm, '', v.fecha)] || []).push({ id: v.id, nom: v.cliente || '' }); });
    const res = { tp: 'enl', filas: lista.length, descartadas: sin, coinciden: 0, registros: 0, efectivas: 0, sinMatch: 0, porNombre: 0, ejemplos: [] };
    const filas = {}, solo = {}, pend = [];
    const poner = (f, id, how) => { filas[id] = { visita_id: id, ecm: ecmNorm(f.e), codigo: f.c, fecha: f.d, foto_antes: f.u[0].join('\n'), foto_despues: f.u[1].join('\n'), efectividad: f.u[2].join('\n'), check_in: f.u[3].join('\n'), check_out: f.u[4].join('\n'), novedades: f.n.join(' | ').slice(0, 2000), cargado: new Date().toISOString(), coincidencia: how }; res.registros++; };
    lista.forEach((f) => { const k = claveEnl(f.e, f.c, f.d), ids = idx[k]; if (!ids) { if (efe[k]) res.efectivas++; else pend.push(f); return; } res.coinciden++; ids.forEach((id) => { poner(f, id, 'CODIGO'); solo[id] = 1; }); });
    const usados = {};
    pend.forEach((f) => {
      const c = (porED[claveEnl(f.e, '', f.d)] || []).filter((x) => !solo[x.id] && !usados[x.id]); if (!c.length || !f.pdv) { res.sinMatch++; return; }
      const sc = c.map((x) => ({ x, s: simNom(f.pdv, x.nom) })).sort((p, q) => q.s - p.s);
      if (sc[0].s < UMBRAL || (sc.length > 1 && sc[1].s > sc[0].s - 0.08)) { res.sinMatch++; return; }
      usados[sc[0].x.id] = 1; res.porNombre++; res.coinciden++; poner(f, sc[0].x.id, `NOMBRE ${Math.round(sc[0].s * 100)}% (${f.pdv.slice(0, 60)})`);
      if (res.ejemplos.length < 12) res.ejemplos.push(`${f.pdv} → ${sc[0].x.nom} (${Math.round(sc[0].s * 100)}%)`);
    });
    const out = Object.values(filas);
    for (let i = 0; i < out.length; i += 500) { say(`Guardando enlaces: ${Math.min(i + 500, out.length)} de ${out.length}…`); const { error } = await sb.from('enlaces').upsert(out.slice(i, i + 500), { onConflict: 'visita_id' }); if (error) throw error; }
    return res;
  }

  /* ---------- pantalla ---------- */
  const fN = (n) => (n == null ? '—' : Number(n).toLocaleString('es-EC'));
  let CARGA = [], RES = [];
  function resumenHTML(r) {
    const tr = Object.entries(r.trans || {}); const T = r.tp === 'vis' || r.tp === 'tar' ? CATL[r.tp] : {};
    const L = (k) => (k === 'E' ? 'Efectiva' : T[k] || k);
    if (r.tp === 'enl') return `<p><b>${NOMBRE.enl}</b>: ${fN(r.registros)} visitas no efectivas con enlaces · ${fN(r.coinciden)} filas coinciden (${fN(r.porNombre)} por parecido de nombre) · ${fN(r.efectivas)} eran de visitas efectivas (omitidas) · ${fN(r.sinMatch)} sin visita correspondiente${r.ejemplos.length ? `<br><span class="note">Cruces por nombre: ${esc(r.ejemplos.join(' · '))}</span>` : ''}</p>`;
    if (r.node) return `<div class="nodo" data-n="${RES.indexOf(r)}"><b>${esc(NOMBRE[r.tp])}</b>: </div>`;
    if (r.texto) return `<p><b>${esc(NOMBRE[r.tp] || r.tp)}</b>: ${esc(r.texto)}</p>`;
    return `<p><b>${esc(NOMBRE[r.tp])}</b>${r.desde ? ` (${r.desde} → ${r.hasta})` : ''}: ${fN(r.nuevas)} nuevas · ${fN(r.actualizadas)} actualizadas · ${fN(r.iguales)} sin cambios${r.borradas ? ` · ${fN(r.borradas)} borradas` : ''}${r.descartadas ? ` · ${fN(r.descartadas)} filas omitidas` : ''}
      ${tr.length ? `<br>Cambios de estado: ${tr.map(([k, n]) => { const [a, b] = k.split('>'); return `${fN(n)} de ${L(a)} → ${L(b)}`; }).join(' · ')}` : ''}
      ${r.motivoEfectivas ? `<br>${fN(r.motivoEfectivas)} ya tenían motivo y ahora son efectivas: el motivo se conserva, pero ya no cuenta.` : ''}${r.propagado ? `<br><span class="note">Supervisor aplicado en: ${Object.entries(r.propagado).map(([k, v]) => `${k} ${fN(v)}`).join(' · ')}</span>` : ''}</p>`;
  }
  async function estado() {
    const { data, error } = await sb.rpc('estado_datos'); if (error) throw error;
    const c = {}; (data.cargas || []).forEach((x) => (c[x.tipo] = x.fecha));
    const f = (x) => (x ? new Date(x).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' }) : '—');
    const rg = (o) => (o && o.desde ? `${o.desde} → ${o.hasta}` : '—');
    const rows = [['Visitas', data.vis.filas, rg(data.vis), c.vis], ['Tareas', data.tar.filas, rg(data.tar), c.tar], ['SOS / SOE (caras)', data.share.filas, `${rg(data.share)} · ${fN(data.share.pdv)} PDV`, c.enc],
      ['Espacios ganados', data.gan.filas, rg(data.gan), c.gan], ['Rutero (PDV)', data.rutero, '', c.rut], ['ECM', data.ecm, '', c.ecm], ['Enlaces de fotos', data.enlaces, '', c.enl], ['Metas', data.metas, '', c.meta], ['Justificaciones', data.justif, '', '']];
    return `<div class="card"><h2>Estado de los datos</h2><div class="tw"><table><thead><tr><th>Base</th><th class="n">Registros</th><th>Fechas</th><th>Última carga</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${r[0]}</td><td class="n">${fN(r[1])}</td><td>${esc(r[2])}</td><td>${f(r[3])}</td></tr>`).join('')}</tbody></table></div></div>`;
  }
  let ERRCARGA = null;
  const AYUDA = (m) => (/timeout|statement/i.test(m) ? 'Supabase cortó una consulta por tardar demasiado. Vuelve a intentarlo; si pasa de nuevo, sube el archivo en partes más pequeñas.' : /memory|allocation|Invalid (string|array)|Maximum call/i.test(m) ? 'El navegador se quedó sin memoria al leer el archivo. Cierra otras pestañas, recarga con Ctrl+F5 y vuelve a intentarlo; si persiste, guarda el Excel en partes más pequeñas.' : /row-level security|permission|42501|policy/i.test(m) ? 'Tu usuario no tiene permiso para guardar estos datos. Solo el administrador puede cargar bases.' : /JWT|401|expired/i.test(m) ? 'Tu sesión venció. Cierra sesión y vuelve a entrar.' : /fetch|network|Failed to fetch|NetworkError/i.test(m) ? 'Se cortó la conexión con Supabase. Revisa tu internet y vuelve a intentarlo.' : '');
  async function pintar() {
    const m = $('#main');
    const lista = CARGA.map((c, i) => c.err ? `<div class="card" style="border-color:var(--bad)">${esc(c.err)}</div>` :
      `<div class="card"><div class="bar" style="margin:0"><h3 style="flex:1">${NOMBRE[c.tp]} · ${esc(c.file.name)}</h3><button data-q="${i}">Quitar</button></div><p class="note">${fN(c.rows.length)} filas${c.falta.length ? `<br><b style="color:var(--bad)">Faltan columnas (quedarán vacías): ${esc(c.falta.join(', '))}</b>` : ''}</p></div>`).join('');
    const hayVT = CARGA.some((c) => c.tp === 'vis' || c.tp === 'tar');
    m.innerHTML = `<div id="est">Cargando estado…</div>
    ${ERRCARGA ? `<div class="card" role="alert" style="border-left:4px solid var(--bad)"><h3 style="color:var(--bad)">La carga se detuvo${ERRCARGA.paso ? ' en: ' + esc(ERRCARGA.paso) : ''}</h3><p>${esc(ERRCARGA.msg)}</p>${ERRCARGA.ayuda ? `<p class="note">${esc(ERRCARGA.ayuda)}</p>` : ''}<p class="note">Lo ya guardado queda guardado. Puedes volver a subir el mismo archivo: el modo «Actualizar» no duplica filas.</p></div>` : ''}
    ${RES.length ? `<div class="card" style="border-left:4px solid var(--ok)"><h3>Resultado de la última carga</h3>${RES.map(resumenHTML).join('')}</div>` : ''}
    <div class="card"><h2>Cargar archivos</h2><p class="note">Sube uno o varios Excel a la vez: la plataforma reconoce cada uno por sus encabezados (visitas, tareas, rutero, ECM, enlaces de fotos, espacios ganados, encuestas SOS/SOE o metas) y los carga en el orden correcto.</p>
      <div class="bar"><input type="file" id="fl" aria-label="Elegir archivos de Excel o CSV para cargar" accept=".xlsx,.xls,.csv" multiple></div><div id="lista">${lista}</div>
      ${CARGA.some((c) => !c.err) ? `<div class="bar">${CARGA.some((c) => !c.err && c.tp === 'rut') ? `<label>Estado de los PDV al subir el rutero<select id="crut"><option value="auto">Normal: solo agrega y actualiza; respeta la columna Estado/Activo si el archivo la trae</option><option value="completo">Rutero completo: los PDV que no vienen pasan a inactivos y los que vienen a activos</option></select></label>` : ''}${hayVT ? `<label>Cómo cargar visitas y tareas<select id="cmod"><option value="actualizar">Actualizar cambios: edita lo que cambió y agrega lo nuevo (recomendado)</option><option value="rango">Reemplazar las fechas que trae el archivo (borra y vuelve a escribir)</option><option value="todo">Reemplazar toda la base</option></select></label>` : '<span class="note">Se actualiza por código (rutero) o por ECM (nombres y teléfonos); no se borra nada.</span>'}<button class="pri" id="go">Cargar ${CARGA.filter((c) => !c.err).length} archivo(s)</button></div>` : ''}
      <p class="note" id="msg"></p></div>
    <div class="card"><h3>Mantenimiento</h3><div class="bar" style="margin:0"><button id="sync">Completar ECM desde las bases</button><button id="prop">Aplicar supervisores de ECM a todas las bases</button></div><p class="note">«Completar» agrega a la tabla ECM los que aparecen en las bases (con el supervisor que traigan, si no tienen uno). «Aplicar» hace que la tabla ECM mande sobre el supervisor de cada archivo.</p></div>`;
    document.querySelectorAll('.nodo').forEach((d) => { const r = RES[+d.dataset.n]; if (r && r.node) d.appendChild(r.node); });
    $('#est').outerHTML = '<div id="est"></div>'; estado().then((h) => { const e = $('#est'); if (e) e.innerHTML = h; }).catch(fail);
    $('#fl').onchange = async (ev) => {
      CARGA = []; RES = []; for (const f of ev.target.files) { try { const a = await leerArchivo(f); a.falta = (FALTAN[a.tp] || []).filter((c) => !a.keys.includes(key(c))); CARGA.push(a); } catch (e) { console.error('No se pudo leer', f.name, e); CARGA.push({ err: f.name + ': ' + e.message + (AYUDA(String(e.message)) ? ' — ' + AYUDA(String(e.message)) : '') }); } } ERRCARGA = null; pintar();
    };
    document.querySelectorAll('[data-q]').forEach((b) => b.onclick = () => { CARGA.splice(+b.dataset.q, 1); pintar(); });
    $('#sync').onclick = async () => { const { data, error } = await sb.rpc('ecm_sync'); error ? fail(error) : toast(`ECM completados: ${data}`); };
    $('#prop').onclick = async () => { const { data, error } = await sb.rpc('ecm_propagar'); error ? fail(error) : toast('Supervisores aplicados: ' + Object.entries(data).map(([k, v]) => `${k} ${v}`).join(' · ')); };
    const go = $('#go'); if (go) go.onclick = ejecutar;
  }
  async function ejecutar() {
    const modo = ($('#cmod') || {}).value || 'actualizar'; const go = $('#go'), msg = $('#msg'), say = (t) => (msg.textContent = t);
    if (modo === 'todo' && !confirm('Se borrará toda la base actual de visitas/tareas cargadas y se reemplazará. Las justificaciones se conservan. ¿Continuar?')) return;
    go.disabled = true; RES = []; ERRCARGA = null; let paso = '';
    const L = CARGA.filter((c) => !c.err), orden = ['ecm', 'rut', 'vis', 'tar', 'enl', 'gan', 'enc', 'meta'];
    try {
      const cfg = (await sb.from('config').select('*')).data || []; S.cfg = Object.fromEntries(cfg.map((r) => [r.clave, r.valor]));
      let A = await apoyo();
      for (const tp of orden) for (const c of L.filter((x) => x.tp === tp)) {
        paso = `${NOMBRE[tp]} · ${c.file.name}`; say(`Procesando ${paso}…`); let r;
        if (tp === 'ecm') { r = await cargarEcm(c.rows, say); A = await apoyo(); }
        else if (tp === 'rut') { r = await cargarRutero(c.rows, say, ($('#crut') || {}).value || 'auto'); A = await apoyo(); }
        else if (tp === 'vis') r = await cargarVT('vis', c.rows, modo, say, A);
        else if (tp === 'tar') {
          let re; try { re = new RegExp(S.cfg.frio_regex || 'FRIO|EQUIPO'); } catch (e) { re = /FRIO|EQUIPO/; }
          const cods = [...new Set(c.rows.map((x) => TXT(g(x, 'CodigoCliente'))).filter((x) => x && !(A.R[x] && A.R[x].region)))], regCli = {};
          for (const part of chunks(cods, 400)) { const { data } = await sb.rpc('regiones_clientes', { p_codigos: part }); (data || []).forEach((x) => (regCli[x.codigo] = x.region)); }
          r = await cargarVT('tar', c.rows, modo, say, A, { re, regCli });
        }
        else if (tp === 'enl') r = await cargarEnlaces(c.rows, say);
        else if (tp === 'gan' || tp === 'enc') { const o = document.createElement('div'); await (tp === 'gan' ? CARGAS.ganancias : CARGAS.encuesta).run(c.file, o); r = { tp, node: o, filas: null }; }
        else if (tp === 'meta') { if (!window.CN.cargarMetas) throw new Error('El módulo de metas no está disponible.'); r = await window.CN.cargarMetas(c.rows, say); }
        RES.push(r); if (r.estadoTxt) { const o = document.createElement('div'); o.textContent = r.estadoTxt; RES.push({ tp: 'pdv', node: o, filas: null }); }
        await sb.from('cargas').insert({ tipo: tp === 'enc' ? 'enc' : tp, modo: tp === 'vis' || tp === 'tar' ? modo : null, archivo: c.file.name.slice(0, 200), filas: r.filas || null, nuevas: r.nuevas || null, actualizadas: r.actualizadas || null, iguales: r.iguales || null, borradas: r.borradas || null, detalle: { trans: r.trans || null, motivoEfectivas: r.motivoEfectivas || null } });
      }
      if (L.some((x) => ['rut', 'vis', 'tar', 'enc', 'gan'].includes(x.tp))) { /* el estado de los PDV sigue a los datos que se suben */
        say('Actualizando PDV activos / inactivos…'); const o = document.createElement('div');
        try { const { data, error } = await sb.rpc('pdv_recalcular_estado'); if (error) throw error;
          o.textContent = data && data.ok === false ? 'Sin datos para calcular.' : !data.historial_suficiente ? `Aún no hay ${data.semanas} semanas de datos para decidir; ningún PDV cambió.` : `${data.desactivados} desactivados (sin datos en ${data.semanas} semanas) · ${data.reactivados} reactivados.`;
        } catch (e) { o.textContent = 'No se pudo actualizar (' + String((e && e.message) || e).slice(0, 120) + '). Puedes hacerlo en Rutero y ubicación → «Recalcular estado».'; }
        RES.push({ tp: 'pdv', node: o, filas: null }); if (CN.PLAN && CN.PLAN.invalidar) CN.PLAN.invalidar();
      }
      CARGA = []; if (CN.invalidarAnalisis) CN.invalidarAnalisis(); if (CN.invalidarShare) CN.invalidarShare(); toast('Carga terminada');
    } catch (e) { console.error('Carga detenida en:', paso, e); const msg2 = String((e && (e.message || e.details || e.hint)) || e); ERRCARGA = { paso, msg: msg2 + (e && e.code ? ' (código ' + e.code + ')' : ''), ayuda: AYUDA(msg2 + ' ' + (e && e.code || '')) }; } finally { pintar(); }
  }
  VIEWS.carga = async function () { await pintar(); };
})();

/* ---------- Equipo ECM: tabla editable (nombre, teléfono, supervisor) ---------- */
(function () {
  NAV.ecm = ['Equipo ECM', ['admin', 'gerencia']];
  const t = { carga: NAV.carga, admin: NAV.admin }; delete NAV.carga; delete NAV.admin; NAV.carga = t.carga; NAV.admin = t.admin;
  VIEWS.ecm = async function () {
    const m = $('#main'); let q = '';
    const draw = async () => {
      const { data, error } = await sb.from('ecm_map').select('*').order('ecm'); if (error) throw error;
      const f = norm(q), L = (data || []).filter((x) => !f || norm(`${x.ecm} ${x.nombre} ${x.supervisor}`).includes(f)), sinSup = (data || []).filter((x) => !(x.supervisor || '').trim()).length;
      m.innerHTML = `<div class="fbar"><label>Buscar<input id="e_q" value="${esc(q)}" placeholder="ECM, nombre o supervisor"></label><button id="e_sync">Completar desde las bases</button><button id="e_prop" class="pri">Aplicar supervisores a todas las bases</button><button id="e_new">Agregar ECM</button><button id="e_tpl" title="Descarga la plantilla de Excel con los ECM actuales para editarlos y volver a subirlos">Plantilla Excel</button></div>
        <div class="card"><h2>Equipo ECM</h2><p class="note">${(data || []).length} ECM · ${sinSup} sin supervisor. El supervisor de esta tabla manda sobre el que traigan los archivos. Después de editar, pulsa «Aplicar» para actualizar las bases ya cargadas.</p>
        <div class="tw"><table><thead><tr><th>ECM</th><th>Nombre</th><th>Teléfono</th><th>Supervisor</th><th>Origen</th><th></th></tr></thead><tbody>${L.map((x) => `<tr><td>${esc(x.ecm)}</td>
          <td><input aria-label="Nombre de ${esc(x.ecm)}" data-e="${esc(x.ecm)}" data-f="nombre" value="${esc(x.nombre || '')}" style="min-width:160px"></td><td><input aria-label="Teléfono de ${esc(x.ecm)}" data-e="${esc(x.ecm)}" data-f="telefono" value="${esc(x.telefono || '')}" style="width:130px" inputmode="tel"></td>
          <td><input aria-label="Supervisor de ${esc(x.ecm)}" data-e="${esc(x.ecm)}" data-f="supervisor" value="${esc(x.supervisor || '')}" style="min-width:180px"></td><td><span class="pill ${x.origen === 'auto' ? 'F' : 'E'}">${esc(x.origen || 'manual')}</span></td><td><button class="bad" data-x="${esc(x.ecm)}">Quitar</button></td></tr>`).join('') || '<tr><td colspan="6" class="note">Sin ECM. Súbelos en «Cargar bases» o pulsa «Completar desde las bases».</td></tr>'}</tbody></table></div></div>`;
      $('#e_q').oninput = (ev) => { q = ev.target.value; clearTimeout(draw.t); draw.t = setTimeout(() => draw().catch(fail), 350); };
      $('#e_sync').onclick = async () => { const { data: n, error: e } = await sb.rpc('ecm_sync'); e ? fail(e) : (toast(`ECM completados: ${n}`), draw().catch(fail)); };
      $('#e_prop').onclick = async () => { const { data: r, error: e } = await sb.rpc('ecm_propagar'); e ? fail(e) : toast('Supervisores aplicados: ' + Object.entries(r).map(([k, v]) => `${k} ${v}`).join(' · ')); };
      $('#e_tpl').onclick = () => { const A = [['ECM', 'NOMBRE', 'TELEFONO', 'SUPERVISOR'], ...(data || []).map((x) => [x.ecm, x.nombre || '', x.telefono || '', x.supervisor || ''])], ws = XLSX.utils.aoa_to_sheet(A);
        for (let k = 1; k < A.length; k++) { const c3 = ws['C' + (k + 1)]; if (c3) { c3.t = 's'; c3.z = '@'; } else ws['C' + (k + 1)] = { t: 's', v: '', z: '@' }; } ws['!cols'] = [{ wch: 12 }, { wch: 34 }, { wch: 16 }, { wch: 28 }];
        const ins = XLSX.utils.aoa_to_sheet([['Cómo llenar esta plantilla'], [''], ['1. Hoja ECM: una fila por ECM (mercaderista). No cambies los encabezados: ECM, NOMBRE, TELEFONO, SUPERVISOR.'], ['2. Puedes agregar ECM nuevos al final: si el código no existe se crea; si ya existe se sustituyen sus datos.'], ['3. Una celda vacía no borra lo que ya está guardado.'], ['4. TELEFONO: escríbelo como texto (con el 0 inicial). SUPERVISOR es opcional; si lo llenas, ese ECM se asigna a ese supervisor.'], ['5. Guarda el archivo y súbelo en «Cargar bases»: el sistema lo reconoce solo.']]); ins['!cols'] = [{ wch: 110 }];
        const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'ECM'); XLSX.utils.book_append_sheet(wb, ins, 'Instrucciones'); XLSX.writeFile(wb, 'Plantilla_ECM.xlsx'); };
      if (!CN.puede('ecm')) { ['#e_sync', '#e_prop', '#e_new', '#e_tpl'].forEach((q2) => { const b = $(q2); if (b) b.remove(); }); m.querySelectorAll('table input, table select, table button').forEach((el) => (el.disabled = true)); }
      if ($('#e_new')) $('#e_new').onclick = async () => { const e = ecmNorm(prompt('Código del ECM (ej. ECM031):') || ''); if (!/^[A-Z0-9_-]{2,20}$/.test(e)) return; const { error: er } = await sb.from('ecm_map').upsert({ ecm: e, origen: 'manual' }, { onConflict: 'ecm' }); er ? fail(er) : draw().catch(fail); };
      document.querySelectorAll('[data-e]').forEach((i) => (i.onchange = async () => {
        let v = i.value.trim(); if (i.dataset.f === 'supervisor') v = v.replace(/\s+/g, ' ').toUpperCase();
        const row = { [i.dataset.f]: v }; if (i.dataset.f === 'supervisor') row.origen = 'manual';
        const { error: er } = await sb.from('ecm_map').update(row).eq('ecm', i.dataset.e); er ? fail(er) : toast('Guardado (recuerda «Aplicar» si cambiaste el supervisor)');
      }));
      document.querySelectorAll('[data-x]').forEach((b) => (b.onclick = async () => { if (!confirm('¿Quitar este ECM de la tabla?')) return; const { error: er } = await sb.from('ecm_map').delete().eq('ecm', b.dataset.x); er ? fail(er) : draw().catch(fail); }));
    };
    await draw();
  };
})();
