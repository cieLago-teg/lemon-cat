const path = require('node:path');
function config() {
  return {
    databaseUrl: process.env.DATABASE_URL,
    dataDir: path.resolve(process.env.LEMON_DATA_DIR || 'data/service'),
    origin: process.env.APP_ORIGIN || 'http://127.0.0.1:3000',
    production: process.env.NODE_ENV === 'production',
    provider: process.env.LEMON_PROVIDER || 'dashscope',
    storage: process.env.ASSET_STORAGE || 'local',
    invite: process.env.REGISTRATION_CODE,
    initialCredits: Number(process.env.INITIAL_CREDITS || 0)
  };
}
module.exports = { config };
