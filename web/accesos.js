'use strict';
/* Accesos y movimiento (solo administrador): quién entró, cuándo, qué pantallas vio y qué cambió en los últimos días. */
(function () {
  const { n: fN, kpi, table, tabs } = VZ;
  NAV.accesos = ['Accesos y movimiento', ['admin']];
  const ST = { dias: 7, tab: 'res', usuario: '' };
  const TABS = [['res', 'Resumen por usuario'], ['acc', 'Accesos'], ['mov', 'Movimiento']];
  const fx = (d) => (d ? new Date(d).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' }) : '—');
  const desde = () => new Date(Date.now() - ST.dias * 864e5).toISOString();
  const EV = { login: 'Ingresó', sesion: 'Retomó sesión', pantalla: 'Vio pantalla' };
  const plano = (h) => String(h).replace(/<[^>]+>/g, '');
  const disp = (ua) => { ua = String(ua || ''); const m = /Android|iPhone|iPad/.test(ua) ? 'Móvil' : 'Computador', n = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : ''; return m + (n ? ' · ' + n : ''); };
  const vistaN = (k) => (NAV[k] ? NAV[k][0] : k || '');

  async function datos() {
    const [pr, act] = await Promise.all([sb.from('profiles').select('id,usuario,nombre,rol,activo'), sb.rpc('admin_actividad', { p_dias: ST.dias })]);
    if (pr.error) throw pr.error; if (act.error) throw act.error;
    const P = Object.fromEntries((pr.data || []).map((p) => [p.id, p]));
    return { P, act: act.data || [] };
  }
  const nom = (P, id) => { const p = P[id]; return p ? `${p.nombre || p.usuario} (${p.usuario})` : '—'; };

  async function resumen() {
    const { P, act } = await datos();
    const filas = act.filter((a) => P[a.usuario] && P[a.usuario].activo).sort((a, b) => (b.ult_acceso || '').localeCompare(a.ult_acceso || '') || b.cambios - a.cambios);
    const con = filas.filter((a) => a.accesos > 0), sin = filas.filter((a) => !a.accesos);
    const cambios = filas.reduce((s, a) => s + Number(a.cambios), 0), accesos = filas.reduce((s, a) => s + Number(a.accesos), 0);
    return `<div class="kp">${kpi('Usuarios que entraron', fN(con.length), `de ${fN(filas.length)} activos`)}${kpi('Accesos', fN(accesos), `últimos ${ST.dias} días`)}${kpi('Sin ingresar', fN(sin.length), 'usuarios activos sin acceso registrado', sin.length ? 'var(--cF)' : '')}${kpi('Cambios registrados', fN(cambios), 'en el historial')}</div>
      <div class="card"><h3>Actividad por usuario · últimos ${ST.dias} días</h3>${table([{ h: 'Usuario' }, { h: 'Tipo' }, { h: 'Último acceso' }, { h: 'Accesos', n: 1 }, { h: 'Días activos', n: 1 }, { h: 'Pantallas vistas', n: 1 }, { h: 'Cambios', n: 1 }, { h: 'Último cambio' }],
        filas.map((a) => { const p = P[a.usuario]; return { c: [esc(nom(P, a.usuario)), esc(p.rol), a.ult_acceso ? fx(a.ult_acceso) : '<span class="mu">Sin ingreso</span>', fN(a.accesos), fN(a.dias_activos), fN(a.pantallas), fN(a.cambios), fx(a.ult_cambio)], s: [plano(nom(P, a.usuario)), p.rol, a.ult_acceso || '', a.accesos, a.dias_activos, a.pantallas, a.cambios, a.ult_cambio || ''] }; }), { name: 'actividad_usuarios' })}
        <p class="note">Los accesos se registran desde la publicación de esta pantalla; los cambios vienen del historial de la plataforma.</p></div>`;
  }

  async function accesos() {
    const { P } = await datos();
    let q = sb.from('accesos').select('*').gte('fecha', desde()).order('fecha', { ascending: false }).limit(1500); if (ST.usuario) q = q.eq('usuario', ST.usuario);
    const { data, error } = await q; if (error) throw error; const L = data || [];
    const opts = `<option value="">Todos los usuarios</option>` + Object.values(P).sort((a, b) => (a.usuario || '').localeCompare(b.usuario || '')).map((p) => `<option value="${esc(p.id)}" ${p.id === ST.usuario ? 'selected' : ''}>${esc(p.nombre || p.usuario)} (${esc(p.usuario)})</option>`).join('');
    return `<div class="bar"><label>Usuario<select id="ac_u">${opts}</select></label><span class="note">${fN(L.length)} registros${L.length >= 1500 ? ' (los 1.500 más recientes)' : ''}</span></div>
      <div class="card"><h3>Accesos y pantallas visitadas</h3>${table([{ h: 'Fecha y hora' }, { h: 'Usuario' }, { h: 'Evento' }, { h: 'Pantalla' }, { h: 'Dispositivo' }],
        L.map((x) => ({ c: [`<span style="white-space:nowrap">${fx(x.fecha)}</span>`, esc(nom(P, x.usuario)), esc(EV[x.evento] || x.evento), esc(x.evento === 'pantalla' ? vistaN(x.vista) : ''), esc(disp(x.agente))], s: [x.fecha, plano(nom(P, x.usuario)), x.evento, x.vista || '', disp(x.agente)] })), { name: 'accesos' })}</div>`;
  }

  async function movimiento() {
    const [{ P }, r] = await Promise.all([datos(), sb.from('bitacora').select('*').gte('fecha', desde()).order('fecha', { ascending: false }).limit(1000)]);
    if (r.error) throw r.error; const L = (r.data || []).map((b) => ({ b, i: CN.bitInfo(b) }));
    return `<div class="bar"><span class="note">${fN(L.length)} cambios${L.length >= 1000 ? ' (los 1.000 más recientes)' : ''} en los últimos ${ST.dias} días</span></div>
      <div class="card"><h3>Movimiento: qué cambió y quién lo hizo</h3>${table([{ h: 'Fecha' }, { h: 'Quién' }, { h: 'Qué hizo' }, { h: 'Dónde' }, { h: 'Detalle' }],
        L.map(({ b, i }) => ({ c: [`<span style="white-space:nowrap">${fx(b.fecha)}</span>`, esc(b.usuario && P[b.usuario] ? nom(P, b.usuario) : '—'), `<span class="acc ${i.tono}">${esc(i.acc)}</span>`, esc(i.donde), i.det], s: [b.fecha, b.usuario && P[b.usuario] ? nom(P, b.usuario) : '', i.acc, i.donde, plano(i.det)] })), { name: 'movimiento' })}</div>`;
  }

  VIEWS.accesos = async function () {
    if (CN.pendingTab && CN.pendingTab[0] === 'accesos') { ST.tab = CN.pendingTab[1]; CN.pendingTab = null; }
    CN.sub.accesos = { tabs: () => TABS, cur: () => ST.tab, set: (k) => { ST.tab = k; draw().catch(fail); } };
    const m = $('#main');
    const draw = async () => {
      m.innerHTML = '<p class="note">Cargando…</p>';
      const cuerpo = ST.tab === 'acc' ? await accesos() : ST.tab === 'mov' ? await movimiento() : await resumen();
      m.innerHTML = `<div class="bar"><label>Período<select id="ac_d">${[1, 3, 7].map((d) => `<option value="${d}" ${d === ST.dias ? 'selected' : ''}>${d === 1 ? 'Últimas 24 horas' : 'Últimos ' + d + ' días'}</option>`).join('')}</select></label></div>${tabs(TABS, ST.tab)}${cuerpo}`;
      m.querySelector('#ac_d').onchange = (e) => { ST.dias = +e.target.value; draw().catch(fail); };
      const u = m.querySelector('#ac_u'); if (u) u.onchange = (e) => { ST.usuario = e.target.value; draw().catch(fail); };
      m.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { ST.tab = b.dataset.tab; draw().catch(fail); CN.sideRefresh(); }));
    };
    await draw();
  };
})();
