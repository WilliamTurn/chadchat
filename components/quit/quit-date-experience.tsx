"use client";

import { CalendarX2, Loader2, Skull } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { runAutopsy } from "@/app/quit-date/actions";
import { AskChadButton } from "@/components/chad/ask-chad-button";
import { QuitShareActions } from "@/components/quit/quit-share-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  APPS_TRIED_OPTIONS,
  type AutopsyAnswersInput,
  KILLER_OPTIONS,
  LIFE_LOAD_OPTIONS,
  type QuitPredictionContent,
  RESTART_OPTIONS,
  STREAK_OPTIONS,
} from "@/lib/quit/content";
import type {
  AppsTried,
  LastKiller,
  LifeLoad,
  LongestStreak,
  Restarts,
} from "@/lib/quit/heuristics";
import type { ReceiptCardData } from "@/lib/quit/share-cards";
import { cn } from "@/lib/utils";

/**
 * The Quit Test (FEAT-21, reworked s157 to the owner's spec): no standing
 * prediction → the intake (plain-language questions, optional buttons,
 * multi-select where it makes sense, a free-text escape hatch on every
 * question); standing prediction → The Verdict. One client island holds both
 * so the verdict swaps in without a reload.
 */
export function QuitDateExperience({
  initial,
  predictedAtLabel,
  predictionId,
  receipt,
  status,
}: {
  initial: QuitPredictionContent | null;
  predictedAtLabel: string | null;
  predictionId: string | null;
  receipt: ReceiptCardData | null;
  status: "active" | "beaten" | "hit" | null;
}) {
  const [content, setContent] = useState<QuitPredictionContent | null>(
    initial
  );
  const [issuedLabel, setIssuedLabel] = useState<string | null>(
    predictedAtLabel
  );
  const [currentStatus, setCurrentStatus] = useState<
    "active" | "beaten" | "hit"
  >(status ?? "active");
  // The receipt is computed server-side against the prediction that rendered
  // the page; a freshly issued day-1 prediction has nothing to brag yet.
  const [currentReceipt, setCurrentReceipt] = useState(receipt);
  const [currentId, setCurrentId] = useState(predictionId);

  if (content) {
    return (
      <VerdictPanel
        content={content}
        issuedLabel={issuedLabel}
        // A resolved prediction no longer blocks the test (FEAT-22), so a
        // hit/beaten verdict offers the restart right here.
        onRetake={
          currentStatus === "active" ? undefined : () => setContent(null)
        }
        predictionId={currentId}
        receipt={currentReceipt}
        status={currentStatus}
      />
    );
  }

  return (
    <QuitTestForm
      onIssued={(c, id) => {
        setContent(c);
        setIssuedLabel("today");
        setCurrentStatus("active");
        setCurrentReceipt(null);
        setCurrentId(id);
      }}
    />
  );
}

// Same segmented-button treatment as the onboarding wizard, so the intake
// reads as part of the same first-run family.
const segmentedButtonClass = (selected: boolean) =>
  cn(
    "min-w-0 whitespace-normal break-words rounded-lg border px-2 py-2.5 text-center font-medium text-sm transition-colors",
    selected
      ? "border-blood/60 bg-blood/10 text-blood"
      : "border-border bg-background/40 text-muted-foreground hover:border-border hover:text-foreground"
  );

/** Single-select buttons; clicking the selected one clears it (every button
 * answer is optional since s157 — no fixed answer may apply). */
