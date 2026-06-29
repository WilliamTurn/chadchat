"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { deleteTrailingMessages } from "@/app/(chat)/actions";
import type { ChatMessage } from "@/lib/types";

export async function submitEditedMessage({
  message,
  text,
  setMessages,
  regenerate,
}: {
  message: ChatMessage;
  text: string;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
}) {
  await deleteTrailingMessages({ id: message.id });

  setMessages((messages) => {
    const index = messages.findIndex((m) => m.id === message.id);
    if (index === -1) {
      return messages;
    }

    return [
      ...messages.slice(0, index),
      { ...message, parts: [{ type: "text" as const, text }] },
    ];
  });

  regenerate();
}

/**
 * Regenerate the last assistant response. Mirrors submitEditedMessage: the chat
 * route appends the resent user message to the DB history, so the stale turn
 * must be deleted first (deleteMessagesByChatIdAfterTimestamp is `>=`, so
 * deleting from the last user message removes that message + the old answer);
 * the client state is then truncated to end at the user message and regenerate()
 * re-runs it. Without the delete, the route duplicates the user message and 400s.
 */
export async function submitRegenerateMessage({
  messages,
  setMessages,
  regenerate,
}: {
  messages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
}) {
  const lastUserIndex = messages.map((m) => m.role).lastIndexOf("user");
  if (lastUserIndex === -1) {
    return;
  }

  await deleteTrailingMessages({ id: messages[lastUserIndex].id });

  setMessages((current) => current.slice(0, lastUserIndex + 1));

  regenerate();
}
