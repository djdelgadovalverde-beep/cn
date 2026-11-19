/* Revisa la sintaxis de todos los .js de web/ (equivale a un «lint» básico, sin dependencias). */
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const dir = path.join(__dirname, '..', 'web'); let mal = 0;
fs.readdirSync(dir).filter((f) => f.endsWith('.js')).forEach((f) => { try { execFileSync(process.execPath, ['--check', path.join(dir, f)], { stdio: 'pipe' }); } catch (e) { mal++; console.error('✘', f, String(e.stderr || e.message).split('\n').slice(0, 4).join('\n')); } });
console.log(mal ? mal + ' archivo(s) con errores' : '✔ Sintaxis correcta en todos los archivos de web/'); process.exit(mal ? 1 : 0);
