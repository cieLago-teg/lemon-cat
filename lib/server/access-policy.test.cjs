const test = require('node:test');
const assert = require('node:assert/strict');
const { quotaEnabled, budgetEnabled, budgetPolicy, callLimit } = require('./access-policy.cjs');
const { mailConfig } = require('./mail.cjs');
function env(t, values) {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  Object.assign(process.env, values);
  t.after(() => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
}

test('public and production modes cannot disable quota or budget enforcement', (t) => {
  env(t, { NODE_ENV:'', PUBLIC_REGISTRATION:'', DAILY_QUOTA_ENABLED:'', AI_BUDGET_ENABLED:'' });
  assert.equal(quotaEnabled(), false); assert.equal(budgetEnabled(), false);
  process.env.PUBLIC_REGISTRATION = 'true'; assert.equal(quotaEnabled(), true); assert.equal(budgetEnabled(), true);
  process.env.PUBLIC_REGISTRATION = ''; process.env.NODE_ENV = 'production';
  assert.equal(quotaEnabled(), true); assert.equal(budgetEnabled(), true);
});
test('missing, non-integer and unconfigured model prices fail closed', (t) => {
  env(t, { AI_MONTHLY_LIMIT_MICROS:'100', AI_CALL_LIMITS_JSON:'{"fixture":60}' });
  assert.deepEqual(callLimit('fixture'), { monthlyMicros: 100, amount: 60 });
  assert.throws(() => callLimit('unknown'), { status: 503 });
  for (const value of ['', '0', '-1', '1.2', 'Infinity', '9007199254740992']) {
    process.env.AI_MONTHLY_LIMIT_MICROS = value;
    assert.throws(() => budgetPolicy(), { status: 503 });
  }
  process.env.AI_MONTHLY_LIMIT_MICROS = '100';
  for (const value of ['{}', 'null', '[]', '{"fixture":-1}']) {
    process.env.AI_CALL_LIMITS_JSON = value;
    assert.throws(() => budgetPolicy(), { status: 503 });
  }
  process.env.AI_CALL_LIMITS_JSON = '{'; assert.throws(() => budgetPolicy(), /invalid JSON/);
  process.env.AI_CALL_LIMITS_JSON = '{"fixture":101}'; assert.throws(() => callLimit('fixture'), { status: 503 });
});
test('email transport requires authenticated TLS ports and never accepts header injection', (t) => {
  env(t, { SMTP_HOST:'smtp.test.invalid', SMTP_PORT:'465', SMTP_USER:'test', SMTP_PASSWORD:'test-only', MAIL_FROM:'test@test.invalid' });
  assert.equal(mailConfig().port, 465);
  process.env.SMTP_PORT = '587'; assert.equal(mailConfig().port, 587);
  process.env.SMTP_PORT = '25'; assert.throws(() => mailConfig(), { status: 503 });
  process.env.SMTP_PORT = '465'; process.env.MAIL_FROM = 'test@test.invalid\r\nBcc: victim@test.invalid';
  assert.throws(() => mailConfig(), /Invalid MAIL_FROM/);
});
