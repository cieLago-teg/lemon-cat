function trustedOrigin(raw, appUrl) {
  try { return new URL(raw).origin === new URL(appUrl).origin; } catch { return false; }
}
function assetUrl(raw, appUrl) {
  if (typeof raw !== 'string' || !/^\/api\/assets\/[a-f0-9-]{36}$/.test(raw)) throw new Error('Only private application assets can be deployed');
  return new URL(raw, appUrl).href;
}
function externalUrl(raw) {
  try { return new URL(raw).protocol === 'https:'; } catch { return false; }
}
module.exports = { trustedOrigin, assetUrl, externalUrl };
