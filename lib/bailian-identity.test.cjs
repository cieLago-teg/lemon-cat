const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { createRequire } = require('node:module');
const localRequire = createRequire(__filename);

function provider(reply) {
  const requests = [];
  const output = ts.transpileModule(fs.readFileSync('lib/bailian.ts','utf8'), { compilerOptions:{ module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022 } }).outputText;
  const testModule = { exports:{} };
  const mockRequire = (name) => {
    if (name === './auth') return { ensureAuth: () => ({baseUrl:'https://dashscope.aliyuncs.com/compatible-mode/v1',apiKey:'synthetic-test-key'}) };
    if (name === 'undici') return { Agent:class {}, fetch:async (url,options) => {
      requests.push({url,body:JSON.parse(options.body)});
      return new Response(JSON.stringify(reply),{status:200});
    } };
    return localRequire(name);
  };
  vm.runInThisContext(`(function(require,module,exports){${output}\n})`,{filename:'bailian-provider-test.cjs'})(mockRequire,testModule,testModule.exports);
  return { api:testModule.exports, requests };
}
test('Qwen edit request carries original image together with style and never falls back to text-to-image',async () => {
  const {api,requests} = provider({output:{choices:[{message:{content:[{image:'https://dashscope.oss.aliyuncs.com/result.png'}]}}]}});
  const source = 'data:image/png;base64,b3JpZ2luYWw=';
  await api.generatePetImage('像素风',source,'qwen-image-edit-plus-2025-12-15');
  assert.equal(requests.length,1);
  assert.equal(requests[0].body.input.messages[0].content[0].image,source);
  assert.match(requests[0].body.input.messages[0].content[1].text,/像素风/);
  await assert.rejects(api.generatePetImage('像素风',source,'wan2.6-t2i'));
  assert.equal(requests.length,1,'invalid model must not submit any provider request');
});
test('Qwen VL compares two ordered images and treats model uncertainty as blocked',async () => {
  const {api,requests} = provider({choices:[{message:{content:JSON.stringify({verdict:'uncertain',reason:'像素风丢失脸部花纹',matches:[],conflicts:[]})}}]});
  const verdict = await api.verifyPetIdentity('original-image','candidate-image','qwen3-vl-plus');
  assert.equal(verdict.passed,false);
  assert.equal(requests[0].body.messages[1].content[0].image_url.url,'original-image');
  assert.equal(requests[0].body.messages[1].content[1].image_url.url,'candidate-image');
});
