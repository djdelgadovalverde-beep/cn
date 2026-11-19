// Migración Drive → Supabase. Uso: node migrate.js [--dry] [--only=tabla,tabla]
const X = require('xlsx'), fs = require('fs'), path = require('path');
const DRY = process.argv.includes('--dry'), ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const URL = 'https://iizebvjhmpglgsunmtog.supabase.co/functions/v1/ingest';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpemVidmpobXBnbGdzdW5tdG9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUwOTIxNjUsImV4cCI6MjExMDY2ODE2NX0.NEjBUAP35q90_26MN6-6qZVgnXa2S2bj0YcUhGLEmEM';
const TOKEN = process.env.INGEST_TOKEN;

/* ---- utilidades idénticas a las de la web ---- */
const norm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
const TXT = (v) => String(v == null ? '' : v).trim();
const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const ecmNorm = (v) => norm(v).replace(/^EC(?=ECM)/, '');
const normReg = (v) => norm(v).replace(/^REGION\s+/, '').replace(/\s*KKAA.*$/, '');
const sinData = (v) => (/^(SIN DATA|N\/A|NA|-)$/i.test(TXT(v)) ? '' : TXT(v));
const serial = (v) => new Date(Math.round((v - 25569) * 864e5));
function fecha(v) {
  if (typeof v === 'number' && v > 20000) return serial(v).toISOString().slice(0, 10);
  const s = TXT(v); let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '';
}
function fechaHora(v) { if (typeof v === 'number' && v > 20000) return serial(v).toISOString().slice(0, 19).replace('T', ' '); const s = TXT(v); return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 19).replace('T', ' ') : fecha(v); }
function msv(v) { if (typeof v === 'number' && v > 20000) return serial(v).getTime(); const m = TXT(v).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) : NaN; }
const minutos = (a, b) => { const x = msv(a), y = msv(b); return isNaN(x) || isNaN(y) || y < x ? null : Math.round((y - x) / 1000) / 60; };
const key = (s) => norm(s).replace(/[^A-Z0-9]/g, '');
const num = (v) => { const n = Number(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) ? n : 0; };

const VT = X.readFile(path.join(__dirname, 'vt.xlsx'), { raw: true }), SOS = X.readFile(path.join(__dirname, 'sos.xlsx'), { raw: true });
const sheet = (wb, n) => { const a = X.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '', raw: true }).filter((r) => r.some((c) => TXT(c) !== '')); if (!a.length) return []; const H = a[0].map(key); return a.slice(1).map((r) => { const o = {}; H.forEach((h, i) => { if (h && !(h in o)) o[h] = r[i]; }); return o; }); };
const g = (r, ...n) => { for (const k of n) { const v = r[key(k)]; if (v !== undefined && v !== '' && v !== null) return v; } return ''; };

/* ---- tablas de apoyo ---- */
const ECM = {};
sheet(VT, 'MAPA_SUPERVISOR').forEach((r) => { const e = ecmNorm(g(r, 'ECM')); if (!e) return; ECM[e] = { ecm: e, nombre: TXT(g(r, 'NOMBRE')), telefono: TXT(g(r, 'TELEFONO')), supervisor: TXT(g(r, 'SUPERVISOR')).toUpperCase(), origen: /manual/i.test(TXT(g(r, 'ORIGEN'))) ? 'manual' : 'auto' }; });
sheet(SOS, 'ECM').forEach((r) => { const e = ecmNorm(g(r, 'ecm')); if (!e) return; const o = (ECM[e] ||= { ecm: e, nombre: '', telefono: '', supervisor: '', origen: 'manual' }); if (!o.nombre) o.nombre = TXT(g(r, 'nombre')); if (!o.telefono) o.telefono = TXT(g(r, 'telefono')); if (!o.supervisor) o.supervisor = TXT(g(r, 'supervisor')).toUpperCase(); });
const RUT = {};
sheet(SOS, 'Rutero').forEach((r) => { const c = TXT(g(r, 'codigo')).replace(/\.0+$/, ''); if (!/^\d+$/.test(c)) return; RUT[c] = { codigo: c, pdv: sinData(g(r, 'pdv')), region: normReg(sinData(g(r, 'region'))), cadena: sinData(g(r, 'cadena')), subcadena: sinData(g(r, 'subcadena')), kam: sinData(g(r, 'kam')), supervisor: sinData(g(r, 'supervisor')).toUpperCase(), ecm: ecmNorm(sinData(g(r, 'ecm'))), agrupacion: sinData(g(r, 'agrupacion')), dia_visita: sinData(g(r, 'dia_visita')), gestor: sinData(g(r, 'gestor')) }; });
sheet(VT, 'RUTERO').forEach((r) => {
  const c = TXT(g(r, 'CLIENTE_SAP')).replace(/\.0+$/, ''); if (!/^\d+$/.test(c)) return; const o = (RUT[c] ||= { codigo: c });
  const set = (k, v) => { if (v !== '' && v != null) o[k] = v; };
  set('pdv', TXT(g(r, 'NombreCliente3'))); set('ecm', ecmNorm(g(r, 'SectorDesarrollo'))); set('grupo_supervision', TXT(g(r, 'GrupoSupervision'))); set('gerencia', TXT(g(r, 'GrupoGerencia')));
  if (!o.region) set('region', normReg(g(r, 'NOMBRE_DIRECCION'))); set('ciudad', TXT(g(r, 'Ciudad'))); set('dia_visita', TXT(g(r, 'DiaVisitaBDR'))); set('semanas', TXT(g(r, 'SemanasVisita'))); set('dia_entrega', TXT(g(r, 'Dia Entrega')));
});
const supDe = (ecm, f) => (ECM[ecm] && ECM[ecm].supervisor) || TXT(f).toUpperCase();

