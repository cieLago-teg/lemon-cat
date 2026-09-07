import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const [major, minor] = process.versions.node.split('.').map(Number);
let failed = false;
function check(label, ok, hint) {
  console.log(`${ok ? 'OK' : 'FAIL'} ${label}${ok ? '' : `: ${hint}`}`);
  if (!ok) failed = true;
}
check(`Node ${process.versions.node}`, major > 22 || (major === 22 && minor >= 19), 'Use Node >=22.19; recommended 24.18.0');
for (const name of ['next', 'react', 'typescript', 'undici', 'onnxruntime-node']) {
  try { console.log(`OK ${name} ${require(`${name}/package.json`).version}`); }
  catch { check(name, false, 'Run npm ci'); }
}
check('environment file', fs.existsSync('.env.local'), 'Copy .env.example to .env.local and configure locally');
check('matting model', fs.existsSync('models/rmbg/rmbg-1.4.onnx'), 'Install the RMBG model before local matting');
check('desktop shell', fs.existsSync('desktop-pet-shell/node_modules/electron/cli.js'), 'Run npm ci --prefix desktop-pet-shell');
try { console.log(`OK ffmpeg ${require('../lib/pet/rvm-matting.js').resolveFfmpegPath()}`); }
catch { check('ffmpeg', false, 'Install dependencies or set FFMPEG_PATH'); }
const archive = path.join('data', 'archives.json');
if (fs.existsSync(archive)) {
  try { check('archives JSON', Array.isArray(JSON.parse(fs.readFileSync(archive, 'utf8'))), 'Expected array; preserve original before recovery'); }
  catch { check('archives JSON', false, 'Corrupt data; preserve original before recovery'); }
} else console.log('OK archives: fresh workspace');
console.log('Local checks only. Cloud credentials, model API and desktop interaction are not tested.');
process.exitCode = failed ? 1 : 0;
