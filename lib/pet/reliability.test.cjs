const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createAnimationTracker } = require('./animation-tracker');
const { pollAnimation } = require('./poll-animation');
const { resolveLocalAssetUrl } = require('./local-url');
const { readJson, writeJsonAtomic } = require('../db/json-store.cjs');

test('restart retains completed video and explains interrupted work without resubmission', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lemon-reliability-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const filePath = path.join(dir, 'tasks.json');
  const original = createAnimationTracker({ filePath });
  original.setSubmitted('pending');
  original.setSucceeded('finished', { videoUrl: '/pet-videos/existing.webm' });
  const restored = createAnimationTracker({ filePath });
  assert.equal(restored.get('finished').videoUrl, '/pet-videos/existing.webm');
  assert.equal(restored.get('pending').stage, 'Failure');
  assert.match(restored.get('pending').error, /重启/);
  assert.equal(restored.listActive().length, 0);
});

test('atomic storage preserves corrupt original instead of treating it as empty', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lemon-store-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'archives.json');
  writeJsonAtomic(file, [{ id: 'a' }]);
  assert.deepEqual(readJson(file, []), [{ id: 'a' }]);
  fs.writeFileSync(file, '{broken');
  assert.throws(() => readJson(file, []), /preserved/);
  assert.equal(fs.readFileSync(file, 'utf8'), '{broken');
  assert.deepEqual(fs.readdirSync(dir), ['archives.json']);
});

test('local asset URLs follow actual server port without trusting public host headers', () => {
  assert.equal(resolveLocalAssetUrl('/pet-videos/a.webm', 'http://localhost:3000/api', {}), 'http://127.0.0.1:3000/pet-videos/a.webm');
  assert.equal(resolveLocalAssetUrl('/a', 'http://localhost:3001/api', {}), 'http://127.0.0.1:3001/a');
  assert.equal(resolveLocalAssetUrl('/a', 'https://public.example/api', { PORT: '8080' }), 'http://127.0.0.1:8080/a');
  assert.throws(() => resolveLocalAssetUrl('//outside.example/a', 'http://localhost:3000', {}));
});

const response = (task) => ({ ok: true, json: async () => ({ task }) });
test('missing task stops polling and exposes actionable message', async () => {
  let calls = 0;
  await assert.rejects(pollAnimation('missing', { fetch: async () => { calls++; return response({ missing: true }); } }), /任务记录不存在/);
  assert.equal(calls, 1);
});
test('polling returns actual result and prefers detailed failure reason', async () => {
  assert.equal(await pollAnimation('done', { fetch: async () => response({ stage: 'Success', videoUrl: '/x.webm' }) }), '/x.webm');
  await assert.rejects(pollAnimation('fail', { fetch: async () => response({ stage: 'Failure', message: '失败', error: '具体原因' }) }), /具体原因/);
});
test('persistent network failure terminates after three sequential attempts', async () => {
  let calls = 0;
  await assert.rejects(pollAnimation('offline', { intervalMs: 0, fetch: async () => { calls++; throw new Error('offline'); } }), /无法查询/);
  assert.equal(calls, 3);
});
test('cancel aborts an in-flight poll and does not wait for another tick', async () => {
  const controller = new AbortController();
  const polling = pollAnimation('cancel', { signal: controller.signal, fetch: async (_, { signal }) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    controller.abort();
  }) });
  await assert.rejects(polling, { name: 'AbortError' });
});
test('overall deadline ends processing polling', async () => {
  await assert.rejects(pollAnimation('slow', { timeoutMs: 5, intervalMs: 6, fetch: async () => response({ stage: 'Processing' }) }), /停止查询/);
});
