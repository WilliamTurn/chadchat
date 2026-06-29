import { geolocation, ipAddress } from "@vercel/functions";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  stepCountIs,
  streamText,
} from "ai";
import { checkBotId } from "botid/server";
import { after } from "next/server";
import { createResumableStreamContext } from "resumable-stream";
import { auth } from "@/app/(auth)/auth";
import { canAccessChad, canAccessProFeatures } from "@/lib/admin";
import { formatTodaySnapshot, summarizeWeight } from "@/lib/ai/dashboard";
import { stripModelInternals } from "@/lib/ai/sanitize-output";
import { getEntitlements, getUsageWarning } from "@/lib/ai/entitlements";
import {
  formatGoalsForPrompt,
  formatMealPlanForPrompt,
  formatMemoryForPrompt,
  formatWorkoutsForPrompt,
  maybeUpdateUserMemory,
} from "@/lib/ai/memory";
import {
  allowedModelIds,
  chatModels,
  DEFAULT_CHAT_MODEL,
  getCapabilities,
} from "@/lib/ai/models";
import {
  isPlaceholderTitle,
  type RequestHints,
  systemPrompt,
} from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { createDocument } from "@/lib/ai/tools/create-document";
import { editDocument } from "@/lib/ai/tools/edit-document";
import { generateMealPlanTool } from "@/lib/ai/tools/generate-meal-plan";
import { getDashboard } from "@/lib/ai/tools/get-dashboard";
import { logWorkout } from "@/lib/ai/tools/log-workout";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { saveGoal } from "@/lib/ai/tools/save-goal";
import { savePlan } from "@/lib/ai/tools/save-plan";
import { updateDocument } from "@/lib/ai/tools/update-document";
import { isProductionEnvironment } from "@/lib/constants";
import { startOfTodayUTC } from "@/lib/date";
import {
  createStreamId,
  deleteChatById,
  getActiveGoalsByUserId,
  getActiveMealPlanByUserId,
  getActivePlansByUserId,
  getChatById,
  getLatestSleepEntry,
  getMealsSince,
  getMessageCountByUserId,
  getMessagesByChatId,
  getNutritionTarget,
  getProgressEntriesByUserId,
  getUserById,
  getUserMemory,
  getWaterMlSince,
  getWorkoutsByUserId,
  saveChat,
  saveMessages,
  updateChatTitleById,
  updateMessage,
} from "@/lib/db/queries";
import type { DBMessage } from "@/lib/db/schema";
import { ChatbotError } from "@/lib/errors";
import { checkIpRateLimit } from "@/lib/ratelimit";
import type { ChatMessage } from "@/lib/types";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

// Raised from 60s: the generateMealPlan tool runs one Opus design pass plus a
// batch of food-database lookups, which can take a couple of minutes for a full
// 7-day plan. A higher ceiling is harmless to normal (fast) chat turns.
export const maxDuration = 300;

function getStreamContext() {
  try {
    return createResumableStreamContext({ waitUntil: after });
  } catch (_) {
    return null;
  }
}

export { getStreamContext };

