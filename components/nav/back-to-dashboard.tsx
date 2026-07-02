import { ArrowLeft } from "lucide-react";
import Link from "next/link";

/**
 * R2-5: one consistent way back from every detail page. A small breadcrumb
 * above the page title, so leaving a deep surface never depends on finding
 * the nav bar or the browser's back button.
 */
export function BackToDashboard() {
  return (
    <Link
      className="mb-2 inline-flex items-center gap-1 text-muted-foreground text-xs underline-offset-4 transition-colors hover:text-foreground hover:underline"
      href="/today"
    >
      <ArrowLeft className="size-3.5" />
      Dashboard
    </Link>
  );
}
