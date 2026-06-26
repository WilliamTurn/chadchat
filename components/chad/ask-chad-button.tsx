import { MessageSquare } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * A small deep-link that opens a fresh chat with Chad, pre-seeded with a
 * context-specific prompt about the dashboard module it sits on. The chat
 * composer reads the `?prompt=` query param and fills the input — see
 * `components/chat/multimodal-input.tsx`. Since Chad can read the user's full
 * dashboard via the `getDashboard` tool, the prompt only needs to point him at
 * the topic; he pulls the actual numbers himself.
 *
 * This is a plain (non-client) component — just a Link — so it can be dropped
 * into both server and client dashboard components.
 */
export function AskChadButton({
  prompt,
  label = "Ask Chad",
  className,
}: {
  prompt: string;
  label?: string;
  className?: string;
}) {
  return (
    <Button
      asChild
      className={`gap-1.5${className ? ` ${className}` : ""}`}
      size="sm"
      variant="outline"
    >
      <Link href={`/?prompt=${encodeURIComponent(prompt)}`}>
        <MessageSquare className="size-3.5" />
        {label}
      </Link>
    </Button>
  );
}
