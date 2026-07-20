import {
  Camera,
  CreditCard,
  Droplets,
  Dumbbell,
  FileText,
  FolderOpen,
  HelpCircle,
  LayoutDashboard,
  LineChart,
  type LucideIcon,
  MessageSquare,
  Moon,
  Refrigerator,
  Skull,
  Sparkles,
  Target,
  UtensilsCrossed,
  Weight,
} from "lucide-react";
import { ROUTES, type RouteId } from "@/lib/contracts/routes";

/**
 * Single source of truth for in-app section navigation (NAV-3, FIX-20).
 *
 * As of P3 (FIX-20) this file is a CONSUMER of the route registry
 * (`lib/contracts/routes.ts`): every path, label, and nav group comes from
 * the registry; this file only adds what the registry deliberately does not
 * carry: icons, surface visibility, and render order. The drift test in
 * `tests/unit/contracts.test.ts` asserts the two can never disagree.
 *
 * Surfaces (`surfaces`):
 * - `header`  → the StandaloneSidebar/StandaloneHeader nav on /home,
 *   /nutrition, /progress, … (desktop panel + phone sheet).
 * - `sidebar` → the chat sidebar (NAV-31: the full feature inventory, so the
 *   product is discoverable from the chat landing). Chat stays header-only
 *   (the sidebar IS chat) and Account stays header-only (the sidebar footer
 *   user menu already carries Account + sign-out).
 *
 * Groups (FIX-20, from the registry's `proposedNavGroup`): both desktop navs
 * render the links grouped Primary / Track / Plan / Review / Utility instead
 * of one flat feature-history list. Order below is the render order within
 * each group on every surface.
 */
export type NavSurface = "header" | "sidebar";

export type NavGroupId = "primary" | "track" | "plan" | "review" | "utility";

export type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  surfaces: NavSurface[];
  group: NavGroupId;
};

/**
 * Icons + surfaces + order for every navigable destination. Paths, labels,
 * and groups resolve from the registry at build below; adding a route here
 * without registering it fails the drift test.
 */
const NAV_CONFIG: { route: RouteId; icon: LucideIcon; surfaces: NavSurface[] }[] = [
  // primary
  { route: "/home", icon: LayoutDashboard, surfaces: ["header", "sidebar"] },
  { route: "/", icon: MessageSquare, surfaces: ["header"] },
  // track
  { route: "/workouts", icon: Dumbbell, surfaces: ["header", "sidebar"] },
  { route: "/nutrition", icon: Camera, surfaces: ["header", "sidebar"] },
  { route: "/hydration", icon: Droplets, surfaces: ["header", "sidebar"] },
  { route: "/sleep", icon: Moon, surfaces: ["header", "sidebar"] },
  // plan
  { route: "/goals", icon: Target, surfaces: ["header", "sidebar"] },
  { route: "/meal-plan", icon: UtensilsCrossed, surfaces: ["header", "sidebar"] },
  // review
  { route: "/progress", icon: LineChart, surfaces: ["header", "sidebar"] },
  { route: "/future-you", icon: Sparkles, surfaces: ["header", "sidebar"] },
  { route: "/reports", icon: FileText, surfaces: ["header", "sidebar"] },
  // utility
  { route: "/kitchen", icon: Refrigerator, surfaces: ["header", "sidebar"] },
  { route: "/files", icon: FolderOpen, surfaces: ["header", "sidebar"] },
  // DEC-03 (DECIDED 2026-07-13): the Quit Test gets its owned destination
  // registered in nav as a utility entry. Relocation only; its Today
  // promotion is untouched until the P6 Today rebuild.
  { route: "/quit-date", icon: Skull, surfaces: ["header", "sidebar"] },
  { route: "/account", icon: CreditCard, surfaces: ["header"] },
  { route: "/help", icon: HelpCircle, surfaces: ["header", "sidebar"] },
];