/* ---- visitas ---- */
const visitas = []; const VIS = {}; { const seen = {};
  sheet(VT, 'BASE_VISITAS').forEach((r) => {
    const f = fecha(g(r, 'VISIT_DATE')), prog = num(g(r, 'VISITAS PROGRAMADAS')); if (!f || prog <= 0) return;
    const bdr = TXT(g(r, 'BDR')), ecm = ecmNorm(bdr), cli = TXT(g(r, 'CodigoCliente')).replace(/\.0+$/, '');
    const ef = num(g(r, 'VISITAS EFECTIVAS')), pe = num(g(r, 'VISITAS PERDIDAS')), rango = num(g(r, 'EN RANGO')) === 1, cat = ef > 0 ? 'E' : pe !== 0 ? 'P' : !rango ? 'F' : 'M';
    const base = `V|${f}|${cli}|${bdr}`; seen[base] = (seen[base] || 0) + 1; const id = seen[base] > 1 ? `${base}#${seen[base]}` : base;
    const ini = g(r, 'FechaInicioVisita'), fin = g(r, 'FechaFinVisita'), ru = RUT[cli];
    const v = { id, fecha: f, region: normReg(g(r, 'Region')), gerencia: TXT(g(r, 'Gerencia_Ventas')), supervisor: supDe(ecm, g(r, 'Supervisor')), ecm, codigo_cliente: cli, cliente: (ru && ru.pdv) || TXT(g(r, 'Cliente')), estado: TXT(g(r, 'EstadoVisita')), categoria: cat, programadas: prog,
      detalle: { justificacion: TXT(g(r, 'Justificacion')).toUpperCase(), just_nc: TXT(g(r, 'Justificacion NoCompletado')), just_fr: TXT(g(r, 'Justificacion FinalRuta')), en_rango: rango ? 1 : 0, inicio: fechaHora(ini), fin: fechaHora(fin), min: minutos(ini, fin),
        desp_h: num(g(r, 'Tiempo Desplazamiento Horas')) || null, kmh: num(g(r, 'Km/h distancia desde poc')) || null, dist_m: num(g(r, 'Distancia Entre POCs Metros')) || null } };
    visitas.push(v); VIS[id] = v; });
}
/* ---- tareas ---- */
const regCli = {}; visitas.forEach((v) => { if (v.region) regCli[v.codigo_cliente] = v.region; });
const FRIO = /COOLER|ESPACIO FRIO|NEVERA/;
const tareas = []; const TAR = {}; { const seen = {};
  sheet(VT, 'BASE_TAREAS').forEach((r) => {
    const f = fecha(g(r, 'SystemModstamp')), bdr = TXT(g(r, 'SectorDesarrollo')), ecm = ecmNorm(bdr), cli = TXT(g(r, 'CodigoCliente')).replace(/\.0+$/, ''); if (!f || !cli || !ecm) return;
    const st = norm(g(r, 'Estado_Tarea')), res = norm(g(r, 'ResultadoEfectividad_Tarea')), cat = res === 'VALID' && st === 'FINISHED' ? 'E' : res === 'INVALID' && st === 'FINISHED' ? 'M' : st === 'JUSTIFIED' ? 'F' : st === 'AVAILABLE' ? 'P' : st === 'FINISHED' ? 'M' : 'P';
    const pilar = TXT(g(r, 'Pilares')), desc = TXT(g(r, 'Descripcion')).replace(/[<>"]/g, '');
    const base = `T|${f}|${cli}|${hash(desc)}`; seen[base] = (seen[base] || 0) + 1; const id = seen[base] > 1 ? `${base}#${seen[base]}` : base; const ru = RUT[cli], u = (v) => (/^https?:\/\//i.test(TXT(v)) ? TXT(v) : null);
    const t = { id, fecha: f, region: (ru && ru.region) || regCli[cli] || null, supervisor: supDe(ecm, g(r, 'Supervisor')), ecm, codigo_cliente: cli, cliente: (ru && ru.pdv) || TXT(g(r, 'NombreCliente3')), pilar, descripcion: desc, estado: TXT(g(r, 'Estado_Tarea')), resultado: TXT(g(r, 'ResultadoEfectividad_Tarea')), categoria: cat,
      es_frio: FRIO.test(norm(pilar + ' ' + desc)), url_imagen: u(g(r, 'URL_Imagen')), url_link: u(g(r, 'URL_Link')),
      detalle: { ts: fechaHora(g(r, 'SystemModstamp')), justificacion: TXT(g(r, 'Justificacion')).toUpperCase(), grupo: TXT(g(r, 'GrupoSupervision')), cargadas: num(g(r, 'Tareas Cargadas')) || null, mal_tomada: g(r, '%Mal Tomada /Just /Abiertas') === '' ? null : num(g(r, '%Mal Tomada /Just /Abiertas')), ejecucion: g(r, '%Ejecucion') === '' ? null : num(g(r, '%Ejecucion')),
        gps: g(r, 'module_gps_compliant') === '' ? null : g(r, 'module_gps_compliant'), vision: g(r, 'module_vision_2_0') === '' ? null : g(r, 'module_vision_2_0'), en_validacion: g(r, 'Tareas en validacion') === '' ? null : g(r, 'Tareas en validacion'), estado_fotos: TXT(g(r, 'Estado Fotos')) } };
    tareas.push(t); TAR[id] = t; });
}
/* ---- motivos y justificaciones ---- */
const motivos = sheet(VT, 'MOTIVOS').filter((r) => TXT(g(r, 'MOTIVO'))).map((r) => ({ motivo: TXT(g(r, 'MOTIVO')), responsable: TXT(g(r, 'RESPONSABLE')).toUpperCase() || 'CN', tipo: { VIS: 'vis', TAR: 'tar' }[norm(g(r, 'APLICA'))] || 'ambos', activo: ['1', 'SI', 'TRUE'].includes(norm(g(r, 'ACTIVO'))) || g(r, 'ACTIVO') === 1, excluye_adicional: ['1', 'SI', 'TRUE'].includes(norm(g(r, 'EXCLUYE_ADICIONAL'))) || g(r, 'EXCLUYE_ADICIONAL') === 1 }));
const MOT = {}; motivos.forEach((m) => (MOT[norm(m.motivo)] = m));
const justificaciones = []; let jSin = 0;
sheet(VT, 'REGISTRO_MOTIVOS').forEach((r) => {
  const id = TXT(g(r, 'ID')), tp = id.startsWith('V|') ? 'vis' : id.startsWith('T|') ? 'tar' : '', rec = tp === 'vis' ? VIS[id] : TAR[id], mot = MOT[norm(g(r, 'MOTIVO'))];
  if (!tp || !TXT(g(r, 'MOTIVO'))) return; if (!rec) { jSin++; return; }
  justificaciones.push({ tipo: tp, registro_id: id, fecha: rec.fecha, ecm: rec.ecm, supervisor: rec.supervisor, motivo: mot ? mot.motivo : TXT(g(r, 'MOTIVO')), responsable: (mot && mot.responsable) || TXT(g(r, 'RESPONSABLE')).toUpperCase() || 'CN', observacion: TXT(g(r, 'OBSERVACION')) || null, estado: 'aprobada', creado_en: fechaHora(g(r, 'FECHA')) ? fechaHora(g(r, 'FECHA')).replace(' ', 'T') + '-05:00' : new Date().toISOString() });
});
/* ---- enlaces, ubicaciones, ganancias, catálogo, metas, config, bitácora ---- */
const enlaces = sheet(VT, 'ENLACES_VISITAS').filter((r) => VIS[TXT(g(r, 'ID'))]).map((r) => ({ visita_id: TXT(g(r, 'ID')), ecm: ecmNorm(g(r, 'ECM')), codigo: TXT(g(r, 'CODIGO')), fecha: fecha(g(r, 'FECHA')) || null, foto_antes: TXT(g(r, 'FOTO_ANTES')), foto_despues: TXT(g(r, 'FOTO_DESPUES')), efectividad: TXT(g(r, 'EFECTIVIDAD')), check_in: TXT(g(r, 'CHECK_IN')), check_out: TXT(g(r, 'CHECK_OUT')), novedades: TXT(g(r, 'NOVEDADES')), coincidencia: TXT(g(r, 'COINCIDENCIA')) || 'CODIGO' }));
const ubicaciones = sheet(VT, 'UBICACIONES_PDV').filter((r) => TXT(g(r, 'CODIGO'))).map((r) => ({ codigo: TXT(g(r, 'CODIGO')), lat: num(g(r, 'LATITUD')), lng: num(g(r, 'LONGITUD')), usuario_txt: TXT(g(r, 'USUARIO')) }));
const gan = {}; sheet(SOS, 'Ganancias').forEach((r) => {
  const f = fecha(g(r, 'fecha')), c = TXT(g(r, 'codigo')).replace(/\.0+$/, ''); if (!f || !/^\d+$/.test(c)) return; const ecm = ecmNorm(g(r, 'ecm')), hora = TXT(g(r, 'hora')).slice(0, 5), u = (v) => (/^https?:\/\//i.test(TXT(v)) ? TXT(v) : null);
  const o = { fecha: f, hora, codigo: c, pdv: TXT(g(r, 'pdv')) || (RUT[c] && RUT[c].pdv) || null, cadena: TXT(g(r, 'cadena')) || (RUT[c] && RUT[c].cadena) || null, ecm, supervisor: supDe(ecm, '') || null, percha: Math.round(num(g(r, 'percha'))), frio: Math.round(num(g(r, 'frio'))), seco: Math.round(num(g(r, 'seco'))), ruma: Math.round(num(g(r, 'ruma'))),
    foto_percha: u(g(r, 'foto_percha')), foto_frio: u(g(r, 'foto_frio')), foto_seco: u(g(r, 'foto_seco')), foto_ruma: u(g(r, 'foto_ruma')), observacion: TXT(g(r, 'observacion')).slice(0, 300) || null, foto_obs: u(g(r, 'foto_obs')), fuente: norm(g(r, 'fuente')) === 'MANUAL' ? 'manual' : 'archivo' };
  const k = f + '|' + c; if (!gan[k] || gan[k].hora <= hora) gan[k] = o; });
const ganancias = Object.values(gan);
const GR = ['CN', 'HNK', 'MERC', 'OTROS', 'EXCLUIR']; const cat = {};
sheet(SOS, 'Catalogo').forEach((r) => {
  const k = TXT(g(r, 'clave')), enc = norm(g(r, 'encuesta')) === 'SOE' ? 'SOE' : 'SOS'; if (!k) return; const t = norm(g(r, 'tipo')); let grupo = norm(g(r, 'grupo')); if (!GR.includes(grupo)) grupo = 'EXCLUIR';
  let tipo = /FRIO/.test(t) ? 'BANDEJA FRÍO' : /SECO/.test(t) ? 'BANDEJA SECO' : /RUMA/.test(t) ? 'RUMA' : /PERCHA/.test(t) ? 'PERCHA' : ''; if (!tipo) { tipo = enc === 'SOS' ? 'PERCHA' : 'RUMA'; if (enc === 'SOE') grupo = 'EXCLUIR'; }
  cat[k + '|' + enc] = { clave: k, pregunta: TXT(g(r, 'pregunta')).slice(0, 300) || k, encuesta: enc, grupo, tipo, marca: TXT(g(r, 'madre')).slice(0, 80), visual: TXT(g(r, 'visual')).slice(0, 120), origen: norm(g(r, 'origen')) === 'AUTO' ? 'auto' : 'manual' }; });
const catalogo = Object.values(cat);
const metas = sheet(SOS, 'Metas').filter((r) => TXT(g(r, 'valor')) !== '').map((r) => ({ nombre: TXT(g(r, 'nombre')), mes: TXT(g(r, 'mes')), ambito: (norm(g(r, 'ambito')) || 'GRUPO').toLowerCase(), clave: TXT(g(r, 'clave')), tipo: '', modo: TXT(g(r, 'modo')) || 'share', valor: num(g(r, 'valor')), responsable: TXT(g(r, 'responsable')), tipos: TXT(g(r, 'tipos')), regiones: TXT(g(r, 'regiones')), cadenas: TXT(g(r, 'cadenas')), supervisores: TXT(g(r, 'supervisores')), ecms: TXT(g(r, 'ecms')), pdvs: TXT(g(r, 'pdvs')), excluir: TXT(g(r, 'excluir')), base: TXT(g(r, 'base')) }));
const cfgVT = Object.fromEntries(sheet(VT, 'CONFIG').map((r) => [norm(g(r, 'CLAVE')), g(r, 'VALOR')])), cfgS = Object.fromEntries(sheet(SOS, 'Config').map((r) => [TXT(g(r, 'clave')), g(r, 'valor')]));
const config = [{ clave: 'frio_regex', valor: 'COOLER|ESPACIO FRIO|NEVERA' }, { clave: 'meta_vis', valor: String((num(cfgVT.META_EFECTIVIDAD) || 90) / 100) }, { clave: 'meta_sos', valor: String(num(cfgS.meta_cn) || 0.8) }, { clave: 'meta_soe', valor: String(num(cfgS.meta_soe) || 0.8) }, { clave: 'semana_inicio', valor: String(cfgS.semana_inicio === '' ? 3 : cfgS.semana_inicio) }, { clave: 'excluir_pdv', valor: TXT(cfgS.excluir_pdv) }, { clave: 'filtros_panel', valor: TXT(cfgS.filtros_panel) }, { clave: 'dias_libres', valor: TXT(cfgS.dias_libres) }];
const bitacora = sheet(VT, 'BITACORA').filter((r) => TXT(g(r, 'FECHA'))).map((r) => ({ fecha: (fechaHora(g(r, 'FECHA')) || '2026-01-01').replace(' ', 'T') + '-05:00', tabla: ({ vis: 'visitas', tar: 'tareas' })[TXT(g(r, 'TIPO'))] || TXT(g(r, 'TIPO')) || 'sistema', accion: TXT(g(r, 'ACCION')), anterior: null, nuevo: { usuario: TXT(g(r, 'USUARIO')), id: TXT(g(r, 'ID')), anterior: TXT(g(r, 'ANTERIOR')), nuevo: TXT(g(r, 'NUEVO')), observacion: TXT(g(r, 'OBSERVACION')) } }));

const JOBS = { ecm_map: Object.values(ECM), rutero: Object.values(RUT).map((o) => ({ pdv: null, region: null, cadena: null, ciudad: null, supervisor: null, ecm: null, dia_visita: null, subcadena: null, kam: null, gerencia: null, grupo_supervision: null, semanas: null, dia_entrega: null, agrupacion: null, gestor: null, ...o })), motivos, config, visitas, tareas, justificaciones, enlaces, ubicaciones, ganancias, catalogo_share: catalogo, metas, bitacora };
module.exports = { JOBS, ECM, RUT, VIS, TAR, tareas, visitas };

async function post(body) {
  const r = await fetch(URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + ANON, apikey: ANON, 'x-ingest-token': TOKEN }, body: JSON.stringify(body) });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = { error: t.slice(0, 200) }; } if (!r.ok || j.error) throw new Error(`${body.table}: ${j.error || r.status} ${j.hint || ''}`); return j;
}
if (require.main === module) (async () => {
  console.log('Resumen a migrar:'); Object.entries(JOBS).forEach(([k, v]) => console.log(`  ${k.padEnd(16)} ${v.length}`)); console.log(`  (justificaciones sin registro en las bases: ${jSin})`);
  const cats = (a) => a.reduce((m, x) => ((m[x.categoria] = (m[x.categoria] || 0) + 1), m), {}); console.log('  visitas por categoría', cats(visitas), ' tareas', cats(tareas), ' frío', tareas.filter((t) => t.es_frio).length);
  if (DRY) return;
  const order = ['ecm_map', 'rutero', 'motivos', 'config', 'catalogo_share', 'visitas', 'tareas', 'justificaciones', 'enlaces', 'ubicaciones', 'ganancias', 'metas', 'bitacora'];
  for (const t of order) { if (ONLY.length && !ONLY.includes(t)) continue; const rows = JOBS[t], sz = ['visitas', 'tareas'].includes(t) ? 800 : 500; let n = 0;
    for (let i = 0; i < rows.length; i += sz) { await post({ table: t, rows: rows.slice(i, i + sz) }); n += Math.min(sz, rows.length - i); process.stdout.write(`\r  ${t}: ${n}/${rows.length}   `); } console.log(`\r  ${t}: ${n}/${rows.length} ✓       `); }
})().catch((e) => { console.error('\nERROR:', e.message); process.exit(1); });
