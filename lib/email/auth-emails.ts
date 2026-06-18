import "server-only";

import { getAppUrl } from "@/lib/stripe";
import { sendEmail } from "./client";
import {
  passwordResetEmailTemplate,
  verificationEmailTemplate,
} from "./templates";

/** Build the absolute link that goes in an auth email. */
function buildLink(path: string, token: string): string {
  return new URL(
    `${path}?token=${encodeURIComponent(token)}`,
    getAppUrl()
  ).toString();
}

export async function sendVerificationEmail(
  email: string,
  token: string
): Promise<string> {
  const url = buildLink("/verify-email", token);
  const { subject, html } = verificationEmailTemplate(url);
  await sendEmail({ to: email, subject, html });
  return url;
}

export async function sendPasswordResetEmail(
  email: string,
  token: string
): Promise<string> {
  const url = buildLink("/reset-password", token);
  const { subject, html } = passwordResetEmailTemplate(url);
  await sendEmail({ to: email, subject, html });
  return url;
}
