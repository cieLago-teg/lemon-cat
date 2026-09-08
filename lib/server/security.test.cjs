const test = require('node:test');
const assert = require('node:assert/strict');
const { sameOrigin } = require('./auth.cjs');
const { route } = require('./http.cjs');
const { safeReturnPath } = require('../client/navigation.cjs');
const { isProviderMediaUrl } = require('./media-policy.cjs');
const { assetUrl, trustedOrigin, externalUrl } = require('../../app-shell/desktop-policy.cjs');
const origin = 'http://127.0.0.1:3000';
test('CSRF rejects absent, null and foreign origin; permits JSON same origin', () => {
  for (const value of [undefined, 'null', 'https://evil.test']) {
    assert.throws(() => sameOrigin(new Request(origin, { method: 'POST', headers: value ? { origin: value } : {} })), /来源/);
  }
  assert.doesNotThrow(() => sameOrigin(new Request(origin, { method: 'POST', headers: { origin, 'content-type': 'application/json; charset=utf-8' } })));
  assert.throws(() => sameOrigin(new Request(origin, { method: 'POST', headers: { origin, 'content-type': 'text/plain' } })), /JSON/);
});
test('request boundary validates JSON, disables shared caches and generates request ids', async () => {
  const handler = route('POST', async (request) => Response.json(await request.json(), { headers: { 'cache-control': 'public, max-age=3600' } }));
  const request = (body) => new Request(origin, { method: 'POST', headers: { origin, 'content-type': 'application/json', 'x-request-id': 'attacker-chosen' }, body });
  const ok = await handler(request('{"hello":"world"}'));
  assert.deepEqual(await ok.json(), { hello: 'world' });
  assert.equal(ok.headers.get('cache-control'), 'private, no-store');
  assert.notEqual(ok.headers.get('x-request-id'), 'attacker-chosen');
  for (const body of ['{','null','[]']) assert.equal((await handler(request(body))).status, 400);
});
test('return paths block protocol-relative, backslash and control character redirects', () => {
  for (const value of ['//evil.test', '/\\evil.test', '/\n/evil.test', 'https://evil.test', '/login']) assert.equal(safeReturnPath(value), '/create');
  assert.equal(safeReturnPath('/pets?test=1'), '/pets?test=1');
});
test('media and desktop boundaries reject local networks, credentials, ports and origin prefixes', () => {
  for (const value of ['http://127.0.0.1:9000/a','file:///secret','https://user:pass@dashscope.oss.aliyuncs.com/a','https://dashscope.oss.aliyuncs.com:444/a','https://dashscope.oss.aliyuncs.com.evil.test/a']) assert.equal(isProviderMediaUrl(value), false);
  assert.equal(trustedOrigin('https://lemon.test.evil.test','https://lemon.test'), false);
  assert.equal(externalUrl('file:///secret'), false);
  assert.throws(() => assetUrl('https://evil.test/video',origin));
  assert.equal(assetUrl('/api/assets/00000000-0000-0000-0000-000000000000',origin), origin+'/api/assets/00000000-0000-0000-0000-000000000000');
});
