import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { getQuitShareView } from "@/lib/quit/share-view";
import { getAppUrl } from "@/lib/stripe";

/*
 * The public share page for a quit prediction (FEAT-23 pro-app share flow).
 * This is the URL members post to X/Facebook/etc.: social scrapers unfurl it
 * into the card image (./card OG route), and humans who click through land on
 * the prediction + a "take the test yourself" funnel into chadcoach.ai —
 * every share is an ad. No auth: the unguessable uuid is the capability, and
 * only the prediction facts are shown (never the owner's identity).
 */

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ v?: string }>;
};

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { id } = await params;
  const { v } = await searchParams;
  const view = await getQuitShareView(id, v);
  if (!view) {
    return { title: "Chad — The Quit Test" };
  }
  const title =
    view.variant === "receipt"
      ? `Chad gave me ${view.givenDays} days. I'm on day ${view.currentDay}.`
      : `Chad says I quit on ${view.dateLabel}.`;
  const description =
    "Chad, the AI coach, reads your history of abandoned plans and names the exact day you quit. Take the test and try to outsmart him.";
  const image = `${getAppUrl()}/q/${id}/card${view.variant === "receipt" ? "?v=receipt" : ""}`;
  return {
    title: `${title} — Chad, The Quit Test`,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: image, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default function PublicQuitSharePage(props: Props) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <Suspense fallback={null}>
        <ShareContent {...props} />
      </Suspense>
    </main>
  );
}

async function ShareContent({ params, searchParams }: Props) {
  const { id } = await params;
  const { v } = await searchParams;
  const view = await getQuitShareView(id, v);
  if (!view) {
    notFound();
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-6 flex items-baseline gap-3">
        <span className="font-display font-extrabold text-2xl text-blood tracking-tight">
          CHAD
        </span>
        <span className="text-muted-foreground text-sm uppercase tracking-widest">
          The Quit Test
        </span>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        {view.variant === "receipt" ? (
          <>
            <p className="font-semibold text-destructive text-xs tracking-[0.2em]">
              THE RECEIPT
            </p>
            <p className="mt-4 text-muted-foreground text-xl">
              Chad gave me {view.givenDays} days.
            </p>
            <p className="mt-1 font-display font-bold text-4xl text-destructive tracking-tight sm:text-5xl">
              I&apos;m on day {view.currentDay}.
            </p>
            <p className="mt-4 text-muted-foreground text-sm">
              He called {view.dateLabel}. Still here.
            </p>
          </>
        ) : (
          <>
            <p className="font-semibold text-destructive text-xs tracking-[0.2em]">
              {view.round > 1 ? `THE VERDICT, ROUND ${view.round}` : "THE VERDICT"}
            </p>
            <p className="mt-4 font-display font-bold text-2xl text-destructive tracking-tight">
              YOU WILL QUIT
            </p>
            <p className="font-display font-bold text-4xl tracking-tight sm:text-5xl">
              {view.dateLabel}
            </p>
            <p className="mt-4 text-muted-foreground text-sm">
              Day {view.dayCount} of my membership. {view.failureMode}.
            </p>
          </>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-6 sm:p-8">
        <h1 className="font-semibold text-lg">
          Chad names the exact day you quit.
        </h1>
        <p className="mt-2 text-muted-foreground text-sm">
          Chad is the AI coach who reads your history of abandoned plans and
          puts your quit date on the record. Then you prove him wrong. See if
          you have what it takes.
        </p>
        <Button asChild className="mt-5 w-full sm:w-auto" size="lg">
          <Link href="https://chadcoach.ai">Take the test</Link>
        </Button>
      </div>
    </div>
  );
}
