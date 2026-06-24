import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { auth } from "@/app/(auth)/auth";
import { AnalysisCard } from "@/components/nutrition/analysis-card";
import { AnalyzeForm } from "@/components/nutrition/analyze-form";
import { StandaloneHeader } from "@/components/nav/standalone-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { canAccessChad, canAccessProFeatures } from "@/lib/admin";
import { getMealAnalysesByUserId, getUserById } from "@/lib/db/queries";

export default function NutritionPage() {
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

      <StandaloneHeader active="/nutrition" />

      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-2xl tracking-tight">
            Nutrition check
          </h1>
          <Badge variant="secondary">Pro</Badge>
        </div>
        <p className="mt-1 text-muted-foreground text-sm">
          Photograph a meal, your fridge, or your pantry. Chad grades it — no
          sugar-coating.
        </p>
      </div>

      <Suspense
        fallback={
          <div className="h-96 animate-pulse rounded-2xl border border-border bg-card" />
        }
      >
        <NutritionContent />
      </Suspense>
    </main>
  );
}

async function NutritionContent() {
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
      <h2 className="font-medium text-lg">Photo analysis is a Chad Pro feature</h2>
      <p className="mx-auto mt-2 max-w-md text-muted-foreground text-sm">
        Upgrade to Pro and send Chad a photo of any meal, your fridge, or your
        pantry. He'll estimate the macros, grade it out of 10, and tell you
        exactly what to fix — the stuff a real coach keeps on you about.
      </p>
      <Button asChild className="mt-5">
        <Link href="/account">Upgrade to Pro</Link>
      </Button>
    </div>
  );
}

async function Feed({ userId }: { userId: string }) {
  const entries = await getMealAnalysesByUserId(userId);

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-2xl border border-border bg-card p-6">
        <AnalyzeForm />
      </section>

      {entries.length > 0 ? (
        <section className="flex flex-col gap-4">
          <h2 className="font-medium text-lg">History</h2>
          {entries.map((entry) => (
            <AnalysisCard entry={entry} key={entry.id} />
          ))}
        </section>
      ) : (
        <p className="text-center text-muted-foreground text-sm">
          No analyses yet. Send Chad your next meal and see what he says.
        </p>
      )}
    </div>
  );
}
