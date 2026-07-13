import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { auth } from "@/app/(auth)/auth";
import { AppearanceCustomizer } from "@/components/account/appearance-customizer";
import { PageShell } from "@/components/nav/page-shell";
import { buttonVariants } from "@/components/ui/button";
import { canAccessChad } from "@/lib/admin";
import { getUserById, getUserMemory } from "@/lib/db/queries";
import { clientField } from "@/lib/memory/client-field";
import { normalizeSex, resolveHero } from "@/lib/today/goal-diagram";
import { cn } from "@/lib/utils";

/**
 * Account > Appearance (DEC-05, owner-decided 2026-07-13): the owned home of
 * the member's figure: the silhouette or uploaded image that used to live in
 * the /today header customizer. Relocation only: every capability (pick
 * male/female, upload your own, reset) survives here, and the dashboard
 * header stays compact. Dedicated page with a back link per the s168
 * pages-not-popups law.
 */
export default function AppearancePage() {
  return (
    <PageShell active="/account" className="max-w-[var(--container-content)]">
      <Toaster position="top-center" richColors theme="system" />

      <div className="mb-8">
        <Link
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "-ml-2 mb-2 min-h-11 gap-1.5 text-muted-foreground sm:min-h-8"
          )}
          href="/account"
        >
          <ArrowLeft className="size-4" />
          Account
        </Link>
        <h1 className="font-semibold text-2xl tracking-tight">Appearance</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Your figure: the silhouette or photo that represents you.
        </p>
      </div>

      <Suspense fallback={<AppearanceSkeleton />}>
        <AppearanceContent />
      </Suspense>
    </PageShell>
  );
}

function AppearanceSkeleton() {
  return (
    <div className="max-w-2xl rounded-2xl border border-border bg-card p-6">
      <div className="h-56 w-40 animate-pulse rounded-xl bg-muted-foreground/20" />
      <div className="mt-6 h-9 w-64 animate-pulse rounded-lg bg-muted-foreground/20" />
    </div>
  );
}

async function AppearanceContent() {
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

  const memory = await getUserMemory(user.id);
  // Same resolution the /today header used (DSH-21): explicit choice, else a
  // silhouette derived from the member's sex in Chad's memory, else male.
  const hero = resolveHero(
    user.heroFigure,
    user.heroImageUrl,
    normalizeSex(clientField(memory?.profile ?? null, "Sex"))
  );

  return (
    <div className="flex max-w-4xl flex-col items-start gap-6 md:flex-row">
      {/* Live preview: the current figure, full height, on the same dark
          card treatment the dashboard header used, so the choice reads
          exactly as it renders. */}
      <div className="relative flex h-72 w-full shrink-0 items-end justify-center overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] md:w-80">
        <div
          aria-hidden
          className="-right-10 -top-10 pointer-events-none absolute size-40 rounded-full bg-blood/20 blur-3xl"
        />
        {hero.kind === "custom" ? (
          <img
            alt="Your uploaded figure"
            className="h-full w-full object-cover"
            src={hero.src}
          />
        ) : (
          <img
            alt={`${hero.effective === "female" ? "Female" : "Male"} silhouette`}
            className="h-full w-auto max-w-none object-contain object-bottom pt-6"
            src={hero.src}
          />
        )}
        <span className="absolute top-3 left-3 rounded-full border border-border/60 bg-background/70 px-2.5 py-1 font-medium text-muted-foreground text-xs backdrop-blur-sm">
          Current
        </span>
      </div>

      <div className="w-full min-w-0 flex-1 rounded-2xl border border-border bg-card p-6">
        <AppearanceCustomizer hero={hero} />
      </div>
    </div>
  );
}
