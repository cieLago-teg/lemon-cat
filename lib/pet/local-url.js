function resolveLocalAssetUrl(raw, requestUrl, env = process.env) {
  if (!raw.startsWith('/')) return raw;
  if (raw.startsWith('//')) throw new Error('Invalid local asset path');
  const request = new URL(requestUrl);
  const requestIsLocal = ['localhost', '127.0.0.1', '[::1]'].includes(request.hostname);
  const port = env.PORT || (requestIsLocal ? request.port : '') || '3000';
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error('Invalid server port');
  }
  return `http://127.0.0.1:${port}${raw}`;
}

module.exports = { resolveLocalAssetUrl };
