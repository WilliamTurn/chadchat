"use client";

import { Loader2, Mic, Square, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
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

export type VoiceInputState = "idle" | "recording" | "transcribing";

function formatClock(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") {
    return;
  }
  return RECORDER_MIME_TYPES.find((type) =>
    MediaRecorder.isTypeSupported(type)
  );
}

/**
 * Push-to-talk dictation for the composer (FEAT-20): tap the mic to record.
 * While recording, the button becomes an explicit stop control (red square)
 * with a live timer and a cancel button, the standard dictation pattern from
 * ChatGPT/Gemini, so nobody has to guess that a second tap ends the take.
 * The audio is transcribed server-side (through the AI Gateway) and the words
 * land in the input box for the member to edit and send themselves.
 */
export function VoiceInputButton({
  onTranscript,
  onStateChange,
}: {
  onTranscript: (text: string) => void;
  onStateChange?: (state: VoiceInputState) => void;
}) {
  const [state, setState] = useState<VoiceInputState>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
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

  useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

  // Live elapsed-time readout while the mic is hot.
  useEffect(() => {
    if (state !== "recording") {
      setElapsedMs(0);
      return;
    }
    const tick = () => setElapsedMs(Date.now() - startedAtRef.current);
    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [state]);

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

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
  }, []);

  const cancelRecording = useCallback(() => {
    discardRef.current = true;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else {
      releaseRecorder();
      setState("idle");
    }
  }, [releaseRecorder]);

  if (!isSupported) {
    return null;
  }

  if (state === "recording") {
    return (
      <div
        className="flex items-center gap-1.5"
        data-testid="voice-recording-controls"
      >
        <span
          className="flex items-center gap-1.5 pl-1 font-medium text-red-500 text-xs tabular-nums"
          data-testid="voice-recording-timer"
        >
          <span aria-hidden="true" className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-red-500" />
          </span>
          {formatClock(elapsedMs)}
        </span>
        <Button
          aria-label="Cancel recording"
          className="h-7 w-7 rounded-lg border border-border/40 p-1 text-muted-foreground transition-colors hover:border-border hover:text-foreground"
          data-testid="voice-cancel-button"
          onClick={(event) => {
            event.preventDefault();
            cancelRecording();
          }}
          type="button"
          variant="ghost"
        >
          <X className="size-3.5" />
        </Button>
        <Button
          aria-label="Stop recording"
          className="h-7 w-7 rounded-xl bg-red-500 p-1 text-white transition-all duration-200 hover:bg-red-500/85 active:scale-95"
          data-testid="voice-stop-button"
          onClick={(event) => {
            event.preventDefault();
            stopRecording();
          }}
          type="button"
          variant="secondary"
        >
          <Square className="size-3 fill-current" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      aria-label="Dictate a message"
      className="h-7 w-7 rounded-lg border border-border/40 p-1 text-foreground transition-colors hover:border-border"
      data-testid="voice-input-button"
      disabled={state === "transcribing"}
      onClick={(event) => {
        event.preventDefault();
        startRecording();
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
