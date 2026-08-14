/**
 * Every outgoing email. Edit this file to change wording or branding — the
 * layout mirrors the app's red/white theme (app/globals.css tokens).
 */

const PRIMARY = '#C62828';
const BORDER = '#E0E0E0';
const FOREGROUND = '#1A1A1A';
const MUTED = '#6B6B6B';
const SECONDARY = '#F5F5F5';

function renderEmailLayout(bodyHtml: string, previewText: string): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CerviTrust</title>
  </head>
  <body style="margin:0;padding:0;background:${SECONDARY};font-family:Arial,Helvetica,sans-serif;color:${FOREGROUND};">
    <span style="display:none;max-height:0;overflow:hidden;">${previewText}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${SECONDARY};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border:1px solid ${BORDER};border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background:${PRIMARY};padding:20px 32px;">
                <span style="color:#FFFFFF;font-size:20px;font-weight:700;letter-spacing:0.02em;">CerviTrust</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;border-top:1px solid ${BORDER};">
                <p style="margin:0;font-size:12px;color:${MUTED};line-height:1.5;">
                  This is an automated message from CerviTrust — AI-assisted cervical cytology screening. Please do not
                  reply to this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function button(url: string, label: string): string {
  return `<a href="${url}" style="display:inline-block;margin-top:8px;background:${PRIMARY};color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;">${label}</a>`;
}

export function passwordResetEmail({
  firstName,
  resetUrl,
  roleLabel,
}: {
  firstName: string;
  resetUrl: string;
  /** Set only when this email address has more than one account (e.g. both a doctor and an admin identity) — disambiguates which one this link resets. */
  roleLabel?: 'administrator' | 'practitioner';
}) {
  const subject = roleLabel ? `Reset your CerviTrust ${roleLabel} password` : 'Reset your CerviTrust password';
  const body = `
    <h1 style="margin:0 0 12px;font-size:20px;color:${FOREGROUND};">Reset your password</h1>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${FOREGROUND};">
      Hi ${firstName || 'there'}, we received a request to reset the password for your CerviTrust
      ${roleLabel ? `<strong>${roleLabel}</strong> ` : ''}account. This link is valid for 1 hour.
    </p>
    ${
      roleLabel
        ? `<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:${MUTED};">
      This email address also has another CerviTrust account under a different role — you may receive a second,
      separate reset link for it. Use the one that matches the account you meant to reset.
    </p>`
        : ''
    }
    ${button(resetUrl, 'Choose a new password')}
    <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:${MUTED};">
      If you didn't request this, you can safely ignore this email — your password will stay unchanged.
    </p>`;
  return { subject, html: renderEmailLayout(body, subject) };
}

export function accountCreatedEmail({
  firstName,
  email,
  role,
}: {
  firstName: string;
  email: string;
  role: 'doctor' | 'admin';
}) {
  const body = `
    <h1 style="margin:0 0 12px;font-size:20px;color:${FOREGROUND};">Your account is ready</h1>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${FOREGROUND};">
      Hi ${firstName || 'there'}, an administrator created a CerviTrust
      ${role === 'admin' ? 'administrator' : 'practitioner'} account for you, using this email address:
    </p>
    <p style="margin:0 0 16px;font-size:14px;font-weight:600;color:${FOREGROUND};">${email}</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${FOREGROUND};">
      Sign in with the temporary password your administrator gave you, then change it from your account settings.
    </p>`;
  return { subject: 'Your CerviTrust account was created', html: renderEmailLayout(body, 'Your CerviTrust account was created') };
}

export function reportValidatedEmail({
  doctorFirstName,
  patientFullName,
  patientId,
  validatedByName,
  validatedAt,
}: {
  doctorFirstName: string;
  patientFullName: string;
  patientId: string;
  validatedByName: string;
  validatedAt: string;
}) {
  const body = `
    <h1 style="margin:0 0 12px;font-size:20px;color:${FOREGROUND};">Report validated</h1>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${FOREGROUND};">
      Hi ${doctorFirstName || 'there'}, your report for <strong>${patientFullName}</strong> (patient ID
      ${patientId}) has been validated.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:${SECONDARY};border-radius:8px;margin:0 0 16px;">
      <tr>
        <td style="padding:16px;font-size:13px;color:${FOREGROUND};line-height:1.6;">
          <strong>Validated by:</strong> ${validatedByName}<br/>
          <strong>Validated on:</strong> ${new Date(validatedAt).toLocaleString()}
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:14px;line-height:1.6;color:${FOREGROUND};">
      Sign in to CerviTrust and open your saved reports to review it.
    </p>`;
  return { subject: `Report validated — ${patientFullName}`, html: renderEmailLayout(body, `Report validated for ${patientFullName}`) };
}
