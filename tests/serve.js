/* Servidor local sin dependencias: sirve la carpeta web/ en http://localhost:5173 (no hay paso de compilación). */
const http = require('http'), fs = require('fs'), path = require('path');
const WEB = path.join(__dirname, '..', 'web'), PORT = process.env.PORT || 5173;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon' };
http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]), f = path.join(WEB, p === '/' ? 'index.html' : p);
  if (!f.startsWith(WEB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('No encontrado'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(res);
}).listen(PORT, () => console.log('CN · http://localhost:' + PORT));
