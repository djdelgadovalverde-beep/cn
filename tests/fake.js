// Supabase simulado en memoria para probar la interfaz sin red.
(function () {
  const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const day = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
  const SUPS = ['ANA PEREZ', 'LUIS MORA', 'EVA RUIZ'], ECMS = []; SUPS.forEach((s, i) => { for (let j = 1; j <= 4; j++) ECMS.push({ ecm: 'ECM' + String(i * 4 + j).padStart(3, '0'), sup: s }); });
  const DB = { roles: [{ clave: 'admin', nombre: 'Administrador', base: 'admin', ver: ['dashboard','visitas','tareas','sos','audit','ganancias','metas','registro','pend','informe','rutero','ecm','catalogo','carga','config','admin'], editar: ['carga','ecm','catalogo','metas','justificar','revisar','sos_editar','ganancias'], sistema: true }, { clave: 'gerencia', nombre: 'Gerencia', base: 'gerencia', ver: ['dashboard','visitas','tareas','sos','audit','ganancias','metas','registro','pend','informe','rutero','ecm'], editar: ['ecm','metas','justificar','revisar','sos_editar','ganancias'], sistema: true }, { clave: 'supervisor', nombre: 'Supervisor', base: 'supervisor', ver: ['dashboard','visitas','tareas','sos','audit','ganancias','metas','registro','pend','informe','rutero'], editar: ['justificar','revisar','sos_editar','ganancias'], sistema: true }, { clave: 'asesor', nombre: 'Mercaderista', base: 'asesor', ver: ['dashboard','visitas','tareas','sos','ganancias','metas','registro','rutero'], editar: ['justificar','ganancias'], sistema: true }], config: [], motivos: [], profiles: [], ecm_map: [], rutero: [], visitas: [], tareas: [], justificaciones: [], evidencias: [], share_detalle: [], ganancias: [], metas: [], bitacora: [], catalogo_share: [], ubicaciones: [], enlaces: [], cargas: [] };
  const cfg = { w_vis: 20, w_tar: 30, w_frio: 30, w_sos: 10, w_soe: 10, meta_sos: 0.8, meta_soe: 0.8, frio_regex: 'FRIO|EQUIPO', titulo: 'CN · Desempeño', semana_inicio: 3, excluir_pdv: '14019915', meta_vis: 0.9, meta_tar: 0.9, meta_frio: 0.9, rei_min: 2 };
  DB.config = Object.entries(cfg).map(([clave, valor]) => ({ clave, valor: String(valor) }));
  DB.motivos = [{ id: 1, tipo: 'ambos', motivo: 'Cliente cerrado', responsable: 'CN', activo: true, excluye_adicional: false }, { id: 2, tipo: 'ambos', motivo: 'Falta de tiempo', responsable: 'SGF', activo: true, excluye_adicional: true }, { id: 3, tipo: 'vis', motivo: 'Falla GPS', responsable: 'CN', activo: true }];
  DB.profiles = [{ id: 'u1', usuario: 'admin', nombre: 'Administrador', rol: 'admin', activo: true, ecm_code: null, supervisor: null }];
  DB.ecm_map = ECMS.map((e) => ({ ecm: e.ecm, nombre: 'Nombre ' + e.ecm, telefono: '0991234567', supervisor: e.sup, origen: 'manual', activo: true }));
  const cads = ['TIA', 'SUPERMAXI', 'MI COMISARIATO', 'TIENDA'], regs = ['SIERRA', 'COSTA'];
  const PDV = []; for (let i = 0; i < 60; i++) { const e = ECMS[i % ECMS.length]; PDV.push({ codigo: String(1000 + i), pdv: 'LOCAL ' + (1000 + i), region: regs[i % 2], cadena: cads[i % 4], ciudad: 'QUITO', supervisor: e.sup, ecm: e.ecm, dia_visita: 'LUNES' }); }
  DB.rutero = PDV; DB.rutero.forEach((r, i) => { r.activo = i % 5 !== 0; r.estado_manual = i % 10 === 0; r.ult_dato = '2026-11-15'; r.inactivo_desde = r.activo ? null : '2026-10-20'; });
  let id = 0;
  for (let d = 0; d < 40; d++) { const f = day(d); ECMS.forEach((e) => { for (let k = 0; k < 4; k++) { const p = pick(PDV), r = rnd(), c = r < 0.62 ? 'E' : r < 0.78 ? 'P' : r < 0.9 ? 'F' : 'M';
    DB.visitas.push({ id: 'V|' + f + '|' + p.codigo + '|' + e.ecm + '#' + ++id, fecha: f, region: p.region, gerencia: 'GV1', supervisor: e.sup, ecm: e.ecm, codigo_cliente: p.codigo, cliente: p.pdv, estado: 'X', categoria: c, programadas: 1, detalle: { min: c === 'M' ? 1 : Math.round(rnd() * 50), justificacion: 'SIN JUSTIFICACIÓN' } });
    if (rnd() < 0.55) { const t = rnd(), tc = t < 0.6 ? 'E' : t < 0.75 ? 'M' : t < 0.88 ? 'P' : 'F', pil = pick(['EXHIBICION', 'EQUIPO DE FRIO', 'PRECIOS']);
      DB.tareas.push({ id: 'T|' + f + '|' + p.codigo + '|' + ++id, fecha: f, region: p.region, supervisor: e.sup, ecm: e.ecm, codigo_cliente: p.codigo, cliente: p.pdv, pilar: pil, descripcion: 'Tarea ' + pil, estado: 'FINISHED', resultado: 'VALID', categoria: tc, es_frio: /FRIO/.test(pil), detalle: { gps: 1 } }); } } }); }
  DB.visitas.filter((v) => v.categoria !== 'E').slice(0, 300).forEach((v, i) => DB.justificaciones.push({ id: 'j' + i, tipo: 'vis', registro_id: v.id, fecha: v.fecha, ecm: v.ecm, supervisor: v.supervisor, motivo: i % 3 ? 'Cliente cerrado' : 'Falta de tiempo', responsable: i % 3 ? 'CN' : 'ASESOR', observacion: i % 2 ? 'Local cerrado por feriado' : '', estado: ['pendiente', 'aprobada', 'rectificada'][i % 3], creado_en: new Date().toISOString() }));
  const marcas = [['CN', 'PILSENER'], ['CN', 'CLUB'], ['HNK', 'HEINEKEN'], ['MERC', 'PRIMA']];
  for (let w = 0; w < 6; w++) PDV.forEach((p, i) => { const f = day(w * 7 + (i % 4)); [['PERCHA', 3], ['RUMA', 1], ['BANDEJA FRÍO', 1]].forEach(([t]) => marcas.forEach(([g, m]) => DB.share_detalle.push({ id: DB.share_detalle.length + 1, fecha: f, codigo: p.codigo, pdv: p.pdv, ecm: p.ecm, supervisor: p.supervisor, tipo: t, grupo: g, marca: m, sku: m + ' LATA', caras: 1 + Math.floor(rnd() * 8) }))); });
  for (let d = 0; d < 20; d++) PDV.slice(0, 10).forEach((p, i) => DB.ganancias.push({ id: DB.ganancias.length + 1, fecha: day(d), codigo: p.codigo, pdv: p.pdv, cadena: p.cadena, ecm: p.ecm, supervisor: p.supervisor, percha: 2, frio: 1, seco: 0, ruma: 1, observacion: '', fuente: 'archivo' }));
  const mes = new Date().toISOString().slice(0, 7); const base = { ambito: 'grupo', clave: '', tipo: '', responsable: 'ERWIN', regiones: '', cadenas: '', supervisores: '', ecms: '', pdvs: '', excluir: '', base: 'grupo' }; DB.metas = [{ ...base, id: 1, nombre: 'GANADAS TOTAL', mes, modo: 'ganadas', valor: 900, tipos: '' }, { ...base, id: 2, nombre: 'PERCHAS TIA', mes: '2026-W46', modo: 'share', valor: 0.7, tipos: 'PERCHA', cadenas: 'TIA' }, { ...base, id: 3, nombre: '% PENETRACION RUMAS', mes: '2026-W46', modo: 'penetracion', valor: 0.4, tipos: 'RUMA' }, { ...base, id: 4, nombre: 'FRIO TIA', mes: '2026-W46', modo: 'caras_total', valor: 500, tipos: 'BANDEJA FRÍO', cadenas: 'TIA' }];
  if (!window.__BIENVENIDA) { try { localStorage.setItem('cn_ayuda_admin', '1'); localStorage.setItem('cn_ayuda_x', '1'); } catch (e) { } }
  DB.accesos = [{ id: 1, usuario: 'u1', fecha: new Date().toISOString(), evento: 'login', vista: null, agente: 'Mozilla/5.0 Chrome/120 Safari/537' }, { id: 2, usuario: 'u1', fecha: new Date().toISOString(), evento: 'pantalla', vista: 'visitas', agente: 'Mozilla/5.0 Android Chrome/120' }];
  DB.bitacora = [{ id: 1, fecha: new Date().toISOString(), usuario: 'u1', tabla: 'justificaciones', accion: 'UPDATE', anterior: { motivo: 'a' }, nuevo: { motivo: 'b' } }];
  if (window.__ROL) DB.profiles[0] = { id: 'u1', usuario: 'x', nombre: 'Usuario Prueba', rol: window.__ROL, activo: true, ecm_code: 'ECM001', supervisor: 'ANA PEREZ' }; DB.reglas_sugerencia = [{ id: 1, palabra: 'GEOLOCALIZ', motivo: 'PDV MAL GEOLOCALIZADO' }];
  DB.motivos.push({ id: 9, tipo: 'ambos', motivo: 'PDV MAL GEOLOCALIZADO', responsable: 'CN', activo: true, excluye_adicional: false });
  { const base = { region: 'SIERRA', gerencia: 'GV1', supervisor: 'ANA PEREZ', ecm: 'ECM001', codigo_cliente: '9999', cliente: 'LOCAL REINCIDENTE', estado: 'X', categoria: 'P', programadas: 1, detalle: { min: 0, justificacion: 'SIN JUSTIFICACIÓN' } };
    const d1 = new Date(); d1.setUTCDate(d1.getUTCDate() - 8); const d2 = new Date(); d2.setUTCDate(d2.getUTCDate() - 1), s1 = d1.toISOString().slice(0, 10), s2 = d2.toISOString().slice(0, 10);
    DB.visitas.push({ ...base, id: 'V|' + s1 + '|9999|ECM001', fecha: s1 }, { ...base, id: 'V|' + s2 + '|9999|ECM001', fecha: s2 });
    DB.justificaciones.push({ id: 'jrei', tipo: 'vis', registro_id: 'V|' + s1 + '|9999|ECM001', fecha: s1, ecm: 'ECM001', supervisor: 'ANA PEREZ', motivo: 'Cliente cerrado', responsable: 'CN', observacion: 'Local cerrado por duelo', estado: 'aprobada', creado_en: new Date().toISOString() }); }
  DB.gestion = []; DB.evidencias = []; DB.ubicaciones = [];
  { const nv = DB.visitas.filter((v) => v.categoria !== 'E' && !DB.justificaciones.some((j) => j.registro_id === v.id)); nv.slice(0, 3).forEach((v) => (v.detalle.justificacion = 'PDV MAL GEOLOCALIZADO SEGUN BDR'));
    DB.enlaces = nv.slice(3, 6).map((v) => ({ visita_id: v.id, ecm: v.ecm, codigo: v.codigo_cliente, fecha: v.fecha, foto_antes: 'https://f/a.jpg', foto_despues: 'https://f/d1.jpg\nhttps://f/d2.jpg', efectividad: 'https://f/e.jpg', check_in: '', check_out: '', novedades: 'Local cerrado', coincidencia: 'CODIGO' })); }
  window.__DB = DB;

  const same = (a, b) => String(a) === String(b);
  class Q {
    constructor(t) { this.t = t; this.f = []; this.op = 'select'; this.o = null; this.lim = null; this.rg = null; this.cnt = false; }
    select(c, o) { this.op = this.op === 'select' ? 'select' : this.op; this.cnt = !!(o && o.count); return this; }
    eq(k, v) { this.f.push((r) => same(r[k], v)); return this; } neq(k, v) { this.f.push((r) => !same(r[k], v)); return this; }
    gte(k, v) { this.f.push((r) => r[k] >= v); return this; } lte(k, v) { this.f.push((r) => r[k] <= v); return this; }
    in(k, a) { this.f.push((r) => a.map(String).includes(String(r[k]))); return this; }
    or(s) { const ps = s.split(',').map((x) => x.split('.')); this.f.push((r) => ps.some(([k, op, v]) => String(r[k] || '').toLowerCase().includes(String(v).replace(/%/g, '').toLowerCase()))); return this; }
    order(k, o) { this.o = [k, !(o && o.ascending === false)]; return this; } limit(n) { this.lim = n; return this; } range(a, b) { this.rg = [a, b]; return this; }
    maybeSingle() { this.one = true; return this; } single() { this.one = true; return this; }
    insert(v) { this.op = 'insert'; this.v = v; return this; } upsert(v, o) { this.op = 'upsert'; this.v = v; this.oc = o; return this; } update(v) { this.op = 'update'; this.v = v; return this; } delete() { this.op = 'delete'; return this; }
    then(res, rej) { try { res(this.run()); } catch (e) { (rej || res)({ data: null, error: { message: e.message } }); } }
    run() {
      const T = DB[this.t] || (DB[this.t] = []); const m = (r) => this.f.every((f) => f(r));
      if (this.op === 'insert') { [].concat(this.v).forEach((x) => T.push({ id: 'n' + Math.random(), ...x })); return { data: null, error: null }; }
      if (this.op === 'upsert') { const ks = (this.oc && this.oc.onConflict || 'id').split(','); [].concat(this.v).forEach((x) => { const i = ks[0] === 'clave_uk' ? T.findIndex((r) => r.nombre === x.nombre && r.mes === x.mes && r.modo === x.modo) : T.findIndex((r) => ks.every((k) => same(r[k], x[k]))); if (i >= 0) Object.assign(T[i], x); else T.push({ id: T.length + 1, ...x }); }); return { data: null, error: null }; }
      if (this.op === 'update') { T.filter(m).forEach((r) => Object.assign(r, this.v)); return { data: null, error: null }; }
      if (this.op === 'delete') { const n = T.length; DB[this.t] = T.filter((r) => !m(r)); return { data: null, error: null, count: n - DB[this.t].length }; }
      let r = T.filter(m); if (this.o) { const [k, a] = this.o; r = r.slice().sort((x, y) => (x[k] > y[k] ? 1 : x[k] < y[k] ? -1 : 0) * (a ? 1 : -1)); } const total = r.length;
      if (this.rg) r = r.slice(this.rg[0], this.rg[1] + 1); if (this.lim) r = r.slice(0, this.lim); if (this.one) return { data: r[0] || null, error: null };
      return { data: r, error: null, count: this.cnt ? total : null };
    }
  }
  const weekStart = (iso, wsd) => { const d = new Date(iso + 'T00:00:00Z'), o = (d.getUTCDay() - wsd + 7) % 7; d.setUTCDate(d.getUTCDate() - o); return d.toISOString().slice(0, 10); };
  const RPC = {
    pdv_recalcular_estado: () => ({ ok: true, desactivados: 2, reactivados: 1, corte: '2026-10-28', referencia: '2026-11-18', historial_suficiente: true, semanas: 3 }),
    admin_actividad: () => DB.profiles.map((p) => ({ usuario: p.id, ult_acceso: new Date().toISOString(), accesos: 3, dias_activos: 2, pantallas: 9, cambios: 1, ult_cambio: new Date().toISOString() })),
    plan_pdv_tipo: (a) => { const m = {}, wsd = 3; DB.share_detalle.filter((r) => r.fecha >= a.p_desde && r.fecha <= a.p_hasta && r.grupo !== 'EXCLUIR').forEach((r) => { const d = new Date(r.fecha + 'T00:00:00Z'), sem = new Date(d - ((d.getUTCDay() - wsd + 7) % 7) * 864e5).toISOString().slice(0, 10), k = r.codigo + '|' + sem + '|' + r.tipo, o = (m[k] ||= [r.codigo, sem, r.tipo, 0, 0]); o[3] += r.caras; if (r.grupo === 'CN') o[4] += r.caras; }); return Object.values(m); },
    share_pdv_sem: (a) => { const rt = Object.fromEntries(DB.rutero.map((r) => [r.codigo, r])), m = {}; const wsd = 3;
      DB.share_detalle.filter((r) => r.fecha >= a.p_desde && r.fecha <= a.p_hasta && r.grupo !== 'EXCLUIR').forEach((r) => { const d = new Date(r.fecha + 'T00:00:00Z'), sem = new Date(d - (((d.getUTCDay() - wsd + 7) % 7)) * 864e5).toISOString().slice(0, 10), isp = r.tipo === 'PERCHA', k = r.codigo + '|' + sem + '|' + isp, o = (m[k] ||= [r.codigo, sem, isp, 0, 0, r.pdv, (rt[r.codigo] || {}).cadena, (rt[r.codigo] || {}).region, (r.supervisor || '').toUpperCase(), (r.ecm || '').toUpperCase()]); o[3] += r.caras; if (r.grupo === 'CN') o[4] += r.caras; });
      return Object.values(m); },
    vt_opts: (a) => { const rows = a.p_tipo === 'vis' ? DB.visitas : DB.tareas, m = {}; rows.filter((r) => r.fecha >= a.p_desde && r.fecha <= a.p_hasta).forEach((r) => { const o = { reg: r.region || '—', ger: a.p_tipo === 'vis' ? (r.gerencia || '—') : '—', sup: r.supervisor || '—', ecm: r.ecm }; m[JSON.stringify(o)] = o; }); return Object.values(m); },
    estado_datos: () => ({ vis: { filas: DB.visitas.length, desde: day(39), hasta: day(0) }, tar: { filas: DB.tareas.length, desde: day(39), hasta: day(0) }, sos: { filas: DB.share_detalle.filter((r) => r.tipo === 'PERCHA').length, desde: day(39), hasta: day(0), pdv: 60 }, soe: { filas: DB.share_detalle.filter((r) => r.tipo !== 'PERCHA').length, desde: day(39), hasta: day(0), pdv: 60 }, share: { filas: DB.share_detalle.length, desde: day(40), hasta: day(0), pdv: 60 }, gan: { filas: DB.ganancias.length }, rutero: 60, ecm: 12, metas: 2, enlaces: 0, justif: DB.justificaciones.length, cargas: [] }),
    share_opts: () => ({ region: regs, cadena: cads, supervisor: SUPS, ecm: ECMS.map((e) => e.ecm), desde: day(40), hasta: day(0) }),
    share_ultima_fecha: (a) => { const m = {}; DB.share_detalle.filter((r) => a.p_codigos.includes(r.codigo) && r.fecha >= a.p_desde && r.fecha <= a.p_hasta && a.p_tipos.includes(r.tipo)).forEach((r) => { if (!m[r.codigo] || r.fecha > m[r.codigo]) m[r.codigo] = r.fecha; }); return Object.entries(m).map(([codigo, fecha]) => ({ codigo, fecha })); },
    recalcular_frio: () => 7,
    regiones_clientes: () => [], ecm_sync: () => 0, ecm_propagar: () => ({ visitas: 0 }),
    score_ecm: (a) => ECMS.map((e) => { const v = DB.visitas.filter((x) => x.ecm === e.ecm && x.fecha >= a.p_desde && x.fecha <= a.p_hasta), ef = v.filter((x) => x.categoria === 'E').length; return { ecm: e.ecm, nombre: 'Nombre ' + e.ecm, supervisor: e.sup, vis_prog: v.length, vis_efec: ef, vis_just: 3, vis_pct: v.length ? ef / v.length : null, tar_prog: 10, tar_efec: 6, tar_just: 1, tar_pct: 0.7, frio_prog: 4, frio_efec: 2, frio_just: 0, frio_pct: 0.5, sos_pct: 0.7, soe_pct: 0.6, score: 66.5, meta_sos_ecm: 0.68, meta_soe_ecm: 0.9 }; }),
    share_agg: (a) => { const wsd = 3, g = {}; DB.share_detalle.filter((r) => r.fecha >= a.p_desde && r.fecha <= a.p_hasta && (!a.p_supervisor || a.p_supervisor.includes(r.supervisor.toUpperCase())) && (!a.p_ecm || a.p_ecm.includes(r.ecm)) && (!a.p_pdv || a.p_pdv.includes(r.codigo))).forEach((r) => { const rt = PDV.find((p) => p.codigo === r.codigo) || {}; if (a.p_region && !a.p_region.includes(rt.region)) return; if (a.p_cadena && !a.p_cadena.includes(rt.cadena)) return;
      const dim = { ecm: r.ecm, supervisor: r.supervisor.toUpperCase(), region: rt.region || '', cadena: rt.cadena || '', marca: r.marca, grupo: r.grupo, sku: r.sku, pdv: r.codigo }[a.p_dim] || 'TOTAL', mk = ['marca', 'sku'].includes(a.p_dim) ? r.marca : '', sem = weekStart(r.fecha, wsd), k = [dim, sem, r.tipo, r.grupo, mk].join('|'); (g[k] ||= { dim, nombre: a.p_dim === 'pdv' ? r.pdv : '', sem, tipo: r.tipo, grupo: r.grupo, marca: mk, caras: 0 }).caras += r.caras; }); return Object.values(g); }
  };
  const rpc = (name, args, opts) => { const q = new Q('__rpc'); q.run = function () { const d = RPC[name] ? RPC[name](args || {}) : null; let out = Array.isArray(d) ? d : d; if (Array.isArray(out)) { const tot = out.length; if (this.rg) out = out.slice(this.rg[0], this.rg[1] + 1); return { data: out, error: null, count: tot }; } return { data: out, error: null }; }; return q; };
  window.supabase = { createClient: () => ({
    from: (t) => new Q(t), rpc,
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }), signOut: async () => { }, signInWithPassword: async () => ({ error: null }) },
    functions: { invoke: async () => ({ data: { ok: true } }) },
    storage: { from: () => ({ createSignedUrls: async (p) => ({ data: p.map(() => ({ signedUrl: 'data:,x' })) }), upload: async () => ({ error: null }), remove: async () => ({}) }) }
  }) };
})();
