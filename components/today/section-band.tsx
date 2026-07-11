import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Visible section band for the /today dashboard (R2-13). The page is organized
 * STATUS → LOGGERS → PLANS → REVIEW, but until now only the code knew: each
 * band names its section and states its job in one plain-language line, so the
 * organizing model is visible to members. The hero (STATUS) needs no band.
 */
export function SectionBand({
  title,
  description,
  contentClassName,
  children,
}: {
  title: string;
  /** One plain sentence stating the section's job (copy-clear, no wit). */
  description: string;
  /** Layout for the band's cards (LAY-1): defaults to the phone stack; the
   *  page passes its desktop dashboard grid here. */
  contentClassName?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="border-border border-b pb-2.5">
        <h2 className="font-display font-semibold text-lg tracking-tight">
          {title}
        </h2>
        <p className="mt-0.5 text-muted-foreground text-sm">{description}</p>
      </div>
      <div className={cn("flex flex-col gap-6", contentClassName)}>
        {children}
      </div>
    </section>
  );
}