export const NAV_LINKS: NavLink[] = NAV_CONFIG.map(
  ({ route, icon, surfaces }) => {
    const def = ROUTES[route];
    return {
      href: def.path,
      label: def.name,
      icon,
      surfaces,
      // The registry drives grouping; ungrouped routes default to utility.
      group: ("proposedNavGroup" in def ? def.proposedNavGroup : undefined) ?? "utility",
    };
  }
);

export type NavGroup = {
  id: NavGroupId;
  /**
   * Member-facing group heading; null renders unlabeled. The primary group
   * needs no caption, and the utility group renders as the standard
   * uncaptioned trailing block (the Linear pattern): "Utility" is internal
   * vocabulary, and captioning it "More" collided with the More tab/sheet.
   */
  label: string | null;
  links: NavLink[];
};

const GROUP_DEFS: { id: NavGroupId; label: string | null }[] = [
  { id: "primary", label: null },
  { id: "track", label: "Track" },
  { id: "plan", label: "Plan" },
  { id: "review", label: "Review" },
  { id: "utility", label: null },
];

export const NAV_GROUPS: NavGroup[] = GROUP_DEFS.map((g) => ({
  ...g,
  links: NAV_LINKS.filter((link) => link.group === g.id),
}));

export const headerLinks = NAV_LINKS.filter((link) =>
  link.surfaces.includes("header")
);

/* `sidebarLinks` was removed in RC-11: it had no consumers. The chat sidebar
 * filters NAV_GROUPS by surface itself (components/chat/app-sidebar.tsx), so
 * the export was a second, silently diverging source of the same list. */

/**
 * Selected state for nav surfaces (FIX-20): a subroute highlights its section
 * (/workouts/history → Workouts). Chat is special-cased because conversations
 * live at /chat/[id] while the section href is "/".
 */
export function isRouteActive(
  pathname: string | null | undefined,
  href: string
): boolean {
  if (!pathname) {
    return false;
  }
  if (href === "/") {
    return pathname === "/" || pathname.startsWith("/chat");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/* --------------------------------------------------------------------------
 * FIX-21 / DEC-01 (DECIDED 2026-07-13): the persistent phone bottom nav.
 * Tabs are Today / Log / Progress / Coach / More, in exactly that owner-
 * decided order. Labels here are the owner's tab wording, not registry
 * display names (the registry names the destinations; DEC-01 names the tabs).
 * ------------------------------------------------------------------------ */

export type BottomTab =
  | { kind: "route"; href: string; label: string; icon: LucideIcon }
  | { kind: "log"; label: string }
  | { kind: "more"; label: string };

export const BOTTOM_NAV_TABS: BottomTab[] = [
  // RC-11 (Q-D): the tab labels now match the registry names they point at, so
  // one destination is never called two things. "Today" became Home with the
  // /today → /home rename; "Coach" became Chad (owner ruling 2026-07-19).
  { kind: "route", href: "/home", label: "Home", icon: LayoutDashboard },
  { kind: "log", label: "Log" },
  { kind: "route", href: "/progress", label: "Progress", icon: LineChart },
  { kind: "route", href: "/", label: "Chad", icon: MessageSquare },
  { kind: "more", label: "More" },
];

/**
 * The Log tab's picker (DEC-01: Meal / Water / Sleep / Weight / Workout, an
 * ADDITIONAL path to each domain's existing logger, never a replacement).
 * Meal and weigh-in target the registered in-page logger anchors
 * (`routes.ts` anchors); hydration and sleep log at the top of their pages.
 */
export const LOG_ACTIONS: { label: string; href: string; icon: LucideIcon }[] =
  [
    { label: "Log a meal", href: "/nutrition#log-meal", icon: UtensilsCrossed },
    { label: "Log water", href: "/hydration", icon: Droplets },
    { label: "Log sleep", href: "/sleep", icon: Moon },
    // FIX-31 (P5, DEC-02): the weigh-in logger lives on the Body category
    // page now; /progress is the cross-domain overview.
    { label: "Log a weigh-in", href: "/progress/body#log-entry", icon: Weight },
    { label: "Log a workout", href: "/workouts/new", icon: Dumbbell },
  ];
