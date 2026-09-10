const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.resolve(__dirname, 'i18n.ts');
const compiled = new Module(filename, module);
compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText, filename);
const { resolveLocale, messages, translate, authError } = compiled.exports;

test('saved language wins; invalid cookies do not become locale values', () => {
  assert.equal(resolveLocale('zh', 'en-US'), 'zh');
  assert.equal(resolveLocale('en', 'zh-CN'), 'en');
  assert.equal(resolveLocale('<script>', 'zh-TW'), 'zh');
});
test('browser preferences honor quality, variants and explicit exclusions', () => {
  assert.equal(resolveLocale(undefined, 'en-US;q=0.5,zh-CN;q=0.9'), 'zh');
  assert.equal(resolveLocale(undefined, 'zh;q=0,en-GB;q=1'), 'en');
  assert.equal(resolveLocale(undefined, 'en;q=NaN,zh-HK;q=0.5'), 'zh');
  assert.equal(resolveLocale(undefined, 'en;q=2,zh;q=0.5'), 'zh');
  assert.equal(resolveLocale(undefined, 'fr-FR,de'), 'en');
  assert.equal(resolveLocale(undefined), 'en');
});
test('every UI key has non-empty Chinese and English copy', () => {
  for (const [key, pair] of Object.entries(messages)) {
    assert.equal(pair.length, 2, key);
    assert.ok(pair[0].trim(), key);
    assert.ok(pair[1].trim(), key);
    assert.doesNotMatch(pair[1], /[\u4e00-\u9fff]/, key);
    assert.equal(translate('zh', key), pair[0]);
    assert.equal(translate('en', key), pair[1]);
  }
});
test('auth errors translate known responses without echoing unknown server content', () => {
  assert.equal(authError('en', 401, '邮箱或密码不正确'), 'Incorrect email or password.');
  assert.equal(authError('zh', 429, '操作过于频繁，请稍后再试'), '操作过于频繁，请稍后再试');
  assert.match(authError('en', 500, 'private provider details'), /\(500\)/);
  assert.doesNotMatch(authError('en', 500, 'private provider details'), /private/);
});
