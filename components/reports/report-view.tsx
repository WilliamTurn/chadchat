import { chadAppHtml } from "@/lib/text/emphasis";
import type { WeeklyReportContent } from "@/lib/reports/content";

/**
 * One weekly report rendered in full (FEAT-12) — headline, Chad's read on the
 * week, the per-area sections, next week's adjustments with reasons, and the
 * bottom line. Pure presentational + server-safe; the same content shape the
 * email and the PDF render. Chad's emphasis (**bold** / [[red]], s157) is
 * escaped-then-marked-up by chadAppHtml, so the model can never inject HTML.
 */

function ChadText({
  text,
  className,
}: {
  text: string;
  className: string;
}) {
  return (
    <p
      className={className}
      // Safe: chadAppHtml HTML-escapes the model text first, then only adds
      // <strong> / <span class="chad-red"> for Chad's emphasis markers.
      // biome-ignore lint/security/noDangerouslySetInnerHtml: escaped upstream
      dangerouslySetInnerHTML={{ __html: chadAppHtml(text) }}
    />
  );
}

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
        <ChadText
          className="mt-3 whitespace-pre-line text-muted-foreground text-sm leading-relaxed"
          text={content.intro}
        />
      </header>

      <div className="flex flex-col gap-5">
        {content.sections.map((section) => (
          <section key={section.title}>
            <h3 className="font-medium text-sm">{section.title}</h3>
            <ChadText
              className="mt-1.5 whitespace-pre-line text-muted-foreground text-sm leading-relaxed"
              text={section.body}
            />
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
              <ChadText className="font-medium text-sm" text={a.change} />
              <ChadText
                className="mt-0.5 text-muted-foreground text-sm"
                text={`Why: ${a.reason}`}
              />
            </li>
          ))}
        </ul>
      </section>

      <ChadText
        className="whitespace-pre-line font-medium text-sm leading-relaxed"
        text={content.bottomLine}
      />
    </article>
  );
}
