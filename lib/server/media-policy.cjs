function isProviderMediaUrl(raw) {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && !url.username && !url.password && (!url.port || url.port === '443') &&
      url.hostname.endsWith('.aliyuncs.com') && url.hostname.includes('dashscope');
  } catch { return false; }
}
async function downloadMedia(url, maximum = 40 * 1024 * 1024) {
  if (!isProviderMediaUrl(url)) throw new Error('Untrusted provider media URL');
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(60000) });
  if (!response.ok || !response.body) throw new Error(`Media download failed (${response.status})`);
  if (Number(response.headers.get('content-length')) > maximum) throw new Error('Media too large');
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > maximum) throw new Error('Media too large');
    chunks.push(Buffer.from(chunk));
  }
  if (!size) throw new Error('Empty media');
  return { bytes: Buffer.concat(chunks), contentType: response.headers.get('content-type')?.split(';')[0] || 'application/octet-stream' };
}
module.exports = { isProviderMediaUrl, downloadMedia };
