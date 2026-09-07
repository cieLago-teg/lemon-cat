import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const tests = [];
function collect(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'models', 'lib'].includes(entry.name) && dir === 'desktop-pet-shell') continue;
    const file = `${dir}/${entry.name}`;
    if (entry.isDirectory()) collect(file);
    else if (/\.test\.(cjs|mjs)$/.test(file)) tests.push(file);
  }
}
for (const dir of ['app', 'lib', 'scripts', 'desktop-pet-shell']) collect(dir);
for (const args of [
  ['node_modules/typescript/bin/tsc', '--noEmit', '--incremental', 'false'],
  ['--test', ...tests]
]) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
