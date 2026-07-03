import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { auth } from "@/app/(auth)/auth";
import { TodaySkeleton } from "@/components/dashboard/page-skeletons";
import { PageShell } from "@/components/nav/page-shell";
import { StandaloneHeader } from "@/components/nav/standalone-header";
import { ReportActions } from "@/components/reports/report-actions";
import { ReportView } from "@/components/reports/report-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { canAccessChad, canAccessEliteFeatures } from "@/lib/admin";
import { formatCalendarDay } from "@/lib/date";
import { getUserById, getWeeklyReportsByUserId } from "@/lib/db/queries";
import {
  parseWeeklyReportContent,
  type WeeklyReportContent,
} from "@/lib/reports/content";
import { formatReportHour, reportDayLabel } from "@/lib/reports/schedule";

/**
 * Weekly reports (FEAT-12, Elite): every coach's report Chad has written for
 * this member, newest first — the latest in full, older weeks collapsed. Each
 * downloads as a PDF and deep-links into chat. In the shared nav since Elite
 * went publicly purchasable (ACC-17); non-Elite members see an upgrade prompt,
 * same pattern as the Pro-gated pages.
 */

export default function ReportsPage() {
  return (
    <PageShell size="narrow">
      <Toaster
        position="top-center"
        theme="system"
        toastOptions={{
          className:
            "!bg-card !text-foreground !border-border/50 !shadow-[var(--shadow-float)]",
        }}
      />

      <StandaloneHeader />

      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-2xl tracking-tight">
            Weekly reports
          </h1>
          <Badge variant="secondary">Elite</Badge>
        </div>
        {/* No settings pointer here: this header renders for every member,
            but the day/time control on /account is Elite-only (LC-6). The
            pointer lives inside the Elite-only list below instead. */}
        <p className="mt-1 text-muted-foreground text-sm">
          Chad's written review of your week — what you trained, how you ate,
          where your weight is heading, and exactly what changes next week.
        </p>
      </div>

      <Suspense fallback={<TodaySkeleton />}>
        <ReportsContent />
      </Suspense>
    </PageShell>
  );
}

