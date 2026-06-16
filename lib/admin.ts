/**
 * Admin allowlist. Who may access the /admin dashboard is controlled by the
 * ADMIN_EMAILS env var (comma-separated, case-insensitive). Keeping this in an
 * env var — not the database — means admin rights can never be granted by
 * editing a normal user row, and the list is identical to whatever is set in
 * the Vercel project for production.
 *
 * Example:  ADMIN_EMAILS=you@example.com,cofounder@example.com
 */

/** The configured admin emails, normalized to lowercase. */
function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** True if this email is on the admin allowlist. */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }
  return adminEmails().includes(email.trim().toLowerCase());
}
