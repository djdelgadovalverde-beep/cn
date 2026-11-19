'use strict';
/* Asignar motivos: migración completa del módulo de registro del sistema anterior.
   Estados · reincidencia y réplica · WhatsApp · fotos · enlaces de Involves · sugerencias · filtros múltiples · guardado por lotes · PDV reincidentes · historial. */
(function () {
  NAV.registro = ['Asignar motivos', ['admin', 'gerencia', 'supervisor', 'asesor']];
  const { n: fN, p: f1, pc } = VZ;
  const CATLX = { vis: { P: 'Perdida', F: 'Fuera de rango', M: '< 2 min' }, tar: { P: 'Abierta', F: 'Justificada', M: 'Mal ejecutada' } };
  const ESTL = { pend: 'Pendiente', gest: 'En gestión', js: 'Justificada sin foto', jf: 'Justificada con foto / Involves' };
  const TABS = [['asignar', 'Asignar motivos'], ['rei', 'PDV reincidentes'], ['reg', 'Justificaciones registradas']];
  const hoy = () => new Date().toISOString().slice(0, 10), add = (d, k) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + k); return t.toISOString().slice(0, 10); };
  const RG = { tipo: 'vis', tab: 'asignar', from: '', to: '', est: 'pend', cat: [], dia: [], sup: [], ecm: [], dur: [], q: '', rei: false, rmin: 2, sg: false, page: 0, cli: '' };
  const DATA = {}, DIRTY = {}, SEL = new Set(), PG = 25, WAG = { o: '', q: '¿Me ayudas indicando cuál fue el motivo? Gracias' }, WAO = {}; let REGLAS = null, UB = null, REIC = new Map(), PJ = {}, HOST = null, ROWS = {};
  const ECMI = () => Object.fromEntries((S.ecmMap || []).map((e) => [ecmNorm(e.ecm), [e.nombre || '', e.telefono || '']]));
  const ymd = (d) => String(d).slice(5, 10).split('-').reverse().join('/');

  /* ---------- datos ---------- */
  async function cargar(tp, forzar) {
    const k = `${tp}|${RG.from}|${RG.to}`; if (DATA[tp] && DATA[tp].k === k && !forzar) return DATA[tp];
    if (forzar && CN.invalidarAnalisis) CN.invalidarAnalisis();
    const [V, E, G, L] = await Promise.all([CN.cargarVT(tp, RG.from, RG.to), CN.fetchPar((o) => sb.from('evidencias').select('registro_id', o).eq('tipo', tp).order('id')),
      CN.fetchPar((o) => sb.from('gestion').select('registro_id,obs', o).eq('tipo', tp).order('registro_id')), tp === 'vis' ? CN.fetchPar((o) => sb.from('enlaces').select('visita_id', o).gte('fecha', RG.from).lte('fecha', RG.to).order('visita_id')) : Promise.resolve([])]);
    if (!REGLAS) REGLAS = (await sb.from('reglas_sugerencia').select('*')).data || [];
    if (!UB) UB = Object.fromEntries(((await sb.from('ubicaciones').select('*')).data || []).map((u) => [u.codigo, u]));
    const EV = new Map(), GE = new Map(), LK = new Set(); E.forEach((x) => EV.set(x.registro_id, (EV.get(x.registro_id) || 0) + 1)); G.forEach((x) => GE.set(x.registro_id, x.obs || '')); L.forEach((x) => LK.add(x.visita_id));
    const R = V.R.filter((r) => r.c !== 'E'); R.forEach((r) => (ROWS[r.id] = r));
    return (DATA[tp] = { k, R, EV, GE, LK });
  }
  const D_ = () => DATA[RG.tipo];
  const cMot = (r) => (DIRTY[r.id] ? DIRTY[r.id].m : (r.j ? r.j.motivo : '')), cObs = (r) => (DIRTY[r.id] ? DIRTY[r.id].o : (r.j ? r.j.observacion || '' : ''));
  const respDe = (m) => { const c = (S.motivos || []).find((x) => norm(x.motivo) === norm(m)); return c ? c.responsable : ''; };
  const respRow = (r) => (DIRTY[r.id] ? respDe(DIRTY[r.id].m) : r.j ? r.j.responsable : '');
  const conEv = (r) => { const d = DATA[tipoDe(r)]; return (d.EV.get(r.id) || 0) > 0 || d.LK.has(r.id) || /https?:\/\//i.test(cObs(r)); };
  const tipoDe = (r) => (r.id.startsWith('V|') ? 'vis' : 'tar');
  const estOf = (r) => (cMot(r) ? (conEv(r) ? 'jf' : 'js') : DATA[tipoDe(r)].GE.has(r.id) ? 'gest' : 'pend');
  const rb = (x) => (x ? `<span class="rb ${x === 'CN' || x === 'SGF' ? x : ''}">${esc(x)}</span>` : '<span class="mu">—</span>');
  const aplicaA = (c, t) => c.tipo === 'ambos' || c.tipo === t;
  const motOpts = (tp, cur) => { const g = {}; (S.motivos || []).filter((c) => (c.activo && aplicaA(c, tp)) || norm(c.motivo) === norm(cur)).forEach((c) => (g[c.responsable] ||= []).push(c));
    return '<option value="">— Sin motivo —</option>' + Object.keys(g).sort((p, q) => (p === 'CN' ? 0 : p === 'SGF' ? 1 : 2) - (q === 'CN' ? 0 : q === 'SGF' ? 1 : 2)).map((r) => `<optgroup label="Responsable ${esc(r)}">${g[r].map((c) => `<option value="${esc(c.motivo)}" ${norm(c.motivo) === norm(cur) ? 'selected' : ''}>${esc(c.motivo)}</option>`).join('')}</optgroup>`).join(''); };

  /* ---------- sugerencias (reglas de la hoja + aprendizaje del historial) ---------- */
  let LEARN = null;
  function sugerir(r) {
    if (r.sg !== undefined) return r.sg; const tp = tipoDe(r), t = norm((r.jus === 'SIN JUSTIFICACIÓN' ? '' : r.jus) + ' ' + (r.jtxt || '') + ' ' + (r.fotos || '')); let s = '';
    for (const x of REGLAS || []) if (t.includes(norm(x.palabra))) { const c = (S.motivos || []).find((m) => norm(m.motivo) === norm(x.motivo)); if (c && c.activo && aplicaA(c, tp)) { s = c.motivo; break; } }
    if (!s && r.jus && r.jus !== 'SIN JUSTIFICACIÓN') { if (!LEARN) { LEARN = {}; Object.values(DATA).forEach((d) => d.R.forEach((x) => { if (x.j && x.jus !== 'SIN JUSTIFICACIÓN') { const k = norm(x.jus).slice(0, 60); (LEARN[k] ||= {})[x.j.motivo] = ((LEARN[k] || {})[x.j.motivo] || 0) + 1; } })); }
      const o = LEARN[norm(r.jus).slice(0, 60)]; if (o) { let tot = 0, bm = '', bn = 0; for (const m in o) { tot += o[m]; if (o[m] > bn) { bn = o[m]; bm = m; } } if (tot >= 3 && bn / tot >= 0.7) { const c = (S.motivos || []).find((m) => norm(m.motivo) === norm(bm)); if (c && c.activo && aplicaA(c, tp)) s = c.motivo; } } }
    return (r.sg = s);
  }

  /* ---------- filtros, reincidencia, réplica ---------- */
  const inA = (a, v) => !a.length || a.includes(v);
  function regFil(skip) {
    const sk = (k) => skip && skip.includes(k), d = D_(); let L = d.R.filter((r) => inA(RG.cat, r.c) && inA(RG.dia, r.d.slice(8)) && (!RG.cli || r.cli === RG.cli) && inA(RG.sup, r.sup) && inA(RG.ecm, r.ecm) && (RG.tipo !== 'vis' || !RG.dur.length || RG.dur.some((v) => durOk(v, r))));
    if (sk('est')) return L; if (RG.q) { const q = norm(RG.q); L = L.filter((r) => norm(r.cn + r.cli + r.ecm + r.jus).includes(q)); }
    if (RG.rei) L = L.filter(isRei); if (RG.est === 'done') L = L.filter((r) => cMot(r)); else if (RG.est !== 'all') L = L.filter((r) => estOf(r) === RG.est);
    if (RG.sg) L = L.filter((r) => !cMot(r) && sugerir(r)); return L;
  }
  const durOk = (v, r) => { const m = r.min; if (v === 'nd') return m == null; if (m == null) return false; const p = v.split('-'); return m >= +p[0] && (p[1] === '' || m < +p[1]); };
  function reiSet() { const m = new Map(); regFil(['est']).forEach((r) => { const o = m.get(r.cli) || { cli: r.cli, cn: r.cn, ecm: new Set(), dias: new Set(), P: 0, F: 0, M: 0, rows: [] }; o.ecm.add(r.ecm); o.dias.add(r.d); o[r.c]++; o.rows.push(r); m.set(r.cli, o); }); m.forEach((o) => (o.n = o.dias.size)); REIC = m; }
  const isRei = (r) => { const o = REIC.get(r.cli); return !!o && o.n >= RG.rmin; };
  const reiHint = (o) => { const f = o.F + o.M, p = o.P; return f >= p && f >= 2 ? 'repite fuera de rango o visitas muy cortas: revisar la geolocalización del PDV' : p >= 2 ? 'repite sin visita: revisar acceso o seguridad de la zona' : 'revisar el PDV'; };
  const reiDias = (o) => { const d = {}; o.rows.forEach((r) => { const x = (d[r.d] ||= { s: 0, j: 0 }); cMot(r) ? x.j++ : x.s++; }); const sj = [], jj = []; Object.keys(d).sort().forEach((k) => (d[k].s ? sj : jj).push(k)); return { sj, j: jj }; };
  const reiB = (r) => { const o = REIC.get(r.cli); if (!o || o.n < RG.rmin) return ''; const dz = reiDias(o); return `<span class="rei" title="${esc('Fallas: ' + (dz.sj.length ? 'sin justificar ' + dz.sj.map(ymd).join(', ') + '. ' : '') + (dz.j.length ? 'justificadas ' + dz.j.map(ymd).join(', ') + '. ' : '') + 'Posible causa: ' + reiHint(o))}">🔁 ${o.n} días con falla</span>`; };
  function rjBuild() { PJ = {}; D_().R.forEach((r) => { if (!cMot(r)) return; (PJ[r.ecm + '|' + r.cli + '|' + r.c] ||= []).push(r); }); Object.values(PJ).forEach((a) => a.sort((x, y) => (x.d < y.d ? -1 : 1))); }
  const rjPrev = (r) => { if (cMot(r)) return null; const a = PJ[r.ecm + '|' + r.cli + '|' + r.c]; if (!a) return null; let p = null; for (const x of a) if (x.d < r.d && x.id !== r.id) p = x; return p; };

  /* ---------- cambios sin guardar ---------- */
  function setDirty(id, m, o) { const r = ROWS[id]; if (!r) return; const orig = r.j ? [r.j.motivo, r.j.observacion || ''] : ['', '']; if (m === orig[0] && (o || '') === orig[1]) delete DIRTY[id]; else DIRTY[id] = { m, o: o || '' }; }
  const nDirty = () => Object.keys(DIRTY).length;
  async function guardar() {
    const ids = Object.keys(DIRTY); if (!ids.length) return; let ok = 0; const errs = [];
    for (let i = 0; i < ids.length; i += 15) await Promise.all(ids.slice(i, i + 15).map(async (id) => {
      const r = ROWS[id], x = DIRTY[id]; try {
        let q; if (!x.m) { if (r.j && can('admin', 'gerencia')) q = sb.from('justificaciones').delete().eq('id', r.j.id); else { delete DIRTY[id]; return; } }
        else if (r.j) q = sb.from('justificaciones').update({ motivo: x.m, observacion: x.o || null }).eq('id', r.j.id);
        else q = sb.from('justificaciones').insert({ tipo: tipoDe(r), registro_id: id, motivo: x.m, observacion: x.o || null });
        const { error } = await q; if (error) throw error; delete DIRTY[id]; ok++;
      } catch (e) { errs.push(e.message); } }));
    toast(`${ok} guardados${errs.length ? ` · ${errs.length} con error: ${errs[0]}` : ''}`); if (CN.invalidarAnalisis) CN.invalidarAnalisis(); await cargar(RG.tipo, true); LEARN = null; render();
  }

  /* ---------- WhatsApp ---------- */
  const waNum = (t) => { let d = String(t || '').replace(/\D/g, ''); if (!d) return ''; if (d.startsWith('00')) d = d.slice(2); if (d.length >= 9) { const l = d.slice(-9), pre = d.slice(0, -9); if (l[0] === '9' && /^(|0|593|5930|59320|593020|5932|59302|2|20|02)$/.test(pre)) return '593' + l; } if (d.length >= 11) return d; if (d.startsWith('0')) d = d.slice(1); return d.length === 9 ? '593' + d : ''; };
  const waObs = (e) => { const t = [WAG.o, WAO[e]].map((x) => String(x || '').trim()).filter(Boolean); return t.length ? '\n\nObservación: ' + t.join(' · ') : ''; };
  function waMsg(ecm, rows, tp) { const full = (ECMI()[ecm] || [''])[0], nm = full ? full.split(' ')[0] : '', dias = new Set(rows.map((r) => r.d)).size, what = tp === 'vis' ? 'visitas no efectivas' : 'tareas no efectivas', MX = 15;
    const L = [...rows].sort((a, b) => (a.d < b.d ? -1 : 1)).slice(0, MX).map((r) => `• ${ymd(r.d)} · ${r.cn} (${r.cli}) – ${CATLX[tp][r.c]}`);
    return `Hola${nm ? ' ' + nm : ''}, tengo ${dias} día${dias > 1 ? 's' : ''} con ${what} contigo en estos PDV:\n${L.join('\n')}${rows.length > MX ? '\n… y ' + (rows.length - MX) + ' más' : ''}${waObs(ecm)}\n\n${WAG.q}`; }
  const waUrl = (ecm, rows, tp) => { const n = waNum((ECMI()[ecm] || [])[1]); return n ? 'https://wa.me/' + n + '?text=' + encodeURIComponent(waMsg(ecm, rows, tp)) : ''; };
  async function setGest(ids, activo, obs) {
    const tp = RG.tipo; ids = ids.filter((id) => ROWS[id] && tipoDe(ROWS[id]) === tp); if (!ids.length) return;
    try { if (activo) { const { error } = await sb.from('gestion').upsert(ids.map((id) => ({ tipo: tp, registro_id: id, obs: obs || null })), { onConflict: 'tipo,registro_id' }); if (error) throw error; ids.forEach((id) => D_().GE.set(id, obs || '')); }
      else { for (const part of CN.chunks(ids, 100)) { const { error } = await sb.from('gestion').delete().eq('tipo', tp).in('registro_id', part); if (error) throw error; } ids.forEach((id) => D_().GE.delete(id)); } } catch (e) { fail(e); }
  }
  function waPanel(ids) {
    const tp = RG.tipo, G = {}; ids.forEach((id) => { const r = ROWS[id]; if (r && tipoDe(r) === tp) (G[r.ecm] ||= []).push(r); }); const E = Object.keys(G).sort(); if (!E.length) return toast('Selecciona primero los registros.');
    const m = document.createElement('div'); m.className = 'modal'; const lnk = (e) => waUrl(e, G[e], tp), I = ECMI();
    m.innerHTML = `<div class="box" style="max-width:760px"><div class="bar" style="margin:0"><h3 style="flex:1">WhatsApp a los ECM</h3><button type="button" id="wax">✕</button></div><p class="note">Se abre un chat por ECM con el mensaje ya escrito (WhatsApp Web o la aplicación). Al abrirlo, los registros pasan a «En gestión».</p>
      <label>Observación para todos los mensajes (opcional)<textarea id="wag" rows="2" maxlength="250">${esc(WAG.o)}</textarea></label><label>Pregunta final del mensaje<input id="waq" value="${esc(WAG.q)}"></label>
      ${E.filter(lnk).length > 1 ? `<div class="bar" style="margin:6px 0"><button type="button" class="pri" id="waall">💬 Abrir los ${E.filter(lnk).length} chats a la vez</button><span class="note">Abre un chat por ECM en pestañas nuevas; solo pulsa «Enviar» en cada uno. Si el navegador bloquea las ventanas, permítelas para este sitio.</span></div>` : ''}
      <div class="tw" style="max-height:46vh;overflow:auto">${E.map((e) => { const rs = G[e], u = lnk(e), nm = (I[e] || [])[0], tel = (I[e] || [])[1]; return `<div class="card" style="margin:8px 0;padding:10px"><b>${esc(e)}${nm ? ' · ' + esc(nm) : ''}</b> <span class="note">${rs.length} PDV · ${new Set(rs.map((r) => r.d)).size} día(s)${tel ? ' · ' + esc(tel) : ''}</span>
        ${u ? `<div class="bar" style="margin:6px 0 0"><a class="wa" data-wae="${esc(e)}" target="_blank" rel="noopener" href="${esc(u)}"><button type="button" class="pri">💬 Abrir WhatsApp</button></a><label style="flex:1">Observación solo para ${esc(nm || e)}<textarea data-wao="${esc(e)}" rows="1" maxlength="250">${esc(WAO[e] || '')}</textarea></label></div>` : '<p class="negc">Sin teléfono: agrégalo en «Equipo ECM».</p>'}</div>`; }).join('')}</div></div>`;
    document.body.appendChild(m); const upd = () => m.querySelectorAll('a[data-wae]').forEach((a) => (a.href = lnk(a.dataset.wae))), obsDe = (e) => waObs(e).replace(/^\s*Observación: /, '').trim();
    $('#wax', m).onclick = () => { m.remove(); render(); }; $('#waq', m).oninput = (ev) => { WAG.q = ev.target.value; upd(); }; $('#wag', m).oninput = (ev) => { WAG.o = ev.target.value; upd(); };
    m.querySelectorAll('textarea[data-wao]').forEach((t) => (t.oninput = () => { WAO[t.dataset.wao] = t.value; upd(); }));
    m.querySelectorAll('a[data-wae]').forEach((a) => a.addEventListener('click', () => setGest(G[a.dataset.wae].map((r) => r.id).filter((id) => !cMot(ROWS[id])), true, obsDe(a.dataset.wae))));
    const all = $('#waall', m); if (all) all.onclick = () => { let ab = 0, ok = 0; E.filter(lnk).forEach((e) => { const w = window.open(lnk(e), '_blank', 'noopener'); if (w === null) ab++; else { ok++; setGest(G[e].map((r) => r.id).filter((id) => !cMot(ROWS[id])), true, obsDe(e)); } }); toast(ab ? `Se abrieron ${ok}; el navegador bloqueó ${ab}. Permite las ventanas emergentes y pulsa de nuevo.` : `Se abrieron ${ok} chats. Pulsa «Enviar» en cada uno.`); };
  }

  /* ---------- fotos (evidencias) ---------- */
  function imgBlob(file, max = 1280) { return new Promise((ok, ko) => { const fr = new FileReader(); fr.onerror = () => ko(new Error('No se pudo leer la imagen')); fr.onload = () => { const im = new Image(); im.onerror = () => ko(new Error('Imagen no válida')); im.onload = () => { const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k)); const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height); c.toBlob((b) => (b ? ok(b) : ko(new Error('No se pudo procesar la imagen'))), 'image/jpeg', 0.72); }; im.src = fr.result; }; fr.readAsDataURL(file); }); }
  async function subirFoto(ids, file) { const tp = RG.tipo, blob = await imgBlob(file), path = `${tp}/${crypto.randomUUID()}.jpg`; const up = await sb.storage.from('evidencias').upload(path, blob, { contentType: 'image/jpeg' }); if (up.error) throw up.error;
    const { error } = await sb.from('evidencias').insert(ids.map((id) => ({ tipo: tp, registro_id: id, path }))); if (error) { await sb.storage.from('evidencias').remove([path]); throw error; } ids.forEach((id) => D_().EV.set(id, (D_().EV.get(id) || 0) + 1)); }
  async function evPanel(id) {
    const r = ROWS[id], m = document.createElement('div'); m.className = 'modal'; m.dataset.ev = id;
    m.innerHTML = `<div class="box" style="max-width:640px"><div class="bar" style="margin:0"><h3 style="flex:1">Evidencia</h3><button type="button" id="evx">✕</button></div><p class="note">${esc(r.d)} · ${esc(r.cn)} (${esc(r.cli)}) · ${esc(r.ecm)}</p>
      <div class="evz" id="evz" tabindex="0"><b>Pega aquí la imagen</b> con Ctrl+V (captura o foto copiada)<br>o <label class="evf">elige / toma una foto<input type="file" accept="image/*" multiple hidden id="evf"></label>, o arrástrala hasta aquí.</div><p class="note" id="evn"></p><div class="evg" id="evg"></div>
      <p class="note">Un registro con motivo y al menos una imagen, o con el enlace de Involves en la observación, queda como «Justificada con foto / Involves».</p></div>`;
    document.body.appendChild(m); $('#evx', m).onclick = () => { m.remove(); render(); }; $('#evz', m).focus();
    const dibujar = async () => { const { data } = await sb.from('evidencias').select('*').eq('tipo', RG.tipo).eq('registro_id', id).order('creado_en'); const L = data || []; D_().EV.set(id, L.length); $('#evn', m).textContent = L.length + ' de 5 imágenes'; const g = $('#evg', m); g.innerHTML = '';
      if (!L.length) { g.innerHTML = '<p class="mu">Aún no hay imágenes.</p>'; return; } const { data: urls } = await sb.storage.from('evidencias').createSignedUrls(L.map((x) => x.path), 3600);
      L.forEach((x, i) => { const u = urls && urls[i] && urls[i].signedUrl; const f = document.createElement('figure'); f.innerHTML = `<a href="${esc(u || '#')}" target="_blank" rel="noopener noreferrer"><img src="${esc(u || '')}" alt="Evidencia ${i + 1}"></a><button type="button" class="bad">Quitar</button>`;
        f.querySelector('button').onclick = async () => { if (!confirm('¿Quitar esta foto?')) return; await sb.from('evidencias').delete().eq('id', x.id); const { count } = await sb.from('evidencias').select('id', { count: 'exact', head: true }).eq('path', x.path); if (!count) await sb.storage.from('evidencias').remove([x.path]); dibujar(); }; g.appendChild(f); }); };
    const add = async (files) => { for (const f of files) { if ((D_().EV.get(id) || 0) >= 5) { toast('Máximo 5 imágenes por registro.'); break; } try { toast('Subiendo imagen…'); await subirFoto([id], f); await dibujar(); } catch (e) { fail(e); } } };
    $('#evf', m).onchange = (e) => { add([...e.target.files]); e.target.value = ''; }; const z = $('#evz', m); z.ondragover = (e) => { e.preventDefault(); z.classList.add('on'); }; z.ondragleave = () => z.classList.remove('on'); z.ondrop = (e) => { e.preventDefault(); z.classList.remove('on'); add([...e.dataTransfer.files].filter((f) => /^image\//.test(f.type))); };
    m.addEventListener('paste', (e) => { const fs = [...((e.clipboardData && e.clipboardData.items) || [])].filter((i) => i.kind === 'file' && /^image\//.test(i.type)).map((i) => i.getAsFile()).filter(Boolean); if (fs.length) { e.preventDefault(); add(fs); } else toast('El portapapeles no tiene una imagen.'); }); await dibujar();
  }
  async function fotoGrupal(ids) { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.onchange = async () => { if (!inp.files[0]) return; try { toast(`Subiendo la foto a ${ids.length} registros…`); await subirFoto(ids, inp.files[0]); toast(`Foto agregada a ${ids.length} registros`); render(); } catch (e) { fail(e); } }; inp.click(); }

  /* ---------- enlaces de Involves ---------- */
  const LK_L = { e: 'Efectividad', ci: 'Check-in', co: 'Check-out', a: 'Foto antes', d: 'Foto después' };
  const lkObs = (ps, pre, tag) => { const tx = []; let L = (pre ? pre.length + 3 : 0) + 22, om = 0; ps.forEach(([l, u]) => { const q = l + ': ' + u; if (L + q.length + 3 <= 760) { tx.push(q); L += q.length + 3; } else om++; }); return (pre ? pre + ' · ' : '') + 'Evidencia ' + (tag || 'Involves') + ' — ' + tx.join(' | ') + (om ? ` (+${om} enlaces no caben)` : ''); };
  const urls = (v) => String(v || '').split(/[\s,]+/).filter((x) => /^https?:/i.test(x));
  async function lkPanel(id) {
    const r = ROWS[id], tp = tipoDe(r); let G = {}, nota = '', cuerpo = '';
    if (tp === 'vis') { const { data } = await sb.from('enlaces').select('*').eq('visita_id', id).maybeSingle(); if (!data) return toast('Esta visita no tiene enlaces cargados.'); G = { e: urls(data.efectividad), ci: urls(data.check_in), co: urls(data.check_out), a: urls(data.foto_antes), d: urls(data.foto_despues) }; nota = data.novedades || ''; if ((data.coincidencia || '').startsWith('NOMBRE')) cuerpo = `<p class="note">⚠ Cruzado por parecido de nombre: ${esc(data.coincidencia.replace(/^NOMBRE /, ''))}. Verifica que sea el mismo punto de venta.</p>`; }
    else { const { data } = await sb.from('tareas').select('url_imagen,url_link,detalle').eq('id', id).single(); G = { i: urls(data.url_imagen), l: urls(data.url_link) }; nota = (data.detalle || {}).estado_fotos || ''; }
    const LB = tp === 'vis' ? LK_L : { i: 'Imagen de la tarea', l: 'Link de la tarea' }, m = document.createElement('div'), all = Object.values(G).flat().length; m.className = 'modal';
    m.innerHTML = `<div class="box" style="max-width:640px"><div class="bar" style="margin:0"><h3 style="flex:1">Enlaces de ${tp === 'vis' ? 'la visita' : 'la tarea'}</h3><button type="button" id="lkx">✕</button></div><p class="note">${esc(r.d)} · ${esc(r.cn)} (${esc(r.cli)}) · ${esc(r.ecm)} · ${esc(CATLX[tp][r.c])}${r.min != null ? ' · Duración ' + r.min.toFixed(1) + ' min' : ''}</p>${cuerpo}
      ${Object.entries(LB).map(([k, t]) => (G[k] && G[k].length ? `<div style="margin:8px 0"><b>${t}</b><div class="bar" style="margin:4px 0">${G[k].map((u, i) => `<label class="mso"><input type="checkbox" data-lk="${k}" value="${esc(u)}" ${(k === 'e' || k === 'i') && i === 0 ? 'checked' : ''}><a href="${esc(safeUrl(u))}" target="_blank" rel="noopener noreferrer">Abrir ${i + 1} ↗</a></label>`).join('')}</div></div>` : '')).join('') || '<p class="mu">Sin enlaces.</p>'}
      ${nota ? `<p><b>${tp === 'vis' ? 'Novedades del PDV' : 'Estado de fotos'}</b><br>${esc(nota)}</p>` : ''}
      ${all ? `<div class="card" style="margin:10px 0 0"><b>Conectar como justificación</b><p class="note">Marca las fotos que quieres dejar conectadas a este registro (ábrelas con «Abrir» para revisarlas).</p><label>Motivo<select id="lkm">${motOpts(tp, cMot(r))}</select></label><label>Observación (opcional)<input id="lkob" maxlength="250"></label><button class="pri" id="lkok">Justificar con lo marcado</button></div>` : ''}</div>`;
    document.body.appendChild(m); $('#lkx', m).onclick = () => m.remove(); const ok = $('#lkok', m);
    if (ok) ok.onclick = () => { const mo = $('#lkm', m).value; if (!mo) return toast('Elige el motivo.'); const ps = [...m.querySelectorAll('[data-lk]:checked')].map((c) => [LB[c.dataset.lk], c.value]); if (!ps.length) return toast('Marca al menos un enlace.');
      setDirty(id, mo, lkObs(ps, [$('#lkob', m).value.trim(), tp === 'tar' && nota ? 'Estado fotos: ' + nota.slice(0, 200) : ''].filter(Boolean).join(' · '), tp === 'tar' ? 'de la tarea' : 'Involves')); m.remove(); render(); toast('Justificado con ' + ps.length + ' enlace(s). Falta guardar.'); };
  }

  /* ---------- ubicación del PDV ---------- */
  const esGeo = (m) => /GEOLOCALIZ|ZONAPELIGROSA/.test(norm(m || '').replace(/ /g, ''));
  function ubPanel(cli) {
    const u = UB[cli], m = document.createElement('div'); m.className = 'modal'; m.innerHTML = `<form class="box"><h3>Ubicación del PDV ${esc(cli)}</h3>${u ? `<p><a href="https://www.google.com/maps?q=${u.lat},${u.lng}" target="_blank" rel="noopener noreferrer">Ver ubicación actual en el mapa ↗</a></p>` : ''}
      <label>Coordenadas correctas (latitud, longitud) o enlace de Google Maps<input id="ub_t" required placeholder="-1.0387, -79.4747"></label><div class="bar" style="margin:0"><button class="pri">Guardar</button><button type="button" id="ub_x">Cancelar</button></div></form>`;
    document.body.appendChild(m); $('#ub_x', m).onclick = () => m.remove(); $('form', m).onsubmit = async (ev) => { ev.preventDefault(); const mm = $('#ub_t', m).value.match(/(-?\d{1,2}\.\d+)\s*[,;\s]\s*(-?\d{1,3}\.\d+)/); if (!mm) return toast('No pude leer las coordenadas.'); const { error } = await sb.from('ubicaciones').upsert({ codigo: cli, lat: +mm[1], lng: +mm[2] }, { onConflict: 'codigo' }); if (error) return fail(error); UB[cli] = { codigo: cli, lat: +mm[1], lng: +mm[2] }; m.remove(); toast('Ubicación guardada'); render(); };
  }

  /* ---------- reincidencia con justificación previa: validar y replicar ---------- */
  function replicaPanel() {
    const tp = RG.tipo; let L = regFil(['est']).filter((r) => !cMot(r) && rjPrev(r)); if (!L.length) return toast('No hay registros pendientes con una justificación previa.'); L.sort((a, b) => a.ecm.localeCompare(b.ecm) || a.cli.localeCompare(b.cli) || (a.d < b.d ? -1 : 1)); const cut = L.length > 300; L = L.slice(0, 300);
    const nof = (o) => String(o || '').replace(/^Reincidencia[^·]*(· )?/, '').trim(), m = document.createElement('div'); m.className = 'modal'; let foto = null;
    m.innerHTML = `<div class="box" style="max-width:980px"><div class="bar" style="margin:0"><h3 style="flex:1">Reincidencia con justificación previa</h3><button type="button" id="rjx">✕</button></div>
      <p class="note">${L.length} registro(s)${cut ? ' (primeros 300)' : ''} repite(n) ECM + PDV + categoría de un día anterior ya justificado. Revisa y valida: se copia el motivo del día anterior (puedes cambiarlo) y, si lo dejas marcado, su observación y enlaces.</p>
      <div class="tw" style="max-height:44vh;overflow:auto"><table><thead><tr><th><input type="checkbox" id="rja" checked></th><th>Fecha</th><th>ECM · PDV</th><th>Categoría</th><th>Justificación previa</th><th>Motivo a aplicar</th></tr></thead><tbody>${L.map((r) => { const p = rjPrev(r), n = D_().EV.get(p.id) || 0; return `<tr data-id="${esc(r.id)}"><td><input type="checkbox" data-rjc checked></td><td>${r.d}</td><td>${esc(r.ecm)}<br><small class="mu">${esc(r.cn)} (${esc(r.cli)})</small></td><td>${CATLX[tp][r.c]}</td><td style="white-space:normal">${ymd(p.d)}: <b>${esc(cMot(p))}</b>${nof(cObs(p)) ? `<br><small class="mu">${esc(nof(cObs(p)).slice(0, 160))}</small>` : ''}${n ? `<br><small>📎 ${n} foto(s) el día anterior</small>` : ''}</td><td><select data-rjm>${motOpts(tp, cMot(p))}</select></td></tr>`; }).join('')}</tbody></table></div>
      <label>Observación adicional (opcional)<input id="rjo" maxlength="250"></label><label>Enlace adicional (opcional)<input id="rjl" placeholder="https://…"></label>
      <label>Foto adicional (opcional)<input type="file" id="rjf" accept="image/*"></label><label class="mso"><input type="checkbox" id="rjk" checked> Copiar también la observación y los enlaces del día anterior</label><div><button class="pri" id="rjok">Validar y replicar</button></div></div>`;
    document.body.appendChild(m); $('#rjx', m).onclick = () => m.remove(); $('#rja', m).onchange = (e) => m.querySelectorAll('[data-rjc]').forEach((c) => (c.checked = e.target.checked)); $('#rjf', m).onchange = (e) => (foto = e.target.files[0] || null);
    $('#rjok', m).onclick = async (ev) => { const rows = [...m.querySelectorAll('tbody tr')].filter((tr) => tr.querySelector('[data-rjc]').checked); if (!rows.length) return toast('Marca al menos un registro.'); const lk = $('#rjl', m).value.trim(); if (lk && !/^https?:/i.test(lk)) return toast('El enlace debe empezar con http.');
      const uo = $('#rjo', m).value.trim(), cp = $('#rjk', m).checked, ok = []; rows.forEach((tr) => { const r = ROWS[tr.dataset.id], p = r && rjPrev(r), mo = tr.querySelector('[data-rjm]').value; if (!r || !p || !mo) return; setDirty(r.id, mo, ['Reincidencia: ya justificado el ' + ymd(p.d), uo, lk ? 'Enlace: ' + lk : '', cp ? nof(cObs(p)) : ''].filter(Boolean).join(' · ').slice(0, 800)); ok.push(r.id); });
      if (!ok.length) return toast('Elige el motivo de los registros marcados.'); if (foto) { ev.target.disabled = true; try { await subirFoto(ok, foto); } catch (e) { fail(e); } } m.remove(); render(); toast(`${ok.length} registro(s) validado(s) como reincidencia. Falta guardar.`); };
  }

  /* ---------- historial del registro ---------- */
  async function historial(id) {
    const { data, error } = await sb.from('bitacora').select('*').or(`nuevo->>registro_id.eq.${id},nuevo->>id.eq.${id}`).order('fecha', { ascending: false }).limit(60); if (error) return fail(error);
    const { data: pr } = await sb.from('profiles').select('id,usuario,nombre'); const U = Object.fromEntries((pr || []).map((p) => [p.id, p.nombre || p.usuario])), m = document.createElement('div'), r = ROWS[id]; m.className = 'modal';
    m.innerHTML = `<div class="box" style="max-width:640px"><div class="bar" style="margin:0"><h3 style="flex:1">Historial del registro</h3><button type="button" id="hx">✕</button></div><p class="note">${esc(r.d)} · ${esc(r.cn)} · ${esc(r.ecm)}${r.j ? ' · estado «' + esc(r.j.estado) + '»' : ''}</p>
      ${(data || []).length ? (data || []).map((b) => { const i = CN.bitInfo(b); return `<div class="card" style="margin:6px 0;padding:10px"><div class="bar" style="margin:0 0 4px"><span class="acc ${i.tono}">${esc(i.acc)}</span><span class="note">${new Date(b.fecha).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' })} · ${esc(U[b.usuario] || (b.nuevo && b.nuevo.usuario) || 'usuario')}</span></div><span class="det" style="max-width:none">${i.det}</span></div>`; }).join('') : '<p class="mu">Sin cambios registrados para este registro.</p>'}</div>`;
    document.body.appendChild(m); $('#hx', m).onclick = () => m.remove();
  }

  /* ---------- pantalla ---------- */
  const o = (k, l, v) => `<label>${l}<select data-rg="${k}">${v.map(([a, b]) => `<option value="${esc(a)}" ${String(RG[k]) === String(a) ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select></label>`;
  function fila(r, tp) {
    const m = cMot(r), sg = !m && sugerir(r), d = !!DIRTY[r.id], d0 = D_(), I = ECMI()[r.ecm] || [], tel = waNum(I[1]), est = estOf(r), nev = d0.EV.get(r.id) || 0, u = UB[r.cli];
    return `<tr data-id="${esc(r.id)}" class="${d ? 'dirty' : ''}"><td><input type="checkbox" data-sel aria-label="Seleccionar ${esc(r.cn)} del ${r.d}" ${SEL.has(r.id) ? 'checked' : ''}></td><td>${r.d}${tp === 'vis' ? `<small>${r.min == null ? '—' : r.min.toFixed(1) + ' min'}</small>` : ''}</td>
      <td><button type="button" class="qf" data-fecm="${esc(r.ecm)}" title="Ver solo este ECM · Supervisor: ${esc(r.sup)}">${esc(r.ecm)}</button>${tel ? `<button type="button" class="wa" data-wa1="${esc(r.id)}" title="Escribir por WhatsApp a ${esc(I[0] || r.ecm)} sobre este PDV">💬</button>` : ''}${I[0] ? `<small title="${esc(I[0])}">${esc(I[0])}</small>` : ''}</td>
      <td><button type="button" class="qf" data-fcli="${esc(r.cli)}" title="Ver solo este cliente">${esc(r.cn)}</button>${u ? ` <a href="https://www.google.com/maps?q=${u.lat},${u.lng}" target="_blank" rel="noopener noreferrer" title="Ver ubicación">📍</a>` : ''}${esGeo(m) ? ` <button type="button" class="ubm" data-ub="${esc(r.cli)}">${u ? '✎ Editar coordenadas' : '📍 Agregar coordenadas'}</button>` : ''}<small>${esc(r.cli)}</small>${reiB(r)}</td>
      <td><span class="pill ${r.c}">${CATLX[tp][r.c]}</span></td>
      <td style="white-space:normal;max-width:240px">${tp === 'vis' ? esc(r.jus === 'SIN JUSTIFICACIÓN' ? (r.jtxt || '—') : r.jus + (r.jtxt ? ' · ' + r.jtxt : '')) : `${esc(r.task.slice(0, 70))}<br><small class="mu">${esc(r.pil)}${r.jus !== 'SIN JUSTIFICACIÓN' ? ' · ' + esc(r.jus) : ''}</small>`}</td>
      <td><select class="mot" data-mot aria-label="Motivo de ${esc(r.cn)} del ${r.d}">${motOpts(tp, m)}</select>${sg ? `<button type="button" class="sgb" data-sg="${esc(sg)}" title="Aplicar el motivo sugerido">💡 ${esc(sg.slice(0, 28))}</button>` : ''}</td>
      <td><input class="obs" data-obs aria-label="Observación de ${esc(r.cn)} del ${r.d}" maxlength="800" value="${esc(cObs(r))}" placeholder="Observación"></td>
      <td class="rsp"><span class="rb">${respRow(r) ? rb(respRow(r)) : ''}</span> <span class="st ${est}">${ESTL[est]}</span>${est === 'gest' && d0.GE.get(r.id) ? `<small title="Observación enviada por WhatsApp">${esc(d0.GE.get(r.id))}</small>` : ''}${r.j ? `<small class="mu">${esc(r.j.estado)}</small>` : ''}</td>
      <td><button type="button" class="evb ${nev ? 'has' : ''}" data-ev="${esc(r.id)}">📎 ${nev ? nev + ' foto' + (nev > 1 ? 's' : '') : 'Adjuntar'}</button>${(tp === 'vis' && d0.LK.has(r.id)) || tp === 'tar' ? ` <button type="button" class="evb ${tp === 'vis' ? 'has' : ''}" data-lkp="${esc(r.id)}" title="Ver los enlaces de fotos">🔗</button>` : ''}${r.j ? ` <button type="button" class="evb" data-hist="${esc(r.id)}" title="Historial">🕘</button>` : ''}</td></tr>`;
  }
  function vistaAsignar() {
    const tp = RG.tipo, d = D_(), all = d.R, LB = regFil(['est']), cn = { pend: 0, gest: 0, js: 0, jf: 0 }; LB.forEach((r) => cn[estOf(r)]++); const conM = LB.filter((r) => cMot(r)).length, L = regFil().sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : a.ecm.localeCompare(b.ecm))), pages = Math.max(1, Math.ceil(L.length / PG)); RG.page = Math.min(RG.page, pages - 1);
    const P = L.slice(RG.page * PG, RG.page * PG + PG), uq = (f) => [...new Set(all.filter(f).map((x) => x))], sups = [...new Set(all.map((r) => r.sup))].sort(), ecms = [...new Set(all.filter((r) => inA(RG.sup, r.sup)).map((r) => r.ecm))].sort(), dias = [...new Set(all.map((r) => r.d.slice(8)))].sort();
    const rjN = LB.filter((r) => !cMot(r) && rjPrev(r)).length, sugN = L.filter((r) => !cMot(r) && sugerir(r)).length, CL = CATLX[tp];
    const kp = (k, t, v, sub, c) => `<div class="k kb" style="--a:${c || 'var(--brand)'}" data-kest="${k}"><span>${t}</span><b style="${c ? 'color:' + c : ''}">${fN(v)}</b><i>${sub}</i></div>`;
    return `${RG.emb ? '' : `<div class="bar">${['vis', 'tar'].map((x) => `<button data-rt="${x}" class="${x === tp ? 'pri' : ''}">${x === 'vis' ? 'Visitas' : 'Tareas'}${DATA[x] ? ' · ' + fN(DATA[x].R.filter((r) => estOf(r) === 'pend').length) + ' pendientes' : ''}</button>`).join('')}</div>`}
      <div class="kp">${kp('all', 'No efectivas', LB.length, tp === 'vis' ? 'perdidas, fuera de rango y < 2 min' : 'abiertas, justificadas y mal ejecutadas')}${kp('pend', 'Pendientes', cn.pend, 'sin motivo ni gestión', 'var(--cP)')}${kp('gest', 'En gestión', cn.gest, 'ya contactados, sin motivo aún', 'var(--cF)')}${kp('jf', 'Justificadas con foto / Involves', cn.jf, 'motivo + foto o enlace', 'var(--cE)')}${kp('js', 'Justificadas sin foto', cn.js, f1(pc(conM, LB.length)) + ' de avance con motivo')}</div>
      ${RG.cli || RG.ecm.length === 1 ? `<div class="bar"><b>Filtro rápido</b>${RG.ecm.length === 1 ? `<span class="pill">ECM ${esc(RG.ecm[0])} <button type="button" data-fx="ecm">✕</button></span>` : ''}${RG.cli ? `<span class="pill">Cliente ${esc(RG.cli)} <button type="button" data-fx="cli">✕</button></span>` : ''}</div>` : ''}
      ${rjN ? `<div class="bar card" style="padding:10px;margin:0 0 10px"><span>🔁 <b>${rjN}</b> registro(s) pendiente(s) repite(n) un caso ya justificado (mismo ECM, PDV y categoría).</span><button type="button" class="pri" data-act="rjall">Revisar y replicar</button></div>` : ''}
      <div class="fbar">${o('est', 'Estado', [['pend', 'Pendientes'], ['gest', 'En gestión'], ['done', 'Completadas (con motivo)'], ['jf', 'Justificadas con foto / Involves'], ['js', 'Justificadas sin foto'], ['all', 'Todas']])}${VZ.msel('cat', 'Categoría', ['P', 'F', 'M'].map((x) => [x, CL[x]]), RG.cat)}<label>Desde<input type="date" data-rg="from" value="${RG.from}"></label><label>Hasta<input type="date" data-rg="to" value="${RG.to}"></label>${VZ.quick()}${VZ.msel('dia', 'Días del mes', dias.map((x) => [x, String(+x)]), RG.dia)}
        ${tp === 'vis' ? VZ.msel('dur', 'Duración', [['0-2', '< 2 min'], ['2-10', '2 a 10 min'], ['10-30', '10 a 30 min'], ['30-60', '30 a 60 min'], ['60-90', '60 a 90 min'], ['90-', '> 90 min'], ['nd', 'Sin dato']], RG.dur) : ''}${sups.length > 1 ? VZ.msel('sup', 'Supervisor', sups, RG.sup) : ''}${VZ.msel('ecm', tp === 'vis' ? 'BDR' : 'ECM', ecms, RG.ecm)}<label>Buscar<input data-rg="q" value="${esc(RG.q)}" placeholder="Cliente, código o ECM"></label>
        <label class="mso" style="flex-direction:row"><input type="checkbox" data-rgc="rei" ${RG.rei ? 'checked' : ''}> Solo reincidentes (≥ <input type="number" data-rg="rmin" min="2" value="${RG.rmin}" style="width:56px;min-height:32px"> días)</label><label class="mso" style="flex-direction:row"><input type="checkbox" data-rgc="sg" ${RG.sg ? 'checked' : ''}> Con motivo sugerido (${sugN})</label></div>
      <div class="bar card" style="padding:10px;margin:0 0 10px"><b>${SEL.size}</b> seleccionados<label>Asignar motivo<select id="bm">${motOpts(tp, '')}</select></label><label>Observación<input id="bo" maxlength="250" placeholder="Opcional, para todos" style="min-width:220px"></label>
        <button data-act="bulk" class="pri" ${SEL.size ? '' : 'disabled'}>Aplicar a seleccionados</button><button data-act="obsb" ${SEL.size ? '' : 'disabled'} title="Aplica solo la observación a los que ya tienen motivo">📝 Observación</button><button data-act="selall">Seleccionar los ${fN(L.length)} filtrados</button><button data-act="clr" ${SEL.size ? '' : 'disabled'}>Limpiar</button>
        <button data-act="wa" ${SEL.size ? '' : 'disabled'}>💬 WhatsApp a los ECM</button><button data-act="gest" ${SEL.size ? '' : 'disabled'}>Marcar «en gestión»</button><button data-act="ungest" ${SEL.size ? '' : 'disabled'}>Devolver a pendientes</button><button data-act="foto" ${SEL.size ? '' : 'disabled'}>📎 Una foto para todos</button>${sugN ? `<button data-act="sgall">💡 Aplicar los ${sugN} sugeridos</button>` : ''}</div>
      <div class="card" style="padding:0"><div class="tws"><table class="rt"><thead><tr><th><input type="checkbox" aria-label="Seleccionar todas las filas de esta página" data-selpg ${P.length && P.every((r) => SEL.has(r.id)) ? 'checked' : ''}></th><th>${tp === 'vis' ? 'Fecha / min' : 'Fecha'}</th><th>${tp === 'vis' ? 'BDR' : 'ECM'}</th><th>Cliente</th><th>Categoría</th><th>${tp === 'vis' ? 'Justificación escrita' : 'Tarea'}</th><th>Motivo</th><th>Observación</th><th>Resp. / estado</th><th>Evidencia</th></tr></thead>
        <tbody>${P.map((r) => fila(r, tp)).join('') || `<tr><td colspan="12" class="note" style="text-align:center;padding:24px">Nada por mostrar con estos filtros.</td></tr>`}</tbody></table></div></div>
      <div class="bar" style="justify-content:center"><button data-pg="-1" ${RG.page ? '' : 'disabled'}>‹ Anterior</button><span class="note">Página ${RG.page + 1} de ${pages} · ${fN(L.length)} registros</span><button data-pg="1" ${RG.page < pages - 1 ? '' : 'disabled'}>Siguiente ›</button></div>
      <div class="savebar ${nDirty() ? 'on' : ''}"><span>${nDirty()} cambios sin guardar</span><button data-act="discard" ${nDirty() ? '' : 'disabled'}>Descartar</button><button class="pri" data-act="save" ${nDirty() ? '' : 'disabled'}>Guardar cambios</button></div>`;
  }
  function vistaRei() {
    const tp = RG.tipo, min = RG.rmin; reiSet(); const L = [...REIC.values()].filter((o) => o.n >= min).sort((a, b) => b.n - a.n || b.rows.length - a.rows.length), CLx = CATLX[tp];
    return `<div class="bar">${['vis', 'tar'].map((x) => `<button data-rt="${x}" class="${x === tp ? 'pri' : ''}">${x === 'vis' ? 'Visitas' : 'Tareas'}</button>`).join('')}<label>Mínimo de días con falla<input type="number" data-rg="rmin" min="2" value="${min}" style="width:80px"></label><label>Desde<input type="date" data-rg="from" value="${RG.from}"></label><label>Hasta<input type="date" data-rg="to" value="${RG.to}"></label></div>
      <div class="card"><h3>PDV reincidentes · ${fN(L.length)} con ${min} o más días con falla</h3><p class="note">Si un PDV falla varios días por estar fuera de rango puede estar mal geolocalizado; si falla porque no se le visita, puede ser una zona de difícil acceso o peligrosa. Marca los PDV y aplica el motivo a todos sus registros pendientes.</p>
      <div class="bar"><label>Motivo<select id="rm">${motOpts(tp, '')}</select></label><label>Observación<input id="ro" maxlength="250" style="min-width:240px"></label><button class="pri" id="rap">Aplicar a los pendientes de los PDV marcados</button><button id="rsl">Seleccionar sus registros en la tabla</button><span class="pill" id="rn">0 PDV marcados</span></div>
      <div class="tws"><table><thead><tr><th><input type="checkbox" id="rall" aria-label="Seleccionar todos los PDV de la lista"></th><th>Cliente</th><th>${tp === 'vis' ? 'BDR' : 'ECM'}</th><th class="n">Días</th><th class="n">${CLx.P}</th><th class="n">${CLx.F}</th><th class="n">${CLx.M}</th><th>Fechas</th><th class="n">Pendientes</th><th>Pista</th></tr></thead><tbody>${L.slice(0, 300).map((o) => { const dz = reiDias(o), pe = o.rows.filter((r) => !cMot(r)).length; return `<tr><td><input type="checkbox" data-rc="${esc(o.cli)}" aria-label="Seleccionar ${esc(o.cn)}"></td><td>${esc(o.cn)}<br><small class="mu">${esc(o.cli)}</small></td><td>${esc([...o.ecm].join(', '))}</td><td class="n"><b>${o.n}</b></td><td class="n">${o.P}</td><td class="n">${o.F}</td><td class="n">${o.M}</td><td style="white-space:normal"><b class="negc">${dz.sj.map(ymd).join(', ') || '—'}</b><br><span class="okc">${dz.j.map(ymd).join(', ') || '—'}</span></td><td class="n">${pe}</td><td style="white-space:normal">${esc(reiHint(o))}</td></tr>`; }).join('') || '<tr><td colspan="10" class="note">No hay PDV con esa reincidencia con los filtros actuales.</td></tr>'}</tbody></table></div></div>`;
  }
  function vistaReg() {
    const tp = RG.tipo, L = D_().R.filter((r) => cMot(r)).sort((a, b) => (a.d < b.d ? 1 : -1));
    return `<div class="bar">${['vis', 'tar'].map((x) => `<button data-rt="${x}" class="${x === tp ? 'pri' : ''}">${x === 'vis' ? 'Visitas' : 'Tareas'}</button>`).join('')}<label>Desde<input type="date" data-rg="from" value="${RG.from}"></label><label>Hasta<input type="date" data-rg="to" value="${RG.to}"></label></div>
      <div class="card"><h3>Justificaciones registradas · ${fN(L.length)}</h3>${VZ.table([{ h: 'Fecha' }, { h: 'ECM' }, { h: 'Cliente' }, { h: 'Categoría' }, { h: 'Motivo' }, { h: 'Responsable' }, { h: 'Observación' }, { h: 'Estado' }, { h: 'Fotos', n: 1 }, { h: '' }],
        L.map((r) => ({ c: [r.d, esc(r.ecm), `${esc(r.cn)}<br><small class="mu">${esc(r.cli)}</small>`, CATLX[tp][r.c], esc(cMot(r)), rb(respRow(r)), `<span style="white-space:normal">${esc(cObs(r).slice(0, 140))}</span>`, ESTL[estOf(r)], fN(D_().EV.get(r.id) || 0), `<button data-hist="${esc(r.id)}">Historial</button>`], s: [r.d, r.ecm, r.cn, r.c, cMot(r), respRow(r), cObs(r), estOf(r), D_().EV.get(r.id) || 0, ''], x: [r.d, r.ecm, r.cli, r.cn, CATLX[tp][r.c], cMot(r), respRow(r), cObs(r), ESTL[estOf(r)], r.j ? r.j.estado : ''] })), { name: 'justificaciones_' + tp, max: 400 })}</div>`;
  }
  async function render() {
    const host = HOST; if (!host) return; if (!RG.from) { RG.to = hoy(); RG.from = add(RG.to, -44); RG.rmin = Number(S.cfg.rei_min || 2); }
    host.innerHTML = '<p class="note">Cargando…</p>';
    try { await cargar(RG.tipo); rjBuild(); reiSet(); } catch (e) { return fail(e); }
    host.innerHTML = RG.tab === 'rei' ? vistaRei() : RG.tab === 'reg' ? vistaReg() : vistaAsignar(); enlazar(host);
    if (!CN.puede('justificar')) { host.querySelectorAll('.rt select, .rt input, .rt .sgb, .rt .evb, .rt .wa, .rt .ubm, .savebar, [data-act], [data-selpg]').forEach((el) => { el.disabled = true; }); host.querySelectorAll('.savebar').forEach((e) => e.remove()); host.insertAdjacentHTML('afterbegin', '<p class="note">Tu tipo de usuario solo puede consultar esta pantalla.</p>'); }
    CN.sideRefresh && CN.sideRefresh();
  }
  function enlazar(host) {
    VZ.mselHandler = (id, vals) => { RG[id] = vals; RG.page = 0; if (id === 'sup') RG.ecm = []; render(); };
    VZ.rangeHandler = (a, b) => { RG.from = a; RG.to = b; RG.page = 0; DATA.vis = DATA.tar = null; render(); };
    host.querySelectorAll('[data-rg]').forEach((i) => (i.onchange = () => { const k = i.dataset.rg; RG[k] = k === 'rmin' ? Math.max(2, +i.value || 2) : i.value; RG.page = 0; if (k === 'from' || k === 'to') { DATA.vis = DATA.tar = null; } if (k === 'q') { clearTimeout(i.t); } render(); }));
    host.querySelectorAll('[data-rgc]').forEach((i) => (i.onchange = () => { RG[i.dataset.rgc] = i.checked; RG.page = 0; render(); }));
    host.querySelectorAll('[data-rt]').forEach((b) => (b.onclick = () => { RG.tipo = b.dataset.rt; RG.page = 0; SEL.clear(); render(); }));
    host.querySelectorAll('[data-kest]').forEach((b) => (b.onclick = () => { RG.est = b.dataset.kest; RG.page = 0; render(); }));
    host.querySelectorAll('[data-fx]').forEach((b) => (b.onclick = () => { if (b.dataset.fx === 'ecm') RG.ecm = []; else RG.cli = ''; render(); }));
    host.querySelectorAll('[data-pg]').forEach((b) => (b.onclick = () => { RG.page += +b.dataset.pg; render(); window.scrollTo(0, 0); }));
    host.onchange = (e) => { const t = e.target, tr = t.closest('tr[data-id]'); if (t.matches('[data-sel]')) { t.checked ? SEL.add(tr.dataset.id) : SEL.delete(tr.dataset.id); render(); return; } if (t.matches('[data-selpg]')) { const ids = regFil().sort((a, b) => (a.d < b.d ? 1 : -1)).slice(RG.page * PG, RG.page * PG + PG).map((r) => r.id); ids.forEach((id) => (t.checked ? SEL.add(id) : SEL.delete(id))); render(); return; }
      if (t.matches('[data-mot]') && tr) { const id = tr.dataset.id; setDirty(id, t.value, tr.querySelector('[data-obs]').value); if (esGeo(t.value) && ROWS[id] && !UB[ROWS[id].cli]) ubPanel(ROWS[id].cli); render(); return; }
      if (t.matches('[data-obs]') && tr) { setDirty(tr.dataset.id, tr.querySelector('[data-mot]').value, t.value); render(); return; }
      if (t.matches('[data-rc]')) { const n = host.querySelectorAll('[data-rc]:checked').length; $('#rn', host).textContent = n + ' PDV marcados'; } if (t.id === 'rall') { host.querySelectorAll('[data-rc]').forEach((x) => (x.checked = t.checked)); $('#rn', host).textContent = host.querySelectorAll('[data-rc]:checked').length + ' PDV marcados'; } };
    host.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; const tr = b.closest('tr[data-id]'), tp = RG.tipo, id = tr && tr.dataset.id;
      if (b.dataset.fecm) { RG.ecm = [b.dataset.fecm]; RG.est = 'all'; RG.page = 0; return render(); } if (b.dataset.fcli) { RG.cli = b.dataset.fcli; RG.est = 'all'; RG.page = 0; return render(); }
      if (b.dataset.ev) return evPanel(b.dataset.ev); if (b.dataset.lkp) return lkPanel(b.dataset.lkp); if (b.dataset.hist) return historial(b.dataset.hist); if (b.dataset.ub) return ubPanel(b.dataset.ub);
      if (b.dataset.sg && tr) { setDirty(id, b.dataset.sg, tr.querySelector('[data-obs]').value); return render(); }
      if (b.dataset.wa1) { SEL.clear(); return waPanel([b.dataset.wa1]); }
      if (b.id === 'rap') { const mo = $('#rm', host).value, ob = $('#ro', host).value.trim(); const cs = [...host.querySelectorAll('[data-rc]:checked')].map((x) => x.dataset.rc); if (!mo) return toast('Elige primero el motivo.'); if (!cs.length) return toast('Marca al menos un PDV.'); let n = 0; cs.forEach((c) => (REIC.get(c) ? REIC.get(c).rows : []).forEach((r) => { if (!cMot(r)) { setDirty(r.id, mo, ob || cObs(r)); n++; } })); RG.tab = 'asignar'; RG.est = 'all'; render(); return toast(n ? `Motivo aplicado a ${n} registros pendientes. Falta guardar.` : 'Esos PDV no tienen registros pendientes.'); }
      if (b.id === 'rsl') { const cs = [...host.querySelectorAll('[data-rc]:checked')].map((x) => x.dataset.rc); if (!cs.length) return toast('Marca al menos un PDV.'); cs.forEach((c) => (REIC.get(c) ? REIC.get(c).rows : []).forEach((r) => SEL.add(r.id))); RG.tab = 'asignar'; RG.est = 'all'; return render(); }
      const a = b.dataset.act; if (!a) return; const sel = [...SEL].filter((x) => ROWS[x] && tipoDe(ROWS[x]) === tp);
      if (a === 'save') return guardar(); if (a === 'discard') { Object.keys(DIRTY).forEach((k) => delete DIRTY[k]); return render(); } if (a === 'rjall') return replicaPanel(); if (a === 'clr') { SEL.clear(); return render(); } if (a === 'selall') { regFil().forEach((r) => SEL.add(r.id)); return render(); }
      if (a === 'bulk') { const mo = $('#bm', host).value; if (!mo) return toast('Elige el motivo.'); const ob = $('#bo', host).value.trim(); sel.forEach((id) => setDirty(id, mo, ob || cObs(ROWS[id]))); SEL.clear(); return render(); }
      if (a === 'obsb') { const ob = $('#bo', host).value.trim(); if (!ob) return toast('Escribe la observación.'); let n = 0; sel.forEach((id) => { if (cMot(ROWS[id])) { setDirty(id, cMot(ROWS[id]), ob); n++; } }); toast(n ? `Observación aplicada a ${n}. Falta guardar.` : 'Ninguno de los seleccionados tiene motivo.'); return render(); }
      if (a === 'sgall') { let n = 0; regFil().forEach((r) => { if (!cMot(r)) { const s = sugerir(r); if (s) { setDirty(r.id, s, cObs(r)); n++; } } }); toast(`${n} motivos sugeridos aplicados. Revisa y guarda.`); return render(); }
      if (a === 'wa') return waPanel(sel); if (a === 'foto') return fotoGrupal(sel);
      if (a === 'gest' || a === 'ungest') return setGest(sel, a === 'gest', '').then(() => { SEL.clear(); toast(a === 'gest' ? `${sel.length} marcados en gestión` : `${sel.length} devueltos a pendientes`); render(); }); };
  }

  const api = { render: async (tp, host, o) => { if (tp) RG.tipo = tp; HOST = host; RG.tab = 'asignar'; RG.est = 'pend'; RG.cli = ''; RG.ecm = []; RG.emb = !!(o && o.embedded); if (o && o.from && (RG.from !== o.from || RG.to !== o.to)) { RG.from = o.from; RG.to = o.to; DATA.vis = DATA.tar = null; } await render(); } };
  CN.registro = api;
  VIEWS.registro = async function () {
    if (CN.pendingTab && CN.pendingTab[0] === 'registro') { RG.tab = CN.pendingTab[1]; CN.pendingTab = null; }
    CN.sub.registro = { tabs: () => TABS.filter(([k]) => CN.tabOk('registro', k)), cur: () => RG.tab, set: (k) => { RG.tab = k; render(); } }; HOST = $('#main'); RG.emb = false; if (!CN.keepEst) { RG.est = 'pend'; RG.cli = ''; RG.ecm = []; } CN.keepEst = false; { const ok = TABS.filter(([k]) => CN.tabOk('registro', k)); if (ok.length && !ok.some((t) => t[0] === RG.tab)) RG.tab = ok[0][0]; } await render();
  };
})();
