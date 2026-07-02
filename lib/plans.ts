import {
  BellRing,
  Camera,
  FileText,
  type LucideIcon,
  Rocket,
  Sparkles,
  Zap,
} from "lucide-react";
import type { PlanTier } from "./subscription";

export type PlanFeature = {
  label: string;
  /** Not built yet — rendered with a "coming soon" qualifier. */
  soon?: boolean;
};

export type ProPerk = PlanFeature & { icon: LucideIcon };

/**
 * The Pro-only perks — what a Basic member gains by upgrading. Single source of
 * truth: the marketing pricing cards (Pro plan), the in-app /account upgrade
 * card, and anywhere else that lists "what Pro gets you" all read from here, so
 * the list can never drift between surfaces. Icons are consumed by the upgrade
 * card; the plain pricing list ignores them and uses a generic check.
 */
export const PRO_PERKS: ProPerk[] = [
  { icon: Camera, label: "Progress photo analysis — Chad reviews your form" },
  {
    icon: Sparkles,
    label: "Custom workout & meal plans built for you",
  },
  { icon: Zap, label: "Highest-priority access to Chad" },
];

/**
 * The Elite-only perks — what a Pro member gains by moving up (ACC-17). Elite
 * is strictly additive on top of Pro: E1 proactive check-ins (FEAT-11), E2 the
 * weekly report (FEAT-12), and permanent early access. Same single-source rule
 * as PRO_PERKS: the pricing cards and the /account upgrade card both read this.
 */
export const ELITE_PERKS: ProPerk[] = [
  {
    icon: BellRing,
    label:
      "Chad checks in first — morning brief, missed-workout callouts, weigh-in nudges",
  },
  {
    icon: FileText,
    label:
      "Your weekly report — a full written review of your week + next week's adjustments",
  },
  { icon: Rocket, label: "Every new feature ships to Elite first" },
];

export const BASIC_FEATURES: PlanFeature[] = [
  { label: "Chat with Chad anytime, day or night" },
  { label: "Personalized workout & nutrition guidance" },
  { label: "Form tips, motivation & real accountability" },
  { label: "Your full coaching history, always saved" },
];

export type MarketingPlan = {
  tier: PlanTier;
  name: string;
  price: string;
  tagline: string;
  features: PlanFeature[];
  highlighted?: boolean;
};

/**
 * Display copy for the pricing cards. The price strings here are marketing
 * labels that mirror the authoritative billing config (Stripe price ids +
 * `monthlyPriceLabel`) in `lib/stripe.ts` — that module is server-only, so it
 * can't be imported into the client pricing component. Keep the two in sync.
 */
export const MARKETING_PLANS: MarketingPlan[] = [
  {
    tier: "basic",
    name: "Chad Basic",
    price: "$29",
    tagline: "Your always-on coach.",
    features: BASIC_FEATURES,
  },
  {
    tier: "pro",
    name: "Chad Pro",
    price: "$39",
    tagline: "The complete Chad experience.",
    highlighted: true,
    features: [{ label: "Everything in Basic" }, ...PRO_PERKS],
  },
  {
    tier: "elite",
    name: "Chad Elite",
    price: "$59",
    tagline: "Maximum accountability. Chad comes to you.",
    features: [{ label: "Everything in Pro" }, ...ELITE_PERKS],
  },
];
