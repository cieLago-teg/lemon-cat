const net = require('node:net');
function devAddress(args) {
  function option(long, short, fallback) {
    const inline = args.find((arg) => arg.startsWith(`${long}=`));
    if (inline) return inline.slice(long.length + 1);
    const index = args.findIndex((arg) => arg === long || arg === short);
    return index < 0 ? fallback : args[index + 1];
  }
  const port = Number(option('--port', '-p', '3000'));
  const host = option('--hostname', '-H', '127.0.0.1');
  if (!Number.isInteger(port) || port < 1 || port > 65535 || !host || host.startsWith('-')) throw new Error('Invalid development hostname or port');
  return { port, host };
}
async function assertPortAvailable(address) {
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', (err) => reject(new Error(`Development address ${address.host}:${address.port} is unavailable. Stop the existing service before starting another; no worker was started.`, { cause: err })));
    probe.listen({ ...address, exclusive: true }, () => probe.close((err) => err ? reject(err) : resolve()));
  });
}
module.exports = { devAddress, assertPortAvailable };
