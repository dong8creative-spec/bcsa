import nodemailer from 'nodemailer';

let transporter = null;

function getSmtpConfig() {
  const host = process.env.SMTP_HOST || 'smtp.naver.com';
  const port = Number(process.env.SMTP_PORT || 465);
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').trim();
  const fromName = (process.env.SMTP_FROM_NAME || '부산청년사업가들').trim();
  const fromEmail = (process.env.SMTP_FROM_EMAIL || user).trim();
  if (!user || !pass) return null;
  return { host, port, user, pass, fromName, fromEmail };
}

function getTransporter() {
  if (transporter) return transporter;
  const cfg = getSmtpConfig();
  if (!cfg) return null;
  transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
  });
  return transporter;
}

export function isSmtpConfigured() {
  return !!getSmtpConfig();
}

/**
 * @param {{ to: string, subject: string, html: string, text: string }} mail
 */
export async function sendMail({ to, subject, html, text }) {
  const cfg = getSmtpConfig();
  const transport = getTransporter();
  if (!cfg || !transport) {
    throw new Error('SMTP_NOT_CONFIGURED');
  }
  await transport.sendMail({
    from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
    to,
    subject,
    html,
    text,
  });
}