async function ReportsContent() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await getUserById(session.user.id);
  if (!user) {
    redirect("/login");
  }
  if (!canAccessChad(user)) {
    redirect("/pricing");
  }
  // Elite-only: everyone else gets the upgrade teaser (Elite is purchasable
  // now, so this is a real path — same pattern as the Pro-gated pages).
  if (!canAccessEliteFeatures(user)) {
    return <UpgradePrompt />;
  }

  const reports = await getWeeklyReportsByUserId(user.id);
  const rendered = reports
    .map((r) => ({
      id: r.id,
      sentAt: r.sentAt,
      dateLabel: formatCalendarDay(r.sentAt, {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      content: parseWeeklyReportContent(r.content),
    }))
    .filter(
      (r): r is typeof r & { content: NonNullable<typeof r.content> } =>
        r.content != null
    );

  return <ReportsList rendered={rendered} user={user} />;
}

/**
 * What a real weekly report looks like, shown blurred behind the Elite upgrade
 * prompt (VF-6); a text-only paywall punished the click that promised
 * "Reports". Static sample content; every number is invented for the mock and
 * it is never presented as the member's own data.
 */
const SAMPLE_REPORT: WeeklyReportContent = {
  headline: "Four sessions in, protein still 20g short",
  intro:
    "You trained four times this week and hit every planned session. Bodyweight moved from 214.2 to 212.9, right on the pace we set. Protein is the weak spot: you averaged 158g against a 180g target, and every day you missed it was a day you skipped the evening shake.",
  sections: [
    {
      title: "Training",
      body: "Four sessions logged: two lower, two upper. Squat top set moved 265 to 275 for the same five reps. Total volume 38,450 lb, up 6% on last week. Bench stalled at 205; bar speed on the last set says fatigue, not weakness.",
    },
    {
      title: "Nutrition",
      body: "Averages: 2,140 calories, 158g protein, 212g carbs, 71g fat. Five of seven days inside the calorie target. Protein missed on Tuesday, Friday and Sunday.",
    },
    {
      title: "Bodyweight",
      body: "214.2 to 212.9 lb. The trend line puts you 1.3 lb down on the week, inside the range we want for holding muscle on a cut.",
    },
  ],
  adjustments: [
    {
      change: "Put the evening shake back on training days",
      reason: "every protein miss this week was a day you skipped it",
    },
    {
      change: "Hold bench at 205 and add a back-off set",
      reason: "the top set stalled two sessions in a row",
    },
  ],
  bottomLine:
    "The cut is working and the squat is climbing. Fix the protein and next week's report has nothing to complain about.",
};

function UpgradePrompt() {
  return (
    <div className="relative max-h-[560px] overflow-hidden rounded-2xl border border-border bg-card">
      {/* The blurred sample report behind the prompt: decorative only. */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none p-6 opacity-85 blur-[5px] sm:p-8"
      >
        <ReportView content={SAMPLE_REPORT} dateLabel="Sample week" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-transparent via-background/50 to-background/90 p-6">
        <div className="max-w-md rounded-2xl border border-border/60 bg-background/85 p-6 text-center shadow-[var(--shadow-float)] backdrop-blur-sm">
          <h2 className="font-medium text-lg">
            Weekly reports are a Chad Elite feature
          </h2>
          <p className="mt-2 text-muted-foreground text-sm">
            Upgrade to Elite and Chad writes you a full coach's review every
            week: what you trained, how you ate, where your weight is heading,
            and exactly what changes next week, delivered to your inbox.
          </p>
          <Button asChild className="mt-5">
            <Link href="/account">Upgrade to Elite</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function ReportsList({
  rendered,
  user,
}: {
  rendered: {
    id: string;
    sentAt: Date;
    dateLabel: string;
    content: NonNullable<ReturnType<typeof parseWeeklyReportContent>>;
  }[];
  user: { weeklyReportDay: number; weeklyReportHour: number };
}) {
  if (rendered.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <h2 className="font-medium text-lg">Your first report is coming</h2>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground text-sm">
          Chad writes it every {reportDayLabel(user.weeklyReportDay)} around{" "}
          {formatReportHour(user.weeklyReportHour)} your time and emails it to
          you. The more you log this week, the more he has to work with. Pick
          a different day and time on{" "}
          <Link
            className="text-foreground underline underline-offset-4"
            href="/account"
          >
            your account page
          </Link>
          .
        </p>
      </div>
    );
  }

  const [latest, ...older] = rendered;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted-foreground text-sm">
        Lands every {reportDayLabel(user.weeklyReportDay)} around{" "}
        {formatReportHour(user.weeklyReportHour)} your time. Change the day and
        time on{" "}
        <Link
          className="text-foreground underline underline-offset-4"
          href="/account"
        >
          your account page
        </Link>
        .
      </p>
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <ReportView content={latest.content} dateLabel={latest.dateLabel} />
        <div className="mt-6 border-border border-t pt-5">
          <ReportActions
            content={latest.content}
            dateLabel={latest.dateLabel}
          />
        </div>
      </div>

      {older.length > 0 && (
        <section>
          <h2 className="mb-3 font-medium text-muted-foreground text-sm uppercase tracking-wide">
            Earlier weeks
          </h2>
          <div className="flex flex-col gap-3">
            {older.map((report) => (
              <details
                className="group rounded-2xl border border-border bg-card"
                key={report.id}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 [&::-webkit-details-marker]:hidden">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-sm">
                      {report.content.headline}
                    </p>
                    <p className="mt-0.5 text-muted-foreground text-xs">
                      {report.dateLabel}
                    </p>
                  </div>
                  <span className="text-muted-foreground text-xs group-open:hidden">
                    Read
                  </span>
                  <span className="hidden text-muted-foreground text-xs group-open:inline">
                    Close
                  </span>
                </summary>
                <div className="border-border border-t p-6 sm:p-8">
                  <ReportView
                    content={report.content}
                    dateLabel={report.dateLabel}
                  />
                  <div className="mt-6 border-border border-t pt-5">
                    <ReportActions
                      content={report.content}
                      dateLabel={report.dateLabel}
                    />
                  </div>
                </div>
              </details>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
