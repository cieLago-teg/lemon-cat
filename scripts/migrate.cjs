const fs = require('node:fs');
const path = require('node:path');
const { database, transaction, close } = require('../lib/server/db.cjs');
const { logger } = require('../lib/server/logger.cjs');
async function migrate() {
  await transaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(17401740)');
    await client.query(fs.readFileSync(path.join(__dirname, '../lib/server/schema.sql'), 'utf8'));
  });
  logger.info({ database: Boolean(database()) }, 'schema ready');
}
if (require.main === module) migrate().catch((err) => { logger.error({ err }, 'migration failed'); process.exitCode=1; }).finally(close);
module.exports = { migrate };
