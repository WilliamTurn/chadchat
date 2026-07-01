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
import { canAccessChad, canAccessEliteFeatures } from "@/lib/admin";
import { formatCalendarDay } from "@/lib/date";
import { getUserById, getWeeklyReportsByUserId } from "@/lib/db/queries";
import { parseWeeklyReportContent } from "@/lib/reports/content";
import { formatReportHour, reportDayLabel } from "@/lib/reports/schedule";

/**
 * Weekly reports (FEAT-12, Elite): every coach's report Chad has written for
 * this member, newest first — the latest in full, older weeks collapsed. Each
 * downloads as a PDF and deep-links into chat. Reached from the report email's
 * CTA and the /account schedule card (deliberately not in the shared nav until
 * Elite is publicly purchasable — no-vaporware).
 */

export default function ReportsPage() {
  return (
    <PageShell>
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
        <p className="mt-1 text-muted-foreground text-sm">
          Chad's written review of your week — what you trained, how you ate,
          where your weight is heading, and exactly what changes next week.
          Pick the day and time it lands on{" "}
          <Link
            className="text-foreground underline underline-offset-4"
            href="/account"
          >
            your account page
          </Link>
          .
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
  // Elite-only. No teaser page for other tiers until Elite is purchasable
  // (no-vaporware) — non-Elite members simply land back on the dashboard.
  if (!canAccessEliteFeatures(user)) {
    redirect("/today");
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

  if (rendered.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <h2 className="font-medium text-lg">Your first report is coming</h2>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground text-sm">
          Chad writes it every {reportDayLabel(user.weeklyReportDay)} around{" "}
          {formatReportHour(user.weeklyReportHour)} your time and emails it to
          you — the more you log this week, the more he has to work with.
        </p>
      </div>
    );
  }

  const [latest, ...older] = rendered;

  return (
    <div className="flex flex-col gap-6">
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
