import { Dumbbell } from "lucide-react";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MessageResponse } from "@/components/ai-elements/message";
import { Button } from "@/components/ui/button";
import { getChatById, getMessagesByChatId } from "@/lib/db/queries";

const MARKETING_URL = "https://chadcoach.ai";

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const chat = await getChatById({ id });
  if (!chat || chat.visibility !== "public") {
    return { title: "Shared chat — Chad" };
  }
  return { title: `${chat.title} — shared from Chad` };
}

export default function SharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="min-h-dvh bg-background">
      {/* Public header — static, renders immediately */}
      <header className="sticky top-0 z-10 border-border border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <a
            aria-label="Chad"
            className="flex items-center gap-2"
            href={MARKETING_URL}
          >
            <span className="flex size-7 items-center justify-center rounded-lg bg-muted/60 ring-1 ring-border/50">
              <Dumbbell className="text-blood" size={14} strokeWidth={2.5} />
            </span>
            <span className="font-display font-bold text-[15px] tracking-[0.14em]">
              CHAD
            </span>
          </a>
          <Button asChild size="sm">
            <a href={MARKETING_URL}>Get your own coach</a>
          </Button>
        </div>
      </header>

      <Suspense
        fallback={
          <div className="mx-auto w-full max-w-3xl px-4 py-10">
            <div className="h-96 animate-pulse rounded-2xl border border-border bg-card" />
          </div>
        }
      >
        <ShareBody params={params} />
      </Suspense>
    </div>
  );
}

async function ShareBody({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const chat = await getChatById({ id });
  // Only public chats are viewable here. Private/unknown chats 404 so a link
  // can't be guessed into someone's private conversation.
  if (!chat || chat.visibility !== "public") {
    notFound();
  }

  const messages = await getMessagesByChatId({ id });
  const visible = messages.filter(
    (m) => m.role === "user" || m.role === "assistant"
  );

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="mb-8">
        <p className="text-muted-foreground text-xs uppercase tracking-wide">
          Shared conversation
        </p>
        <h1 className="mt-1 font-semibold text-2xl tracking-tight">
          {chat.title}
        </h1>
        <p className="mt-1 text-muted-foreground text-sm">
          A read-only chat shared from Chad — your AI fitness coach.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {visible.map((m) => {
          const text = extractText(m.parts);
          const attachments = Array.isArray(m.attachments)
            ? (m.attachments as Attachment[])
            : [];
          const isUser = m.role === "user";
          return (
            <div className="flex flex-col gap-1.5" key={m.id}>
              <div className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                {isUser ? "You" : "Chad"}
              </div>
              <div
                className={
                  isUser
                    ? "rounded-2xl border border-border bg-muted/30 px-4 py-3"
                    : "rounded-2xl border border-border bg-card px-4 py-3"
                }
              >
                {attachments.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {attachments.map((a) =>
                      a.url && a.contentType?.startsWith("image/") ? (
                        // biome-ignore lint/performance/noImgElement: user-shared blob images, sizes vary
                        <img
                          alt={a.name ?? "attachment"}
                          className="max-h-64 rounded-lg border border-border"
                          key={a.url}
                          src={a.url}
                        />
                      ) : null
                    )}
                  </div>
                )}
                {text ? (
                  isUser ? (
                    <p className="whitespace-pre-wrap break-words text-[15px] leading-[1.65]">
                      {text}
                    </p>
                  ) : (
                    <div className="text-[15px] leading-[1.65]">
                      <MessageResponse>{text}</MessageResponse>
                    </div>
                  )
                ) : (
                  !attachments.length && (
                    <p className="text-muted-foreground text-sm italic">
                      (no text content)
                    </p>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer CTA */}
      <div className="mt-12 rounded-2xl border border-border border-dashed bg-card p-8 text-center">
        <h2 className="font-display font-bold text-xl tracking-tight">
          Want a coach who actually keeps you honest?
        </h2>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground text-sm">
          Chad builds your plan, tracks your progress, and won't let you talk
          yourself out of it. Start free.
        </p>
        <Button asChild className="mt-5">
          <a href={MARKETING_URL}>Meet Chad</a>
        </Button>
      </div>
    </main>
  );
}
