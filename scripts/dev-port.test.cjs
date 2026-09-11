const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { devAddress, assertPortAvailable } = require('./dev-port.cjs');
test('development defaults to one explicit loopback port and honors explicit options', () => {
  assert.deepEqual(devAddress([]), { host: '127.0.0.1', port: 3000 });
  assert.deepEqual(devAddress(['-H','localhost','--port=3020']), { host:'localhost',port:3020 });
  assert.throws(() => devAddress(['-p','invalid']), /Invalid/);
  assert.throws(() => devAddress(['-H']), /Invalid/);
});
test('occupied port fails before starting a second worker; a released port is usable', async () => {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = { host:'127.0.0.1', port:server.address().port };
  try { await assert.rejects(assertPortAvailable(address), /no worker was started/); }
  finally { await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve())); }
  await assertPortAvailable(address);
});
