import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { auth } from "@/app/(auth)/auth";
import { KitchenFeed } from "@/components/kitchen/kitchen-feed";
import { AnalysisCard } from "@/components/nutrition/analysis-card";
import { StandaloneHeader } from "@/components/nav/standalone-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { canAccessChad, canAccessProFeatures } from "@/lib/admin";
import { getKitchenAnalysesByUserId, getUserById } from "@/lib/db/queries";

export default function KitchenPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-12">
      <Toaster
        position="top-center"
        theme="system"
        toastOptions={{
          className:
            "!bg-card !text-foreground !border-border/50 !shadow-[var(--shadow-float)]",
        }}
      />

      <StandaloneHeader active="/kitchen" />

      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-2xl tracking-tight">
            Rate My Kitchen
          </h1>
          <Badge variant="secondary">Pro</Badge>
        </div>
        <p className="mt-1 text-muted-foreground text-sm">
          Show Chad your fridge or pantry — he'll tell you what's helping, what's
          sabotaging you, and what to buy next. Logging a meal instead?{" "}
          <Link
            className="text-foreground underline underline-offset-4"
            href="/nutrition"
          >
            Nutrition diary
          </Link>{" "}
          ·{" "}
          <Link
            className="text-foreground underline underline-offset-4"
            href="/meal-plan"
          >
            Meal plan
          </Link>
          .
        </p>
      </div>

      <Suspense
        fallback={
          <div className="h-96 animate-pulse rounded-2xl border border-border bg-card" />
        }
      >
        <KitchenContent />
      </Suspense>
    </main>
  );
}

async function KitchenContent() {
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

  const isPro = canAccessProFeatures(user);
  return isPro ? <Feed userId={user.id} /> : <UpgradePrompt />;
}

function UpgradePrompt() {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center">
      <h2 className="font-medium text-lg">
        Rate My Kitchen is a Chad Pro feature
      </h2>
      <p className="mx-auto mt-2 max-w-md text-muted-foreground text-sm">
        Upgrade to Pro and send Chad a photo of your fridge or pantry. He'll
        inventory it, call out the junk, and tell you exactly what to stock.
      </p>
      <Button asChild className="mt-5">
        <Link href="/account">Upgrade to Pro</Link>
      </Button>
    </div>
  );
}

async function Feed({ userId }: { userId: string }) {
  const entries = await getKitchenAnalysesByUserId(userId);

  return (
    <KitchenFeed
      hasEntries={entries.length > 0}
      history={entries.map((entry) => (
        <AnalysisCard entry={entry} key={entry.id} />
      ))}
    />
  );
}
