import "server-only";

import { Resend } from "resend";

let client: Resend | null = null;

/**
 * Lazily build the Resend client. Returns null when RESEND_API_KEY is not set
 * so the app runs fine before email is configured — the moment the key lands in
 * the environment, emails start sending with no code change.
 */
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return null;
  }
  if (!client) {
    client = new Resend(key);
  }
  return client;
}

// From address. Must be on a domain verified in Resend. Until a domain is
// verified you can use Resend's onboarding sender (onboarding@resend.dev).
export const EMAIL_FROM =
  process.env.EMAIL_FROM ?? "Chad <onboarding@resend.dev>";

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ skipped: boolean }> {
  const resend = getResend();

  if (!resend) {
    if (process.env.NODE_ENV !== "production") {
      // biome-ignore lint/suspicious/noConsole: dev-only notice that email isn't wired yet
      console.warn(
        `[email] RESEND_API_KEY not set — skipping email to ${to} ("${subject}")`
      );
    }
    return { skipped: true };
  }

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject,
    html,
  });

  if (error) {
    throw new Error(`Resend failed to send email: ${error.message}`);
  }

  return { skipped: false };
}
