const { Pool } = require('pg');
const { config } = require('./config.cjs');
const { logger } = require('./logger.cjs');
let pool;
function database() {
  if (!config().databaseUrl) throw new Error('DATABASE_URL is not configured');
  if (!pool) {
    pool = new Pool({ connectionString: config().databaseUrl, max: 8, connectionTimeoutMillis: 5000, statement_timeout: 15000 });
    pool.on('error', (err) => logger.error({ err }, 'database pool error'));
  }
  return pool;
}
async function transaction(run) {
  const client = await database().connect();
  try {
    await client.query('BEGIN');
    const result = await run(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally { client.release(); }
}
async function close() { if (pool) { await pool.end(); pool = undefined; } }
module.exports = { database, transaction, close };
