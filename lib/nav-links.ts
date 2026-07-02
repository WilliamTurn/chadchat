import {
  Camera,
  CreditCard,
  Dumbbell,
  FileText,
  HelpCircle,
  LayoutDashboard,
  LineChart,
  type LucideIcon,
  MessageSquare,
  Moon,
  Refrigerator,
  UtensilsCrossed,
} from "lucide-react";

/**
 * Single source of truth for in-app section navigation (NAV-3).
 *
 * Both the chat `AppSidebar` and the standalone-page `StandaloneHeader` render
 * from this one list so the two navs can't silently drift apart (they used to
 * expose different link sets). Each surface picks the subset it shows via
 * `surfaces`:
 *
 * - `header`  → the StandaloneHeader bar on /today, /nutrition, /progress, …
 * - `sidebar` → the chat sidebar.
 *
 * NAV-31 (reverses the FEAT-1 lean-sidebar call): the chat surface is the
 * default landing, but the chat route has no StandaloneHeader — so when the
 * sidebar only carried Dashboard/Help, a new user literally could not see
 * Workouts, Nutrition, Meal Plan, Kitchen, Progress or Sleep from where they
 * start. Three first-week audits flagged this as a real discovery gap, so every
 * feature section is now tagged `sidebar` too: the chat sidebar exposes the same
 * labelled inventory as the StandaloneHeader and the mobile drawer — one nav
 * model everywhere. Chat stays header-only (the sidebar IS chat: New chat +
 * history cover it) and Account stays header-only (the sidebar footer user menu
 * already carries Account + sign-out). Order matters: both navs render the list
 * in order (left-to-right in the header, top-to-bottom in the sidebar).
 */
export type NavSurface = "header" | "sidebar";

export type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  surfaces: NavSurface[];
};

export const NAV_LINKS: NavLink[] = [
  {
    href: "/today",
    label: "Dashboard",
    icon: LayoutDashboard,
    surfaces: ["header", "sidebar"],
  },
  { href: "/", label: "Chat", icon: MessageSquare, surfaces: ["header"] },
  {
    href: "/workouts",
    label: "Workouts",
    icon: Dumbbell,
    surfaces: ["header", "sidebar"],
  },
  {
    href: "/nutrition",
    label: "Calorie Tracker",
    icon: Camera,
    surfaces: ["header", "sidebar"],
  },
  {
    href: "/meal-plan",
    label: "Meal Plan",
    icon: UtensilsCrossed,
    surfaces: ["header", "sidebar"],
  },
  {
    href: "/kitchen",
    label: "Kitchen",
    icon: Refrigerator,
    surfaces: ["header", "sidebar"],
  },
  {
    href: "/progress",
    label: "Progress",
    icon: LineChart,
    surfaces: ["header", "sidebar"],
  },
  {
    href: "/sleep",
    label: "Sleep",
    icon: Moon,
    surfaces: ["header", "sidebar"],
  },
  {
    href: "/reports",
    label: "Weekly Report",
    icon: FileText,
    surfaces: ["header", "sidebar"],
  },
  {
    href: "/account",
    label: "Account",
    icon: CreditCard,
    surfaces: ["header"],
  },
  {
    href: "/help",
    label: "Help",
    icon: HelpCircle,
    surfaces: ["header", "sidebar"],
  },
];

export const headerLinks = NAV_LINKS.filter((link) =>
  link.surfaces.includes("header")
);

export const sidebarLinks = NAV_LINKS.filter((link) =>
  link.surfaces.includes("sidebar")
);
