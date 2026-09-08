const { spawnSync } = require('node:child_process');
if (!process.env.DATABASE_URL) throw new Error('Run service:setup first');
const result = spawnSync(process.execPath, ['--test','lib/server/jobs.integration.test.cjs'], { env: { ...process.env, LEMON_TEST_DATABASE_URL: process.env.DATABASE_URL }, stdio: 'inherit', windowsHide: true });
if (result.error) throw result.error;
process.exitCode = result.status || 0;
