const { HttpError } = require('./errors.cjs');

function quotaEnabled() {
  return process.env.NODE_ENV === 'production' || process.env.PUBLIC_REGISTRATION === 'true' || process.env.DAILY_QUOTA_ENABLED === 'true';
}
function budgetEnabled() {
  return quotaEnabled() || process.env.AI_BUDGET_ENABLED === 'true';
}
function positiveInteger(value, name) {
  if (!/^\d+$/.test(String(value || '')) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0) {
    throw new HttpError(503, `AI safety configuration missing: ${name}`);
  }
  return Number(value);
}
function budgetPolicy() {
  const monthlyMicros = positiveInteger(process.env.AI_MONTHLY_LIMIT_MICROS, 'AI_MONTHLY_LIMIT_MICROS');
  // 配置单位为百万分之一人民币，不用浮点数记账。上线前须核对模型与地域报价。
  let rates;
  try { rates = JSON.parse(process.env.AI_CALL_LIMITS_JSON || '{}'); }
  catch (err) { throw new Error('AI_CALL_LIMITS_JSON is invalid JSON', { cause: err }); }
  if (!rates || typeof rates !== 'object' || Array.isArray(rates) || !Object.keys(rates).length) throw new HttpError(503, 'AI price configuration is invalid');
  for (const value of Object.values(rates)) positiveInteger(value, 'AI_CALL_LIMITS_JSON amount');
  return { monthlyMicros, rates };
}
function callLimit(profile) {
  const { monthlyMicros, rates } = budgetPolicy();
  const amount = positiveInteger(rates[profile], 'AI_CALL_LIMITS_JSON profile');
  if (amount > monthlyMicros) throw new HttpError(503, 'AI call limit exceeds monthly budget');
  return { monthlyMicros, amount };
}
module.exports = { quotaEnabled, budgetEnabled, budgetPolicy, callLimit };
