const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function worker(verdicts) {
  const records = new Map();
  const calls = [];
  let videoCalls = 0;
  const output = ts.transpileModule(fs.readFileSync('scripts/worker.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const testModule = { exports: {} };
  const mockRequire = (name) => {
    const normalized = name.replace(/\\/g, '/');
    if (name.startsWith('node:')) return require(name);
    if (name === '../lib/bailian') return { verifyPetIdentity: async (source, candidate) => {
      calls.push({ source, candidate });
      const verdict = verdicts[calls.length - 1];
      if (verdict instanceof Error) throw verdict;
      return verdict;
    } };
    if (name === 'undici') return { fetch: async () => { videoCalls++; throw new Error('Unexpected paid video call'); } };
    if (normalized.endsWith('/db.cjs')) return { database: () => ({ query: async (sql, values) => {
      if (sql.startsWith('SELECT verdict')) return { rows: records.has(values[1]) ? [{ verdict: records.get(values[1]) }] : [] };
      if (sql.startsWith('INSERT INTO identity_checks')) { records.set(values[2], values[6]); return { rows: [] }; }
      throw new Error(`Unexpected query: ${sql}`);
    } }) };
    if (normalized.endsWith('/assets.cjs')) return {
      ownedAsset: async (_user, id) => ({ id, content_type: 'image/png' }),
      readAsset: async (asset) => Buffer.from(asset.id)
    };
    if (normalized.endsWith('/identity.cjs')) return { requireVerifiedImage: async () => { throw new Error('Image not verified'); } };
    if (normalized.endsWith('/logger.cjs')) return { logger: { info() {} } };
    if (['../lib/prompts'].includes(name) || /\/(jobs|config|media-policy|dashscope-video-config|animation-prompt|rvm-matting)\.(cjs|js)$/.test(normalized)) return {};
    throw new Error(`Unexpected dependency: ${name}`);
  };
  vm.runInThisContext(`(function(require,module,exports){${output}\n})`, { filename: 'worker-identity-fixture.cjs' })(mockRequire, testModule, testModule.exports);
  return { adapter: testModule.exports.adapter, calls, records, videoCalls: () => videoCalls };
}
const pass = { passed: true, verdict: 'pass', reason: '相符', matches: ['左脸黑斑', '白爪'], conflicts: [] };
const fail = { passed: false, verdict: 'fail', reason: '花纹不同', matches: [], conflicts: ['脸部花纹不同'] };
const job = { id: 'job', user_id: 'user', kind: 'generate', input: { sourceImageUrl: '/api/assets/original' }, result: { results: [{ style: '水墨', imageUrl: '/api/assets/one' }, { style: '像素', imageUrl: '/api/assets/two' }] } };

test('actual worker publishes only approved styles and reuses persisted checks on retry', async () => {
  const fixture = worker([pass, fail]);
  const result = await fixture.adapter.materialize(job);
  assert.deepEqual(result.results.map((item) => item.style), ['水墨']);
  assert.deepEqual(result.rejected, [{ style: '像素', reason: '花纹不同' }]);
  assert.equal(fixture.records.size, 2);
  assert.equal(fixture.calls[0].source, `data:image/png;base64,${Buffer.from('original').toString('base64')}`);
  assert.deepEqual(await fixture.adapter.materialize(job), result);
  assert.equal(fixture.calls.length, 2, 'restart must not repeat completed checks');
});

test('actual worker blocks all-failed checks, provider errors and unverified video submission', async () => {
  await assert.rejects(worker([fail, fail]).adapter.materialize(job), { identityBlocked: true });
  const cause = new Error('Qwen network unavailable');
  await assert.rejects(worker([cause]).adapter.materialize(job), (err) => err.identityBlocked && err.cause === cause);
  const fixture = worker([]);
  const previous = process.env.DASHSCOPE_API_KEY;
  process.env.DASHSCOPE_API_KEY = 'synthetic-test-key';
  try {
    await assert.rejects(fixture.adapter.submit({ ...job, kind: 'animate', input: { imageUrl: '/api/assets/unverified' } }), /Image not verified/);
    assert.equal(fixture.videoCalls(), 0);
  } finally {
    if (previous === undefined) delete process.env.DASHSCOPE_API_KEY;
    else process.env.DASHSCOPE_API_KEY = previous;
  }
});
