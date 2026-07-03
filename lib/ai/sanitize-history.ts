import type { ChatMessage } from "@/lib/types";

type Part = ChatMessage["parts"][number];

/**
 * CHT-10: repair the chat history before it's resent to the model, so one bad
 * turn can never poison every turn after it.
 *
 * The observed failure class (s136, Gemini via the gateway): a follow-up turn
 * in a tool-history chat 400s with vertex "must include at least one parts
 * field" (an assistant message that converts to zero model parts — e.g. a
 * lone `step-start` persisted by an errored stream) or google "Corrupted
 * thought signature" (stale reasoning/tool metadata from a previous turn
 * failing Gemini's signature validation on resend).
 */

/** Model-facing content: what a resent history message actually needs. */
function isModelFacingPart(part: Part): boolean {
  if (part.type === "step-start") {
    return false;
  }
  // Past turns' internal reasoning is never needed back; it's also where the
  // poisonous thought signatures live.
  if (part.type === "reasoning") {
    return false;
  }
  if (part.type === "text") {
    return part.text.trim().length > 0;
  }
  return true;
}

/** Anything the UI can render — reasoning counts here, unlike model-facing. */
function isRenderablePart(part: Part): boolean {
  if (part.type === "step-start") {
    return false;
  }
  if (part.type === "text") {
    return part.text.trim().length > 0;
  }
  return true;
}

/**
 * True when the message is worth persisting: it has at least one part a user
 * could see. Guards onFinish against saving the classic errored-stream husk
 * (a lone `step-start`), which renders as an empty bubble and later breaks
 * resends.
 */
export function hasPersistableParts(
  message: Pick<ChatMessage, "parts">
): boolean {
  return message.parts?.some(isRenderablePart) ?? false;
}

/** Drop part-level provider plumbing (where thought signatures ride). */
function stripPartProviderMetadata(part: Part): Part {
  const record = part as Record<string, unknown>;
  if (
    record.providerMetadata === undefined &&
    record.callProviderMetadata === undefined
  ) {
    return part;
  }
  const cleaned = { ...record };
  delete cleaned.providerMetadata;
  delete cleaned.callProviderMetadata;
  return cleaned as unknown as Part;
}

/**
 * Sanitize the UI-message history for `convertToModelMessages`:
 *
 * 1. Previous turns (assistant messages before the last user message) lose
 *    their reasoning parts and part-level provider metadata. The model never
 *    needs its past internal monologue back, and Gemini rejects the whole
 *    request over a stale thought signature riding in that metadata. The
 *    current turn (at/after the last user message — e.g. a tool call awaiting
 *    approval) is left untouched, because Gemini DOES validate the signature
 *    on an in-flight function call.
 * 2. Assistant messages with no model-facing parts at all are dropped
 *    entirely (they'd convert to zero-part messages, which vertex rejects).
 *    This also repairs chats already poisoned by a persisted empty turn.
 *
 * Persistence paths must keep using the ORIGINAL messages — this is only for
 * what gets sent to the model.
 */
export function sanitizeHistoryForModel(
  messages: ChatMessage[]
): ChatMessage[] {
  const lastUserIndex = messages.map((m) => m.role).lastIndexOf("user");

  return messages
    .map((msg, index) => {
      if (msg.role !== "assistant" || index >= lastUserIndex) {
        return msg;
      }
      return {
        ...msg,
        parts: msg.parts
          .filter((part) => part.type !== "reasoning")
          .map(stripPartProviderMetadata),
      };
    })
    .filter(
      (msg) => msg.role !== "assistant" || msg.parts.some(isModelFacingPart)
    );
}
