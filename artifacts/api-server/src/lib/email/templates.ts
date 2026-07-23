// Email content builders. Each returns { subject, html, text }; the caller pairs
// it with a recipient and hands it to sendEmail(). HTML is intentionally simple,
// inline-styled, and always accompanied by a plaintext fallback.

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

// Escape user-supplied strings before interpolating into HTML.
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Shared shell: a centered card with the Vispix wordmark, a body, and a footer.
function layout(bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
      <tr><td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr><td style="padding-bottom:16px;font-size:20px;font-weight:700;color:#7c3aed;">Vispix</td></tr>
          <tr><td style="font-size:15px;line-height:1.6;">${bodyHtml}</td></tr>
          <tr><td style="padding-top:24px;font-size:12px;color:#a1a1aa;">Vispix &middot; photo management for archery organizations</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

// A primary call-to-action button.
function button(url: string, label: string): string {
  return `<a href="${esc(url)}" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;font-size:14px;">${esc(label)}</a>`;
}

export function passwordResetEmail(url: string): EmailContent {
  return {
    subject: "Reset your Vispix password",
    html: layout(
      `<p style="margin:0 0 16px;">We received a request to reset your Vispix password. Click below to choose a new one. This link expires in 1 hour.</p>
       <p style="margin:0 0 24px;">${button(url, "Reset password")}</p>
       <p style="margin:0;color:#71717a;font-size:13px;">If you didn't request this, you can safely ignore this email — your password won't change.</p>`,
    ),
    text: `Reset your Vispix password\n\nWe received a request to reset your password. Open this link to choose a new one (expires in 1 hour):\n\n${url}\n\nIf you didn't request this, ignore this email — your password won't change.`,
  };
}

export function emailVerificationEmail(url: string): EmailContent {
  return {
    subject: "Confirm your Vispix email",
    html: layout(
      `<p style="margin:0 0 16px;">Welcome to Vispix! Confirm your email address to activate your account.</p>
       <p style="margin:0 0 24px;">${button(url, "Confirm email")}</p>
       <p style="margin:0;color:#71717a;font-size:13px;">If you didn't create a Vispix account, you can ignore this email.</p>`,
    ),
    text: `Confirm your Vispix email\n\nWelcome to Vispix! Confirm your email address to activate your account:\n\n${url}\n\nIf you didn't create a Vispix account, ignore this email.`,
  };
}

export function orgInviteEmail(orgName: string, signUpUrl: string): EmailContent {
  const org = esc(orgName);
  return {
    subject: `You've been invited to ${orgName} on Vispix`,
    html: layout(
      `<p style="margin:0 0 16px;">You've been invited to join <strong>${org}</strong> on Vispix, a photo library for archery organizations.</p>
       <p style="margin:0 0 24px;">${button(signUpUrl, "Accept invitation")}</p>
       <p style="margin:0;color:#71717a;font-size:13px;">Sign up with this email address and you'll be added to ${org} automatically.</p>`,
    ),
    text: `You've been invited to ${orgName} on Vispix\n\nJoin ${orgName} on Vispix, a photo library for archery organizations. Sign up with this email address and you'll be added automatically:\n\n${signUpUrl}`,
  };
}

export function adminNewSignupEmail(userEmail: string, userName: string | null): EmailContent {
  const who = userName ? `${esc(userName)} (${esc(userEmail)})` : esc(userEmail);
  const whoText = userName ? `${userName} (${userEmail})` : userEmail;
  return {
    subject: `New Vispix signup: ${userEmail}`,
    html: layout(`<p style="margin:0;">A new user just signed up for Vispix: <strong>${who}</strong>.</p>`),
    text: `New Vispix signup: ${whoText}`,
  };
}

export function adminNewOrgEmail(orgName: string, creatorEmail: string): EmailContent {
  return {
    subject: `New Vispix organization: ${orgName}`,
    html: layout(
      `<p style="margin:0;">A new organization <strong>${esc(orgName)}</strong> was created on Vispix by ${esc(creatorEmail)}.</p>`,
    ),
    text: `New Vispix organization "${orgName}" created by ${creatorEmail}.`,
  };
}
