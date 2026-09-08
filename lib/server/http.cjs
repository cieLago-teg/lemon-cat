const crypto = require('node:crypto');
const { logger } = require('./logger.cjs');
const { HttpError } = require('./errors.cjs');
const { sameOrigin } = require('./auth.cjs');

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
    const requestId = crypto.randomUUID();
    const url = new URL(request.url);
    const log = logger.child({ requestId, method: request.method || method, path: url.pathname });
    const started = Date.now();
    log.info({ ip: clientIp(request), hasBody: request.method !== 'GET' && request.method !== 'HEAD' }, 'request start');
    try {
      sameOrigin(request);
      if (!['GET', 'HEAD', 'DELETE', 'OPTIONS'].includes(request.method)) {
        const chunks = [];
        let size = 0;
        if (request.body) {
          for await (const chunk of request.body) {
            size += chunk.length;
            if (size > 8 * 1024 * 1024) throw new HttpError(413, '请求内容过大');
            chunks.push(Buffer.from(chunk));
          }
        }
        const raw = Buffer.concat(chunks).toString('utf8');
        let parsed;
        try { parsed = JSON.parse(raw); }
        catch (err) { if (!(err instanceof SyntaxError)) throw err; throw new HttpError(400, '无效的 JSON 请求'); }
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new HttpError(400, '请求必须是 JSON 对象');
        request = new Request(request.url, { method: request.method, headers: request.headers, body: raw, signal: request.signal });
      }
      const response = await handler(request, context, { requestId, log });
      // 身份相关响应不能留在共享 CDN 或退出登录后的浏览器缓存中。
      response.headers.set('cache-control', 'private, no-store');
      response.headers.set('x-content-type-options', 'nosniff');
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
        headers: { 'content-type': 'application/json; charset=utf-8', 'x-request-id': requestId, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' }
      });
    }
  };
}

module.exports = { route, clientIp };
