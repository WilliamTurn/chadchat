import "server-only";

import { getAppUrl } from "@/lib/stripe";
import { sendEmail } from "./client";
import { paymentFailedEmailTemplate } from "./templates";

/**
 * Dunning email sent when a subscription invoice fails to charge. Points the
 * member at /account, where they can open the Stripe billing portal to update
 * their card. No-ops silently (via sendEmail) until RESEND_API_KEY is set.
 */
export async function sendPaymentFailedEmail(
  email: string
): Promise<{ skipped: boolean }> {
  const url = new URL("/account", getAppUrl()).toString();
  const { subject, html } = paymentFailedEmailTemplate(url);
  return await sendEmail({ to: email, subject, html });
}
