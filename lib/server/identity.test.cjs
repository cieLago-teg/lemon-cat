const test = require('node:test');
const assert = require('node:assert/strict');
const { parseVerdict } = require('./identity.cjs');
const { publicJob } = require('./jobs.cjs');
const good = { verdict: 'pass', reason: '脸部斑纹和四足白色分布相符', matches: ['左脸黑斑', '四足白色'], conflicts: [] };
test('identity verdict fails closed for uncertain, conflicts, sparse evidence and malformed responses', () => {
  assert.equal(parseVerdict(JSON.stringify(good)).passed, true);
  assert.equal(parseVerdict('```json\n' + JSON.stringify(good) + '\n```').passed, true);
  for (const patch of [{ verdict: 'uncertain' }, { verdict: 'fail' }, { conflicts: ['脸部斑纹位置不同'] }, { matches: ['同品种'] }, { matches: ['左脸黑斑', ' 左脸黑斑 '] }]) {
    assert.equal(parseVerdict(JSON.stringify({ ...good, ...patch, passed: true })).passed, false);
  }
  for (const raw of ['yes', '{}', 'null', JSON.stringify({ ...good, matches: [true] }), JSON.stringify({ ...good, matches: ['', ' '] })]) assert.throws(() => parseVerdict(raw));
});
test('unreviewed job candidates are never returned as finished results', () => {
  for (const state of ['materializing', 'needs_review', 'failed', 'submitting']) {
    const job = publicJob({ id: 'test', state, updated_at: new Date(), result: { results: [{ imageUrl: '/secret-candidate' }], videoUrl: '/unchecked' } });
    assert.equal(job.result, null);
    assert.equal(job.videoUrl, null);
  }
});
