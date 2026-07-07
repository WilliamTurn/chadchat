import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { auth } from "@/app/(auth)/auth";
import { TodaySkeleton } from "@/components/dashboard/page-skeletons";
import { PageShell } from "@/components/nav/page-shell";
import { StandaloneHeader } from "@/components/nav/standalone-header";
import { RoastComposer } from "@/components/share/roast-composer";
import { canAccessChad } from "@/lib/admin";
import { getLatestCheckIn, getUserById } from "@/lib/db/queries";

/**
 * Roast Share (FEAT-24): the standalone card composer. The "Share this roast"
 * link in Chad's check-in emails lands here with the member's latest check-in
 * pre-filled (?src=checkin); otherwise it's an empty composer for pasting any
 * Chad line. Chat messages and weekly reports have their own in-place share
 * dialogs — this page exists because an email can't open one.
 */

export default function RoastPage({
  searchParams,
}: {
  searchParams: Promise<{ src?: string }>;
}) {
  return (
    <PageShell>
      <Toaster position="top-center" richColors theme="system" />
      <StandaloneHeader />

      <div className="mb-8 max-w-2xl">
        <h1 className="font-semibold text-2xl tracking-tight">
          Share the roast
        </h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Turn what Chad said into a card you can post. Trim it to the line
          worth sharing — nothing goes anywhere until you share it.
        </p>
      </div>

      <Suspense fallback={<TodaySkeleton />}>
        <RoastContent searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function RoastContent({
  searchParams,
}: {
  searchParams: Promise<{ src?: string }>;
}) {
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

  const { src } = await searchParams;
  let initialText = "";
  if (src === "checkin") {
    const latest = await getLatestCheckIn(user.id);
    initialText = latest?.body ?? "";
  }

  return (
    <div className="max-w-2xl rounded-2xl border border-border bg-card p-6 sm:p-8">
      <RoastComposer initialText={initialText} />
    </div>
  );
}
