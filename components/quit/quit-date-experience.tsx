"use client";

import { CalendarX2, Loader2, Skull } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { runAutopsy } from "@/app/quit-date/actions";
import { AskChadButton } from "@/components/chad/ask-chad-button";
import { QuitShareActions } from "@/components/quit/quit-share-actions";
import { Button } from "@/components/ui/button";
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
 * The Quit Date (FEAT-21): if the member has no standing prediction they get
 * The Autopsy (the failure-history intake); once one is on the record they
 * get The Verdict. One client island holds both so the verdict swaps in
 * without a reload, mirroring the montage card's transition pattern.
 */
export function QuitDateExperience({
  initial,
  predictedAtLabel,
  receipt,
  status,
}: {
  initial: QuitPredictionContent | null;
  predictedAtLabel: string | null;
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

  if (content) {
    return (
      <VerdictPanel
        content={content}
        issuedLabel={issuedLabel}
        // A resolved prediction no longer blocks the autopsy (FEAT-22), so a
        // hit/beaten verdict offers the restart right here.
        onRetake={
          currentStatus === "active" ? undefined : () => setContent(null)
        }
        receipt={currentReceipt}
        status={currentStatus}
      />
    );
  }

  return (
    <AutopsyForm
      onIssued={(c) => {
        setContent(c);
        setIssuedLabel("today");
        setCurrentStatus("active");
        setCurrentReceipt(null);
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

function OptionGrid<T extends string>({
  options,
  value,
  onChange,
  columns,
}: {
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  columns?: string;
}) {
  return (
    <div className={cn("grid gap-2", columns ?? "grid-cols-2")}>
      {options.map((opt) => (
        <button
          className={segmentedButtonClass(value === opt.value)}
          key={opt.value}
          onClick={() => onChange(opt.value)}
          type="button"
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function AutopsyForm({
  onIssued,
}: {
  onIssued: (content: QuitPredictionContent) => void;
}) {
  const [isPending, startTransition] = useTransition();

  const [appsTried, setAppsTried] = useState<AppsTried | null>(null);
  const [restarts, setRestarts] = useState<Restarts | null>(null);
  const [longestStreak, setLongestStreak] = useState<LongestStreak | null>(
    null
  );
  const [lastKiller, setLastKiller] = useState<LastKiller | null>(null);
  const [lifeLoad, setLifeLoad] = useState<LifeLoad | null>(null);
  const [confession, setConfession] = useState("");

  const complete =
    appsTried &&
    restarts &&
    longestStreak &&
    lastKiller &&
    lifeLoad &&
    confession.trim().length >= 4;

  function handleSubmit() {
    if (!complete) {
      toast.error("Answer every question first.");
      return;
    }
    const answers: AutopsyAnswersInput = {
      appsTried,
      restarts,
      longestStreak,
      lastKiller,
      lifeLoad,
      confession: confession.trim(),
    };
    startTransition(async () => {
      const result = await runAutopsy(answers);
      if (result.ok) {
        onIssued(result.content);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      {/* Pre-verdict, the form is THE TEST (owner framing, s157): nothing
          here names the quit-date mechanic — the verdict makes that reveal. */}
      <h2 className="flex items-center gap-2 font-medium text-lg">
        <Skull aria-hidden className="size-4 text-muted-foreground" />
        The Test
      </h2>
      <p className="mt-1 text-muted-foreground text-sm">
        Six questions about every attempt that came before this one. Answer
        honestly: Chad&apos;s verdict is only as sharp as your confession.
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
        </div>

        <div className="flex flex-col gap-2">
          <Label>
            How many times have you started over from scratch? Count the
            Januaries and the Mondays.
          </Label>
          <OptionGrid
            columns="grid-cols-2 sm:grid-cols-4"
            onChange={setRestarts}
            options={RESTART_OPTIONS}
            value={restarts}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>What is the longest you have ever stuck with it?</Label>
          <OptionGrid
            columns="grid-cols-2 sm:grid-cols-5"
            onChange={setLongestStreak}
            options={STREAK_OPTIONS}
            value={longestStreak}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>What killed your last attempt?</Label>
          <OptionGrid
            columns="grid-cols-2 sm:grid-cols-3"
            onChange={setLastKiller}
            options={KILLER_OPTIONS}
            value={lastKiller}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>How much is life demanding from you right now?</Label>
          <OptionGrid
            columns="grid-cols-2 sm:grid-cols-4"
            onChange={setLifeLoad}
            options={LIFE_LOAD_OPTIONS}
            value={lifeLoad}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="autopsy-confession">
            What actually happened the last time you quit? Be specific.
          </Label>
          <Textarea
            id="autopsy-confession"
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

const STATUS_LINES: Record<"active" | "beaten" | "hit", string> = {
  active: "The prediction stands. Keep logging and prove him wrong.",
  beaten: "You outlived the date. Chad owes you a harder one.",
  hit: "The date came and went. Restart and make him wrong the second time.",
};

function VerdictPanel({
  content,
  issuedLabel,
  onRetake,
  receipt,
  status,
}: {
  content: QuitPredictionContent;
  issuedLabel: string | null;
  onRetake?: () => void;
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
          <p className="mt-3 font-display font-bold text-4xl tracking-tight sm:text-5xl">
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

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">{STATUS_LINES[status]}</p>
        <div className="flex flex-wrap items-center gap-2">
          {/* The receipts (FEAT-23): branded share cards, member-initiated. */}
          <QuitShareActions
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
      </div>
    </section>
  );
}
