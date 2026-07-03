import {
  BellRing,
  Camera,
  CreditCard,
  Download,
  Droplets,
  Dumbbell,
  FileText,
  HelpCircle,
  LayoutDashboard,
  LineChart,
  type LucideIcon,
  MessageSquare,
  Moon,
  Refrigerator,
  Rocket,
  Share2,
  Target,
  UtensilsCrossed,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { PageShell } from "@/components/nav/page-shell";
import { StandaloneHeader } from "@/components/nav/standalone-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Help",
};

/**
 * The help center (HLP-2, rebuilt s130). One long, skimmable page: getting
 * started, every feature by its NAV name (LC-8: help used to invent its own
 * feature names and only knew two of the three tiers), plans and billing for
 * all three tiers, data and privacy, troubleshooting, and an FAQ. Static
 * content, server-rendered, anchor links from the small TOC at the top.
 */

type Tier = "Pro" | "Elite";

type Feature = {
  icon: LucideIcon;
  /** Exactly the name the navigation uses, so help and nav can't drift. */
  title: string;
  href: string;
  tier?: Tier;
  body: React.ReactNode;
};

const FEATURES: Feature[] = [
  {
    icon: MessageSquare,
    title: "Chat",
    href: "/",
    body: (
      <>
        <p>
          Chat is Chad himself. Tell him your goal, your training history, your
          injuries, and what equipment you have. The more he knows, the better
          the coaching. Ask him to build a training split, set your calorie and
          macro targets, review your week, or talk you out of skipping the gym.
        </p>
        <p>
          Chad remembers what you tell him between chats, so you never have to
          repeat yourself. He can also see your logged data: your workouts,
          meals, weigh-ins, water, and sleep, including past days. Ask him
          "how did I eat last week?" and he answers from your real logs.
        </p>
      </>
    ),
  },
  {
    icon: LayoutDashboard,
    title: "Dashboard",
    href: "/today",
    body: (
      <>
        <p>
          The Dashboard is your home base: today's calories and macros, your
          weight trend, your streak, your last workout, water, sleep, and your
          goals, all on one page. Every card links to its full page, and the
          "Ask Chad" buttons start a chat about that exact card.
        </p>
        <p>
          The streak counts days where you logged anything at all: a meal, a
          workout, a weigh-in, water, or sleep. Show up, log it, keep the
          streak alive.
        </p>
      </>
    ),
  },
  {
    icon: Dumbbell,
    title: "Workouts",
    href: "/workouts",
    tier: "Pro",
    body: (
      <>
        <p>
          Log every session: exercises, sets, reps, and weight. The page tracks
          your total volume (all the weight you moved), your personal records,
          and your estimated one-rep max for each lift, with charts that show
          the trend over time.
        </p>
        <p>
          Built-in tools: a plate calculator that shows which plates to load
          for a target weight, and a rest timer for between sets. Chad sees
          every workout you log and holds you to your plan.
        </p>
      </>
    ),
  },
  {
    icon: Camera,
    title: "Calorie Tracker",
    href: "/nutrition",
    tier: "Pro",
    body: (
      <>
        <p>
          Log what you eat four ways: photograph the meal and Chad identifies
          it and estimates the macros, photograph a nutrition label and he
          reads the printed numbers off it, enter it manually, or re-log a
          recent meal in one tap. Every meal gets graded against your targets
          with a verdict from Chad.
        </p>
        <p>
          The page tracks calories, protein, carbs, and fat against your daily
          targets, with daily history and trend charts. Macro numbers come
          from a verified food database, not from guesswork.
        </p>
      </>
    ),
  },
  {
    icon: UtensilsCrossed,
    title: "Meal Plan",
    href: "/meal-plan",
    tier: "Pro",
    body: (
      <>
        <p>
          Ask Chad for a meal plan and he builds a structured day of real
          meals that hits your calorie and macro targets: every ingredient
          with gram amounts and its own macros. Adjust portions and the
          numbers re-calculate instantly. Download it as a PDF to take to the
          grocery store.
        </p>
      </>
    ),
  },
  {
    icon: Refrigerator,
    title: "Kitchen",
    href: "/kitchen",
    tier: "Pro",
    body: (
      <>
        <p>
          Photograph your fridge or pantry and Chad rates it: what supports
          your goal, what is sabotaging it, and what to buy instead. Good for
          a reality check before a grocery run.
        </p>
      </>
    ),
  },
  {
    icon: LineChart,
    title: "Progress",
    href: "/progress",
    tier: "Pro",
    body: (
      <>
        <p>
          Log weigh-ins, progress photos, and body measurements over time.
          The chart shows your raw weigh-ins plus a smoothed trend weight, so
          you are judged on the trend line, not on a single bad morning on the
          scale. It also projects when you reach your goal weight at your
          current pace.
        </p>
        <p>
          Trend weight is the number to watch: daily scale weight jumps around
          with water and food timing, and the trend smooths that noise out.
        </p>
      </>
    ),
  },
  {
    icon: Target,
    title: "Goals",
    href: "/goals",
    body: (
      <>
        <p>
          Set your goals (lose weight, build muscle, hit a lift) and Chad
          writes them up properly: the target, the pace, and the training plan
          that gets you there. Goal progress shows up on your Dashboard, and
          Chad brings your goals up when you talk to him. Goals and training
          plans download as PDFs.
        </p>
      </>
    ),
  },
  {
    icon: Droplets,
    title: "Hydration",
    href: "/hydration",
    tier: "Pro",
    body: (
      <>
        <p>
          Log your water through the day against a daily target. The Dashboard
          shows how much is left, and Chad sees it when he reviews your day.
        </p>
      </>
    ),
  },
  {
    icon: Moon,
    title: "Sleep",
    href: "/sleep",
    tier: "Pro",
    body: (
      <>
        <p>
          Log how long you slept and how it felt. Sleep is where the muscle
          gets built and the fat gets lost, so it counts toward your streak
          and shows up in your trends, and Chad factors it into his coaching.
        </p>
      </>
    ),
  },
  {
    icon: FileText,
    title: "Weekly Report",
    href: "/reports",
    tier: "Elite",
    body: (
      <>
        <p>
          Every week Chad writes you a full coach's report: what you trained,
          how you ate, where your weight is heading, and exactly what changes
          next week, with reasons pulled from your real logs. It is emailed to
          you and saved on the Weekly Report page, and each report downloads
          as a PDF.
        </p>
        <p>
          Elite members pick the day and time it lands on the{" "}
          <Link
            className="text-foreground underline underline-offset-4"
            href="/account"
          >
            Account page
          </Link>
          .
        </p>
      </>
    ),
  },
  {
    icon: BellRing,
    title: "Check-ins",
    href: "/account",
    tier: "Elite",
    body: (
      <>
        <p>
          Chad reaches out first instead of waiting for you: morning briefs,
          missed-workout callouts, weigh-in nudges. How often he checks in is
          up to you, on the{" "}
          <Link
            className="text-foreground underline underline-offset-4"
            href="/account"
          >
            Account page
          </Link>
          .
        </p>
      </>
    ),
  },
  {
    icon: Share2,
    title: "Sharing a chat",
    href: "/",
    body: (
      <>
        <p>
          Want to show someone Chad's advice? Use the Share button in a chat's
          header to create a public link. Anyone with the link can read that
          conversation, no account needed. Chats stay private until you create
          a link, and you can make one private again anytime.
        </p>
      </>
    ),
  },
];

