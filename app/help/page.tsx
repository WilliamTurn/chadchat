import {
  Camera,
  CreditCard,
  LineChart,
  MessageSquare,
  Share2,
  Target,
} from "lucide-react";
import Link from "next/link";
import { PageShell } from "@/components/nav/page-shell";
import { StandaloneHeader } from "@/components/nav/standalone-header";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Help — How Chad works",
};

type Section = {
  icon: typeof MessageSquare;
  title: string;
  body: React.ReactNode;
};

const SECTIONS: Section[] = [
  {
    icon: MessageSquare,
    title: "Talk to Chad",
    body: (
      <>
        Chad is your coach. Tell him your goal, your training history, your
        injuries, what equipment you have — the more he knows, the better the
        plan. He remembers what you tell him between chats, so you don't have to
        repeat yourself. Ask him to build a training split, set your macros, or
        talk you out of skipping the gym.
      </>
    ),
  },
  {
    icon: Target,
    title: "Your dashboard",
    body: (
      <>
        The <strong>Dashboard</strong> is your home base. It pulls together your
        goal, your current training plan, your streak, and — on Pro — today's
        fuel and your weight trend. Set or edit your goal right from there; it
        writes straight to what Chad knows, so you and he are always on the same
        page.
      </>
    ),
  },
  {
    icon: Camera,
    title: "Nutrition check (Pro)",
    body: (
      <>
        Snap a photo of a meal, your fridge, or your pantry and Chad grades it —
        macros, a score out of 10, and exactly what to fix. Meals you log feed
        the fuel rings on your dashboard so you can see where the day stands.
        Photos are a Pro feature.
      </>
    ),
  },
  {
    icon: LineChart,
    title: "Progress tracking (Pro)",
    body: (
      <>
        Log your weight and progress photos over time on the{" "}
        <strong>Progress</strong> page. Chad charts the trend so you're judged
        on the line, not on a single bad morning on the scale. Pro feature.
      </>
    ),
  },
  {
    icon: Share2,
    title: "Sharing a chat",
    body: (
      <>
        Want to show someone Chad's advice? Use the <strong>Share</strong>{" "}
        button in a chat's header to create a public link. Anyone with the link
        can read that conversation — no account needed. Chats stay private until
        you create a link, and you can make one private again anytime.
      </>
    ),
  },
  {
    icon: CreditCard,
    title: "Your membership & billing",
    body: (
      <>
        Manage your plan from the <strong>Account</strong> page — update your
        card, switch between Basic and Pro, or cancel. Billing is handled
        securely by Stripe, and you can cancel anytime; you keep access through
        the end of the period you've paid for.
      </>
    ),
  },
];

export default function HelpPage() {
  return (
    <PageShell>
      <StandaloneHeader active="/help" />

      <div className="mb-8">
        <h1 className="font-display font-bold text-3xl tracking-tight">
          How Chad works
        </h1>
        <p className="mt-2 text-muted-foreground text-sm">
          The short version: tell Chad what you want, do the work, and let him
          keep you honest. Here's what each part of the app is for.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <section
              className="rounded-2xl border border-border bg-card p-6"
              key={section.title}
            >
              <h2 className="mb-2 flex items-center gap-2 font-medium text-lg">
                <Icon className="size-5 text-blood" />
                {section.title}
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {section.body}
              </p>
            </section>
          );
        })}
      </div>

      <div className="mt-8 rounded-2xl border border-border border-dashed bg-card p-6 text-center">
        <h2 className="font-medium text-lg">Still stuck?</h2>
        <p className="mx-auto mt-1 max-w-md text-muted-foreground text-sm">
          Ask Chad directly — he can walk you through anything in the app, or
          just get you training.
        </p>
        <Button asChild className="mt-4 gap-1.5">
          <Link href="/">
            <MessageSquare className="size-4" />
            Ask Chad
          </Link>
        </Button>
      </div>
    </PageShell>
  );
}
