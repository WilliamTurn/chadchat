import { smoothStream, streamText } from "ai";
import { updateDocumentPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";

// The writer model never sees the chat — the brief from createDocument is its
// only context. This prompt is what makes generated guides comprehensive
// instead of thin (the old prompt was one line and passed only the title).
const textWriterPrompt = `You are the document writer for Chad, an AI fitness coach. A member asked Chad for a document; you write the complete document that appears in the member's document viewer.

Write in Markdown. Use clear headings and bullet lists to keep the content easy to follow. Do not use markdown pipe tables (the member's document editor cannot render them); use headed lists or labeled lines instead.

Depth requirements:
- Be COMPREHENSIVE. The document must stand alone as a complete resource the member can follow start to finish without needing to ask follow-up questions.
- Cover the full scope of the request with concrete specifics: exact numbers (sets, reps, rest times, weights, grams, calories, timings), step-by-step instructions, weekly structure where relevant, common mistakes to avoid, and how to adjust when progress stalls.
- Personalize with every detail the brief gives about the member (goals, stats, experience, schedule, equipment, injuries, preferences).
- No filler, no hedging disclaimers, no generic padding. Every section must be concrete and actionable.
- Never use em-dashes.`;

export const textDocumentHandler = createDocumentHandler<"text">({
  kind: "text",
  onCreateDocument: async ({ title, brief, dataStream, modelId }) => {
    let draftContent = "";

    const { fullStream } = streamText({
      model: getLanguageModel(modelId),
      system: textWriterPrompt,
      experimental_transform: smoothStream({ chunking: "word" }),
      prompt: brief ? `Title: ${title}\n\nBrief:\n${brief}` : title,
    });

    for await (const delta of fullStream) {
      if (delta.type === "text-delta") {
        draftContent += delta.text;
        dataStream.write({
          type: "data-textDelta",
          data: delta.text,
          transient: true,
        });
      }
    }

    return draftContent;
  },
  onUpdateDocument: async ({ document, description, dataStream, modelId }) => {
    let draftContent = "";

    const { fullStream } = streamText({
      model: getLanguageModel(modelId),
      system: updateDocumentPrompt(document.content, "text"),
      experimental_transform: smoothStream({ chunking: "word" }),
      prompt: description,
    });

    for await (const delta of fullStream) {
      if (delta.type === "text-delta") {
        draftContent += delta.text;
        dataStream.write({
          type: "data-textDelta",
          data: delta.text,
          transient: true,
        });
      }
    }

    return draftContent;
  },
});