// BLK-3: scrub any leaked internal reasoning / tool plumbing out of assistant
// text parts before they're persisted, so the saved transcript is always clean
// (the client render path scrubs too, via sanitizeText — defense in depth).
function sanitizeParts(parts: ChatMessage["parts"]): ChatMessage["parts"] {
  return parts.map((part) =>
    part.type === "text"
      ? { ...part, text: stripModelInternals(part.text) }
      : part
  );
}

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatbotError("bad_request:api").toResponse();
  }

  try {
    const { id, message, messages, selectedChatModel, selectedVisibilityType } =
      requestBody;

    const [, session] = await Promise.all([
      checkBotId().catch(() => null),
      auth(),
    ]);

    if (!session?.user) {
      return new ChatbotError("unauthorized:chat").toResponse();
    }

    // Paywall: only members with an active trial/subscription can talk to Chad.
    // This is the hard enforcement point (the page redirect is just for UX).
    const dbUser = await getUserById(session.user.id);
    // Admins are comped (canAccessChad) so the owner can always use the app.
    if (!(dbUser && canAccessChad(dbUser))) {
      return new ChatbotError("forbidden:subscription").toResponse();
    }

    const chatModel = allowedModelIds.has(selectedChatModel)
      ? selectedChatModel
      : DEFAULT_CHAT_MODEL;

    await checkIpRateLimit(ipAddress(request));

    // Daily usage cap based on the member's plan (trial caps are smaller).
    const entitlements = getEntitlements(dbUser);
    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    if (messageCount >= entitlements.maxMessagesPerDay) {
      return new ChatbotError("rate_limit:subscription").toResponse();
    }

    // A warm heads-up as the member nears their daily cap (computed on the
    // count *including* this message), so the at-limit wall is never a surprise.
    const usageWarning = getUsageWarning({
      used: messageCount + 1,
      limit: entitlements.maxMessagesPerDay,
      tier: dbUser.subscriptionTier,
      status: dbUser.subscriptionStatus,
      isNewUserMessage: message?.role === "user",
    });

    const isToolApprovalFlow = Boolean(messages);

    const chat = await getChatById({ id });
    let messagesFromDb: DBMessage[] = [];
    let titlePromise: Promise<string> | null = null;

    if (chat) {
      if (chat.userId !== session.user.id) {
        return new ChatbotError("forbidden:chat").toResponse();
      }
      messagesFromDb = await getMessagesByChatId({ id });

      // The chat's opening message was a bare greeting, so it's still unnamed.
      // Now that a real message has arrived, take another shot at titling it.
      if (message?.role === "user" && isPlaceholderTitle(chat.title)) {
        titlePromise = generateTitleFromUserMessage({ message });
      }
    } else if (message?.role === "user") {
      await saveChat({
        id,
        userId: session.user.id,
        title: "New chat",
        visibility: selectedVisibilityType,
      });
      titlePromise = generateTitleFromUserMessage({ message });
    }

    let uiMessages: ChatMessage[];

    if (isToolApprovalFlow && messages) {
      const dbMessages = convertToUIMessages(messagesFromDb);
      const approvalStates = new Map(
        messages.flatMap(
          (m) =>
            m.parts
              ?.filter(
                (p: Record<string, unknown>) =>
                  p.state === "approval-responded" ||
                  p.state === "output-denied"
              )
              .map((p: Record<string, unknown>) => [
                String(p.toolCallId ?? ""),
                p,
              ]) ?? []
        )
      );
      uiMessages = dbMessages.map((msg) => ({
        ...msg,
        parts: msg.parts.map((part) => {
          if (
            "toolCallId" in part &&
            approvalStates.has(String(part.toolCallId))
          ) {
            return { ...part, ...approvalStates.get(String(part.toolCallId)) };
          }
          return part;
        }),
      })) as ChatMessage[];
    } else {
      uiMessages = [
        ...convertToUIMessages(messagesFromDb),
        message as ChatMessage,
      ];
    }

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    // Memory layer: when the member has it on, load their durable profile and
    // inject it so Chad remembers them across chats. Off → cold start as usual.
    const memoryEnabled = dbUser.memoryEnabled;
    let memoryBlock = "";
    if (memoryEnabled) {
      const memoryRecord = await getUserMemory(session.user.id);
      memoryBlock = formatMemoryForPrompt(memoryRecord?.profile);
    }

    // The client's saved goals & plans + recently logged workouts are explicit
    // records (not memory), so Chad sees them in every chat regardless of the
    // memory toggle.
    const [activeGoals, activePlans, recentWorkouts] = await Promise.all([
      getActiveGoalsByUserId(session.user.id),
      getActivePlansByUserId(session.user.id),
      getWorkoutsByUserId(session.user.id, 8),
    ]);
    const goalsBlock = formatGoalsForPrompt(activeGoals, activePlans);
    const workoutsBlock = formatWorkoutsForPrompt(recentWorkouts);

    // Always-on "today's dashboard" snapshot so Chad has live, ambient
    // awareness of where the client stands (nutrition vs target, latest
    // weigh-in, water) without being asked. Pro-only data, mirroring /today;
    // for any other day Chad calls the getDashboard tool. Best-effort — a query
    // hiccup here must never block the chat.
    let dashboardBlock = "";
    let mealPlanBlock = "";
    if (canAccessProFeatures(dbUser)) {
      try {
        // 00:00 UTC, matching the noon-UTC calendar-day convention (lib/date.ts).
        const startOfToday = startOfTodayUTC();
        const [
          todaysMeals,
          nutritionTarget,
          waterMl,
          progressEntries,
          activeMealPlan,
          lastSleep,
        ] = await Promise.all([
          getMealsSince(session.user.id, startOfToday),
          getNutritionTarget(session.user.id),
          getWaterMlSince(session.user.id, startOfToday),
          getProgressEntriesByUserId(session.user.id),
          getActiveMealPlanByUserId(session.user.id),
          getLatestSleepEntry(session.user.id),
        ]);
        dashboardBlock = formatTodaySnapshot({
          date: startOfToday,
          meals: todaysMeals,
          target: nutritionTarget,
          waterMl,
          weight: summarizeWeight(progressEntries),
          lastSleep,
        });
        mealPlanBlock = formatMealPlanForPrompt(activeMealPlan);
      } catch (error) {
        console.error("Dashboard snapshot failed:", error);
      }
    }

    if (message?.role === "user") {
      await saveMessages({
        messages: [
          {
            chatId: id,
            id: message.id,
            role: "user",
            parts: message.parts,
            attachments: [],
            createdAt: new Date(),
          },
        ],
      });
    }

    const modelConfig = chatModels.find((m) => m.id === chatModel);
    const modelCapabilities = await getCapabilities();
    const capabilities = modelCapabilities[chatModel];
    const isReasoningModel = capabilities?.reasoning === true;
    const supportsTools = capabilities?.tools === true;

    const modelMessages = await convertToModelMessages(uiMessages);

    const stream = createUIMessageStream({
      originalMessages: isToolApprovalFlow ? uiMessages : undefined,
      execute: async ({ writer: dataStream }) => {
        const result = streamText({
          model: getLanguageModel(chatModel),
          system: systemPrompt({
            requestHints,
            supportsTools,
            memory: memoryBlock,
            goals: goalsBlock,
            workouts: workoutsBlock,
            dashboard: dashboardBlock,
            mealPlan: mealPlanBlock,
          }),
          messages: modelMessages,
          stopWhen: stepCountIs(5),
          experimental_activeTools:
            isReasoningModel && !supportsTools
              ? []
              : [
                  "createDocument",
                  "editDocument",
                  "updateDocument",
                  "requestSuggestions",
                  "saveGoal",
                  "savePlan",
                  "generateMealPlan",
                  "logWorkout",
                  "getDashboard",
                ],
          providerOptions: {
            ...(modelConfig?.gatewayOrder && {
              gateway: { order: modelConfig.gatewayOrder },
            }),
            ...(modelConfig?.reasoningEffort && {
              openai: { reasoningEffort: modelConfig.reasoningEffort },
            }),
          },
          tools: {
            createDocument: createDocument({
              session,
              dataStream,
              modelId: chatModel,
            }),
            editDocument: editDocument({ dataStream, session }),
            updateDocument: updateDocument({
              session,
              dataStream,
              modelId: chatModel,
            }),
            requestSuggestions: requestSuggestions({
              session,
              dataStream,
              modelId: chatModel,
            }),
            saveGoal: saveGoal({ session, chatId: id }),
            savePlan: savePlan({ session, chatId: id }),
            generateMealPlan: generateMealPlanTool({ session, chatId: id }),
            logWorkout: logWorkout({ session }),
            getDashboard: getDashboard({ session }),
          },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: "stream-text",
          },
        });

        dataStream.merge(
          result.toUIMessageStream({ sendReasoning: isReasoningModel })
        );

        if (usageWarning) {
          dataStream.write({ type: "data-usage-warning", data: usageWarning });
        }

        if (titlePromise) {
          try {
            const title = await titlePromise;
            // A greeting yields a placeholder title — keep the chat "unnamed"
            // so the next real message gets another chance to name it.
            if (title && !isPlaceholderTitle(title)) {
              dataStream.write({ type: "data-chat-title", data: title });
              updateChatTitleById({ chatId: id, title });
            }
          } catch (_) {
            /* non-fatal */
          }
        }
      },
      generateId: generateUUID,
      onFinish: async ({ messages: finishedMessages }) => {
        if (isToolApprovalFlow) {
          for (const finishedMsg of finishedMessages) {
            const existingMsg = uiMessages.find((m) => m.id === finishedMsg.id);
            if (existingMsg) {
              await updateMessage({
                id: finishedMsg.id,
                parts: sanitizeParts(finishedMsg.parts),
              });
            } else {
              await saveMessages({
                messages: [
                  {
                    id: finishedMsg.id,
                    role: finishedMsg.role,
                    parts: sanitizeParts(finishedMsg.parts),
                    createdAt: new Date(),
                    attachments: [],
                    chatId: id,
                  },
                ],
              });
            }
          }
        } else if (finishedMessages.length > 0) {
          await saveMessages({
            messages: finishedMessages.map((currentMessage) => ({
              id: currentMessage.id,
              role: currentMessage.role,
              parts: sanitizeParts(currentMessage.parts),
              createdAt: new Date(),
              attachments: [],
              chatId: id,
            })),
          });
        }

        // Memory layer: after the reply is saved, update the user's durable
        // profile in the background (non-blocking, throttled, best-effort).
        if (memoryEnabled) {
          const recentMessages = [...uiMessages, ...finishedMessages].map(
            (m) => ({ role: m.role, parts: m.parts })
          );
          after(() =>
            maybeUpdateUserMemory({
              userId: session.user.id,
              recentMessages,
            })
          );
        }
      },
      onError: (error) => {
        if (
          error instanceof Error &&
          error.message?.includes(
            "AI Gateway requires a valid credit card on file to service requests"
          )
        ) {
          return "AI Gateway requires a valid credit card on file to service requests. Please visit https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dadd-credit-card to add a card and unlock your free credits.";
        }
        return "Oops, an error occurred!";
      },
    });

    return createUIMessageStreamResponse({
      stream,
      async consumeSseStream({ stream: sseStream }) {
        if (!process.env.REDIS_URL) {
          return;
        }
        try {
          const streamContext = getStreamContext();
          if (streamContext) {
            const streamId = generateId();
            await createStreamId({ streamId, chatId: id });
            await streamContext.createNewResumableStream(
              streamId,
              () => sseStream
            );
          }
        } catch (_) {
          /* non-critical */
        }
      },
    });
  } catch (error) {
    const vercelId = request.headers.get("x-vercel-id");

    if (error instanceof ChatbotError) {
      return error.toResponse();
    }

    if (
      error instanceof Error &&
      error.message?.includes(
        "AI Gateway requires a valid credit card on file to service requests"
      )
    ) {
      return new ChatbotError("bad_request:activate_gateway").toResponse();
    }

    console.error("Unhandled error in chat API:", error, { vercelId });
    return new ChatbotError("offline:chat").toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatbotError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== session.user.id) {
    return new ChatbotError("forbidden:chat").toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
