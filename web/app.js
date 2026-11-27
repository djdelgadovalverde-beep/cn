'use strict';
/* CN · Desempeño comercial — SPA sin build. Datos y seguridad: Supabase (RLS). */
const sb = supabase.createClient(CN_CONFIG.SUPABASE_URL, CN_CONFIG.SUPABASE_ANON_KEY);
const $app = document.getElementById('app');
const S = { me: null, cfg: {}, motivos: [], ecmMap: [] };
const ROL_TXT = { admin: 'Administrador', gerencia: 'Gerencia', supervisor: 'Supervisor', asesor: 'Mercaderista' };
const NAV = {
  dashboard: ['Dashboard', ['admin', 'gerencia', 'supervisor', 'asesor']],
  visitas: ['Visitas', ['admin', 'gerencia', 'supervisor', 'asesor']],
  tareas: ['Tareas', ['admin', 'gerencia', 'supervisor', 'asesor']],
  sos: ['SOS y SOE', ['admin', 'gerencia', 'supervisor', 'asesor']],
  carga: ['Cargar bases', ['admin']],
  admin: ['Administración', ['admin']]
};

/* ---------- utilidades ---------- */
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/* solo enlaces http(s): evita javascript: en enlaces que vienen de archivos cargados */
const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : '#');
const norm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
const key = (s) => norm(s).replace(/[^A-Z0-9]/g, '');
const pct = (x, d = 1) => (x == null ? '—' : (x * 100).toFixed(d) + '%');
const ecmNorm = (v) => { const t = norm(v).replace(/^EC(?=ECM)/, ''); return t; };
const $ = (sel, el = document) => el.querySelector(sel);
const monthNow = () => new Date().toISOString().slice(0, 7);
function range(m) { const [y, mo] = m.split('-').map(Number); const last = new Date(Date.UTC(y, mo, 0)).getUTCDate(); return [`${m}-01`, `${m}-${String(last).padStart(2, '0')}`]; }
let tt; function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 3200); }
function fail(e) { console.error(e); toast('No se pudo completar: ' + (e.message || e)); }
const can = (...roles) => roles.includes(S.me.rol);
/* permisos del tipo de usuario: ver un módulo / editar una función */
const veMod = (k) => { if (k === 'carga') return !!S.me && (S.me.perfil || S.me.rol) === 'admin'; const d = S.me && S.me.def; if (!d || !d.ver) return !!(NAV[k] && NAV[k][1].includes(S.me.rol)); return S.me.rol === 'admin' && d.clave === 'admin' ? !!NAV[k] : !!NAV[k] && d.ver.includes(k); };

const teamName = () => norm(S.me.supervisor || '');