type PlanRow = {
  name: string;
  price: string;
  summary: string;
};

const PLAN_ROWS: PlanRow[] = [
  {
    name: "Chad Basic",
    price: "$29/month",
    summary:
      "Chat with Chad anytime: personalized workout and nutrition guidance, goals and training plans, and your full coaching history, always saved.",
  },
  {
    name: "Chad Pro",
    price: "$39/month",
    summary:
      "Everything in Basic, plus the full dashboard: the Workouts log, Calorie Tracker with photo and label analysis, Meal Plans, Kitchen ratings, Progress tracking with trend weight and photos, Hydration, and Sleep.",
  },
  {
    name: "Chad Elite",
    price: "$59/month",
    summary:
      "Everything in Pro, plus Chad comes to you: proactive check-ins, the written Weekly Report, and every new feature ships to Elite first.",
  },
];

type Faq = {
  q: string;
  a: React.ReactNode;
};

const FAQS: Faq[] = [
  {
    q: "How do I switch plans or cancel?",
    a: (
      <>
        On the{" "}
        <Link
          className="text-foreground underline underline-offset-4"
          href="/account"
        >
          Account page
        </Link>
        , open "Manage billing". You can move between Basic, Pro, and Elite
        anytime, update your card, or cancel. If you cancel, you keep full
        access through the end of the period you already paid for.
      </>
    ),
  },
  {
    q: "How does Chad remember me?",
    a: (
      <>
        Chad keeps a private profile of what you tell him: your goal, your
        history, your preferences. It is used only to coach you, and you can
        turn memory off in Settings (the menu under your name in the chat
        sidebar). He also reads the data you log
        (workouts, meals, weigh-ins, water, sleep), which is how his coaching
        stays grounded in what you actually did.
      </>
    ),
  },
  {
    q: "Where do the calorie and macro numbers come from?",
    a: (
      <>
        From a verified food database, not from the AI guessing. When you
        photograph a meal, Chad identifies the foods and portions, and the
        macros are looked up. When you photograph a nutrition label, he reads
        the printed numbers off the label itself.
      </>
    ),
  },
  {
    q: "Why does my weight show two different numbers?",
    a: (
      <>
        The bigger number movements are your raw scale weigh-ins; the steadier
        one is your trend weight, a smoothed average that filters out daily
        water and food-timing noise. The trend is the honest signal, and it is
        the number the app uses for your goal progress.
      </>
    ),
  },
  {
    q: 'What does "this week" mean on my stats?',
    a: (
      <>
        The 7-day stats and strips cover the last 7 days, today included, in
        your own time zone, rather than a calendar week that resets on a fixed
        day.
      </>
    ),
  },
  {
    q: "Why is Chad so harsh?",
    a: (
      <>
        Because that is the point. Chad tells you what a good coach tells you:
        the truth, based on what you logged. When he is hard on you, the
        numbers earned it, and when he gives you credit, the numbers earned
        that too.
      </>
    ),
  },
  {
    q: "Is my data mine?",
    a: (
      <>
        Yes. Export your logged data as CSV from the{" "}
        <Link
          className="text-foreground underline underline-offset-4"
          href="/account"
        >
          Account page
        </Link>{" "}
        anytime, and your chats stay private unless you create a share link
        yourself.
      </>
    ),
  },
];

