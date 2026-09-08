function safeReturnPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || /[\\\x00-\x20]/.test(value)) return '/create';
  const base = 'https://lemon.invalid';
  const parsed = new URL(value, base);
  return parsed.origin === base && parsed.pathname !== '/login' ? parsed.pathname + parsed.search + parsed.hash : '/create';
}
module.exports = { safeReturnPath };
