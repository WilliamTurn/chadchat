import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin-guard";
import { getChatById, getMessagesByChatId } from "@/lib/db/queries";

type TextPart = { type: string; text?: string };
type Attachment = { url?: string; name?: string; contentType?: string };

/** Pull the human-readable text out of a stored message's `parts` JSON. */
function extractText(parts: unknown): string {
  if (!Array.isArray(parts)) {
    return "";
  }
  return (parts as TextPart[])
    .filter((p) => p?.type === "text" && typeof p.text === "string")
    .map((p) => p.text)
    .join("\n\n")
    .trim();
}

export default function AdminTranscriptPage({
  params,
}: {
  params: Promise<{ id: string; chatId: string }>;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-16">
      <Suspense
        fallback={
          <div className="h-96 animate-pulse rounded-2xl border border-border bg-card" />
        }
      >
        <Transcript params={params} />
      </Suspense>
    </main>
  );
}

async function Transcript({
  params,
}: {
  params: Promise<{ id: string; chatId: string }>;
}) {
  await requireAdmin();
  const { id, chatId } = await params;

  const chat = await getChatById({ id: chatId });
  // Guard: the chat must belong to the member in the URL, so an admin can't
  // stumble across an unrelated chat by id-swapping.
  if (!chat || chat.userId !== id) {
    notFound();
  }

  const messages = await getMessagesByChatId({ id: chatId });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate font-semibold text-xl tracking-tight">
            {chat.title}
          </h1>
          <p className="mt-1 text-muted-foreground text-sm">
            {chat.createdAt.toLocaleString()} · {messages.length} messages ·
            read-only
          </p>
        </div>
        <Button asChild size="sm" variant="ghost">
          <Link href={`/admin/users/${id}`}>Back to member</Link>
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        {messages.map((m) => {
          const text = extractText(m.parts);
          const attachments = Array.isArray(m.attachments)
            ? (m.attachments as Attachment[])
            : [];
          const isUser = m.role === "user";
          return (
            <div
              className={`rounded-2xl border border-border p-4 ${
                isUser ? "bg-muted/30" : "bg-card"
              }`}
              key={m.id}
            >
              <div className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                {isUser ? "Member" : "Chad"}
              </div>
              {text ? (
                <p className="whitespace-pre-wrap break-words text-[15px] leading-[1.65]">
                  {text}
                </p>
              ) : (
                <p className="text-muted-foreground text-sm italic">
                  (no text content)
                </p>
              )}
              {attachments.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {attachments.map((a) =>
                    a.url && a.contentType?.startsWith("image/") ? (
                      // biome-ignore lint/performance/noImgElement: admin-only review tool, not user-facing
                      <img
                        alt={a.name ?? "attachment"}
                        className="max-h-48 rounded-lg border border-border"
                        key={a.url}
                        src={a.url}
                      />
                    ) : (
                      <a
                        className="text-sm underline"
                        href={a.url ?? "#"}
                        key={a.url ?? a.name}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        {a.name ?? "attachment"}
                      </a>
                    )
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