type TroubleshootingRow = {
  problem: string;
  fix: React.ReactNode;
};

const TROUBLESHOOTING: TroubleshootingRow[] = [
  {
    problem: "Chad's emails aren't arriving",
    fix: (
      <>
        They come from noreply@send.chadcoach.ai. Check your spam folder and
        mark the message "Not spam" so the next one lands in your inbox.
      </>
    ),
  },
  {
    problem: "A photo upload fails",
    fix: (
      <>
        Retry once (mobile connections drop mid-upload), and if it keeps
        failing try a smaller photo or a screenshot of it. Photo features need
        a Pro or Elite plan.
      </>
    ),
  },
  {
    problem: "My day rolls over at the wrong time, or dates look off",
    fix: (
      <>
        Your time zone decides when "today" ends for streaks and logs. It is
        detected from your browser and shown on the{" "}
        <Link
          className="text-foreground underline underline-offset-4"
          href="/account"
        >
          Account page
        </Link>{" "}
        under Preferences; correct it there if it is wrong.
      </>
    ),
  },
  {
    problem: "Chad has something wrong about me",
    fix: (
      <>
        Tell him directly in chat ("my squat max is 315, not 275") and he
        updates what he remembers. For your height, age, and stats, edit the
        profile on the Account page.
      </>
    ),
  },
  {
    problem: "Something else is broken or confusing",
    fix: (
      <>
        Ask Chad in chat; he knows the app and can walk you through any
        feature. Look for the small "?" icons next to stats around the
        dashboard too; they explain what each number means.
      </>
    ),
  },
];

