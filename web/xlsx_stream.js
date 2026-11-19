'use strict';
/* Lector de .xlsx por flujo (portado del SOS/SOE original): los exportes de encuestas pesan decenas de MB de XML, así que
   se lee fila a fila sin armar el libro completo (el lector normal agota la memoria del navegador). Devuelve filas como arreglos. */
(function () {
  const key2 = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  function zipEntries(buf) {
    const dv = new DataView(buf), n = buf.byteLength; let i = n - 22;
    while (i >= 0 && dv.getUint32(i, true) !== 0x06054b50) i--;
    if (i < 0) throw new Error('El archivo no parece un Excel (.xlsx)');
    const count = dv.getUint16(i + 10, true); let off = dv.getUint32(i + 16, true); const out = {}, td = new TextDecoder();
    for (let k = 0; k < count; k++) {
      if (dv.getUint32(off, true) !== 0x02014b50) break;
      const nl = dv.getUint16(off + 28, true), el = dv.getUint16(off + 30, true), cl = dv.getUint16(off + 32, true);
      out[td.decode(new Uint8Array(buf, off + 46, nl))] = { method: dv.getUint16(off + 10, true), csize: dv.getUint32(off + 20, true), lho: dv.getUint32(off + 42, true) };
      off += 46 + nl + el + cl;
    }
    return out;
  }
  function zipStream(buf, e) {
    const dv = new DataView(buf), o = e.lho + 30 + dv.getUint16(e.lho + 26, true) + dv.getUint16(e.lho + 28, true), st = new Blob([buf.slice(o, o + e.csize)]).stream();
    if (e.method === 0) return st;
    if (e.method !== 8 || typeof DecompressionStream === 'undefined') throw new Error('zip no compatible');
    return st.pipeThrough(new DecompressionStream('deflate-raw'));
  }
  const xmlText = (x) => x.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (m, c) => String.fromCharCode(+c)).replace(/&amp;/g, '&');
  async function readStream(stream, onChunk) { const rd = stream.pipeThrough(new TextDecoderStream()).getReader(); for (;;) { const r = await rd.read(); if (r.done) return; onChunk(r.value); } }
  const colIdx = (ref) => { const m = /^([A-Z]+)/.exec(ref || ''); if (!m) return -1; let n = 0; for (let i = 0; i < m[1].length; i++) n = n * 26 + m[1].charCodeAt(i) - 64; return n - 1; };
  CN.xlsxFlujo = async function (buf, progreso) {
    const z = zipEntries(buf), shared = [], names = Object.keys(z);
    const sheet = names.filter((x) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(x)).sort((a, b) => parseInt(a.replace(/\D/g, ''), 10) - parseInt(b.replace(/\D/g, ''), 10))[0];
    if (!sheet) throw new Error('No encontré la hoja de datos del Excel');
    if (z['xl/sharedStrings.xml']) { let acc = ''; await readStream(zipStream(buf, z['xl/sharedStrings.xml']), (c) => { acc += c; });
      (acc.match(/<(?:x:)?si>[\s\S]*?<\/(?:x:)?si>/g) || []).forEach((si) => { let t = ''; si.replace(/<(?:x:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:x:)?t>/g, (m, v) => { t += xmlText(v); }); shared.push(t); }); }
    const rows = []; let dateCols = null, width = 0, resto = '';
    const cellRe = /<(?:x:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:x:)?c>)/g;
    const doRow = (rx) => {
      const row = []; let pos = 0, m; cellRe.lastIndex = 0;
      while ((m = cellRe.exec(rx))) {
        const at = m[1] || '', body = m[2] || '', ref = /\br="([A-Z]+\d+)"/.exec(at); let t = /\bt="(\w+)"/.exec(at); const j = ref ? colIdx(ref[1]) : pos; let v = ''; t = t ? t[1] : 'n';
        if (t === 'inlineStr') body.replace(/<(?:x:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:x:)?t>/g, (q, x) => { v += xmlText(x); });
        else { const vm = /<(?:x:)?v>([\s\S]*?)<\/(?:x:)?v>/.exec(body); if (vm) v = xmlText(vm[1]); if (t === 's') v = shared[+v] != null ? shared[+v] : ''; }
        row[j] = v; pos = j + 1;
      }
      if (!rows.length) { width = row.length; dateCols = {}; row.forEach((c, i) => { if (/FECHA|DATE/.test(key2(c))) dateCols[i] = 1; }); }
      else Object.keys(dateCols).forEach((i) => { const x = row[i]; if (x && /^\d{5}(\.\d+)?$/.test(x)) row[i] = /\./.test(x) && +x % 1 > 0.00001 ? new Date(Math.round((+x - 25569) * 86400) * 1000).toISOString().slice(0, 19).replace('T', ' ') : new Date(Math.round((+x - 25569) * 86400000)).toISOString().slice(0, 10); });
      for (let q = 0; q < width; q++) if (row[q] === undefined) row[q] = '';
      rows.push(row); if (progreso && rows.length % 20000 === 0) progreso(rows.length);
    };
    await readStream(zipStream(buf, z[sheet]), (chunk) => {
      resto += chunk; const re = /<(?:x:)?row\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:x:)?row>)/g; let m, last = 0;
      while ((m = re.exec(resto))) { last = re.lastIndex; if (m[1]) doRow(m[1]); }
      resto = resto.slice(last);
    });
    return rows;
  };
})();
