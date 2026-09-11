const { spawnSync } = require('node:child_process');
if (!process.env.DATABASE_URL) throw new Error('Configure the local DATABASE_URL before running this check');
const url = new URL(process.env.DATABASE_URL);
if (!['127.0.0.1','localhost'].includes(url.hostname)) throw new Error('Only local test databases are allowed');
const result = spawnSync(process.execPath, ['--test', 'lib/server/jobs.integration.test.cjs', 'lib/server/public-access.integration.test.cjs'], {
  env: { ...process.env, LEMON_TEST_DATABASE_URL: process.env.DATABASE_URL, NODE_ENV: 'test', PUBLIC_REGISTRATION: '', DAILY_QUOTA_ENABLED: '', AI_BUDGET_ENABLED: '' },
  stdio: 'inherit', windowsHide: true
});
if (result.error) throw result.error;
process.exitCode = result.status || 0;
