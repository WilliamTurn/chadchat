import { ArrowLeft } from "lucide-react";
import Link from "next/link";

/**
 * R2-5: one consistent way back from every detail page. A small breadcrumb
 * above the page title, so leaving a deep surface never depends on finding
 * the nav bar or the browser's back button. Document pages nested under a
 * listing (e.g. /goals/[id]) point it at their parent instead (R2-9).
 */
export function BackToDashboard({
  href = "/today",
  label = "Dashboard",
}: {
  href?: string;
  label?: string;
}) {
  return (
    <Link
      className="mb-2 inline-flex items-center gap-1 text-muted-foreground text-xs underline-offset-4 transition-colors hover:text-foreground hover:underline"
      href={href}
    >
      <ArrowLeft className="size-3.5" />
      {label}
    </Link>
  );
}
