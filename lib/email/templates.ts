// Plain inline-styled HTML emails — no extra template dependency. Kept simple
// and on-brand (deep blood-red accent). Both follow the same minimal layout.

const BRAND_RED = "#a4161a";

function layout({
  heading,
  body,
  buttonLabel,
  buttonUrl,
  footer,
}: {
  heading: string;
  body: string;
  buttonLabel: string;
  buttonUrl: string;
  footer: string;
}): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#141414;border:1px solid #262626;border-radius:12px;padding:32px;">
            <tr><td style="color:#fff;font-size:18px;font-weight:700;letter-spacing:1px;padding-bottom:24px;">CHAD</td></tr>
            <tr><td style="color:#fff;font-size:20px;font-weight:600;padding-bottom:12px;">${heading}</td></tr>
            <tr><td style="color:#a3a3a3;font-size:14px;line-height:22px;padding-bottom:24px;">${body}</td></tr>
            <tr>
              <td style="padding-bottom:24px;">
                <a href="${buttonUrl}" style="display:inline-block;background:${BRAND_RED};color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;">${buttonLabel}</a>
              </td>
            </tr>
            <tr><td style="color:#737373;font-size:12px;line-height:20px;border-top:1px solid #262626;padding-top:16px;">${footer}<br/><br/>If the button doesn't work, copy and paste this link into your browser:<br/><a href="${buttonUrl}" style="color:#a3a3a3;word-break:break-all;">${buttonUrl}</a></td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function verificationEmailTemplate(url: string): {
  subject: string;
  html: string;
} {
  return {
    subject: "Verify your email for Chad",
    html: layout({
      heading: "Confirm your email",
      body: "Thanks for signing up. Confirm your email address so you can recover your account later. This link expires in 24 hours.",
      buttonLabel: "Verify email",
      buttonUrl: url,
      footer: "If you didn't create a Chad account, you can ignore this email.",
    }),
  };
}

export function paymentFailedEmailTemplate(url: string): {
  subject: string;
  html: string;
} {
  return {
    subject: "Your Chad payment didn't go through",
    html: layout({
      heading: "Update your payment method",
      body: "We tried to charge your card for Chad and it didn't go through. We'll keep retrying for a little while, but to avoid losing your access, update your payment method now. It takes about a minute.",
      buttonLabel: "Update payment method",
      buttonUrl: url,
      footer:
        "If you've already fixed this, you can ignore this email. Manage your billing anytime from your account page.",
    }),
  };
}

export function passwordResetEmailTemplate(url: string): {
  subject: string;
  html: string;
} {
  return {
    subject: "Reset your Chad password",
    html: layout({
      heading: "Reset your password",
      body: "We received a request to reset your password. Click the button below to choose a new one. This link expires in 1 hour.",
      buttonLabel: "Reset password",
      buttonUrl: url,
      footer:
        "If you didn't request a password reset, you can ignore this email — your password won't change.",
    }),
  };
}

/** Escape text for safe interpolation into the HTML email shell. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * A proactive check-in from Chad (FEAT-11, Elite). The body is the plain-text
 * message the compose pass wrote in Chad's voice; it's escaped and split into
 * paragraphs here, so the model never injects HTML. Same dark shell as the
 * auth/billing emails, but the copy IS the message (no generic heading), the
 * CTA drops the reader into chat, and the footer says exactly how to dial the
 * frequency down — the anti-spam escape hatch is always one click away.
 */
export function checkInEmailTemplate({
  body,
  chatUrl,
  settingsUrl,
}: {
  body: string;
  chatUrl: string;
  settingsUrl: string;
}): string {
  const paragraphs = escapeHtml(body.trim())
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p style="margin:0 0 14px 0;">${p.replace(/\n/g, "<br/>")}</p>`
    )
    .join("");

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#141414;border:1px solid #262626;border-radius:12px;padding:32px;">
            <tr><td style="color:#fff;font-size:18px;font-weight:700;letter-spacing:1px;padding-bottom:24px;">CHAD</td></tr>
            <tr><td style="color:#e5e5e5;font-size:15px;line-height:24px;padding-bottom:10px;">${paragraphs}</td></tr>
            <tr>
              <td style="padding-bottom:24px;">
                <a href="${chatUrl}" style="display:inline-block;background:${BRAND_RED};color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;">Reply to Chad</a>
              </td>
            </tr>
            <tr><td style="color:#737373;font-size:12px;line-height:20px;border-top:1px solid #262626;padding-top:16px;">You get these check-ins as a Chad Elite member — it's Chad holding you accountable between sessions. Choose how often he reaches out, or pause check-ins, anytime on <a href="${settingsUrl}" style="color:#a3a3a3;">your account page</a>.</td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