const VIEWS = {};
/* ---------- sesión ---------- */
/* registro de accesos (lo ve solo el administrador): ingreso, sesión retomada y pantallas visitadas */
window.CN = window.CN || {};
CN.logAcc = (evento, vista) => { try { if (!S.me) return; sb.from('accesos').insert({ usuario: S.me.id, evento, vista: vista || null, agente: (navigator.userAgent || '').slice(0, 160) }).then(() => { }, () => { }); } catch (e) { } };
CN.ecmSync = () => { CN.ecmInact = new Set((S.ecmMap || []).filter((e) => e.activo === false).map((e) => String(e.ecm || '').trim().toUpperCase())); };
CN.ecmOff = (e) => !!CN.ecmInact && CN.ecmInact.has(String(e || '').trim().toUpperCase());
CN.sinOff = (rows) => (CN.ecmInact && CN.ecmInact.size ? rows.filter((x) => !CN.ecmOff(x.ecm)) : rows);
async function boot() {
  const { data } = await sb.auth.getSession();
  if (!data.session) return loginView();
  /* todo lo que necesita el arranque se pide a la vez (antes eran tres viajes seguidos a la base) */
  const [pr, rl, cf, mo, em] = await Promise.all([sb.from('profiles').select('*').eq('id', data.session.user.id).single(), sb.from('roles').select('*'), sb.from('config').select('*'), sb.from('motivos').select('*').eq('activo', true).order('motivo'), sb.from('ecm_map').select('*')]);
  const p = pr.data, error = pr.error;
  if (error || !p || !p.activo) { await sb.auth.signOut(); return loginView('Tu usuario no está activo. Contacta al administrador.'); }
  S.me = p;
  /* tipo de usuario: el rol BASE define el alcance de los datos; el tipo define qué ve y qué edita */
  const rls = rl.data; S.roles = rls || []; const def = S.roles.find((r) => r.clave === p.rol) || { clave: p.rol, nombre: ROL_TXT[p.rol] || p.rol, base: p.rol, ver: null, editar: null };
  S.me.perfil = p.rol; S.me.perfilNombre = def.nombre; S.me.def = def; S.me.rol = def.base;
  const c = cf, m = mo, e = em;
  S.cfg = Object.fromEntries((c.data || []).map((r) => [r.clave, r.valor]));
  S.motivos = m.data || []; S.ecmMap = e.data || []; CN.ecmSync();
  shell();
  try { const ss = window.sessionStorage; if (ss.getItem('cn_login')) { ss.removeItem('cn_login'); ss.setItem('cn_ses', '1'); CN.logAcc('login'); } else if (!ss.getItem('cn_ses')) { ss.setItem('cn_ses', '1'); CN.logAcc('sesion'); } } catch (e) { CN.logAcc('sesion'); }
}
function loginView(msg) {
  $app.innerHTML = `<div class="login"><h2 style="margin-bottom:16px">Desempeño comercial</h2>
  <form id="lf"><label>Usuario (código)<input id="u" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="Ej. admin o ecm035" required></label>
  <label>Contraseña<input id="p" type="password" autocomplete="current-password" required></label>
  <button class="pri">Entrar</button><p class="note" id="lm">${esc(msg || '')}</p></form></div>`;
  $('#lf').onsubmit = async (ev) => {
    ev.preventDefault();
    const u = $('#u').value.trim().toLowerCase().split('@')[0].replace(/[^a-z0-9._-]/g, ''); /* solo el código: si alguien escribe un correo se usa lo anterior a la @ */
    const { error } = await sb.auth.signInWithPassword({ email: `${u}@cn.app`, password: $('#p').value });
    if (error) $('#lm').textContent = (error.code === 'email_provider_disabled' || /disabled/i.test(error.message || '')) ? 'El acceso por contraseña está desactivado en Supabase (Authentication → Sign In / Providers → Email). Avisa al administrador.' : error.status === 429 ? 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' : 'Usuario o contraseña incorrectos.'; else { try { sessionStorage.setItem('cn_login', '1'); } catch (e) { } boot(); }
  };
}
/* ---------- Armazón: panel lateral con botones principales y secundarios ---------- */
const ICON = {
  dashboard: '<path d="M3 12l9-8 9 8"/><path d="M5 10v10h14V10"/>', visitas: '<path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  tareas: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h9"/>', audit: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  sos: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/>', ganancias: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  metas: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>', pend: '<path d="M21 15a2 2 0 01-2 2H8l-5 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>',
  informe: '<path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h6"/>', rutero: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
  carga: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3"/>', ecm: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14.5c2 .7 3.5 2.4 3.5 5.5"/>',
  config: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>', plan: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>', alcance: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', registro: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>', catalogo: '<path d="M20 12l-8 8-9-9V3h8z"/><circle cx="7.5" cy="7.5" r="1.2"/>', admin: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
  salir: '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>', tema: '<path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/>', menu: '<path d="M3 6h18M3 12h18M3 18h18"/>'
};
ICON.usuarios = ICON.ecm; ICON.motivos = ICON.registro || ICON.pend; ICON.accesos = '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'; ICON.permisos = '<path d="M12 3l8 3v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>';
const ico = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k] || ICON.dashboard}</svg>`;
const GROUPS = [['Análisis', ['dashboard', 'visitas', 'tareas', 'audit']], ['Share de góndola', ['sos', 'ganancias', 'plan', 'alcance', 'metas']], ['Gestión', ['registro', 'pend', 'informe', 'rutero']], ['Datos', ['carga', 'ecm', 'catalogo']], ['Sistema', ['config', 'usuarios', 'permisos', 'motivos', 'accesos']]];
window.CN = window.CN || {}; CN.sub = {}; CN.pendingTab = null;
CN.tabOk = (mod, key) => { const d = S.me && S.me.def; if (!d || !d.ver || (S.me.perfil || S.me.rol) === 'admin') return true; return d.ver.includes(mod + ':' + key); };
CN.puede = (cap) => { const d = S.me && S.me.def; return S.me.rol === 'admin' || !d || !d.editar ? true : d.editar.includes(cap); };
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }, lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } };
CN.subClosed = new Set(JSON.parse(lsGet('cn_sub_cerrados', '[]')));
function curKey() { const k = (location.hash || '#dashboard').slice(1).split('/')[0]; return veMod(k) ? k : 'dashboard'; }
CN.sideRefresh = function () {
  const side = $('#sb'); if (!side || !S.me) return; const cur = curKey();
  const ok = (k) => veMod(k), seen = new Set();
  const sec = GROUPS.map(([t, ks]) => { const L = ks.filter(ok); L.forEach((k) => seen.add(k)); return [t, L]; });
  const rest = Object.keys(NAV).filter((k) => ok(k) && !seen.has(k)); if (rest.length) sec.push(['Otros', rest]);
  side.querySelector('#nav').innerHTML = sec.filter(([, L]) => L.length).map(([t, L]) => `<div class="sec">${esc(t)}</div>${L.map((k) => {
    const sub = k === cur && CN.sub[k] ? CN.sub[k] : null;
    const abierto = sub && !CN.subClosed.has(k);
    return `<button class="sbtn ${k === cur ? 'on' : ''}" data-go="${k}" ${k === cur ? 'aria-current="page"' : ''} ${sub ? `aria-expanded="${abierto}" title="${abierto ? 'Plegar' : 'Desplegar'} sub botones"` : ''}>${ico(k)}<span>${esc(NAV[k][0])}</span>${sub ? `<em class="chev ${abierto ? 'open' : ''}" aria-hidden="true">›</em>` : ''}</button>` +
      (abierto ? `<div class="ssub">${sub.tabs().map(([tk, tl]) => `<button class="${sub.cur() === tk ? 'on' : ''}" data-sub="${k}|${tk}">${esc(tl)}</button>`).join('')}</div>` : '');
  }).join('')}`).join('');
  const sub = CN.sub[cur], tl = sub ? (sub.tabs().find((t) => t[0] === sub.cur()) || [])[1] : '';
  /* móvil: cada bloque de filtros se pliega tras un botón «Filtros» (menos desplazamiento) */
  if (!window._fbObs) { const mk = () => { document.querySelectorAll('#main .fbar').forEach((f) => { if (f.previousElementSibling && f.previousElementSibling.classList.contains('fbtoggle')) return; const b = document.createElement('button'); b.type = 'button'; b.className = 'fbtoggle'; b.textContent = 'Filtros ▾'; b.setAttribute('aria-expanded', 'false'); b.onclick = () => { const o = f.classList.toggle('fb-open'); b.textContent = o ? 'Filtros ▴' : 'Filtros ▾'; b.setAttribute('aria-expanded', o); }; f.parentNode.insertBefore(b, f); }); }; window._fbObs = new MutationObserver(() => mk()); window._fbObs.observe(document.body, { childList: true, subtree: true }); }
  $('#ph').textContent = NAV[cur][0] + (tl && tl !== NAV[cur][0] ? ' · ' + tl : '');
};
function shell() {
  const th = (() => { try { return localStorage.getItem('cn_tema') || ''; } catch (e) { return ''; } })(); if (th) document.documentElement.dataset.theme = th;
  $app.innerHTML = `<a class="skip" href="#main" onclick="event.preventDefault();var m=document.getElementById('main');m.tabIndex=-1;m.focus()">Saltar al contenido</a><div class="app"><aside class="sb" id="sb" aria-label="Menú principal"><div class="brand"><i>${esc((S.cfg.titulo || 'CN').slice(0, 2).toUpperCase())}</i><span>${esc(S.cfg.titulo || 'CN')}</span></div>
    <nav id="nav"></nav><div class="foot"><div class="who"><b>${esc(S.me.nombre)}</b><span>${esc(S.me.perfilNombre || ROL_TXT[S.me.rol])}${S.me.supervisor ? ' · ' + esc(S.me.supervisor) : ''}${S.me.ecm_code ? ' · ' + esc(S.me.ecm_code) : ''}${(S.me.regiones || []).length && ['supervisor', 'gerencia'].includes(S.me.rol) ? ' · ' + esc(S.me.regiones.join('/')) : ''}</span></div>
    <div class="row"><button class="sbtn" id="tema">${ico('tema')}<span>Tema claro / oscuro</span></button></div><button class="sbtn" id="pw">${ico('config')}<span>Cambiar mi clave</span></button><button class="sbtn" id="out">${ico('salir')}<span>Salir</span></button></div></aside>
    <div class="scrim" id="scrim"></div><div class="mw"><header class="pagehead"><button class="menubtn" id="mb" aria-label="Ocultar o mostrar el menú" title="Ocultar / mostrar el menú">${ico('menu')}</button><h1 id="ph"></h1><span class="sp"></span><span class="fresh" id="fresh"></span></header><main id="main"></main></div></div>`;
  const side = $('#sb'), close = () => side.classList.remove('open');
  const app = $('.app'), movil = () => matchMedia('(max-width:900px)').matches;
  if (lsGet('cn_panel', 'visible') === 'oculto') app.classList.add('collapsed');
  const mb = $('#mb'), sync = () => mb.setAttribute('aria-expanded', movil() ? side.classList.contains('open') : !app.classList.contains('collapsed'));
  mb.onclick = () => { if (movil()) side.classList.toggle('open'); else { delete app.dataset.auto; app.classList.toggle('collapsed'); lsSet('cn_panel', app.classList.contains('collapsed') ? 'oculto' : 'visible'); } sync(); };
  $('#scrim').onclick = () => { close(); sync(); }; addEventListener('keydown', (e) => { if (e.key === 'Escape' && side.classList.contains('open')) { close(); sync(); } }); sync();
  $('#pw').onclick = () => {
    const m = document.createElement('div'); m.className = 'modal';
    m.innerHTML = `<form class="box" style="max-width:400px"><h3>Cambiar mi clave</h3><label>Clave actual<input type="password" id="pw0" autocomplete="current-password" required></label><label>Nueva clave (mínimo 8 caracteres)<input type="password" id="pw1" autocomplete="new-password" minlength="8" required></label><label>Repite la nueva clave<input type="password" id="pw2" autocomplete="new-password" minlength="8" required></label><div class="bar" style="margin:0"><button class="pri">Guardar clave</button><button type="button" id="pwx">Cancelar</button></div></form>`;
    document.body.appendChild(m); $('#pwx', m).onclick = () => m.remove(); $('#pw0', m).focus();
    $('form', m).onsubmit = async (ev) => { ev.preventDefault(); const a0 = $('#pw0', m).value, n1 = $('#pw1', m).value; if (n1 !== $('#pw2', m).value) return toast('Las claves nuevas no coinciden.'); if (n1 === a0) return toast('La nueva clave debe ser distinta de la actual.');
      try { const { error: e1 } = await sb.auth.signInWithPassword({ email: S.me.usuario.toLowerCase().replace(/@.*/, '') + '@cn.app', password: a0 }); if (e1) return toast('La clave actual no es correcta.'); const { error } = await sb.auth.updateUser({ password: n1 }); if (error) throw error; m.remove(); toast('Clave actualizada'); } catch (e) { fail(e); } };
  };
  $('#out').onclick = async () => { await sb.auth.signOut(); S.me = null; loginView(); };
  $('#tema').onclick = () => { const d = document.documentElement, dark = d.dataset.theme === 'dark' || (!d.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches); d.dataset.theme = dark ? 'light' : 'dark'; try { localStorage.setItem('cn_tema', d.dataset.theme); } catch (e) { } };
  side.addEventListener('click', (ev) => {
    const g = ev.target.closest('[data-go]'), u = ev.target.closest('[data-sub]');
    if (g) {
      const k = g.dataset.go;
      if (curKey() === k) { if (CN.sub[k]) { CN.subClosed.has(k) ? CN.subClosed.delete(k) : CN.subClosed.add(k); lsSet('cn_sub_cerrados', JSON.stringify([...CN.subClosed])); CN.sideRefresh(); } else { route(); close(); } }
      else { CN.subClosed.delete(k); lsSet('cn_sub_cerrados', JSON.stringify([...CN.subClosed])); location.hash = '#' + k; close(); }
    }
    if (u) { const [k, t] = u.dataset.sub.split('|'); if (curKey() === k && CN.sub[k]) { CN.sub[k].set(t); } else { CN.pendingTab = [k, t]; location.hash = '#' + k; } close(); }
  });
  window.onhashchange = route; route();
  sb.rpc('estado_datos_ligero').then(({ data }) => { if (!data) return; const f = (o) => (o && o.hasta ? o.hasta : '—'); const el = $('#fresh'); if (el) el.textContent = `Datos hasta · visitas ${f(data.vis)} · tareas ${f(data.tar)} · SOS/SOE ${f(data.share)}`; });
}
/* pantallas anchas (Asignar motivos): el menú lateral se oculta solo y se restaura al salir */
function panelAuto(k) {
  const app = document.querySelector('.app'); if (!app || innerWidth <= 900) return;
  if (k === 'registro' && innerWidth < 1700 && !app.classList.contains('collapsed')) { app.classList.add('collapsed'); app.dataset.auto = '1'; }
  else if (k !== 'registro' && app.dataset.auto === '1') { app.classList.remove('collapsed'); delete app.dataset.auto; }
  const mb = document.getElementById('mb'); if (mb) mb.setAttribute('aria-expanded', !app.classList.contains('collapsed'));
}
function route() {
  const ok = curKey(); panelAuto(ok); CN.sideRefresh(); if (CN.ultVista !== ok) { CN.ultVista = ok; CN.logAcc('pantalla', ok); }
  $('#main').innerHTML = '<p class="note">Cargando…</p>'; $('#main').scrollTop = 0; window.scrollTo(0, 0);
  VIEWS[ok]().then(() => CN.sideRefresh()).catch(fail);
}

/* ---------- Dashboard ---------- */
async function dashboard() {
  const m = $('#main');
  m.innerHTML = `<div class="bar"><label>Mes<input type="month" id="mes" value="${monthNow()}"></label></div><div id="dash"></div>`;
  const load = async () => {
    const [d, h] = range($('#mes').value);
    const { data, error } = await sb.rpc('score_ecm', { p_desde: d, p_hasta: h });
    if (error) return fail(error);
    let rows = data || [];
    if (S.me.rol === 'asesor') rows = rows.filter((r) => norm(r.ecm) === norm(S.me.ecm_code));
    else if (S.me.rol === 'supervisor') rows = rows.filter((r) => norm(r.supervisor) === teamName());
    rows = rows.filter((r) => r.score != null || r.vis_prog || r.tar_prog || r.frio_prog);
    $('#dash').innerHTML = S.me.rol === 'asesor' ? cardPersona(rows[0], true) : resumenEquipo(rows);
    document.querySelectorAll('[data-ecm]').forEach((tr) => tr.onclick = () => {
      const r = rows.find((x) => x.ecm === tr.dataset.ecm);
      $('#det').innerHTML = cardPersona(r);
      $('#det').scrollIntoView({ behavior: 'smooth' });
    });
  };
  $('#mes').onchange = () => load().catch(fail);
  await load();
}
function cardPersona(r, own) {
  if (!r) return `<div class="card"><p class="note">${own ? 'Aún no hay datos tuyos en este mes.' : 'Sin datos.'}</p></div>`;
  const w = (k, d) => Number(S.cfg[k] ?? d);
  const comp = [
    ['Efectividad de visitas', r.vis_pct, w('w_vis', 20), `${r.vis_efec} efectivas de ${r.vis_prog} (${r.vis_just} justif.)`],
    ['Efectividad de tareas', r.tar_pct, w('w_tar', 30), `${r.tar_efec} de ${r.tar_prog} (${r.tar_just} justif.)`],
    ['Tareas equipo de frío', r.frio_pct, w('w_frio', 30), `${r.frio_efec} de ${r.frio_prog} (${r.frio_just} justif.)`],
    ['SOS (percha)', r.sos_pct == null ? null : Math.min(1, r.sos_pct / Number(r.meta_sos_ecm || S.cfg.meta_sos || .8)), w('w_sos', 10), `Share CN ${pct(r.sos_pct)} · meta ${pct(Number(r.meta_sos_ecm || S.cfg.meta_sos || .8), 0)}`],
    ['SOE (espacios)', r.soe_pct == null ? null : Math.min(1, r.soe_pct / Number(r.meta_soe_ecm || S.cfg.meta_soe || .8)), w('w_soe', 10), `Share CN ${pct(r.soe_pct)} · meta ${pct(Number(r.meta_soe_ecm || S.cfg.meta_soe || .8), 0)}`]
  ];
  return `<div class="card"><h2>${esc(r.nombre || r.ecm)} <span class="note">${esc(r.ecm)} · ${esc(r.supervisor || '')}</span></h2>
  <div class="score">${r.score == null ? '—' : r.score.toFixed(1)}<span class="note"> / 100</span></div>
  ${comp.map((c) => `<div class="comp"><div><b>${c[0]}</b> <span class="note">${c[2]}%</span><div class="note">${esc(c[3])}</div></div>
    <div class="meter"><i style="width:${c[1] == null ? 0 : c[1] * 100}%"></i></div><div class="n"><b>${pct(c[1])}</b></div></div>`).join('')}
  <p class="note">Efectividad = efectivas ÷ (programadas − justificadas válidas). Si falta un componente, su peso se reparte entre los demás.</p></div>`;
}
function resumenEquipo(rows) {
  const avg = (k) => { const v = rows.map((r) => r[k]).filter((x) => x != null); return v.length ? v.reduce((a, b) => a + Number(b), 0) / v.length : null; };
  const sc = avg('score');
  return `<div class="grid" style="margin-bottom:16px">
  <div class="kpi"><b>${sc == null ? '—' : sc.toFixed(1)}</b><span>Puntaje promedio</span></div>
  <div class="kpi"><b>${pct(avg('vis_pct'))}</b><span>Efectividad visitas</span></div>
  <div class="kpi"><b>${pct(avg('tar_pct'))}</b><span>Efectividad tareas</span></div>
  <div class="kpi"><b>${pct(avg('frio_pct'))}</b><span>Tareas equipo de frío</span></div>
  <div class="kpi"><b>${pct(avg('sos_pct'))}</b><span>SOS</span></div>
  <div class="kpi"><b>${pct(avg('soe_pct'))}</b><span>SOE</span></div></div>
  <div class="card"><div class="tw"><table><thead><tr><th>ECM</th><th>Nombre</th><th>Supervisor</th><th class="n">Visitas</th><th class="n">Tareas</th><th class="n">Frío</th><th class="n">SOS</th><th class="n">SOE</th><th class="n">Puntaje</th></tr></thead><tbody>
  ${rows.slice().sort((a, b) => (b.score ?? -1) - (a.score ?? -1)).map((r) => `<tr data-ecm="${esc(r.ecm)}" style="cursor:pointer"><td>${esc(r.ecm)}</td><td>${esc(r.nombre || '')}</td><td>${esc(r.supervisor || '')}</td>
  <td class="n">${pct(r.vis_pct)}</td><td class="n">${pct(r.tar_pct)}</td><td class="n">${pct(r.frio_pct)}</td><td class="n">${pct(r.sos_pct)}</td><td class="n">${pct(r.soe_pct)}</td><td class="n"><b>${r.score == null ? '—' : r.score.toFixed(1)}</b></td></tr>`).join('') || '<tr><td colspan="9" class="note">Sin datos en este mes.</td></tr>'}
  </tbody></table></div><p class="note">Toca una fila para ver el detalle de la persona.</p></div><div id="det"></div>`;
}

/* ---------- Visitas y Tareas (+ justificaciones) ---------- */
const CATS = { vis: { E: 'Efectiva', P: 'Perdida', F: 'Fuera de rango', M: 'Menos de 2 min' }, tar: { E: 'Efectiva', M: 'Mal ejecutada', F: 'Justificada', P: 'Abierta' } };
async function registros(tipo, host) {
  const tabla = tipo === 'vis' ? 'visitas' : 'tareas', CAT = CATS[tipo];
  const m = host || $('#main');
  m.innerHTML = `<div class="bar"><label>Mes<input type="month" id="mes" value="${monthNow()}"></label>
  <label>Estado<select id="cat"><option value="">Todos</option><option value="NE">No efectivas</option>${Object.entries(CAT).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
  ${tipo === 'tar' ? '<label>Tipo<select id="fr"><option value="">Todas</option><option value="1">Equipo de frío</option><option value="0">Resto</option></select></label>' : ''}
  <label>Buscar<input id="q" placeholder="ECM, cliente o código"></label></div><div class="card"><div class="tw" id="tb"></div><p class="note" id="info"></p></div>`;
  const load = async () => {
    const [d, h] = range($('#mes').value);
    let q = sb.from(tabla).select('*').gte('fecha', d).lte('fecha', h).order('fecha', { ascending: false }).limit(1000);
    const cat = $('#cat').value; if (cat === 'NE') q = q.neq('categoria', 'E'); else if (cat) q = q.eq('categoria', cat);
    if (tipo === 'tar' && $('#fr').value) q = q.eq('es_frio', $('#fr').value === '1');
    const t = $('#q').value.trim(); if (t) { const s = t.replace(/[,()%]/g, ' '); q = q.or(`ecm.ilike.%${s}%,cliente.ilike.%${s}%,codigo_cliente.ilike.%${s}%`); }
    const [r, j] = await Promise.all([q, sb.from('justificaciones').select('*').eq('tipo', tipo).gte('fecha', d).lte('fecha', h)]);
    if (r.error) return fail(r.error);
    const J = Object.fromEntries((j.data || []).map((x) => [x.registro_id, x]));
    const rows = r.data || [];
    $('#info').textContent = rows.length >= 1000 ? 'Mostrando los primeros 1000; afina los filtros.' : `${rows.length} registros`;
    $('#tb').innerHTML = `<table><thead><tr><th>Fecha</th><th>ECM</th><th>Cliente</th>${tipo === 'tar' ? '<th>Pilar / tarea</th>' : ''}<th>Estado</th><th>Justificación</th><th></th></tr></thead><tbody>${rows.map((x) => {
      const jj = J[x.id];
      const acciones = x.categoria === 'E' ? '' : `<button data-j="${esc(x.id)}">${jj ? (S.me.rol === 'asesor' ? 'Editar' : 'Revisar') : 'Justificar'}</button>`;
      return `<tr><td>${esc(x.fecha)}</td><td>${esc(x.ecm)}</td><td>${esc(x.cliente || x.codigo_cliente || '')}</td>${tipo === 'tar' ? `<td>${esc(x.pilar || '')} ${x.es_frio ? '❄' : ''}<div class="note">${esc((x.descripcion || '').slice(0, 60))}</div></td>` : ''}
      <td><span class="pill ${x.categoria}">${CAT[x.categoria]}</span></td>
      <td>${jj ? `<span class="pill ${jj.estado}">${jj.estado}</span> ${esc(jj.motivo)} <span class="note">(${esc(jj.responsable)})</span>` : '<span class="note">—</span>'}</td><td>${acciones}</td></tr>`;
    }).join('') || '<tr><td colspan="7" class="note">Sin registros.</td></tr>'}</tbody></table>`;
    document.querySelectorAll('[data-j]').forEach((b) => b.onclick = () => modalJust(tipo, rows.find((x) => x.id === b.dataset.j), J[b.dataset.j], load));
  };
  ['mes', 'cat', 'fr'].forEach((id) => { const el = $('#' + id); if (el) el.onchange = () => load().catch(fail); });
  let dt; $('#q').oninput = () => { clearTimeout(dt); dt = setTimeout(() => load().catch(fail), 350); };
  await load();
}
function modalJust(tipo, reg, jj, done) {
  const rev = S.me.rol !== 'asesor' && CN.puede('revisar') && jj;
  const opts = S.motivos.filter((x) => x.tipo === 'ambos' || x.tipo === tipo);
  const el = document.createElement('div'); el.className = 'modal';
  el.innerHTML = `<form class="box"><h3>${rev ? 'Revisar justificación' : 'Justificar novedad'}</h3>
  <p class="note">${esc(reg.fecha)} · ${esc(reg.ecm)} · ${esc(reg.cliente || reg.codigo_cliente || '')}</p>
  <label>Motivo<select id="mo" required><option value="">Selecciona…</option>${opts.map((o) => `<option ${jj && jj.motivo === o.motivo ? 'selected' : ''}>${esc(o.motivo)}</option>`).join('')}</select></label>
  <label>Observación<textarea id="ob" rows="3" maxlength="500">${esc(jj ? jj.observacion || '' : '')}</textarea></label>
  ${rev ? `<label>Decisión<select id="es"><option value="rectificada">Rectificar (usar el motivo elegido)</option><option value="aprobada">Aprobar</option><option value="rechazada">Rechazar</option></select></label>` : ''}
  <div class="bar" style="margin:0"><button class="pri" type="submit">Guardar</button><button type="button" id="cx">Cancelar</button>${jj && can('admin', 'gerencia') ? '<button type="button" class="bad" id="del">Eliminar</button>' : ''}</div></form>`;
  document.body.appendChild(el);
  $('#cx', el).onclick = () => el.remove();
  const d = $('#del', el); if (d) d.onclick = async () => { const { error } = await sb.from('justificaciones').delete().eq('id', jj.id); if (error) return fail(error); el.remove(); toast('Eliminada'); done(); };
  $('form', el).onsubmit = async (ev) => {
    ev.preventDefault();
    const body = { motivo: $('#mo', el).value, observacion: $('#ob', el).value.trim() };
    let res;
    if (jj) { if (rev) body.estado = $('#es', el).value; res = await sb.from('justificaciones').update(body).eq('id', jj.id); }
    else res = await sb.from('justificaciones').insert({ ...body, tipo, registro_id: reg.id });
    if (res.error) return fail(res.error);
    el.remove(); toast('Justificación guardada'); done();
  };
}

/* ---------- SOS y SOE ---------- */
async function sos(host) {
  const m = host || $('#main'); const canEdit = can('admin', 'gerencia', 'supervisor');
  m.innerHTML = `<div class="bar"><label>Mes<input type="month" id="mes" value="${monthNow()}"></label>
  <label>Vista<select id="vw"><option value="ecm">Por ECM</option>${canEdit ? '<option value="det">Detalle editable</option>' : ''}</select></label>
  <label>Buscar<input id="q" placeholder="ECM, código o PDV"></label></div><div class="card"><div class="tw" id="tb"></div><p class="note" id="info"></p></div>`;
  const load = async () => {
    const [d, h] = range($('#mes').value);
    let rows = [], from = 0;
    for (;;) { const { data, error } = await sb.from('share_detalle').select('*').gte('fecha', d).lte('fecha', h).range(from, from + 999); if (error) return fail(error); rows = rows.concat(data); if (data.length < 1000 || rows.length >= 20000) break; from += 1000; }
    const q = norm($('#q').value);
    if (q) rows = rows.filter((r) => norm(`${r.ecm} ${r.codigo} ${r.pdv}`).includes(q));
    if ($('#vw').value === 'det') return detalleShare(rows.slice(0, 300), $('#info'));
    const g = {};
    rows.forEach((r) => {
      if (r.grupo === 'EXCLUIR') return; const e = (g[r.ecm || '—'] ||= { sup: r.supervisor, pt: 0, pc: 0, et: 0, ec: 0 });
      if (r.tipo === 'PERCHA') { e.pt += r.caras; if (r.grupo === 'CN') e.pc += r.caras; } else { e.et += r.caras; if (r.grupo === 'CN') e.ec += r.caras; }
    });
    const ms = Number(S.cfg.meta_sos || .8), me = Number(S.cfg.meta_soe || .8);
    const col = (v, meta) => v == null ? '' : `style="color:var(--${v >= meta ? 'ok' : 'bad'})"`;
    $('#tb').innerHTML = `<table><thead><tr><th>ECM</th><th>Supervisor</th><th class="n">Caras percha</th><th class="n">CN</th><th class="n">SOS</th><th class="n">Espacios</th><th class="n">CN</th><th class="n">SOE</th></tr></thead><tbody>${Object.entries(g).sort().map(([k, e]) => {
      const a = e.pt ? e.pc / e.pt : null, b = e.et ? e.ec / e.et : null;
      return `<tr><td>${esc(k)}</td><td>${esc(e.sup || '')}</td><td class="n">${e.pt}</td><td class="n">${e.pc}</td><td class="n" ${col(a, ms)}><b>${pct(a)}</b></td><td class="n">${e.et}</td><td class="n">${e.ec}</td><td class="n" ${col(b, me)}><b>${pct(b)}</b></td></tr>`;
    }).join('') || '<tr><td colspan="8" class="note">Sin datos.</td></tr>'}</tbody></table>`;
    $('#info').textContent = `Meta SOS ${pct(ms, 0)} · Meta SOE ${pct(me, 0)}. SOS = caras CN en percha ÷ total percha. SOE = caras CN en rumas y bandejas ÷ total espacios.`;
  };
  ['mes', 'vw'].forEach((id) => $('#' + id).onchange = () => load().catch(fail));
  let dt; $('#q').oninput = () => { clearTimeout(dt); dt = setTimeout(() => load().catch(fail), 350); };
  await load();
}
function detalleShare(rows, info) {
  info.textContent = rows.length >= 300 ? 'Mostrando 300; usa el buscador para afinar. Los cambios se guardan al salir del campo.' : 'Los cambios se guardan al salir del campo.';
  $('#tb').innerHTML = `<table><thead><tr><th>Fecha</th><th>Código</th><th>PDV</th><th>ECM</th><th>Tipo</th><th>Grupo</th><th class="n">Caras</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r.fecha)}</td><td>${esc(r.codigo)}</td><td>${esc(r.pdv || '')}</td><td>${esc(r.ecm || '')}</td><td>${esc(r.tipo)}</td>
  <td><select data-id="${r.id}" data-f="grupo">${['CN', 'HNK', 'MERC', 'OTROS', 'EXCLUIR'].map((x) => `<option ${x === r.grupo ? 'selected' : ''}>${x}</option>`).join('')}</select></td>
  <td class="n"><input type="number" min="0" style="width:90px" value="${r.caras}" data-id="${r.id}" data-f="caras"></td></tr>`).join('')}</tbody></table>`;
  document.querySelectorAll('[data-id]').forEach((el) => el.onchange = async () => {
    const v = el.dataset.f === 'caras' ? Math.max(0, parseInt(el.value, 10) || 0) : el.value;
    const { error } = await sb.from('share_detalle').update({ [el.dataset.f]: v }).eq('id', el.dataset.id);
    error ? fail(error) : toast('Guardado');
  });
}

