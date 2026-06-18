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
