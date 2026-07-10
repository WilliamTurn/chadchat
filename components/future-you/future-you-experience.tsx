"use client";

import { Download, ImagePlus, Loader2, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  type ForecastView,
  getLatestForecast,
  startForecast,
} from "@/app/future-you/actions";
import { AskChadButton } from "@/components/chad/ask-chad-button";
import { Button } from "@/components/ui/button";
import {
  type FutureYouContent,
  type FutureYouFrame,
  quitFrame,
  workFrames,
} from "@/lib/future-you/content";
import { cn } from "@/lib/utils";

/**
 * The Future You experience (FEAT-29), one client island with three states:
 * intake (photo submission), generating (the page polls the pending run), and
 * the reveal (both futures, work vs quit). Everything automatic here follows
 * an explicit member action: polling only runs on a generation the member
 * started, and nothing focuses or opens on mount.
 */

const MIN_PHOTOS = 3;
const MAX_PHOTOS = 6;
const POLL_MS = 5000;

export function FutureYouExperience({
  goalId,
  goalTitle,
  initial,
}: {
  goalId: string;
  goalTitle: string;
  initial: ForecastView | null;
}) {
  const [forecast, setForecast] = useState<ForecastView | null>(initial);
  // "Run a new forecast" from a ready reveal drops back into intake.
  const [newRunRequested, setNewRunRequested] = useState(false);

  // Poll the run the member started (or arrived back to) until it resolves.
  useEffect(() => {
    if (forecast?.status !== "pending") {
      return;
    }
    const timer = setInterval(async () => {
      try {
        const latest = await getLatestForecast();
        if (latest) {
          setForecast(latest);
        }
      } catch {
        // Transient polling failure: keep polling; the run resolves server-side.
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [forecast?.status]);

  if (forecast?.status === "pending") {
    return <GeneratingPanel />;
  }

  if (forecast?.status === "ready" && forecast.content && !newRunRequested) {
    return (
      <RevealPanel
        content={forecast.content}
        createdAtLabel={forecast.createdAtLabel}
        onNewRun={() => setNewRunRequested(true)}
      />
    );
  }

  return (
    <IntakePanel
      failedNote={forecast?.status === "failed" ? forecast.error : null}
      goalId={goalId}
      goalTitle={goalTitle}
      onStarted={(f) => {
        setForecast(f);
        setNewRunRequested(false);
      }}
    />
  );
}

// ─── Intake ────────────────────────────────────────────────────────────────

type UploadedPhoto = { url: string };

function IntakePanel({
  goalId,
  goalTitle,
  failedNote,
  onStarted,
}: {
  goalId: string;
  goalTitle: string;
  failedNote: string | null;
  onStarted: (forecast: ForecastView) => void;
}) {
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  // Chad's photo-check note when he rejects the set (QC), shown in place.
  const [rejectNote, setRejectNote] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploading = uploadingCount > 0;
  const ready = photos.length >= MIN_PHOTOS && !uploading;

  async function uploadOne(file: File): Promise<string | null> {
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/files/upload`,
        { method: "POST", body: fd }
      );
      if (!res.ok) {
        const { error } = await res
          .json()
          .catch(() => ({ error: "Upload failed." }));
        toast.error(error ?? "Upload failed.");
        return null;
      }
      const data = await res.json();
      return data.url as string;
    } catch {
      toast.error("Upload failed. Check your connection and try again.");
      return null;
    }
  }

  async function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) {
      return;
    }
    const room = MAX_PHOTOS - photos.length;
    const files = [...list].slice(0, room);
    if (list.length > room) {
      toast.error(`${MAX_PHOTOS} photos is the maximum.`);
    }
    setUploadingCount((n) => n + files.length);
    await Promise.all(
      files.map(async (file) => {
        const url = await uploadOne(file);
        if (url) {
          setPhotos((prev) =>
            prev.length < MAX_PHOTOS ? [...prev, { url }] : prev
          );
        }
        setUploadingCount((n) => n - 1);
      })
    );
  }

  function handleGenerate() {
    setRejectNote(null);
    startTransition(async () => {
      const result = await startForecast({
        goalId,
        photoUrls: photos.map((p) => p.url),
      });
      if (result.ok) {
        onStarted(result.forecast);
      } else {
        setRejectNote(result.error);
        toast.error("Chad sent your photos back. See his note.");
      }
    });
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      <h2 className="flex items-center gap-2 font-medium text-lg">
        <Sparkles aria-hidden className="size-4 text-muted-foreground" />
        Submit your photos
      </h2>
      <p className="mt-1 text-muted-foreground text-sm">
        Projecting toward: <span className="text-foreground">{goalTitle}</span>{" "}
        {/* Inline link with an expanded tap area (44px+ effective target). */}
        <Link
          className="-my-2.5 inline-block px-1 py-2.5 underline underline-offset-4 hover:text-foreground"
          href="/goals"
        >
          (change goal)
        </Link>
      </p>

      <ul className="mt-5 space-y-2 text-sm">
        <ChecklistItem>
          {MIN_PHOTOS} to {MAX_PHOTOS} photos, JPEG or PNG, from different
          angles.
        </ChecklistItem>
        <ChecklistItem>
          Your face fully visible in every photo: no sunglasses, no phone in
          front of your face, no heavy shadows.
        </ChecklistItem>
        <ChecklistItem>
          At least one full-body photo, head to feet.
        </ChecklistItem>
        <ChecklistItem>
          Sharp focus, good light, fitted clothing that shows your build.
        </ChecklistItem>
      </ul>

      {failedNote && !rejectNote ? (
        <Note title="THE LAST RUN DIDN'T FINISH" tone="destructive">
          {failedNote}
        </Note>
      ) : null}

      {rejectNote ? (
        <Note title="CHAD'S PHOTO CHECK" tone="destructive">
          {rejectNote}
        </Note>
      ) : null}

      <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.map((photo, i) => (
          <div
            className="relative aspect-square overflow-hidden rounded-lg border border-border"
            key={photo.url}
          >
            {/* biome-ignore lint/performance/noImgElement: user Blob photo, same treatment as /progress */}
            <img
              alt={`Your upload ${i + 1}`}
              className="size-full object-cover"
              src={photo.url}
            />
            <button
              aria-label={`Remove photo ${i + 1}`}
              className="absolute top-1 right-1 flex size-8 items-center justify-center rounded-full bg-black/70 text-white transition-colors hover:bg-black/90"
              onClick={() =>
                setPhotos((prev) => prev.filter((p) => p.url !== photo.url))
              }
              type="button"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
        ))}
        {uploading ? (
          <div className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-border border-dashed text-muted-foreground">
            <Loader2 aria-hidden className="size-5 animate-spin" />
            <span aria-live="polite" className="text-xs">
              Uploading {uploadingCount}...
            </span>
          </div>
        ) : null}
        {photos.length + uploadingCount < MAX_PHOTOS ? (
          <button
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-border border-dashed text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            <ImagePlus aria-hidden className="size-5" />
            <span className="text-xs">Add photo</span>
          </button>
        ) : null}
      </div>
      <input
        accept="image/jpeg,image/png"
        className="hidden"
        multiple
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
        ref={fileInputRef}
        type="file"
      />

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-xs">
          Your photos stay in your account and are used only to build your
          forecast.
        </p>
        <Button
          className="min-h-11 w-full sm:w-auto"
          disabled={!ready || isPending}
          onClick={handleGenerate}
        >
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Chad is checking your photos...
            </>
          ) : (
            "Generate my forecast"
          )}
        </Button>
      </div>
      {photos.length < MIN_PHOTOS ? (
        <p className="mt-2 text-muted-foreground text-xs">
          {photos.length === 0
            ? `Add at least ${MIN_PHOTOS} photos to unlock your forecast.`
            : `${MIN_PHOTOS - photos.length} more photo${MIN_PHOTOS - photos.length === 1 ? "" : "s"} to go.`}
        </p>
      ) : null}
    </section>
  );
}

function ChecklistItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span aria-hidden className="mt-0.5 text-blood">
        •
      </span>
      <span>{children}</span>
    </li>
  );
}

function Note({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "destructive" | "muted";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mt-5 rounded-xl border p-4",
        tone === "destructive"
          ? "border-destructive/30 bg-destructive/5"
          : "border-border bg-background/40"
      )}
    >
      <p
        className={cn(
          "font-semibold text-xs tracking-[0.12em]",
          tone === "destructive" ? "text-destructive" : "text-muted-foreground"
        )}
      >
        {title}
      </p>
      <p className="mt-1.5 text-sm leading-relaxed">{children}</p>
    </div>
  );
}

// ─── Generating ────────────────────────────────────────────────────────────

const GENERATING_LINES = [
  "Chad approved your photos. Building your checkpoints...",
  "Projecting the work, week by week...",
  "Rendering what the finish line looks like on you...",
  "Rendering the version of you that quit, too. You'll want to see both...",
  "Final pass. Making every frame look real...",
];

function GeneratingPanel() {
  const [lineIndex, setLineIndex] = useState(0);

  // The member started this run; the rotating status line is feedback on
  // their action, not something starting uninvited.
  useEffect(() => {
    const timer = setInterval(() => {
      setLineIndex((i) => (i + 1) % GENERATING_LINES.length);
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="rounded-2xl border border-border bg-card p-8 text-center">
      <Loader2 aria-hidden className="mx-auto size-8 animate-spin text-blood" />
      <h2 className="mt-4 font-medium text-lg">Your forecast is being built</h2>
      <p aria-live="polite" className="mt-2 text-muted-foreground text-sm">
        {GENERATING_LINES[lineIndex]}
      </p>
      <p className="mt-4 text-muted-foreground text-xs">
        This takes 2 to 4 minutes. You can leave this page; the forecast will be
        waiting here when it's done.
      </p>
    </section>
  );
}

// ─── Reveal ────────────────────────────────────────────────────────────────

function RevealPanel({
  content,
  createdAtLabel,
  onNewRun,
}: {
  content: FutureYouContent;
  createdAtLabel: string;
  onNewRun: () => void;
}) {
  const [path, setPath] = useState<"work" | "quit">("work");
  const work = workFrames(content);
  const quit = quitFrame(content);

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <p className="font-semibold text-destructive text-xs tracking-[0.12em]">
          YOUR FORECAST
        </p>
        <h2 className="mt-2 font-display font-bold text-2xl tracking-tight sm:text-3xl">
          {content.goalTitle}
        </h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Generated {createdAtLabel} from deep analysis of your photos, your
          goal, and your calculated rate of progress.
        </p>

        <div className="mt-5 rounded-xl border border-border bg-background/40 p-4">
          <p className="font-semibold text-muted-foreground text-xs tracking-[0.12em]">
            WHERE YOU START
          </p>
          <p className="mt-1.5 text-sm leading-relaxed">
            {content.physiqueRead}
          </p>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <PathButton
            active={path === "work"}
            label="If you do the work"
            onClick={() => setPath("work")}
          />
          <PathButton
            active={path === "quit"}
            label="If you quit"
            onClick={() => setPath("quit")}
          />
        </div>
      </section>

      {path === "work" ? (
        work.map((frame, i) => (
          <FrameCard frame={frame} key={frame.imageUrl} lazy={i > 0} />
        ))
      ) : quit ? (
        <FrameCard frame={quit} lazy={false} />
      ) : null}

      <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <p className="font-semibold text-destructive text-xs tracking-[0.12em]">
          CHAD'S VERDICT
        </p>
        <p className="mt-2 text-sm leading-relaxed">{content.verdict}</p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <AskChadButton
            className="min-h-11"
            label="Talk to Chad about it"
            prompt={`You built my Future You forecast for "${content.goalTitle}". I've seen both versions. Tell me exactly what this week's work is so I end up in the right photo.`}
          />
          <Button className="min-h-11" onClick={onNewRun} variant="outline">
            Run a new forecast
          </Button>
        </div>
      </section>
    </div>
  );
}

function PathButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        "min-h-11 min-w-0 whitespace-normal break-words rounded-lg border px-2 py-2.5 text-center font-medium text-sm transition-colors",
        // The ACTIVE path must be the most legible thing in the control:
        // solid blood fill + white text (the quit-test tint style measured
        // 2.5:1 on dark and read weaker than the inactive segment).
        active
          ? "border-blood bg-blood text-white"
          : "border-border bg-background/40 text-muted-foreground hover:border-border hover:text-foreground"
      )}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function FrameCard({ frame, lazy }: { frame: FutureYouFrame; lazy: boolean }) {
  const isQuit = frame.kind === "quit";

  async function handleSave() {
    try {
      const res = await fetch(frame.imageUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `future-you-${isQuit ? "if-you-quit" : `week-${frame.weekOffset}`}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Couldn't save the photo. Try again.");
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-6 pt-5 sm:px-8">
        <h3
          className={cn(
            "font-display font-bold text-xl tracking-tight",
            isQuit && "text-destructive"
          )}
        >
          {isQuit ? "If you quit" : `Week ${frame.weekOffset}`}
        </h3>
        <p className="text-muted-foreground text-sm">
          {frame.dateLabel}
          {frame.expectedWeightLabel ? ` · ${frame.expectedWeightLabel}` : ""}
        </p>
      </div>
      <div className="relative mt-4 aspect-[2/3] w-full">
        {/* biome-ignore lint/performance/noImgElement: generated Blob image, same treatment as /progress photos */}
        <img
          alt={
            isQuit
              ? `You at ${frame.dateLabel} if you quit`
              : `You at week ${frame.weekOffset}, ${frame.dateLabel}`
          }
          className="size-full object-cover"
          loading={lazy ? "lazy" : "eager"}
          src={frame.imageUrl}
        />
      </div>
      <div className="px-6 py-5 sm:px-8">
        <p className="text-sm leading-relaxed">{frame.caption}</p>
        <Button
          className="mt-4 min-h-11"
          onClick={handleSave}
          variant="outline"
        >
          <Download aria-hidden className="size-4" />
          Save photo
        </Button>
      </div>
    </section>
  );
}
