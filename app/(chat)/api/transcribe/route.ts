import { gateway } from "@ai-sdk/gateway";
import {
  experimental_transcribe as transcribe,
  NoTranscriptGeneratedError,
} from "ai";
import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";

// ~5 minutes of opus/aac speech is well under this; the client also caps the
// recording length, so hitting it means something other than the mic button.
const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

// Served through the Vercel AI Gateway like every other model call (OIDC in
// prod, AI_GATEWAY_API_KEY locally) — no separate STT provider key to manage.
const TRANSCRIPTION_MODEL = "openai/gpt-4o-mini-transcribe";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("audio");

    if (!(file instanceof Blob) || file.size === 0) {
      return NextResponse.json({ error: "No audio received" }, { status: 400 });
    }

    if (file.size > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { error: "That recording is too long. Keep it under five minutes." },
        { status: 413 }
      );
    }

    // MediaRecorder containers vary by browser: audio/webm (Chrome/Firefox),
    // audio/mp4 or video/mp4 (Safari). The SDK detects the real type from the
    // bytes; this check just rejects obviously-wrong uploads early.
    if (
      file.type &&
      !(file.type.startsWith("audio/") || file.type.startsWith("video/"))
    ) {
      return NextResponse.json(
        { error: "Unsupported recording format" },
        { status: 415 }
      );
    }

    let result: Awaited<ReturnType<typeof transcribe>>;
    try {
      result = await transcribe({
        model: gateway.transcriptionModel(TRANSCRIPTION_MODEL),
        audio: new Uint8Array(await file.arrayBuffer()),
      });
    } catch (error) {
      // Speech-free audio (background noise, a pocket recording) is a normal
      // outcome, not a failure — hand the client an empty transcript so it can
      // show its gentler "didn't catch any words" note.
      if (NoTranscriptGeneratedError.isInstance(error)) {
        return NextResponse.json({ text: "" });
      }
      throw error;
    }

    return NextResponse.json({ text: result.text });
  } catch (error) {
    console.error("[api/transcribe] transcription failed:", error);
    return NextResponse.json(
      { error: "Couldn't make that out. Try recording again." },
      { status: 500 }
    );
  }
}
