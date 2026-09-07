const fs = require('node:fs');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const file = '.env.1a.local';
if (!fs.existsSync(file)) {
  const password = crypto.randomBytes(32).toString('hex');
  const invitation = crypto.randomBytes(16).toString('hex');
  fs.writeFileSync(file, `POSTGRES_PASSWORD=${password}\nDATABASE_URL=postgresql://lemon:${password}@127.0.0.1:55432/lemon\nAPP_ORIGIN=http://127.0.0.1:3000\nREGISTRATION_CODE=${invitation}\nINITIAL_CREDITS=0\nASSET_STORAGE=local\nLEMON_DATA_DIR=data/service\n`, { flag: 'wx', mode: 0o600 });
}
const result = spawnSync('docker', ['compose','--env-file',file,'-f','compose.1a.yml','up','-d'], { stdio: 'inherit', windowsHide: true });
if (result.error) throw result.error;
process.exitCode = result.status || 0;
