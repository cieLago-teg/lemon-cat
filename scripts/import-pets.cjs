const fs = require('node:fs');
const path = require('node:path');
const { transaction, close } = require('../lib/server/db.cjs');
const { logger } = require('../lib/server/logger.cjs');

async function importPets(file = path.resolve('data/archives.json')) {
  const raw = fs.readFileSync(file, 'utf8');
  const archives = JSON.parse(raw);
  if (!Array.isArray(archives)) throw new Error('Invalid legacy archive store');
  // 原 JSON 不改动；先留时间戳备份，再在一个数据库事务里导入。
  const backup = `${file}.before-postgres-${Date.now()}.json`;
  fs.copyFileSync(file, backup, fs.constants.COPYFILE_EXCL);
  let inserted = 0;
  await transaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(17401741)');
    for (const archive of archives) {
      if (!/^[a-z0-9]+$/i.test(archive.id) || !archive.ownerId) throw new Error('Run migrate:legacy before importing unowned archives');
      const existing = await client.query('SELECT user_id FROM pets WHERE id=$1', [archive.id]);
      if (existing.rows[0]) {
        if (existing.rows[0].user_id !== archive.ownerId) throw new Error('Archive ownership conflict; import rolled back');
        continue;
      }
      const result = await client.query('INSERT INTO pets(id,user_id,data,created_at) VALUES($1,$2,$3,$4)', [archive.id, archive.ownerId, archive, new Date(archive.createdAt)]);
      inserted += result.rowCount;
    }
  });
  logger.info({ total: archives.length, inserted, backup }, 'legacy pets imported; source unchanged');
}
if (require.main === module) importPets().catch((err) => { logger.error({ err }, 'pet import failed'); process.exitCode = 1; }).finally(close);
module.exports = { importPets };
