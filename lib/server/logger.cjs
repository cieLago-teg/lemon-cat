const fs = require('node:fs');
const path = require('node:path');
const pino = require('pino');
const logDir = path.resolve(process.env.LEMON_LOG_DIR || 'logs');
fs.mkdirSync(logDir, { recursive: true });
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { module: 'lemon-service', pid: process.pid },
  redact: { paths: ['password', 'token', 'apiKey', 'cookie', 'authorization', 'databaseUrl', '*.password', '*.token', '*.apiKey', '*.authorization'], censor: '[REDACTED]' },
  serializers: {
    err(error) {
      const clean = (value) => String(value || '').replace(/https?:\/\/\S+/g, '[URL]').replace(/(?:sk-|Bearer\s+)\S+/gi, '[REDACTED]');
      return { type: error?.name, message: clean(error?.message), stack: clean(error?.stack), code: error?.code };
    }
  }
}, pino.multistream([{ stream: process.stdout }, { stream: pino.destination({ dest: path.join(logDir, 'app.log'), sync: true }) }]));
module.exports = { logger };
