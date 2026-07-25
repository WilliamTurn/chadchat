import { Crown, Sparkles, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/app/(auth)/auth";
import { CheckInSettings } from "@/components/account/check-in-settings";
import { DeleteDataButton } from "@/components/account/delete-data-button";
import { ExerciseCaloriesSettings } from "@/components/account/exercise-calories-settings";
import { IntensitySettings } from "@/components/account/intensity-settings";
import { MemorySettings } from "@/components/account/memory-settings";
import { QuitDateSettings } from "@/components/account/quit-date-settings";
import { SensorySettings } from "@/components/account/sensory-settings";
import {
  SettingsLinkRow,
  SettingsRow,
  SettingsZone,
} from "@/components/account/settings-row";
import { TimezonePreference } from "@/components/account/timezone-preference";
import { UnitPreference } from "@/components/account/unit-preference";
import { WeeklyReportSettings } from "@/components/account/weekly-report-settings";
import { PageShell } from "@/components/nav/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { canAccessEliteFeatures } from "@/lib/admin";
import { sanitizeCheckInDays } from "@/lib/checkins/schedule";
import { getUserById } from "@/lib/db/queries";
import { ELITE_PERKS, PRO_PERKS } from "@/lib/plans";
import { PLANS } from "@/lib/stripe";
import { hasActiveAccess } from "@/lib/subscription";
import { formatBillingDate, formatBillingDateShort } from "@/lib/date";
import { openBillingPortal, startPlanChange } from "./actions";

/**
 * The "cancel anytime" phrase as a real submit button (ACC-21). Rendered inside
 * a form whose action is `openBillingPortal`, so the promise is one click away
 * instead of making the member hunt through the billing page.
 */
function CancelAnytimeButton({ capitalized }: { capitalized?: boolean }) {
  return (
    <button
      aria-label="Cancel anytime in the billing page"
      className="underline underline-offset-4 transition-colors hover:text-foreground"
      type="submit"
    >
      {capitalized ? "Cancel anytime" : "cancel anytime"}
    </button>
  );
}


/**
 * /account, the Form/settings archetype (composition canon 05 §6): grouped
 * rows under spaced-caps zone headers on the bare page surface — no boxed
 * panels (05 #52; canon 01 #38: topical grouping earns no container; north
 * star: cardless). Zones separated by header + whitespace (the sanctioned
 * pair, canon 06 #4); rows inside a zone by hairline dividers (rung 4).
 * Desktop keeps the LAY-1 full-page frame (owner law, s177/s178) with two
 * independently packed zone columns; each column caps at a readable band so
 * label/control pairing survives the width (canon 08 #48, 02 #44). Phones
 * stack: membership → profile → preferences → data → delete, with the
 * destructive zone isolated last (05 #57).
 */
export default function AccountPage() {
  return (
    <PageShell active="/account" className="max-w-[1500px]">
      <div className="mb-8">
        <h1 className="font-semibold text-2xl tracking-tight">Account</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Your membership, profile, preferences, and data.
        </p>
      </div>

      <Suspense
        fallback={
          <SettingsZone title="Membership">
            <MembershipSkeleton />
          </SettingsZone>
        }
      >
        <AccountZones />
      </Suspense>
    </PageShell>
  );
}

/**
 * All zones, one member fetch. Phone renders one column in canonical order
 * (membership → profile → emails → preferences → intensity → data → delete,
 * destructive last, canon 05 #57) via `order-*` on the flattened zones; at lg
 * the `display: contents` wrappers materialize into two real columns packed
 * for near-equal height on every tier (canon 02 #21: no content-free column
 * tail), keeping the owner's LAY-1 full-page frame. items-start (ACC-22):
 * columns keep their natural height. Zone beat: 56px phones, 96px desktop
 * (canon 06 #8).
 */
async function AccountZones() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const user = await getUserById(session.user.id);
  if (!user) {
    redirect("/login");
  }

  const usesCustomPhoto = user.heroFigure === "custom" && user.heroImageUrl;
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  // Every log the app collects is here (LC-16) — "your data" that skipped
  // hydration, sleep, and measurements was only half the promise.
  const exports: { dataset: string; label: string }[] = [
    { dataset: "weighins", label: "Weigh-ins" },
    { dataset: "meals", label: "Nutrition" },
    { dataset: "workouts", label: "Workouts" },
    { dataset: "hydration", label: "Hydration" },
    { dataset: "sleep", label: "Sleep" },
    { dataset: "measurements", label: "Measurements" },
  ];

  return (
    <div className="flex flex-col gap-14 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-16">
      <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-24">
        <SettingsZone className="order-1" title="Membership">
          <MembershipZone user={user} />
        </SettingsZone>

        <SettingsZone className="order-2" title="Profile">
          {/* The stats form lives on its own sub-screen so this surface stays
              purely instant-apply (canon 05 #56: commit models never mix). A
              multi-field row shows supporting text, not a concatenated value
              (Hevy/MyFitnessPal/Strava convention; canon 05 #53). */}
          <SettingsLinkRow
            href="/account/profile"
            label="Your stats"
            supporting="Sex, age, height, activity, experience, goals, and training days."
          />
          <SettingsLinkRow
            href="/account/appearance"
            label="Appearance"
            supporting="The figure that represents you: a silhouette or your own photo."
            value={usesCustomPhoto ? "Your photo" : "Silhouette"}
          />
        </SettingsZone>

        {/* Proactive check-ins (FEAT-11) + the weekly report (FEAT-12) —
            Elite only, so members who don't have the features never see a
            dead control. */}
        {canAccessEliteFeatures(user) && (
          <SettingsZone
            className="order-3"
            footer={
              <>
                Chad&apos;s emails come from noreply@send.chadcoach.ai. If one
                doesn&apos;t arrive, check spam and mark it &quot;Not
                spam&quot;.
              </>
            }
            title="Emails from Chad"
          >
            <CheckInSettings
              initialDays={sanitizeCheckInDays(user.checkInDays)}
              initialEnabled={user.checkInsEnabled}
              initialEveningHour={user.checkInEveningHour}
              initialFrequency={user.checkInFrequency}
              initialMorningHour={user.checkInMorningHour}
            />
            <WeeklyReportSettings
              initialDay={user.weeklyReportDay}
              initialEnabled={user.weeklyReportsEnabled}
              initialHour={user.weeklyReportHour}
            />
          </SettingsZone>
        )}

        <SettingsZone className="order-6" title="Your data">
          <SettingsRow
            label="Export as CSV"
            supporting="Download any of your logs, yours to take anywhere."
          >
            {/* A fixed chip grid so no dataset ever orphan-wraps alone
                (canon 07 #13). Accessible names carry the action the bare
                nouns omit (canon 04 §128, §140). */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {exports.map(({ dataset, label }) => (
                <Button asChild key={dataset} variant="outline">
                  <a
                    aria-label={`Export ${label.toLowerCase()} as CSV`}
                    download
                    href={`${basePath}/api/me/export?dataset=${dataset}`}
                  >
                    {label}
                  </a>
                </Button>
              ))}
            </div>
          </SettingsRow>
        </SettingsZone>

        {/* Delete everything (owner ask, s157): the member's one-button wipe.
            Its own final zone, isolated from every safe action by position
            and spacing (canon 05 #57). */}
        <SettingsZone className="order-7" title="Delete your data">
          <div className="py-4">
            <p className="text-muted-foreground text-sm">
              Permanently deletes your chats, logs, photos, and everything
              Chad has recorded about you. Your account and membership stay.
            </p>
            <div className="mt-4">
              <DeleteDataButton />
            </div>
          </div>
        </SettingsZone>
      </div>

      <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-24">
        {/* Ordered by frequency of use (canon 05 #54). */}
        <SettingsZone className="order-4" title="Preferences">
          <UnitPreference initialUnit={user.weightUnit} />
          <TimezonePreference initialTimezone={user.timezone} />
          <ExerciseCaloriesSettings
            initialEnabled={user.exerciseCalorieAddBack}
          />
          <SensorySettings
            initialHaptics={user.hapticsEnabled}
            initialSound={user.soundEnabled}
          />
          <MemorySettings initialEnabled={user.memoryEnabled} />
          <QuitDateSettings initialEnabled={user.quitDateEnabled} />
        </SettingsZone>

        {/* Chad's intensity is its own zone: three described option tiles
            outgrew the settings-row rhythm (canon 06 #8/#9: the zone beat
            must stay ≥2x the row beat). */}
        <SettingsZone className="order-5" title="Chad's intensity">
          <IntensitySettings initialIntensity={user.chadIntensity} />
        </SettingsZone>
      </div>
    </div>
  );
}

/** Flat loading placeholder mirroring the membership zone's real shape (plan
 *  line, status line, action row), so the page doesn't reflow when data
 *  lands — no card chrome (canon 01 #73: states keep their group's rung). */
function MembershipSkeleton() {
  return (
    <div className="py-4">
      <div className="flex items-center gap-3">
        <div className="h-6 w-32 animate-pulse rounded-md bg-muted-foreground/20" />
        <div className="h-5 w-16 animate-pulse rounded-full bg-muted-foreground/20" />
      </div>
      <div className="mt-3 h-4 w-64 max-w-full animate-pulse rounded bg-muted-foreground/20" />
      <div className="mt-6 flex gap-3">
        <div className="h-9 w-32 animate-pulse rounded-lg bg-muted-foreground/20" />
        <div className="h-9 w-28 animate-pulse rounded-lg bg-muted-foreground/20" />
      </div>
    </div>
  );
}

function MembershipZone({
  user,
}: {
  user: NonNullable<Awaited<ReturnType<typeof getUserById>>>;
}) {
  const hasAccess = hasActiveAccess(user);
  const tier = user.subscriptionTier;
  // A lapsed row can still carry its old tier; only name the plan while it is
  // actually usable, so the zone never reads "Chad Pro" next to a no-plan
  // status line (ACC-29).
  const planName = tier && hasAccess ? PLANS[tier].name : "No active plan";
  const priceLabel = tier ? PLANS[tier].monthlyPriceLabel : null;
  const status = user.subscriptionStatus;

  // Revenue at risk: a failed payment is one card update away from a churned
  // member, so the status renders as a destructive interjection banner (the
  // one container this zone earns, canon 01 #43) and the primary action
  // becomes "Update payment".
  const isPastDue = status === "past_due";

  // Members with live access who can move up a tier. Each upgrade goes through
  // Stripe's hosted plan-change flow (no second subscription). Basic sees the
  // Pro card (the primary path); Pro sees the Elite card (ACC-17). A past-due
  // member sees no upsell: fixing the payment is the one job on screen.
  const canUpgradeToPro = hasAccess && tier === "basic" && !isPastDue;
  const canUpgradeToElite = hasAccess && tier === "pro" && !isPastDue;

  const isCancelling = Boolean(
    hasAccess &&
      status === "active" &&
      user.cancelAtPeriodEnd &&
      user.currentPeriodEnd
  );

  // A member with live access but no Stripe record (comped/admin-granted) has
  // nothing to manage and must never be told to choose a plan they have, be
  // promised a renewal charge, or be upsold a Stripe plan change.
  const isComped = hasAccess && !user.stripeCustomerId;

  // Status lines never interpolate a missing date or price — each state
  // branches to a value-free variant instead (missing-said-plainly; the old
  // fallback rendered a bare dash glyph). A comped row never promises a
  // charge the no-payment-method fine print contradicts (canon 06 §165).
  let statusLine: string;
  if (!(hasAccess || isPastDue)) {
    statusLine = "Choose a plan to start training with Chad.";
  } else if (isComped) {
    statusLine = "Your plan is active. No renewal is scheduled.";
  } else if (status === "trialing") {
    // The "Free trial" badge already names the state, so the line starts at
    // the fact (canon 04 §130).
    const trialEnd = user.trialEndsAt ?? user.currentPeriodEnd;
    if (trialEnd && priceLabel) {
      statusLine = `First charge of ${priceLabel} on ${formatBillingDate(trialEnd)}.`;
    } else if (priceLabel) {
      statusLine = `Your first charge is ${priceLabel} when the trial ends.`;
    } else if (trialEnd) {
      statusLine = `Your first charge lands on ${formatBillingDate(trialEnd)}.`;
    } else {
      statusLine = "Free trial.";
    }
  } else if (isCancelling && user.currentPeriodEnd) {
    statusLine = `Ends ${formatBillingDate(user.currentPeriodEnd)}. You keep full access until then, and you can resume from Manage billing any time before that date.`;
  } else if (status === "active") {
    if (user.currentPeriodEnd) {
      statusLine = priceLabel
        ? `${priceLabel}/month. Renews on ${formatBillingDate(user.currentPeriodEnd)}.`
        : `Renews on ${formatBillingDate(user.currentPeriodEnd)}.`;
    } else {
      statusLine = "Your plan is active. No renewal is scheduled.";
    }
  } else if (isPastDue) {
    statusLine = "Your last payment failed. Update your card to keep your access.";
  } else {
    statusLine = "Choose a plan to start training with Chad.";
  }

  return (
    <div className="flex flex-col gap-5 py-4">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-medium text-lg">{planName}</span>
          {hasAccess && status === "trialing" && (
            <Badge variant="secondary">Free trial</Badge>
          )}
          {isCancelling && user.currentPeriodEnd ? (
            <Badge variant="secondary">
              Ends {formatBillingDateShort(user.currentPeriodEnd)}
            </Badge>
          ) : (
            hasAccess && status === "active" && <Badge>Active</Badge>
          )}
          {isPastDue && <Badge variant="destructive">Payment needed</Badge>}
        </div>

        {isPastDue ? (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 font-medium text-foreground text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
            <span>{statusLine}</span>
          </p>
        ) : (
          <p className="mt-2 text-muted-foreground text-sm">{statusLine}</p>
        )}

        {/* Membership actions only: navigation to Chad lives in the app
            chrome, never duplicated here (canon 08 #15/#16). */}
        {(user.stripeCustomerId || !hasAccess) && (
          <div className="mt-5 flex flex-wrap gap-3">
            {user.stripeCustomerId ? (
              <form action={openBillingPortal}>
                <Button
                  type="submit"
                  variant={
                    isPastDue
                      ? "destructive"
                      : canUpgradeToPro || canUpgradeToElite
                        ? "outline"
                        : "default"
                  }
                >
                  {isPastDue ? "Update payment" : "Manage billing"}
                </Button>
              </form>
            ) : (
              <Button asChild>
                <Link href="/pricing">Choose a plan</Link>
              </Button>
            )}

            {!hasAccess && user.stripeCustomerId && (
              // "See plans" only when the primary isn't already "Choose a
              // plan": two buttons to /pricing would be one action twice.
              <Button asChild variant="outline">
                <Link href="/pricing">See plans</Link>
              </Button>
            )}
          </div>
        )}

        {/* The qualifier sits with the block it qualifies, never below the
            promo (canon 08 #34, #38). */}
        {user.stripeCustomerId ? (
          // "cancel anytime" is a real one-click promise (ACC-21): the
          // phrase itself opens the Stripe billing portal.
          <form action={openBillingPortal}>
            <p className="mt-3 text-muted-foreground text-xs">
              Stripe handles billing securely. Update your card, switch
              plans, or <CancelAnytimeButton />.
            </p>
          </form>
        ) : (
          isComped && (
            <p className="mt-3 text-muted-foreground text-xs">
              No payment method is on file for this membership. Questions
              about plans go to{" "}
              <Link
                className="underline underline-offset-4 transition-colors hover:text-foreground"
                href="/help#plans"
              >
                Plans &amp; billing
              </Link>
              .
            </p>
          )
        )}
      </div>

      {/* The upsell renders LAST in its zone, below the member's own plan
          facts and their fine print: the zone's protagonist is the plan, not
          the promo (canon 05 #2, #54). */}
      {canUpgradeToPro && (
        <UpgradeToProCard price={PLANS.pro.monthlyPriceLabel} />
      )}
      {canUpgradeToElite && (
        <UpgradeToEliteCard price={PLANS.elite.monthlyPriceLabel} />
      )}
    </div>
  );
}

/**
 * The in-app upgrade path for Basic members. Without this, a Basic user who
 * comes to "manage their account" hits a dead end. The button posts to the
 * `startPlanChange` server action, which opens Stripe's hosted plan-change
 * flow (real proration, no duplicate subscription). The bordered container is
 * EARNED: a promotional unit is provenance-marked so members see exactly
 * where the offer begins and ends (canon 01 #41).
 */
function UpgradeToProCard({ price }: { price: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-blood/40 bg-card p-5">
      <div className="relative">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-blood" />
          <h3 className="font-semibold text-base tracking-tight">
            Upgrade to Chad Pro
          </h3>
        </div>
        <p className="mt-1.5 text-muted-foreground text-sm">
          Everything in Basic, plus Future You, form reviews, and custom
          workout &amp; meal plans.
        </p>

        <ul className="mt-4 flex flex-col gap-2.5">
          {PRO_PERKS.map(({ icon: Icon, label, soon }) => (
            <li className="flex items-start gap-2.5 text-sm" key={label}>
              <Icon className="mt-0.5 size-4 shrink-0 text-blood" />
              <span>
                {label}
                {soon && (
                  <span className="ml-1.5 text-muted-foreground text-xs">
                    (coming soon)
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>

        {/* The price lives in the fine print, not the button, so the label
            can never clip at 320px (canon 03 #18; the pinned defect). */}
        <form action={startPlanChange}>
          <Button
            className="mt-5 w-full gap-1.5 sm:w-auto"
            size="lg"
            type="submit"
          >
            <Sparkles className="size-4" />
            Upgrade to Pro
          </Button>
        </form>
        <form action={openBillingPortal}>
          <p className="mt-2.5 text-muted-foreground text-xs">
            {price}/month. You&apos;ll see the exact prorated amount before
            you confirm. Billed securely by Stripe.{" "}
            <CancelAnytimeButton capitalized />.
          </p>
        </form>
      </div>
    </div>
  );
}

/**
 * The Pro→Elite upgrade path (ACC-17). Same hosted plan-change flow as the
 * Basic→Pro card. Deliberately NOT red — red stays Pro's "pick me" color; the
 * Elite card reads premium via the neutral bone/white accent instead. Earned
 * container: promotional unit (canon 01 #41).
 */
function UpgradeToEliteCard({ price }: { price: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-foreground/25 bg-card p-5">
      <div className="relative">
        <div className="flex items-center gap-2">
          <Crown className="size-4" />
          <h3 className="font-semibold text-base tracking-tight">
            Upgrade to Chad Elite
          </h3>
        </div>
        <p className="mt-1.5 text-muted-foreground text-sm">
          Chad reaches out first: morning briefs, missed-workout callouts, and
          a written weekly report.
        </p>

        <ul className="mt-4 flex flex-col gap-2.5">
          {ELITE_PERKS.map(({ icon: Icon, label }) => (
            <li className="flex items-start gap-2.5 text-sm" key={label}>
              <Icon className="mt-0.5 size-4 shrink-0" />
              <span>{label}</span>
            </li>
          ))}
        </ul>

        {/* Price in the fine print, never the button (canon 03 #18). */}
        <form action={startPlanChange}>
          <Button
            className="mt-5 w-full gap-1.5 sm:w-auto"
            size="lg"
            type="submit"
            variant="outline"
          >
            <Crown className="size-4" />
            Upgrade to Elite
          </Button>
        </form>
        <form action={openBillingPortal}>
          <p className="mt-2.5 text-muted-foreground text-xs">
            {price}/month. You&apos;ll see the exact prorated amount before
            you confirm. Billed securely by Stripe.{" "}
            <CancelAnytimeButton capitalized />.
          </p>
        </form>
      </div>
    </div>
  );
}
