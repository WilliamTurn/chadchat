import { cn } from "@/lib/utils";

/**
 * TOKEN SPECIMEN SHEET (P2-A, FIX-13 evidence). Renders the semantic type
 * ramp, spacing scale, surface ladder, semantic state colors with their
 * measured WCAG ratios, and the 12/8/4 grid, so an auditor can grade the
 * token system against visual-excellence.md line by line in both themes.
 *
 * The hex values in CONTRAST_TABLE mirror app/globals.css; they exist here
 * only to display the measured numbers next to their swatches. If a token
 * changes in globals.css, update this sheet in the same commit.
 */

/* WCAG 2.x relative-luminance contrast, computed at render time so the
   numbers on screen are measurements, not copy. */
function lum(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4]
    .map((i) => Number.parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.039_28 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a: string, b: string): number {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return Math.round(((l1 + 0.05) / (l2 + 0.05)) * 100) / 100;
}

const DARK = { card: "#0b0f17", inset: "#131a26" };
const LIGHT = { card: "#ffffff", inset: "#f2f2f2" };

const CONTRAST_TABLE = [
  { role: "positive-text", light: "#047857", dark: "#10b981" },
  { role: "attention-text", light: "#92400e", dark: "#f59e0b" },
  { role: "critical-text (DSH-61)", light: "#a4161a", dark: "#f2555a" },
  { role: "info-text", light: "#0369a1", dark: "#0ea5e9" },
  { role: "sleep-text", light: "#4f46e5", dark: "#818cf8" },
] as const;

const TYPE_RAMP = [
  { cls: "text-page-title", label: "Page title 32/27px" },
  { cls: "text-section-title", label: "Section title 22/20px" },
  { cls: "text-card-title", label: "Card title 16px" },
  { cls: "text-metric-lg", label: "Metric large 32px tabular" },
  { cls: "text-metric", label: "Metric 28px tabular" },
  { cls: "text-body", label: "Body 15px" },
  { cls: "text-body-sm", label: "Secondary 14px" },
  { cls: "text-meta", label: "Meta 13px (short metadata only)" },
  { cls: "text-eyebrow", label: "Eyebrow 12px uppercase" },
] as const;

const SPACING = [4, 8, 12, 16, 20, 24, 32, 40] as const;

export default function TokensPage() {
  return (
    <div className="space-y-12">
      <div className="space-y-3">
        <h1 className="text-page-title">Design tokens</h1>
        <p className="max-w-[72ch] text-body text-muted-foreground">
          The FIX-13 layout language: semantic type ramp, the 4 to 40px
          spacing scale, surface ladder, semantic state colors with measured
          contrast, and the 12/8/4 dashboard grid. Toggle the theme and
          resize to grade both variants.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-section-title">Type ramp</h2>
        <div className="space-y-5 rounded-2xl border border-border bg-card p-6">
          {TYPE_RAMP.map((t) => (
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1" key={t.cls}>
              <p className={t.cls}>
                {t.cls === "text-metric" || t.cls === "text-metric-lg"
                  ? "1,840 of 2,300"
                  : "Progress you can see"}
              </p>
              <p className="text-meta text-muted-foreground">
                .{t.cls} : {t.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-section-title">Spacing scale</h2>
        <div className="space-y-3 rounded-2xl border border-border bg-card p-6">
          {SPACING.map((px) => (
            <div className="flex items-center gap-4" key={px}>
              <span className="w-14 text-meta text-muted-foreground tabular-nums">
                {px}px
              </span>
              <div
                className="h-4 rounded-sm bg-info/60"
                style={{ width: px * 4 }}
              />
            </div>
          ))}
          <p className="pt-2 text-body-sm text-muted-foreground">
            Card padding 20 to 24px. Card gap 16px desktop, 12px phone.
            Section gap 32 to 40px. No 6/10/14px one-offs.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-section-title">Surface ladder</h2>
        <div className="rounded-2xl border border-border bg-surface-page p-6">
          <p className="mb-4 text-meta text-muted-foreground">
            surface-page
          </p>
          <div className="rounded-xl border border-border bg-surface-card p-6 shadow-[var(--shadow-card)]">
            <p className="mb-4 text-meta text-muted-foreground">
              surface-card
            </p>
            <div className="rounded-lg bg-surface-inset p-6">
              <p className="text-meta text-muted-foreground">surface-inset</p>
            </div>
            <div className="mt-4 w-64 rounded-lg border border-border bg-surface-overlay p-4 shadow-[var(--shadow-float)]">
              <p className="text-meta text-muted-foreground">
                surface-overlay (floats above the card, not nested in inset)
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-section-title">Semantic state colors</h2>
        <p className="max-w-[72ch] text-body-sm text-muted-foreground">
          Fills draw charts, bars, and badges; text forms are AA-measured on
          card and inset in their theme. Brand red #a4161a is FILL-ONLY in
          dark (2.5:1); red text uses critical-text (the DSH-61 fix). Domain
          color never substitutes for state color.
        </p>
        <div className="overflow-x-auto rounded-2xl border border-border bg-card p-6">
          <table className="w-full min-w-[640px] border-collapse text-body">
            <thead>
              <tr className="border-border border-b text-left">
                <th className="py-2 pr-4 font-medium">Role</th>
                <th className="py-2 pr-4 font-medium">Specimen</th>
                <th className="py-2 pr-4 font-medium">Light card / inset</th>
                <th className="py-2 pr-4 font-medium">Dark card / inset</th>
              </tr>
            </thead>
            <tbody>
              {CONTRAST_TABLE.map((row) => (
                <tr className="border-border/60 border-b" key={row.role}>
                  <td className="py-3 pr-4 font-mono text-body-sm">
                    {row.role}
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={cn(
                        "font-semibold",
                        row.role.startsWith("positive") && "text-positive-text",
                        row.role.startsWith("attention") &&
                          "text-attention-text",
                        row.role.startsWith("critical") && "text-critical-text",
                        row.role.startsWith("info") && "text-info-text",
                        row.role.startsWith("sleep") && "text-sleep-text"
                      )}
                    >
                      208.8 lb
                    </span>
                  </td>
                  <td className="py-3 pr-4 tabular-nums">
                    {ratio(row.light, LIGHT.card)} / {ratio(row.light, LIGHT.inset)}
                  </td>
                  <td className="py-3 pr-4 tabular-nums">
                    {ratio(row.dark, DARK.card)} / {ratio(row.dark, DARK.inset)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-section-title">Dashboard grid: 12 / 8 / 4</h2>
        <p className="text-body-sm text-muted-foreground">
          Resize to see composition change: 12 columns at 1280+, 8 at 768+,
          4 below. Content region bounds at 1500px inside the full shell.
        </p>
        <div className="grid-dashboard">
          {Array.from({ length: 12 }, (_, i) => (
            <div
              className={cn(
                "flex h-16 items-center justify-center rounded-lg bg-surface-inset text-meta text-muted-foreground tabular-nums",
                i >= 8 && "hidden xl:flex",
                i >= 4 && i < 8 && "hidden md:flex"
              )}
              key={`col-${i + 1}`}
            >
              {i + 1}
            </div>
          ))}
          <div className="col-span-4 flex h-24 items-center justify-center rounded-xl border border-border bg-card text-body-sm md:col-span-4 xl:col-span-4">
            span 4 (quick-log)
          </div>
          <div className="col-span-4 flex h-24 items-center justify-center rounded-xl border border-border bg-card text-body-sm md:col-span-4 xl:col-span-8">
            span 8 (trend, 2/3 split)
          </div>
        </div>
      </section>
    </div>
  );
}
