const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const { logger } = require('../lib/server/logger.cjs');
const { devAddress, assertPortAvailable } = require('./dev-port.cjs');
async function main() {
  const args = process.argv.slice(2);
  const address = devAddress(args);
  await assertPortAvailable(address);
  if (fs.existsSync('.env.1a.local')) process.loadEnvFile('.env.1a.local');
  if (fs.existsSync('.env.local')) require('@next/env').loadEnvConfig(process.cwd());
  const built = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc','-p','tsconfig.worker.json'], { stdio: 'inherit', windowsHide: true });
  if (built.error) throw built.error;
  if (built.status !== 0) process.exit(built.status || 1);
  const children = [
    // 显式端口：已有服务时应失败退出，不能自动换端口后共享 .next 缓存。
    spawn(process.execPath, ['node_modules/next/dist/bin/next','dev','--hostname',address.host,'--port',String(address.port),...args], { stdio: 'inherit', windowsHide: true }),
    spawn(process.execPath, ['.worker/scripts/worker.js'], { stdio: 'inherit', windowsHide: true })
  ];
  let stopping = false;
  function stop(code = 0) {
    if (stopping) return;
    stopping = true;
    process.exitCode = code;
    for (const child of children) child.kill();
  }
  for (const child of children) {
    child.on('error', (err) => { logger.error({ err }, 'development process failed'); stop(1); });
    child.on('exit', (code) => stop(code || 0));
  }
  process.on('SIGINT', () => stop());
  process.on('SIGTERM', () => stop());
}
main().catch((err) => { logger.error({ err }, 'development startup refused'); process.exitCode = 1; });
