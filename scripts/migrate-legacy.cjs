// 2026-09-08 1A 用户隔离：把 data/archives.json 里没有 ownerId 的存量档案
// 统一归属到内置 legacy 账号。幂等：已有 ownerId 的档案不动。
// 运行：npm run migrate:legacy（需先 npm run service:setup 启动 Postgres）。
const fs = require('node:fs');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);
const { Pool } = require('pg');
const { logger } = require('../lib/server/logger.cjs');

const ENV_FILE = '.env.1a.local';
const ARCHIVE_FILE = 'data/archives.json';

function appendEnvIfMissing(key, value) {
  if (!fs.existsSync(ENV_FILE)) return false;
  const lines = fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/);
  if (lines.some((line) => line.startsWith(`${key}=`))) return false;
  fs.appendFileSync(ENV_FILE, `${key}=${value}\n`);
  return true;
}

async function ensureLegacyUser(pool) {
  const email = process.env.LEGACY_EMAIL || 'legacy@lemoncat.local';
  const existing = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
  if (existing.rows[0]) {
    logger.info({ email }, 'legacy user exists, reuse');
    return existing.rows[0].id;
  }
  // 密码优先用环境变量；否则生成一次性密码并写回 .env.1a.local（幂等）。
  const password = process.env.LEGACY_PASSWORD || crypto.randomBytes(12).toString('base64url');
  if (!process.env.LEGACY_PASSWORD) {
    const written = appendEnvIfMissing('LEGACY_PASSWORD', password);
    logger.warn(
      { email, savedToEnv: written },
      written
        ? 'generated one-time legacy password and saved to .env.1a.local (LEGACY_PASSWORD)'
        : 'generated one-time legacy password, NOT saved (env file missing) — save it manually'
    );
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = (await scrypt(password, salt, 64)).toString('hex');
  const inserted = await pool.query(
    'INSERT INTO users(id,email,password_hash,credits) VALUES($1,$2,$3,$4) RETURNING id',
    [crypto.randomUUID(), email, `${salt}:${hash}`, 0]
  );
  logger.info({ email }, 'legacy user created');
  return inserted.rows[0].id;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL 未配置：先运行 npm run service:setup');
  if (!fs.existsSync(ARCHIVE_FILE)) throw new Error(`未找到 ${ARCHIVE_FILE}`);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const legacyId = await ensureLegacyUser(pool);
    const raw = fs.readFileSync(ARCHIVE_FILE, 'utf8');
    const archives = JSON.parse(raw);
    if (!Array.isArray(archives)) throw new Error('档案数据格式异常，已保留原文件，请勿覆盖。');

    let migrated = 0;
    for (const archive of archives) {
      if (!archive.ownerId) {
        archive.ownerId = legacyId;
        migrated += 1;
      }
    }

    if (migrated > 0) {
      // 与 lib/db/json-store.cjs 相同的原子写：临时文件 + rename。
      const tmp = `${ARCHIVE_FILE}.tmp-${process.pid}`;
      fs.writeFileSync(tmp, JSON.stringify(archives, null, 2));
      fs.renameSync(tmp, ARCHIVE_FILE);
    }
    logger.info({ total: archives.length, migrated, legacyId }, 'legacy archive migration done');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  logger.error({ err }, 'legacy archive migration failed');
  process.exitCode = 1;
});