function OptionGrid<T extends string>({
  options,
  value,
  onChange,
  columns,
}: {
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (v: T | null) => void;
  columns?: string;
}) {
  return (
    <div className={cn("grid gap-2", columns ?? "grid-cols-2")}>
      {options.map((opt) => (
        <button
          aria-pressed={value === opt.value}
          className={segmentedButtonClass(value === opt.value)}
          key={opt.value}
          onClick={() => onChange(value === opt.value ? null : opt.value)}
          type="button"
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/** Multi-select buttons (s157): people can have several reasons. */
function MultiOptionGrid<T extends string>({
  options,
  values,
  onChange,
  columns,
}: {
  options: readonly { value: T; label: string }[];
  values: T[];
  onChange: (v: T[]) => void;
  columns?: string;
}) {
  return (
    <div className={cn("grid gap-2", columns ?? "grid-cols-2")}>
      {options.map((opt) => (
        <button
          aria-pressed={values.includes(opt.value)}
          className={segmentedButtonClass(values.includes(opt.value))}
          key={opt.value}
          onClick={() =>
            onChange(
              values.includes(opt.value)
                ? values.filter((v) => v !== opt.value)
                : [...values, opt.value]
            )
          }
          type="button"
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/** The per-question free-text escape hatch (s157): the buttons never fit
 * everyone, so every question takes the member's own words too. */
function NoteInput({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Input
      aria-label="Your own answer or notes (optional)"
      id={id}
      maxLength={300}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Your own answer or notes (optional)"
      value={value}
    />
  );
}

function QuitTestForm({
  onIssued,
}: {
  onIssued: (content: QuitPredictionContent, id: string | null) => void;
}) {
  const [isPending, startTransition] = useTransition();

  const [appsTried, setAppsTried] = useState<AppsTried | null>(null);
  const [restarts, setRestarts] = useState<Restarts | null>(null);
  const [longestStreak, setLongestStreak] = useState<LongestStreak | null>(
    null
  );
  const [killers, setKillers] = useState<LastKiller[]>([]);
  const [lifeLoad, setLifeLoad] = useState<LifeLoad | null>(null);
  const [appsTriedNote, setAppsTriedNote] = useState("");
  const [restartsNote, setRestartsNote] = useState("");
  const [streakNote, setStreakNote] = useState("");
  const [killersNote, setKillersNote] = useState("");
  const [lifeLoadNote, setLifeLoadNote] = useState("");
  const [confession, setConfession] = useState("");

  // Only the written answer is required: the buttons are optional (s157) —
  // there might be cases where no button applies.
  const complete = confession.trim().length >= 4;

  function handleSubmit() {
    if (!complete) {
      toast.error("Answer the last question first. Be specific.");
      return;
    }
    const note = (s: string) => {
      const trimmed = s.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    };
    const answers: AutopsyAnswersInput = {
      appsTried,
      restarts,
      longestStreak,
      killers,
      lifeLoad,
      appsTriedNote: note(appsTriedNote),
      restartsNote: note(restartsNote),
      streakNote: note(streakNote),
      killersNote: note(killersNote),
      lifeLoadNote: note(lifeLoadNote),
      confession: confession.trim(),
    };
    startTransition(async () => {
      const result = await runAutopsy(answers);
      if (result.ok) {
        onIssued(result.content, result.id);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      <h2 className="flex items-center gap-2 font-medium text-lg">
        <Skull aria-hidden className="size-4 text-muted-foreground" />
        The Quit Test
      </h2>
      <p className="mt-1 text-muted-foreground text-sm">
        These questions are about your past efforts to accomplish your fitness
        goals. Answer them honestly. Chad can only help you if you&apos;re
        100% honest.
      </p>

      <div className="mt-6 flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label>
            How many fitness apps or programs have you tried before this one?
          </Label>
          <OptionGrid
            columns="grid-cols-2 sm:grid-cols-4"
            onChange={setAppsTried}
            options={APPS_TRIED_OPTIONS}
            value={appsTried}
          />
          <NoteInput
            id="quit-test-apps-note"
            onChange={setAppsTriedNote}
            value={appsTriedNote}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>
            Count the times you&apos;ve quit in the past (estimates are fine).
          </Label>
          <OptionGrid
            columns="grid-cols-2 sm:grid-cols-4"
            onChange={setRestarts}
            options={RESTART_OPTIONS}
            value={restarts}
          />
          <NoteInput
            id="quit-test-restarts-note"
            onChange={setRestartsNote}
            value={restartsNote}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>
            What&apos;s the longest you&apos;ve ever stuck with a training
            program (including workouts and meal plans)?
          </Label>
          <OptionGrid
            columns="grid-cols-2 sm:grid-cols-5"
            onChange={setLongestStreak}
            options={STREAK_OPTIONS}
            value={longestStreak}
          />
          <NoteInput
            id="quit-test-streak-note"
            onChange={setStreakNote}
            value={streakNote}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Why did you stop previous attempts? Pick all that apply.</Label>
          <MultiOptionGrid
            columns="grid-cols-2 sm:grid-cols-3"
            onChange={setKillers}
            options={KILLER_OPTIONS}
            values={killers}
          />
          <NoteInput
            id="quit-test-killers-note"
            onChange={setKillersNote}
            value={killersNote}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>How would you describe your day-to-day life right now?</Label>
          <OptionGrid
            columns="grid-cols-2 sm:grid-cols-4"
            onChange={setLifeLoad}
            options={LIFE_LOAD_OPTIONS}
            value={lifeLoad}
          />
          <NoteInput
            id="quit-test-life-note"
            onChange={setLifeLoadNote}
            value={lifeLoadNote}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="quit-test-confession">
            What actually happened the last time you quit? Be specific.
          </Label>
          <Textarea
            id="quit-test-confession"
            maxLength={1000}
            onChange={(e) => setConfession(e.target.value)}
            placeholder="The week it fell apart, what you told yourself, what you did instead."
            rows={4}
            value={confession}
          />
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">
          One verdict at a time. No re-rolls.
        </p>
        <Button disabled={isPending || !complete} onClick={handleSubmit}>
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Chad is deciding...
            </>
          ) : (
            "Get Chad's verdict"
          )}
        </Button>
      </div>
    </section>
  );
}

/** The small line under the verdict, in CHAD's voice (owner order, s157). */
function statusLine(
  status: "active" | "beaten" | "hit",
  dateLabel: string
): string {
  if (status === "beaten") {
    return "You beat my date. I owe you a harder one.";
  }
  if (status === "hit") {
    return "I called it. Take the test again and make me wrong the second time.";
  }
  return `My prediction stands. You're going to quit on ${dateLabel}. Keep logging and prove me wrong. Let's find out.`;
}

function VerdictPanel({
  content,
  issuedLabel,
  onRetake,
  predictionId,
  receipt,
  status,
}: {
  content: QuitPredictionContent;
  issuedLabel: string | null;
  onRetake?: () => void;
  predictionId: string | null;
  receipt: ReceiptCardData | null;
  status: "active" | "beaten" | "hit";
}) {
  const round = content.round ?? 1;
  return (
    <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-destructive text-xs tracking-[0.12em]">
            {round > 1 ? `THE VERDICT, ROUND ${round}` : "THE VERDICT"}
          </p>
          <p className="mt-3 font-display font-bold text-2xl text-destructive tracking-tight sm:text-3xl">
            YOU WILL QUIT
          </p>
          <p className="font-display font-bold text-4xl tracking-tight sm:text-5xl">
            {content.dateLabel}
          </p>
          <p className="mt-2 text-muted-foreground text-sm">
            Day {content.dayCount} of your membership
            {issuedLabel ? `, called ${issuedLabel}` : ""}.
          </p>
        </div>
        <CalendarX2
          aria-hidden
          className="size-8 shrink-0 text-destructive/70"
        />
      </div>

      <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <p className="font-semibold text-destructive text-xs tracking-[0.12em]">
          HOW IT HAPPENS
        </p>
        <p className="mt-1.5 font-medium text-sm">{content.failureMode}.</p>
        <p className="mt-3 text-sm leading-relaxed">{content.narrative}</p>
      </div>

      <p className="mt-5 text-muted-foreground text-sm">
        {statusLine(status, content.dateLabel)}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {/* The receipts (FEAT-23): pro-app share dialog, member-initiated. */}
        <QuitShareActions
          predictionId={predictionId}
          receipt={status === "hit" ? null : receipt}
          verdict={{
            dateLabel: content.dateLabel,
            dayCount: content.dayCount,
            failureMode: content.failureMode,
          }}
        />
        {onRetake ? (
          <Button onClick={onRetake} size="sm" variant="outline">
            Take the test again
          </Button>
        ) : null}
        <AskChadButton
          label="Talk to Chad about it"
          prompt={
            status === "hit"
              ? `You called my quit date and I went quiet, just like you said. I'm back. Tell me how we restart this so it doesn't end that way again.`
              : `You put my quit date on the record: ${content.dateLabel}, day ${content.dayCount}. Tell me exactly how I make that prediction wrong.`
          }
        />
      </div>
    </section>
  );
}
