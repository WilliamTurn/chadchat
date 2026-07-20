import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/app/(auth)/auth";
import { TodaySkeleton } from "@/components/dashboard/page-skeletons";
import { BackLink } from "@/components/nav/back-link";
import { PageShell } from "@/components/nav/page-shell";
import { QuitDateExperience } from "@/components/quit/quit-date-experience";
import { canAccessChad } from "@/lib/admin";
import { formatCalendarDay, todayAnchorInTz } from "@/lib/date";
import {
  getLatestQuitPrediction,
  getQuitPredictionsByUserId,
  getUserById,
} from "@/lib/db/queries";
import { parseQuitPredictionContent } from "@/lib/quit/content";
import { dayNumberOn, dayOneAnchor } from "@/lib/quit/lifecycle";
import type { ReceiptCardData } from "@/lib/quit/share-cards";

/**
 * The Quit Date (FEAT-21): Chad's on-the-record prediction of the exact day
 * this member quits. No standing prediction: the page runs The Autopsy (the
 * failure-history intake). Standing prediction: it shows The Verdict. Not
 * tier-gated; every member with access gets a date. Reached from the /home
 * card (deliberately not in the shared nav while NAV-35/VF-20 debate how many
 * icons the header can hold).
 */

export default function QuitDatePage() {
  return (
    <PageShell>

      {/* The page header lives inside the async content (s157, owner order):
          pre-test it sells the TEST ("outsmart Chad") and never names the
          quit-date mechanic — that reveal belongs to the verdict. */}
      <Suspense fallback={<TodaySkeleton />}>
        <QuitDateContent />
      </Suspense>
    </PageShell>
  );
}

async function QuitDateContent() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await getUserById(session.user.id);
  if (!user) {
    redirect("/login");
  }
  // Legal gate (BLK-4): accept the Terms before using the product.
  if (!user.acceptedTermsAt) {
    redirect("/legal");
  }
  if (!canAccessChad(user)) {
    redirect("/pricing");
  }

  // The member switched the Quit Date off (FEAT-25): no verdict, no autopsy.
  // The prediction ledger survives and everything returns if they flip it on.
  if (!user.quitDateEnabled) {
    return (
      <>
        <PageHeading sub="You turned this feature off." title="The Quit Test" />
        <div className="max-w-2xl rounded-2xl border border-border bg-card p-6 sm:p-8">
          <h2 className="font-medium text-lg">
            The Quit Date is switched off
          </h2>
          <p className="mt-2 text-muted-foreground text-sm">
            You turned this feature off, so Chad isn&apos;t keeping a
            prediction on you. Turn it back on from{" "}
            <Link
              className="text-foreground underline underline-offset-4"
              href="/account"
            >
              your account page
            </Link>{" "}
            whenever you want a date to beat.
          </p>
        </div>
      </>
    );
  }

  // Latest row regardless of status (FEAT-22): an active one is the standing
  // verdict; a resolved hit/beaten one keeps its verdict on screen with the
  // "run it back" path (a resolved prediction no longer blocks a new autopsy).
  const prediction = await getLatestQuitPrediction(user.id);
  const content = prediction
    ? parseQuitPredictionContent(prediction.content)
    : null;

  // THE RECEIPT (FEAT-23): available once the member is past the CHAIN's
  // original predicted date and still here ("Chad gave me 23 days. I'm on day
  // 61."). Reissued rounds share their day-one anchor with the row they
  // replaced, so the chain's first prediction is the oldest row with the same
  // day one; a hit-then-restart chain starts a new day one and a new count.
  let receipt: ReceiptCardData | null = null;
  if (prediction && content && prediction.status !== "hit") {
    const dayOne = dayOneAnchor(prediction.quitDate, content.dayCount);
    let givenDays = content.dayCount;
    let givenDateLabel = content.dateLabel;
    for (const row of await getQuitPredictionsByUserId(user.id)) {
      const c = parseQuitPredictionContent(row.content);
      if (
        c &&
        dayOneAnchor(row.quitDate, c.dayCount).getTime() === dayOne.getTime()
      ) {
        givenDays = c.dayCount;
        givenDateLabel = c.dateLabel;
        break;
      }
    }
    const currentDay = dayNumberOn(
      todayAnchorInTz(user.timezone),
      prediction.quitDate,
      content.dayCount
    );
    if (currentDay > givenDays) {
      receipt = { givenDays, currentDay, dateLabel: givenDateLabel };
    }
  }

  return (
    <>
      {/* Pre-test: the owner's test framing, verbatim — the page never names
          the quit-date mechanic before the verdict does (s157). */}
      {/* RC-11 (Q-D): one destination, one title. The heading used to rename
          itself from "The Quit Test" to "The Quit Date" once a prediction
          existed, so the same page answered to two names. The title is now
          fixed to the registered name and only the sub-copy changes with
          state. */}
      <PageHeading
        sub={
          content
            ? "Chad read your history of abandoned plans and named the exact day you quit this one. Your job is to prove him wrong."
            : "See if you have what it takes. Take this test and try to outsmart Chad."
        }
        title="The Quit Test"
      />
      <div className="max-w-2xl">
        <QuitDateExperience
          initial={content}
          predictedAtLabel={
            prediction ? formatCalendarDay(prediction.predictedAt) : null
          }
          predictionId={prediction?.id ?? null}
          receipt={receipt}
          status={prediction?.status ?? null}
        />
      </div>
    </>
  );
}

function PageHeading({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-8 max-w-2xl">
      <BackLink />
      <h1 className="font-semibold text-2xl tracking-tight">{title}</h1>
      <p className="mt-1 text-muted-foreground text-sm">{sub}</p>
    </div>
  );
}
