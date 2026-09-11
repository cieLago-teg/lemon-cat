const nodemailer = require('nodemailer');
const { HttpError } = require('./errors.cjs');
function mailConfig() {
  const { SMTP_HOST: host, SMTP_USER: user, SMTP_PASSWORD: pass, MAIL_FROM: from } = process.env;
  const port = Number(process.env.SMTP_PORT);
  if (!host || !user || !pass || !from || ![465,587].includes(port)) throw new HttpError(503, 'Email delivery is not configured');
  if (/[\r\n]/.test(from)) throw new Error('Invalid MAIL_FROM');
  return { host, port, user, pass, from };
}
async function sendAccountMail(email, token, purpose, locale) {
  const cfg = mailConfig();
  const transport = nodemailer.createTransport({
    host: cfg.host, port: cfg.port, secure: cfg.port === 465, requireTLS: true,
    auth: { user: cfg.user, pass: cfg.pass }, connectionTimeout: 10000,
    greetingTimeout: 10000, socketTimeout: 15000, disableFileAccess: true, disableUrlAccess: true,
    logger: false, debug: false
  });
  const origin = new URL(process.env.APP_ORIGIN);
  if (origin.protocol !== 'https:') throw new HttpError(503, 'Email links require HTTPS');
  const link = `${origin.origin}/account/confirm#${purpose}:${token}`;
  const action = purpose === 'verify' ? 'Verify your email and set your password' : 'Reset your password';
  const text = locale === 'zh'
    ? `Pawnear · 爪伴\n${purpose === 'verify' ? '请验证邮箱并设置密码' : '请重新设置密码'}：\n${link}\n链接 30 分钟内有效，仅可使用一次。如果不是你发起的请求，请忽略此邮件。`
    : `Pawnear\n${action}:\n${link}\nThis one-use link expires in 30 minutes. If you did not request it, ignore this email.`;
  await transport.sendMail({ from: cfg.from, to: email, subject: locale === 'zh' ? 'Pawnear · 账户安全验证' : `Pawnear · ${action}`, text });
}
module.exports = { sendAccountMail, mailConfig };
