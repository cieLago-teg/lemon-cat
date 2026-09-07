const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');

test('concurrent asynchronous archive saves preserve both records; corrupt database blocks writes', async (t) => {
  const previousDirectory = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lemon-archive-test-'));
  const previousLoader = require.extensions['.ts'];
  require.extensions['.ts'] = (module, filename) => {
    const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
    });
    module._compile(compiled.outputText, filename);
  };
  t.after(() => {
    process.chdir(previousDirectory);
    if (previousLoader) require.extensions['.ts'] = previousLoader;
    else delete require.extensions['.ts'];
    fs.rmSync(dir, { recursive: true, force: true });
  });
  process.chdir(dir);
  const archive = require('./archive.ts');
  const input = (petName) => ({ petName, results: [{ style: 'test', imageUrl: 'data:image/png;base64,AA==' }] });
  await Promise.all([archive.saveArchiveAsync(input('first')), archive.saveArchiveAsync(input('second'))]);
  assert.deepEqual(archive.getAllArchives().map((entry) => entry.petName).sort(), ['first', 'second']);
  const file = path.join(dir, 'data', 'archives.json');
  fs.writeFileSync(file, '{broken');
  await assert.rejects(archive.saveArchiveAsync(input('third')), /preserved/);
  assert.equal(fs.readFileSync(file, 'utf8'), '{broken');
});
