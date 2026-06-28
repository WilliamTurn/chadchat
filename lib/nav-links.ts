import {
  Camera,
  CreditCard,
  Dumbbell,
  HelpCircle,
  LayoutDashboard,
  LineChart,
  type LucideIcon,
  MessageSquare,
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
 * The sidebar is deliberately kept lean — Chat, Meal Plan and Account are
 * header-only (they're reachable from the chat view itself and the account
 * menu), so adding a new feature link here won't bloat the sidebar unless it's
 * explicitly tagged `sidebar`. Order matters: both navs render the list in
 * order (left-to-right in the header, top-to-bottom in the sidebar).
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
    label: "Nutrition",
    icon: Camera,
    surfaces: ["header", "sidebar"],
  },
  {
    href: "/meal-plan",
    label: "Meal Plan",
    icon: UtensilsCrossed,
    surfaces: ["header"],
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
