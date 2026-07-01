import type { WeeklyReportContent } from "@/lib/reports/content";

/**
 * One weekly report rendered in full (FEAT-12) — headline, Chad's read on the
 * week, the per-area sections, next week's adjustments with reasons, and the
 * bottom line. Pure presentational + server-safe; the same content shape the
 * email and the PDF render.
 */
export function ReportView({
  content,
  dateLabel,
}: {
  content: WeeklyReportContent;
  dateLabel: string;
}) {
  return (
    <article className="flex flex-col gap-6">
      <header>
        <p className="font-semibold text-blood text-xs uppercase tracking-[0.2em]">
          Weekly report · {dateLabel}
        </p>
        <h2 className="mt-2 font-semibold text-xl tracking-tight">
          {content.headline}
        </h2>
        <p className="mt-3 whitespace-pre-line text-muted-foreground text-sm leading-relaxed">
          {content.intro}
        </p>
      </header>

      <div className="flex flex-col gap-5">
        {content.sections.map((section) => (
          <section key={section.title}>
            <h3 className="font-medium text-sm">{section.title}</h3>
            <p className="mt-1.5 whitespace-pre-line text-muted-foreground text-sm leading-relaxed">
              {section.body}
            </p>
          </section>
        ))}
      </div>

      <section className="rounded-xl border border-blood/20 bg-blood/[0.04] p-4">
        <h3 className="font-semibold text-blood text-xs uppercase tracking-[0.2em]">
          Next week's adjustments
        </h3>
        <ul className="mt-3 flex flex-col gap-3">
          {content.adjustments.map((a) => (
            <li key={a.change}>
              <p className="font-medium text-sm">{a.change}</p>
              <p className="mt-0.5 text-muted-foreground text-sm">
                Why: {a.reason}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <p className="whitespace-pre-line font-medium text-sm leading-relaxed">
        {content.bottomLine}
      </p>
    </article>
  );
}
