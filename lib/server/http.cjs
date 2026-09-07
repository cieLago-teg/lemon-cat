const crypto = require('node:crypto');
const { logger } = require('./logger.cjs');
const { HttpError } = require('./errors.cjs');

// Best-effort client ip for boundary logs; never trust it for authz.
function clientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'local';
}

// Wrap a Next.js App Router handler with request_id, boundary logging and
// error->Response mapping. Handler may throw HttpError for expected 4xx/5xx.
// Anything else is logged with full stack (error) and returned as an opaque 500
// carrying the requestId so the client can quote it back for diagnosis.
function route(method, handler) {
  return async function wrapped(request, context) {
    const requestId = request.headers.get('x-request-id') || crypto.randomUUID();
    const url = new URL(request.url);
    const log = logger.child({ requestId, method: request.method || method, path: url.pathname });
    const started = Date.now();
    log.info({ ip: clientIp(request), hasBody: request.method !== 'GET' && request.method !== 'HEAD' }, 'request start');
    try {
      const response = await handler(request, context, { requestId, log });
      if (!response.headers.has('x-request-id')) response.headers.set('x-request-id', requestId);
      log.info({ status: response.status, ms: Date.now() - started }, 'request end');
      return response;
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      const ms = Date.now() - started;
      if (status >= 500) {
        log.error({ err, status, ms }, 'request failed');
      } else {
        log.warn({ status, ms, reason: err && err.message }, 'request rejected');
      }
      const body = {
        error: status >= 500 ? '服务器内部错误，请稍后重试' : (err && err.message) || '请求失败',
        requestId
      };
      return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8', 'x-request-id': requestId }
      });
    }
  };
}

module.exports = { route, clientIp };