const TOC = [
  { href: "#getting-started", label: "Getting started" },
  { href: "#features", label: "Features" },
  { href: "#plans", label: "Plans & billing" },
  { href: "#data", label: "Your data & privacy" },
  { href: "#troubleshooting", label: "Troubleshooting" },
  { href: "#faq", label: "FAQ" },
];

function SectionHeading({
  icon: Icon,
  id,
  title,
}: {
  icon: LucideIcon;
  id: string;
  title: string;
}) {
  return (
    <h2
      className="mb-4 flex scroll-mt-24 items-center gap-2 font-display font-semibold text-xl tracking-tight"
      id={id}
    >
      <Icon className="size-5 text-blood" />
      {title}
    </h2>
  );
}

export default function HelpPage() {
  return (
    <PageShell>
      <StandaloneHeader active="/help" />

      <div className="mb-8">
        <h1 className="font-display font-bold text-3xl tracking-tight">
          Help
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
          The short version: tell Chad what you want, do the work, log it, and
          let him keep you honest. Everything else is below. If you'd rather
          just ask, Chad can explain any part of the app in chat.
        </p>
        <nav className="mt-4 flex flex-wrap gap-2">
          {TOC.map((item) => (
            <a
              className="rounded-full border border-border bg-card px-3 py-1.5 text-muted-foreground text-xs transition-colors hover:text-foreground"
              href={item.href}
              key={item.href}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>

      {/* Getting started */}
      <section className="mb-10">
        <SectionHeading
          icon={Rocket}
          id="getting-started"
          title="Getting started"
        />
        <div className="rounded-2xl border border-border bg-card p-6">
          <ol className="flex flex-col gap-4">
            {[
              {
                title: "Tell Chad about yourself",
                body: "Open a chat and give him the real picture: your goal, your training history, injuries, equipment, and schedule. He remembers all of it, so you only say it once.",
              },
              {
                title: "Set a goal",
                body: "Ask Chad for one, or set it on the Goals page. He turns it into a written plan with a target and a pace, and it anchors everything else in the app.",
              },
              {
                title: "Log as you go",
                body: "Workouts after training, meals when you eat (a photo is enough), a weigh-in in the morning, water and sleep when you think of it. Logging takes seconds and it is the raw material for all of Chad's coaching.",
              },
              {
                title: "Check the Dashboard, take the heat",
                body: "The Dashboard shows where today stands, and Chad reviews everything you log. Hit your numbers and he says so. Miss them and he says that too.",
              },
            ].map((step, i) => (
              <li className="flex gap-4" key={step.title}>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-blood/10 font-semibold text-blood text-sm">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-medium text-sm">{step.title}</h3>
                  <p className="mt-1 text-muted-foreground text-sm leading-relaxed">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Features */}
      <section className="mb-10">
        <SectionHeading icon={LayoutDashboard} id="features" title="Features" />
        <p className="mb-4 max-w-2xl text-muted-foreground text-sm">
          Every section of the app, by the same name the navigation uses.
          Features marked Pro or Elite are included in that plan and above.
        </p>
        <div className="flex flex-col gap-4">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <section
                className="rounded-2xl border border-border bg-card p-6"
                key={feature.title}
              >
                <h3 className="mb-2 flex items-center gap-2 font-medium text-lg">
                  <Icon className="size-5 text-blood" />
                  <Link
                    className="transition-colors hover:text-blood"
                    href={feature.href}
                  >
                    {feature.title}
                  </Link>
                  {feature.tier && (
                    <Badge variant="secondary">{feature.tier}</Badge>
                  )}
                </h3>
                <div className="flex flex-col gap-2.5 text-muted-foreground text-sm leading-relaxed">
                  {feature.body}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      {/* Plans & billing */}
      <section className="mb-10">
        <SectionHeading icon={CreditCard} id="plans" title="Plans & billing" />
        <div className="flex flex-col gap-4">
          {PLAN_ROWS.map((plan) => (
            <div
              className="rounded-2xl border border-border bg-card p-6"
              key={plan.name}
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="font-medium text-lg">{plan.name}</h3>
                <span className="text-muted-foreground text-sm">
                  {plan.price}
                </span>
              </div>
              <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
                {plan.summary}
              </p>
            </div>
          ))}
          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="font-medium text-lg">Managing your membership</h3>
            <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
              Everything billing lives on the{" "}
              <Link
                className="text-foreground underline underline-offset-4"
                href="/account"
              >
                Account page
              </Link>
              : see your current plan and renewal date, update your card, move
              between Basic, Pro, and Elite, or cancel. Payments are handled
              securely by Stripe; Chad never sees your card. If you cancel, you
              keep access through the end of the period you've paid for.
            </p>
          </div>
        </div>
      </section>

      {/* Your data & privacy */}
      <section className="mb-10">
        <SectionHeading icon={Download} id="data" title="Your data & privacy" />
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-col gap-3 text-muted-foreground text-sm leading-relaxed">
            <p>
              Your logged data is yours. Download it as CSV from the{" "}
              <Link
                className="text-foreground underline underline-offset-4"
                href="/account"
              >
                Account page
              </Link>{" "}
              and take it anywhere.
            </p>
            <p>
              What Chad remembers about you from your chats is used only to
              coach you, and you can switch memory off (or wipe it) in
              Settings, in the menu under your name in the chat sidebar.
              Your conversations are private unless you create a share link
              yourself, and a share link can be revoked anytime.
            </p>
          </div>
        </div>
      </section>

      {/* Troubleshooting */}
      <section className="mb-10">
        <SectionHeading
          icon={Wrench}
          id="troubleshooting"
          title="Troubleshooting"
        />
        <div className="flex flex-col gap-4">
          {TROUBLESHOOTING.map((row) => (
            <div
              className="rounded-2xl border border-border bg-card p-6"
              key={row.problem}
            >
              <h3 className="font-medium text-sm">{row.problem}</h3>
              <p className="mt-1.5 text-muted-foreground text-sm leading-relaxed">
                {row.fix}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mb-10">
        <SectionHeading icon={HelpCircle} id="faq" title="FAQ" />
        <div className="flex flex-col gap-3">
          {FAQS.map((faq) => (
            <details
              className="group rounded-2xl border border-border bg-card"
              key={faq.q}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-medium text-sm [&::-webkit-details-marker]:hidden">
                {faq.q}
                <span className="shrink-0 text-muted-foreground text-xs group-open:hidden">
                  Show
                </span>
                <span className="hidden shrink-0 text-muted-foreground text-xs group-open:inline">
                  Hide
                </span>
              </summary>
              <p className="border-border border-t p-5 text-muted-foreground text-sm leading-relaxed">
                {faq.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      <div className="rounded-2xl border border-border border-dashed bg-card p-6 text-center">
        <h2 className="font-medium text-lg">Still stuck?</h2>
        <p className="mx-auto mt-1 max-w-md text-muted-foreground text-sm">
          Ask Chad directly. He can walk you through anything in the app, or
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
