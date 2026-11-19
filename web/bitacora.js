'use strict';
/* Presentación legible del historial de cambios (bitácora): quién, qué hizo, dónde y el detalle en lenguaje claro. */
(function () {
  const TAB = { justificaciones: 'Justificación', visitas: 'Visita', tareas: 'Tarea', share_detalle: 'SOS / SOE', ganancias: 'Espacio ganado', config: 'Configuración', profiles: 'Usuario', motivos: 'Motivo', metas: 'Meta', ecm_map: 'Equipo ECM', rutero: 'Rutero' };
  const ACC = { INSERT: ['Creó', 'ok'], UPDATE: ['Modificó', 'info'], DELETE: ['Eliminó', 'bad'], MOTIVO: ['Asignó motivo', 'ok'], GESTION: ['En gestión', 'warn'], 'EVIDENCIA+': ['Agregó foto', 'ok'], 'EVIDENCIA-': ['Quitó foto', 'bad'], UBICACION: ['Ubicación PDV', 'info'], OBSERVACION: ['Observación', 'info'], ENLACES: ['Cargó enlaces', 'info'], REVISION: ['Revisó', 'info'] };
  const CAMPO = { motivo: 'Motivo', estado: 'Estado', responsable: 'Responsable', observacion: 'Observación', ecm: 'ECM', supervisor: 'Supervisor', fecha: 'Fecha', tipo: 'Tipo', activo: 'Activo', rol: 'Rol', nombre: 'Nombre', valor: 'Valor', regiones: 'Regiones', ecm_code: 'ECM', usuario: 'Usuario', excluye_adicional: 'Excluye adicional', caras: 'Caras', grupo: 'Grupo', percha: 'Percha', frio: 'Frío', seco: 'Seco', ruma: 'Ruma' };
  const OCULTOS = new Set(['id', 'creado_en', 'revisado_en', 'creado_por', 'revisado_por', 'clave_uk', 'registro_id']);
  const esc2 = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const v = (x) => (x === null || x === undefined || x === '' ? '—' : Array.isArray(x) ? (x.length ? x.join(', ') : 'todas') : typeof x === 'boolean' ? (x ? 'Sí' : 'No') : String(x));
  const cut = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s));
  /* 'V|2026-11-08|11935372|ECM004' → «Visita del 08/11 · PDV 11935372 · ECM004» */
  const regTxt = (id) => { const p = String(id || '').split('|'); if (p.length < 4) return id ? 'Registro ' + cut(id, 24) : ''; return `${p[0] === 'V' ? 'Visita' : 'Tarea'} del ${p[1].slice(8)}/${p[1].slice(5, 7)} · PDV ${p[2]} · ${p[3]}`; };
  const dif = (a, n) => Object.keys(n || {}).filter((k) => !OCULTOS.has(k) && JSON.stringify(n[k]) !== JSON.stringify((a || {})[k])).map((k) => `<b>${esc2(CAMPO[k] || k)}</b>: ${a && a[k] !== undefined ? esc2(cut(v(a[k]), 60)) + ' → ' : ''}${esc2(cut(v(n[k]), 80))}`);
  const lista = (o) => Object.keys(o || {}).filter((k) => !OCULTOS.has(k) && o[k] != null && o[k] !== '' && !(Array.isArray(o[k]) && !o[k].length)).slice(0, 6).map((k) => `<b>${esc2(CAMPO[k] || k)}</b>: ${esc2(cut(v(o[k]), 60))}`);
  CN.bitInfo = (b) => {
    const tabla = TAB[b.tabla] || b.tabla, acc = ACC[b.accion] || [b.accion, 'info'], n = b.nuevo, a = b.anterior;
    let donde = tabla, det = [];
    if (['visitas', 'tareas'].includes(b.tabla) && n && typeof n === 'object' && 'nuevo' in n) { /* registros de la bitácora migrada: {id, anterior, nuevo, observacion} */
      donde = regTxt(n.id) || tabla; const ant = n.anterior, nu = n.nuevo;
      if (b.accion === 'EVIDENCIA+') det.push('Foto: ' + esc2(cut(nu, 40)) + (n.observacion ? ' · ' + esc2(cut(n.observacion, 100)) : ''));
      else if (b.accion === 'ENLACES') det.push(esc2(nu) + (n.observacion ? ' · ' + esc2(n.observacion) : ''));
      else if (b.accion === 'UBICACION') det.push('Coordenadas: ' + esc2(nu));
      else det.push((ant ? '<b>' + esc2(cut(ant, 80)) + '</b> → ' : '') + '<b>' + esc2(cut(nu, 120)) + '</b>' + (n.observacion ? '<br><span class="mu">' + esc2(cut(String(n.observacion).replace(/https?:\/\/\S+/g, '(enlace)'), 140)) + '</span>' : ''));
    } else if (b.tabla === 'justificaciones') {
      const o = n || a || {}; donde = `${o.tipo === 'tar' ? 'Tarea' : 'Visita'} · ${o.ecm || ''} · ${o.fecha || ''}`;
      det = b.accion === 'UPDATE' ? dif(a, n) : [`<b>Motivo</b>: ${esc2(o.motivo)}`, `<b>Responsable</b>: ${esc2(o.responsable)}`, `<b>Estado</b>: ${esc2(o.estado)}`].concat(o.observacion ? ['<b>Observación</b>: ' + esc2(cut(o.observacion, 100))] : []);
    } else if (b.tabla === 'config') { const o = n || a || {}; donde = 'Configuración · ' + (o.clave || ''); det = b.accion === 'UPDATE' ? [`${esc2(cut(v(a && a.valor), 60))} → <b>${esc2(cut(v(n && n.valor), 80))}</b>`] : [`<b>${esc2(v(o.valor))}</b>`]; }
    else if (b.tabla === 'profiles') { const o = n || a || {}; donde = 'Usuario · ' + (o.usuario || ''); det = b.accion === 'UPDATE' ? dif(a, n) : lista({ nombre: o.nombre, rol: o.rol, supervisor: o.supervisor, regiones: o.regiones, ecm_code: o.ecm_code }); }
    else if (b.tabla === 'motivos') { const o = n || a || {}; donde = 'Motivo · ' + cut(o.motivo || '', 40); det = b.accion === 'UPDATE' ? dif(a, n) : lista({ responsable: o.responsable, tipo: o.tipo, activo: o.activo }); }
    else if (b.tabla === 'metas') { const o = n || a || {}; donde = 'Meta · ' + cut(o.nombre || '', 60); det = b.accion === 'UPDATE' ? dif(a, n) : lista({ mes: o.mes, modo: o.modo, valor: o.valor, regiones: o.regiones, responsable: o.responsable }); }
    else { const o = n || a || {}; donde = tabla + (o.codigo ? ' · ' + o.codigo : ''); det = b.accion === 'UPDATE' ? dif(a, n) : lista(o); }
    return { tabla, acc: acc[0], tono: acc[1], donde, det: det.filter(Boolean).join(' · ') || '—' };
  };
  CN.bitTablas = TAB; CN.bitAcciones = ACC;
})();
