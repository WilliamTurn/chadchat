import { tool, type UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import {
  artifactKinds,
  documentHandlersByArtifactKind,
} from "@/lib/artifacts/server";
import type { ChatMessage } from "@/lib/types";
import { generateUUID } from "@/lib/utils";

type CreateDocumentProps = {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  modelId: string;
  chatId: string;
};

export const createDocument = ({
  session,
  dataStream,
  modelId,
  chatId,
}: CreateDocumentProps) =>
  tool({
    description:
      "Create an artifact. You MUST specify kind: use 'code' for any programming/algorithm request (creates a script), 'text' for essays/writing (creates a document), 'sheet' for spreadsheets/data.",
    inputSchema: z.object({
      title: z.string().describe("The title of the artifact"),
      kind: z
        .enum(artifactKinds)
        .describe(
          "REQUIRED. 'code' for programming/algorithms, 'text' for essays/writing, 'sheet' for spreadsheets"
        ),
      brief: z
        .string()
        .describe(
          "REQUIRED. The complete brief for the writer, who sees ONLY this brief and the title (never the conversation). Restate the member's exact request plus EVERY relevant detail from the conversation and their profile: goals, stats, experience level, schedule, equipment, injuries, preferences, and any specifics they gave. A thin brief produces a thin document."
        ),
      description: z
        .string()
        .describe(
          "REQUIRED. One plain sentence saying what this document is and who it is for, shown under the title on the member's Files page."
        ),
      category: z
        .enum(["training", "nutrition", "recovery", "progress", "other"])
        .describe(
          "REQUIRED. Which part of the member's fitness life this belongs to, used to organize their Files page."
        ),
    }),
    execute: async ({ title, kind, brief, description, category }) => {
      const id = generateUUID();

      dataStream.write({
        type: "data-kind",
        data: kind,
        transient: true,
      });

      dataStream.write({
        type: "data-id",
        data: id,
        transient: true,
      });

      dataStream.write({
        type: "data-title",
        data: title,
        transient: true,
      });

      dataStream.write({
        type: "data-clear",
        data: null,
        transient: true,
      });

      const documentHandler = documentHandlersByArtifactKind.find(
        (documentHandlerByArtifactKind) =>
          documentHandlerByArtifactKind.kind === kind
      );

      if (!documentHandler) {
        throw new Error(`No document handler found for kind: ${kind}`);
      }

      await documentHandler.onCreateDocument({
        id,
        title,
        brief,
        description,
        category,
        chatId,
        dataStream,
        session,
        modelId,
      });

      dataStream.write({ type: "data-finish", data: null, transient: true });

      return {
        id,
        title,
        kind,
        content:
          kind === "code"
            ? "A script was created and is now visible to the user."
            : "A document was created and is now visible to the user.",
      };
    },
  });
