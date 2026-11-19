'use strict';
/* Exportaciones del sistema anterior: Excel con formato (encabezados, filtros, paneles fijos, anchos), PNG/PDF por tarjeta,
   Excel de la vista y Excel completo. Las librerías pesadas se cargan solo al usarlas. */
(function () {
  const LIBS = { exceljs: ['ExcelJS', 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js'], html2canvas: ['html2canvas', 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'], jspdf: ['jspdf', 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'], pptx: ['PptxGenJS', 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js'] };
  const P = {};
  CN.lib = (...ks) => Promise.all(ks.map((k) => { const [g, u] = LIBS[k]; if (window[g]) return 1; return (P[k] ||= new Promise((ok, no) => { const s = document.createElement('script'); s.src = u; s.onload = ok; s.onerror = () => { delete P[k]; no(new Error('No se pudo cargar la librería ' + k + '. Revisa tu conexión.')); }; document.head.appendChild(s); })); }));
  const DS = () => new Date().toISOString().slice(0, 10);
  const slug = (s) => String(s || 'datos').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  CN.guardar = (blob, nombre) => { const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = nombre; a.rel = 'noopener'; a.style.display = 'none'; document.body.appendChild(a); a.click(); setTimeout(() => { a.remove(); URL.revokeObjectURL(u); }, 60000); };
  const busy = (t) => { let b = document.getElementById('busy'); if (!t) { if (b) b.remove(); return; } if (!b) { b = document.createElement('div'); b.id = 'busy'; b.setAttribute('role', 'status'); document.body.appendChild(b); } b.textContent = t; };
  CN.ocupado = busy;

  /* ---------- Excel con formato ---------- */
  const NAVY = 'FF1D4F91';
  const nombreHoja = (wb, h) => { const b = String(h).replace(/\s*\(.*$/, '').replace(/[\[\]:*?\/\\]/g, '').trim().slice(0, 28) || 'Hoja'; let n = b, i = 2; while (wb.getWorksheet(n)) n = b + ' ' + i++; return n; };
  const num = (t) => { if (typeof t === 'number') return [t]; const s = String(t ?? '').trim(); if (/^-?\d+(\.\d+)?$/.test(s) && s.length < 15) return [+s]; if (/^-?\d+(\.\d+)?\s*%$/.test(s)) return [parseFloat(s) / 100, '0.0%']; return [s]; };
  /* hoja: {name, title, sub, blocks:[{title, head:[], rows:[[]]}]} */
  CN.excelHoja = (wb, h) => {
    const ws = wb.addWorksheet(nombreHoja(wb, h.name)); ws.getCell(1, 1).value = h.title || h.name; ws.getCell(1, 1).font = { bold: true, size: 14 };
    if (h.sub) { ws.getCell(2, 1).value = h.sub; ws.getCell(2, 1).font = { size: 9, color: { argb: 'FF62708A' } }; }
    let r = 4; const anchos = [];
    (h.blocks || []).forEach((b) => {
      if (b.title) { ws.getCell(r, 1).value = b.title; ws.getCell(r, 1).font = { bold: true, size: 11 }; r++; }
      const r0 = r; b.head.forEach((t, i) => { const c = ws.getCell(r, i + 1); c.value = t; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }; c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }; anchos[i] = Math.max(anchos[i] || 0, String(t).length); });
      b.rows.forEach((row) => { r++; row.forEach((v, i) => { const [val, nf] = Array.isArray(v) ? v : num(v), c = ws.getCell(r, i + 1); c.value = val; if (nf) c.numFmt = nf; c.alignment = { vertical: 'top', wrapText: true, horizontal: typeof val === 'number' || i ? 'center' : 'left' }; c.border = { bottom: { style: 'thin', color: { argb: 'FFE1E6EE' } } }; anchos[i] = Math.max(anchos[i] || 0, Math.min(60, String(val ?? '').split('\n').reduce((m, x) => Math.max(m, x.length), 0))); }); });
      if (b.rows.length > 5 && !(h.blocks.length > 1)) { ws.autoFilter = { from: { row: r0, column: 1 }, to: { row: r0, column: b.head.length } }; ws.views = [{ state: 'frozen', xSplit: 1, ySplit: r0 }]; }
      r += 3;
    });
    anchos.forEach((l, i) => { ws.getColumn(i + 1).width = Math.min(46, Math.max(11, l + 3)); });
    return ws;
  };
  CN.excel = async (hojas, nombre) => {
    await CN.lib('exceljs'); const wb = new ExcelJS.Workbook(); hojas.forEach((h) => CN.excelHoja(wb, h));
    const buf = await wb.xlsx.writeBuffer(); CN.guardar(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), slug(nombre) + '-' + DS() + '.xlsx');
  };

  /* tablas de una tarjeta: las tablas ordenables se leen completas del registro (no solo la página visible) */
  const cel = (td) => { const c = td.cloneNode(true); c.querySelectorAll('br').forEach((b) => b.replaceWith('\n')); c.querySelectorAll('small').forEach((s) => { s.prepend('\n'); }); return c.textContent.replace(/\n{2,}/g, '\n').trim(); };
  CN.tablasDe = (el) => [...el.querySelectorAll('table')].map((t) => {
    const w = t.closest('.tw[id^="vt"]'), d = w && VZ.tableData(w.id); if (d) return { head: d.head, rows: d.rows };
    if (!t.tHead || !t.tBodies[0]) return null; return { head: [...t.tHead.rows[0].cells].map((h) => h.textContent.replace(/[▲▼]/g, '').trim()), rows: [...t.tBodies[0].rows].map((r) => [...r.cells].map(cel)) };
  }).filter((b) => b && b.rows.length);
  CN.hojaDeTarjeta = (card, titulo, sub) => { const h = (card.querySelector('h3') || {}).textContent || titulo || 'Datos'; return { name: h, title: h, sub, blocks: CN.tablasDe(card) }; };
  CN.kpisDe = (root) => [...root.querySelectorAll('.k')].map((k) => [(k.querySelector('span') || {}).textContent || '', (k.querySelector('b') || {}).textContent || '', ((k.querySelector('i') || {}).textContent || '').trim()]);

  /* ---------- PNG / PDF de una tarjeta ---------- */
  CN.capturar = async (el, fmt, nombre) => {
    await CN.lib('html2canvas', ...(fmt === 'pdf' ? ['jspdf'] : [])); el.classList.add('cap');
    try {
      const cs = getComputedStyle(document.body), sc = Math.max(1, Math.min(2, 14000 / Math.max(el.scrollHeight, 1))), c2 = await html2canvas(el, { scale: sc, backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--card').trim() || '#fff', useCORS: true, windowWidth: Math.max(el.scrollWidth, el.clientWidth) });
      if (fmt === 'pdf') { const W = c2.width / sc, H = c2.height / sc, p = new jspdf.jsPDF({ orientation: W > H ? 'l' : 'p', unit: 'px', format: [W, H], compress: true }); p.addImage(c2.toDataURL('image/png'), 'PNG', 0, 0, W, H); CN.guardar(p.output('blob'), nombre + '.pdf'); }
      else CN.guardar(await new Promise((r) => c2.toBlob(r, 'image/png')), nombre + '.png');
    } finally { el.classList.remove('cap'); }
  };

  /* ---------- botones por tarjeta ---------- */
  const tieneDatos = (c) => c.querySelector('table, svg.ch, .hb, .stk, .lg');
  const decorar = () => document.querySelectorAll('#main .card').forEach((c) => {
    if (c.dataset.dl || c.closest('.modal') || c.querySelector('table.rt, [data-pm], [data-ur]') || !tieneDatos(c) || c.querySelector(':scope > .card, :scope > .kp') && c.querySelector('.card')) return; c.dataset.dl = 1;
    const tb = !!c.querySelector('table'); c.insertAdjacentHTML('afterbegin', `<div class="dlb" data-nocap>${tb ? '<button type="button" data-ex="xls" title="Descargar esta tabla en Excel">Excel</button>' : ''}<button type="button" data-ex="png" title="Descargar esta tarjeta como imagen">PNG</button><button type="button" data-ex="pdf" title="Descargar esta tarjeta como PDF">PDF</button></div>`);
  });
  let tm; new MutationObserver(() => { clearTimeout(tm); tm = setTimeout(decorar, 150); }).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', async (ev) => {
    const b = ev.target.closest && ev.target.closest('[data-ex]'); if (!b) return; const c = b.closest('.card'), h = (c.querySelector('h3') || {}).textContent || 'tarjeta', nom = slug(h) + '-' + DS(), t0 = b.textContent;
    b.textContent = '…'; b.disabled = true;
    try { if (b.dataset.ex === 'xls') await CN.excel([CN.hojaDeTarjeta(c, h)], h); else await CN.capturar(c, b.dataset.ex, nom); }
    catch (e) { toast('No se pudo descargar: ' + (e && e.message || e)); }
    b.textContent = t0; b.disabled = false;
  });
  window.CN.slug = slug; CN.hoy = DS;
})();
