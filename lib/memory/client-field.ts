/**
 * Pull a value from the "## Client file" block of Chad's memory profile:
 * lines like "- Name: Alex" or "* Primary goal: Lose 20 lb". Returns null for
 * missing fields and explicit "unknown"s. Shared by the dashboard pages that
 * personalize from memory (/today, /goals).
 */
export function clientField(
  profile: string | null | undefined,
  label: string
): string | null {
  if (!profile) {
    return null;
  }
  const escaped = label.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  const re = new RegExp(`^[-*]\\s*${escaped}\\s*:\\s*(.+)$`, "im");
  const match = profile.match(re);
  const value = match?.[1]?.trim();
  if (!value || /^unknown$/i.test(value)) {
    return null;
  }
  return value;
}
