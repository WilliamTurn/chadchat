"use client";

import { Loader2, Mic } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";

// Preference order matters: Chrome/Edge/Firefox record webm+opus, Safari
// (macOS + iOS) records mp4/aac. The server detects the real container from
// the bytes, so any of these is fine to send.
const RECORDER_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
];

// Matches the server's 15MB body cap with plenty of headroom.
const MAX_RECORDING_MS = 5 * 60 * 1000;
// A click-through (press stop immediately) produces a useless sliver of audio
// — drop it instead of paying for a transcription of nothing.
const MIN_RECORDING_MS = 400;

type VoiceState = "idle" | "recording" | "transcribing";

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") {
    return;
  }
  return RECORDER_MIME_TYPES.find((type) =>
    MediaRecorder.isTypeSupported(type)
  );
}

/**
 * Push-to-talk dictation for the composer (FEAT-20): tap to record, tap again
 * to stop; the audio is transcribed server-side (through the AI Gateway) and
 * the words land in the input box for the member to edit and send themselves.
 */
export function VoiceInputButton({
  onTranscript,
}: {
  onTranscript: (text: string) => void;
}) {
  const [state, setState] = useState<VoiceState>("idle");
  // MediaRecorder + getUserMedia exist on every modern browser (iOS Safari
  // 14.3+), but render nothing rather than a dead button on the stragglers.
  // Detected in an effect so SSR and the first client render agree.
  const [isSupported, setIsSupported] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Distinguishes "user hit stop" from unmount teardown, where the audio
  // should be thrown away instead of transcribed.
  const discardRef = useRef(false);

  useEffect(() => {
    setIsSupported(
      typeof navigator !== "undefined" &&
        typeof navigator.mediaDevices?.getUserMedia === "function" &&
        pickMimeType() !== undefined
    );
  }, []);

  const releaseRecorder = useCallback(() => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder) {
      for (const track of recorder.stream.getTracks()) {
        track.stop();
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      discardRef.current = true;
      recorderRef.current?.stop();
      releaseRecorder();
    };
  }, [releaseRecorder]);

  const transcribeRecording = useCallback(
    async (audio: Blob) => {
      setState("transcribing");
      try {
        const formData = new FormData();
        formData.append("audio", audio, "voice-input");

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/transcribe`,
          { method: "POST", body: formData }
        );

        if (!response.ok) {
          const { error } = await response
            .json()
            .catch(() => ({ error: null }));
          toast.error(error ?? "Couldn't make that out. Try recording again.");
          return;
        }

        const { text } = await response.json();
        if (typeof text === "string" && text.trim().length > 0) {
          onTranscript(text.trim());
        } else {
          toast.info("Didn't catch any words in that. Try again.");
        }
      } catch (_error) {
        toast.error("Couldn't make that out. Try recording again.");
      } finally {
        setState("idle");
      }
    },
    [onTranscript]
  );

  const startRecording = useCallback(async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        toast.error(
          "Microphone access is blocked. Allow the mic in your browser settings to talk to Chad."
        );
      } else {
        toast.error("Couldn't reach your microphone.");
      }
      return;
    }

    const recorder = new MediaRecorder(stream, { mimeType: pickMimeType() });
    recorderRef.current = recorder;
    chunksRef.current = [];
    startedAtRef.current = Date.now();
    discardRef.current = false;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      const duration = Date.now() - startedAtRef.current;
      const audio = new Blob(chunksRef.current, { type: recorder.mimeType });
      chunksRef.current = [];
      releaseRecorder();

      if (discardRef.current) {
        setState("idle");
        return;
      }
      if (duration < MIN_RECORDING_MS || audio.size === 0) {
        setState("idle");
        return;
      }
      transcribeRecording(audio);
    };

    recorder.start();
    setState("recording");

    // Hard stop at the cap so a forgotten live mic can't record indefinitely.
    stopTimerRef.current = setTimeout(() => {
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
      }
    }, MAX_RECORDING_MS);
  }, [releaseRecorder, transcribeRecording]);

  const handleClick = useCallback(() => {
    if (state === "recording") {
      recorderRef.current?.stop();
      return;
    }
    if (state === "idle") {
      startRecording();
    }
  }, [state, startRecording]);

  if (!isSupported) {
    return null;
  }

  return (
    <Button
      aria-label={
        state === "recording" ? "Stop recording" : "Dictate a message"
      }
      className={cn(
        "h-7 w-7 rounded-lg border p-1 transition-colors",
        state === "recording"
          ? "animate-pulse border-red-500/60 bg-red-500/15 text-red-500 hover:bg-red-500/25 hover:text-red-500"
          : "border-border/40 text-foreground hover:border-border"
      )}
      data-testid="voice-input-button"
      disabled={state === "transcribing"}
      onClick={(event) => {
        event.preventDefault();
        handleClick();
      }}
      type="button"
      variant="ghost"
    >
      {state === "transcribing" ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Mic className="size-3.5" />
      )}
    </Button>
  );
}
