import { createUIMessageStream, JsonToSseTransformStream } from "ai";
import { after } from "next/server";
import { createResumableStreamContext } from "resumable-stream";
import { auth } from "@/app/(auth)/auth";
import {
  getChatById,
  getMessagesByChatId,
  getStreamIdsByChatId,
} from "@/lib/db/queries";
import type { ChatMessage } from "@/lib/types";
import { convertToUIMessages } from "@/lib/utils";

export const maxDuration = 60;

// How recently Chad's reply must have landed for us to replay it on resume.
// Covers the narrow race where generation finishes server-side between the
// client's /api/messages fetch and its resume call.
const REPLAY_WINDOW_MS = 15_000;

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
} as const;

function getStreamContext() {
  try {
    return createResumableStreamContext({ waitUntil: after });
  } catch (_) {
    // No REDIS_URL / resumable-stream backend → resume is unavailable.
    return null;
  }
}

/**
 * Resume an in-progress assistant stream after a refresh/navigation. The client
 * (useAutoResume) calls this whenever a chat's last persisted message is from
 * the user — meaning Chad was mid-reply when the page reloaded. We hand back the
 * still-streaming SSE if it's live, or replay the just-finished reply, so his
 * long workout/meal plans are never silently lost. Returns 204 when there is
 * nothing to resume.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: chatId } = await params;

  const streamContext = getStreamContext();
  if (!streamContext || !chatId) {
    return new Response(null, { status: 204 });
  }

  const chat = await getChatById({ id: chatId });
  if (!chat) {
    return new Response(null, { status: 204 });
  }

  // Only the owner may resume a private chat's live stream.
  if (chat.visibility === "private") {
    const session = await auth();
    if (!session?.user || session.user.id !== chat.userId) {
      return new Response(null, { status: 204 });
    }
  }

  const streamIds = await getStreamIdsByChatId({ chatId });
  const recentStreamId = streamIds.at(-1);
  if (!recentStreamId) {
    return new Response(null, { status: 204 });
  }

  // Live stream still in flight → hand the buffered SSE straight back.
  const resumedStream = await streamContext.resumeExistingStream(recentStreamId);
  if (resumedStream) {
    return new Response(resumedStream, { headers: SSE_HEADERS });
  }

  // The stream already finished (resumeExistingStream returned null/undefined).
  // If Chad's reply landed within the replay window, push it to the client so a
  // refresh right as generation completed still shows the answer.
  const messages = await getMessagesByChatId({ id: chatId });
  const mostRecentMessage = messages.at(-1);

  if (!mostRecentMessage || mostRecentMessage.role !== "assistant") {
    return new Response(null, { status: 204 });
  }

  if (
    Date.now() - new Date(mostRecentMessage.createdAt).getTime() >
    REPLAY_WINDOW_MS
  ) {
    return new Response(null, { status: 204 });
  }

  const [uiMessage] = convertToUIMessages([mostRecentMessage]);

  const restoredStream = createUIMessageStream<ChatMessage>({
    execute: ({ writer }) => {
      writer.write({
        type: "data-appendMessage",
        data: JSON.stringify(uiMessage),
        transient: true,
      });
    },
  });

  return new Response(
    restoredStream.pipeThrough(new JsonToSseTransformStream()),
    { headers: SSE_HEADERS }
  );
}