/* ---------- Carga de bases (gerencia / admin) ---------- */
const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
/* Excel en configuración de EE. UU. deja los días 1–12 como fechas con día y mes intercambiados (12/11 → 11-dic) y los días 13+ como texto.
   Con las fechas «firmes» del archivo (día > 12) se sabe en qué rango están los datos: si una fecha ambigua cae fuera de ese rango y al
   intercambiar día y mes cae dentro, se corrige. Devuelve la función que arregla cada fecha ISO. */
CN.mapaFechas = (isos) => {
  const firmes = isos.filter((x) => x && +x.slice(8) > 12).sort(); if (firmes.length < 5) return (x) => x;
  const t = (x) => Date.parse(x + 'T00:00:00Z'), lo = t(firmes[0]) - 10 * 864e5, hi = t(firmes[firmes.length - 1]) + 10 * 864e5, dentro = (x) => t(x) >= lo && t(x) <= hi;
  return (x) => { if (!x) return x; const dd = +x.slice(8), mm = +x.slice(5, 7); if (dd > 12 || dd === mm) return x; const s = `${x.slice(0, 4)}-${String(dd).padStart(2, '0')}-${x.slice(5, 7)}`; return !dentro(x) && dentro(s) ? s : x; };
};
/* número de serie de Excel (p. ej. 46327 = 2026-11-01) → milisegundos en hora local de pared, o NaN si no parece una fecha */
const serialMs = (v) => (typeof v === 'number' && v > 30000 && v < 80000 ? Math.round((v - 25569) * 86400000) : NaN);
function toISO(v) {
  if (typeof v === 'number') { const t = serialMs(v); return isNaN(t) ? '' : new Date(t).toISOString().slice(0, 10); }
  if (v instanceof Date) return new Date(v.getTime() - v.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const s = String(v == null ? '' : v).trim(); let x;
  if ((x = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return `${x[1]}-${x[2]}-${x[3]}`;
  if ((x = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) return `${x[3]}-${x[2].padStart(2, '0')}-${x[1].padStart(2, '0')}`;
  return '';
}
async function leerExcel(file) {
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: true });
  return rows.map((r) => { const o = {}; Object.keys(r).forEach((k) => o[key(k)] = r[k]); return o; });
}
const g = (r, ...names) => { for (const n of names) { const v = r[key(n)]; if (v !== undefined && v !== '') return v; } return ''; };
const TXT = (v) => String(v == null ? '' : v).trim();
function supDeEcm(ecm, fallback) { const m = S.ecmMap.find((x) => ecmNorm(x.ecm) === ecm); return (m && m.supervisor) || TXT(fallback); }
const CARGAS = {
  visitas: { t: 'Visitas', ayuda: 'Excel de visitas (VISIT_DATE, BDR, CodigoCliente, Cliente, Supervisor, VISITAS EFECTIVAS, VISITAS PERDIDAS, EN RANGO…)', tabla: 'visitas', conflict: 'id',
    map(rows) { const seen = {}; return rows.map((r) => {
      const fecha = toISO(g(r, 'VISIT_DATE')); const ecm = ecmNorm(g(r, 'BDR')); if (!fecha || !ecm) return null;
      const ef = Number(g(r, 'VISITAS EFECTIVAS')) || 0, pe = Number(g(r, 'VISITAS PERDIDAS')) || 0;
      const categoria = ef > 0 ? 'E' : pe !== 0 ? 'P' : Number(g(r, 'EN RANGO')) !== 1 ? 'F' : 'M';
      const base = `${fecha}|${ecm}|${TXT(g(r, 'CodigoCliente'))}|${TXT(g(r, 'FechaInicioVisita'))}`; seen[base] = (seen[base] || 0) + 1;
      return { id: hash(base) + '-' + seen[base], fecha, region: TXT(g(r, 'Region')), gerencia: TXT(g(r, 'Gerencia_Ventas')), supervisor: supDeEcm(ecm, g(r, 'Supervisor')), ecm,
        codigo_cliente: TXT(g(r, 'CodigoCliente')), cliente: TXT(g(r, 'Cliente')), estado: TXT(g(r, 'EstadoVisita')), categoria,
        detalle: { just_no_completado: TXT(g(r, 'Justificacion NoCompletado')), just_final: TXT(g(r, 'Justificacion FinalRuta')) } };
    }).filter(Boolean); } },
  tareas: { t: 'Tareas', ayuda: 'Excel de tareas (SystemModstamp, SectorDesarrollo, CodigoCliente, Pilares, Descripcion, Estado_Tarea, ResultadoEfectividad_Tarea, URL_Imagen…). Las de equipo de frío se detectan con la expresión de Ajustes.', tabla: 'tareas', conflict: 'id',
    map(rows) { const seen = {}; let re; try { re = new RegExp(S.cfg.frio_regex || 'FRIO|EQUIPO'); } catch (e) { re = /FRIO|EQUIPO/; }
      return rows.map((r) => {
      const fecha = toISO(g(r, 'SystemModstamp')); const ecm = ecmNorm(g(r, 'SectorDesarrollo')); if (!fecha || !ecm) return null;
      const st = norm(g(r, 'Estado_Tarea')), res = norm(g(r, 'ResultadoEfectividad_Tarea'));
      const categoria = res === 'VALID' && st === 'FINISHED' ? 'E' : res === 'INVALID' && st === 'FINISHED' ? 'M' : st === 'JUSTIFIED' ? 'F' : st === 'FINISHED' ? 'M' : 'P';
      const pilar = TXT(g(r, 'Pilares')), desc = TXT(g(r, 'Descripcion'));
      const base = `${fecha}|${ecm}|${TXT(g(r, 'CodigoCliente'))}|${desc}`; seen[base] = (seen[base] || 0) + 1;
      const url = (v) => /^https?:\/\//i.test(TXT(v)) ? TXT(v) : null;
      return { id: hash(base) + '-' + seen[base], fecha, supervisor: supDeEcm(ecm, g(r, 'Supervisor')), ecm, codigo_cliente: TXT(g(r, 'CodigoCliente')), cliente: TXT(g(r, 'NombreCliente3')),
        pilar, descripcion: desc, estado: TXT(g(r, 'Estado_Tarea')), resultado: TXT(g(r, 'ResultadoEfectividad_Tarea')), categoria, es_frio: re.test(norm(pilar + ' ' + desc)),
        url_imagen: url(g(r, 'URL_Imagen')), url_link: url(g(r, 'URL_Link')), detalle: { estado_fotos: TXT(g(r, 'Estado Fotos')) } };
    }).filter(Boolean); } },
  share: { t: 'SOS / SOE', ayuda: 'Plantilla con columnas: fecha, codigo, pdv, ecm, tipo (PERCHA, RUMA, BANDEJA FRÍO, BANDEJA SECO), grupo (CN, HNK, MERC, OTROS, EXCLUIR), caras.', tabla: 'share_detalle', conflict: 'fecha,codigo,tipo,grupo,marca,sku',
    map(rows) { const acc = {}; rows.forEach((r) => {
      const fecha = toISO(g(r, 'fecha')); const codigo = TXT(g(r, 'codigo')); const ecm = ecmNorm(g(r, 'ecm'));
      const t = norm(g(r, 'tipo')); const tipo = /FRIO/.test(t) ? 'BANDEJA FRÍO' : /SECO/.test(t) ? 'BANDEJA SECO' : /RUMA/.test(t) ? 'RUMA' : /PERCHA/.test(t) ? 'PERCHA' : '';
      const grupo = norm(g(r, 'grupo')); if (!fecha || !codigo || !tipo || !['CN', 'HNK', 'MERC', 'OTROS', 'EXCLUIR'].includes(grupo)) return;
      const k = `${fecha}|${codigo}|${tipo}|${grupo}|${TXT(g(r, 'marca'))}|${TXT(g(r, 'sku'))}`; const caras = Math.max(0, Math.round(Number(String(g(r, 'caras')).replace(',', '.')) || 0));
      if (acc[k]) acc[k].caras += caras; else acc[k] = { fecha, codigo, pdv: TXT(g(r, 'pdv')), ecm, supervisor: supDeEcm(ecm, ''), tipo, grupo, marca: TXT(g(r, 'marca')), sku: TXT(g(r, 'sku')), caras };
    }); return Object.values(acc); } },
  ecm: { t: 'ECM → Supervisor', ayuda: 'Columnas: ecm, nombre, telefono, supervisor. Define a qué supervisor pertenece cada mercaderista.', tabla: 'ecm_map', conflict: 'ecm',
    map(rows) { return rows.map((r) => ({ ecm: ecmNorm(g(r, 'ecm')), nombre: TXT(g(r, 'nombre')), telefono: TXT(g(r, 'telefono')), supervisor: TXT(g(r, 'supervisor')) })).filter((x) => x.ecm); } },
  rutero: { t: 'Rutero', ayuda: 'Columnas: codigo (o CLIENTE_SAP), pdv (o NombreCliente3), region, cadena, ciudad, supervisor, ecm, dia_visita.', tabla: 'rutero', conflict: 'codigo',
    map(rows) { return rows.map((r) => ({ codigo: TXT(g(r, 'codigo', 'CLIENTE_SAP')), pdv: TXT(g(r, 'pdv', 'NombreCliente3')), region: TXT(g(r, 'region')), cadena: TXT(g(r, 'cadena')), ciudad: TXT(g(r, 'ciudad')), supervisor: TXT(g(r, 'supervisor')), ecm: ecmNorm(g(r, 'ecm')), dia_visita: TXT(g(r, 'dia_visita', 'DiaVisitaBDR')) })).filter((x) => x.codigo); } }
};
async function carga() {
  $('#main').innerHTML = Object.entries(CARGAS).map(([k, c]) => `<div class="card"><h3>${c.t}</h3><p class="note">${esc(c.ayuda)}</p>
  <div class="bar"><input type="file" accept=".xlsx,.xls,.csv" id="f_${k}"><button class="pri" data-up="${k}">Cargar</button></div><p class="note" id="r_${k}"></p></div>`).join('') +
  `<p class="note">Cargar de nuevo la misma base actualiza los registros existentes y no borra las justificaciones.</p>`;
  document.querySelectorAll('[data-up]').forEach((b) => b.onclick = async () => {
    const k = b.dataset.up, c = CARGAS[k], f = $('#f_' + k).files[0], out = $('#r_' + k);
    if (!f) return toast('Elige un archivo');
    b.disabled = true;
    try {
      if (c.run) { await c.run(f, out); return; }
      out.textContent = 'Leyendo archivo…';
      const data = c.map(await leerExcel(f));
      if (!data.length) throw new Error('No encontré filas válidas. Revisa los encabezados.');
      for (let i = 0; i < data.length; i += 500) {
        out.textContent = `Subiendo ${Math.min(i + 500, data.length)} de ${data.length}…`;
        const { error } = await sb.from(c.tabla).upsert(data.slice(i, i + 500), { onConflict: c.conflict });
        if (error) throw error;
      }
      out.textContent = `Listo: ${data.length} registros cargados.`;
      if (k === 'ecm') { S.ecmMap = (await sb.from('ecm_map').select('*')).data || []; CN.ecmSync(); }
    } catch (e) { out.textContent = ''; fail(e); } finally { b.disabled = false; }
  });
}

/* ---------- Administración ---------- */
async function admin() {
  const [u, c, mo] = await Promise.all([sb.from('profiles').select('*').order('usuario'), sb.from('config').select('*').order('clave'), sb.from('motivos').select('*').order('motivo')]);
  const m = $('#main');
  m.innerHTML = `<div class="card"><div class="bar"><h2 style="flex:1">Usuarios</h2><button class="pri" id="nu">Nuevo usuario</button></div><div class="tw"><table><thead><tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>ECM</th><th>Supervisor</th><th>Activo</th><th></th></tr></thead><tbody>
  ${(u.data || []).map((x) => `<tr><td>${esc(x.usuario)}</td><td>${esc(x.nombre)}</td><td>${ROL_TXT[x.rol]}</td><td>${esc(x.ecm_code || '')}</td><td>${esc(x.supervisor || '')}</td><td>${x.activo ? 'Sí' : 'No'}</td>
  <td><button data-pw="${x.id}">Nueva clave</button> <button data-act="${x.id}" data-v="${x.activo}">${x.activo ? 'Desactivar' : 'Activar'}</button> <button class="bad" data-rm="${x.id}">Eliminar</button></td></tr>`).join('')}</tbody></table></div></div>
  <div class="card"><h2>Pesos y metas</h2><div class="grid" style="margin-top:8px">${(c.data || []).map((x) => `<label>${esc(x.clave)}<input data-cfg="${esc(x.clave)}" value="${esc(x.valor)}"></label>`).join('')}</div>
  <p class="note">w_* son los pesos del puntaje (deben sumar 100). meta_sos / meta_soe en decimal (0.8 = 80%). frio_regex: texto que identifica tareas de equipo de frío (se aplica al cargar tareas).</p></div>
  <div class="card"><div class="bar"><h2 style="flex:1">Catálogo de motivos</h2><button id="nm">Nuevo motivo</button></div><div class="tw"><table><thead><tr><th>Motivo</th><th>Aplica a</th><th>Responsable</th><th>Activo</th><th></th></tr></thead><tbody>
  ${(mo.data || []).map((x) => `<tr><td>${esc(x.motivo)}</td><td>${x.tipo}</td><td>${esc(x.responsable)}</td><td>${x.activo ? 'Sí' : 'No'}</td><td><button data-mt="${x.id}" data-v="${x.activo}">${x.activo ? 'Desactivar' : 'Activar'}</button></td></tr>`).join('')}</tbody></table></div>
  <p class="note">Responsable «CN» = justificación válida (no penaliza la efectividad). Cualquier otro = sí penaliza.</p></div>`;
  const fn = async (body) => { const { data, error } = await sb.functions.invoke('admin-users', { body }); if (error || (data && data.error)) throw new Error((data && data.error) || error.message); };
  $('#nu').onclick = () => modalUsuario(fn);
  document.querySelectorAll('[data-pw]').forEach((b) => b.onclick = async () => { const p = prompt('Nueva clave (mínimo 8 caracteres):'); if (!p) return; try { await fn({ action: 'password', id: b.dataset.pw, password: p }); toast('Clave actualizada'); } catch (e) { fail(e); } });
  document.querySelectorAll('[data-rm]').forEach((b) => b.onclick = async () => { if (!confirm('¿Eliminar este usuario definitivamente?')) return; try { await fn({ action: 'delete', id: b.dataset.rm }); admin(); } catch (e) { fail(e); } });
  document.querySelectorAll('[data-act]').forEach((b) => b.onclick = async () => { const { error } = await sb.from('profiles').update({ activo: b.dataset.v !== 'true' }).eq('id', b.dataset.act); error ? fail(error) : admin(); });
  document.querySelectorAll('[data-cfg]').forEach((i) => i.onchange = async () => { const { error } = await sb.from('config').update({ valor: i.value.trim() }).eq('clave', i.dataset.cfg); if (error) return fail(error); S.cfg[i.dataset.cfg] = i.value.trim(); toast('Guardado'); });
  document.querySelectorAll('[data-mt]').forEach((b) => b.onclick = async () => { const { error } = await sb.from('motivos').update({ activo: b.dataset.v !== 'true' }).eq('id', b.dataset.mt); if (error) return fail(error); S.motivos = (await sb.from('motivos').select('*').eq('activo', true).order('motivo')).data; admin(); });
  $('#nm').onclick = async () => {
    const motivo = prompt('Nombre del motivo:'); if (!motivo) return;
    const resp = (prompt('Responsable (CN = no penaliza; ASESOR = penaliza):', 'CN') || 'CN').toUpperCase();
    const tipo = prompt('Aplica a: vis, tar o ambos', 'ambos');
    if (!['vis', 'tar', 'ambos'].includes(tipo)) return toast('Tipo inválido');
    const { error } = await sb.from('motivos').insert({ motivo: motivo.trim(), responsable: resp.trim(), tipo }); if (error) return fail(error);
    S.motivos = (await sb.from('motivos').select('*').eq('activo', true).order('motivo')).data; admin();
  };
}
function modalUsuario(fn) {
  const el = document.createElement('div'); el.className = 'modal';
  el.innerHTML = `<form class="box"><h3>Nuevo usuario</h3>
  <label>Usuario<input id="nu_u" required pattern="[A-Za-z0-9._-]+"></label><label>Nombre<input id="nu_n" required></label>
  <label>Rol<select id="nu_r">${Object.entries(ROL_TXT).map(([k, v]) => `<option value="${k}" ${k === 'asesor' ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
  <label>Código ECM/BDR (mercaderista)<input id="nu_e" placeholder="ECM031"></label><label>Supervisor (como viene en las bases)<input id="nu_s"></label>
  <label>Contraseña inicial (mín. 8)<input id="nu_p" type="password" minlength="8" required></label>
  <div class="bar" style="margin:0"><button class="pri">Crear</button><button type="button" id="cx">Cancelar</button></div></form>`;
  document.body.appendChild(el); $('#cx', el).onclick = () => el.remove();
  $('form', el).onsubmit = async (ev) => {
    ev.preventDefault();
    try { await fn({ action: 'create', usuario: $('#nu_u', el).value, nombre: $('#nu_n', el).value, rol: $('#nu_r', el).value, ecm_code: ecmNorm($('#nu_e', el).value) || null, supervisor: $('#nu_s', el).value.trim() || null, password: $('#nu_p', el).value }); el.remove(); toast('Usuario creado'); admin(); }
    catch (e) { fail(e); }
  };
}

Object.assign(VIEWS, { dashboard, visitas: () => registros('vis'), tareas: () => registros('tar'), sos, carga, admin });
window.addEventListener('load', () => boot().catch(fail));
