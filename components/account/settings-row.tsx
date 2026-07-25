import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The one settings-row slot map for every row on /account (W4): label first,
 * supporting text stacked below it, trailing slot for the control, value, or
 * disclosure affordance, never rearranged per row (comp-canon 08 #27, #51).
 * Feature-level on purpose: promoting it into components/ui is shared-layer
 * work that needs owner sign-off (CLAUDE.md §3); until then every /account
 * row composes from here so the grammar cannot drift (comp-canon 08 #52).
 *
 * Anatomy per composition canon 05 #53 (label left, current value or control
 * right) and the Hevy/MyFitnessPal/Strava settings grammar. At narrow widths
 * the row wraps as a unit: the control drops below the text, full-line, never
 * half-wrapped (comp-canon 07 #13, #30).
 */

/** The supporting-text slot: a save error swaps INTO this slot instead of
 *  pushing rows down, so nothing ever jumps (owner ruling 2026-07-23;
 *  ux-canon 03 #29, #40: errors needing action never live in a toast). */
function SupportingLine({
  supporting,
  error,
}: {
  supporting?: ReactNode;
  error?: string | null;
}) {
  if (error) {
    return (
      <p className="mt-1 text-destructive text-sm" role="status">
        {error}
      </p>
    );
  }
  if (!supporting) {
    return null;
  }
  return <p className="mt-1 text-muted-foreground text-sm">{supporting}</p>;
}

/** A row whose whole surface navigates to a sub-screen: label + supporting
 *  line + optional current-value text + chevron (comp-canon 05 #53; ux-canon
 *  01 #3: navigation is a real link). Chevron-right means "navigates deeper"
 *  and nothing else (comp-canon 08 #40). */
export function SettingsLinkRow({
  label,
  supporting,
  href,
  value,
}: {
  label: string;
  supporting?: ReactNode;
  href: string;
  value?: string;
}) {
  return (
    <Link
      className="group flex min-h-11 items-center justify-between gap-4 py-4 transition-colors"
      href={href}
    >
      <div className="min-w-0">
        <span className="font-medium text-sm group-hover:underline group-hover:underline-offset-4">
          {label}
        </span>
        <SupportingLine supporting={supporting} />
      </div>
      <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
        {value && <span className="text-sm">{value}</span>}
        <ChevronRight aria-hidden className="size-4" />
      </span>
    </Link>
  );
}

/**
 * A row holding an inline control (switch, segmented control, select). When
 * `controlId` is set the whole row is the control's label, so tapping
 * anywhere on it flips the switch with no dead zone (ux-canon 01 rule 113).
 */
export function SettingsRow({
  label,
  supporting,
  error,
  control,
  controlId,
  children,
  className,
}: {
  label: string;
  supporting?: ReactNode;
  /** Replaces the supporting line until the member retries (ux-canon 03 #29). */
  error?: string | null;
  control?: ReactNode;
  /** id of the trailing control; makes the whole row its label. */
  controlId?: string;
  /** Sub-controls below the row header (pickers, option tiles). */
  children?: ReactNode;
  className?: string;
}) {
  const header = (
    <>
      <div className="min-w-0 flex-1 basis-52">
        <span className="font-medium text-sm">{label}</span>
        <SupportingLine error={error} supporting={supporting} />
      </div>
      {control && <div className="shrink-0">{control}</div>}
    </>
  );

  return (
    <div className={cn("py-4", className)}>
      {controlId ? (
        <label
          className="flex cursor-pointer flex-wrap items-center justify-between gap-x-4 gap-y-3"
          htmlFor={controlId}
        >
          {header}
        </label>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          {header}
        </div>
      )}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

/**
 * A named zone of rows: spaced-caps eyebrow (rung 3 of the separation
 * ladder), rows separated by hairline dividers (rung 4): the cardless
 * form/settings skeleton (comp-canon 05 #52; north star).
 */
export function SettingsZone({
  title,
  children,
  footer,
  className,
}: {
  title: string;
  children: ReactNode;
  /** Fine print rendered once under the zone's rows (canon 05 #59). */
  footer?: ReactNode;
  /** Order/placement utilities from the page grid. */
  className?: string;
}) {
  return (
    // Zones cap themselves at the readable band (canon 08 #48) so the
    // phone-order flattening (display: contents wrappers) can't stretch one.
    <section className={cn("w-full min-w-0 max-w-xl", className)}>
      {/* Header binds 12px to its first row, matching the profile form's
          group binding exactly (canon 06 #7: same relationship, same gap). */}
      <h2 className="mb-3 font-medium text-muted-foreground text-sm uppercase tracking-wide">
        {title}
      </h2>
      <div className="divide-y divide-border">{children}</div>
      {footer && (
        <div className="mt-3 text-muted-foreground text-xs">{footer}</div>
      )}
    </section>
  );
}
