import nodemailer from 'nodemailer';

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT ?? 587),
    secure: Number(SMTP_PORT ?? 587) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

/**
 * Sends an email through whichever SMTP provider is configured via env vars
 * (Gmail app password, Outlook, SendGrid/Resend SMTP relay, Mailtrap for local
 * testing…). Silently no-ops when SMTP isn't configured so the rest of the app
 * (password reset, account creation, report validation) never breaks because
 * mail isn't set up yet — it just logs instead of sending.
 */
export async function sendMail({ to, subject, html }: { to: string; subject: string; html: string }): Promise<void> {
  const client = getTransporter();
  if (!client) {
    console.warn(`[mailer] SMTP not configured — skipping email "${subject}" to ${to}`);
    return;
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  try {
    await client.sendMail({ from, to, subject, html });
  } catch (error) {
    console.error(`[mailer] Failed to send "${subject}" to ${to}:`, error);
  }
}
