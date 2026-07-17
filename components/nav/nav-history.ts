/**
 * RC-1 (SYS-15/16): the in-app navigation memory behind the shared back
 * control and scroll restoration. One sessionStorage stack of visited
 * pathnames, maintained by <NavTracker> (mounted once per standalone page
 * via PageShell, record-only in the chat layout), plus a per-pathname
 * scroll-position map.
 *
 * The stack mirrors the browser history for in-app movement, so "did the
 * member actually navigate here from another page?" is answerable without
 * touching window.history: BackToDashboard walks real history
 * (router.back()) only when a referrer exists; a cold entry (deep link,
 * fresh tab) keeps the labeled fallback destination.
 */

const STACK_KEY = "nav.stack";
const SCROLL_KEY = "nav.scroll";
const FRESH_KEY = "nav.fresh";
const MAX_ENTRIES = 50;

/** Fired on window after every recordVisit, so controls that render from the
 *  stack (BackToDashboard) can re-read it once the tracker has run; effect
 *  ordering between separately hydrated islands is not guaranteed. */
export const NAV_STACK_EVENT = "chad:nav-stack";

export type NavAction =
  /** First tracked page in this tab. */
  | "initial"
  /** Same page again: a hard reload (the browser owns scroll restoration
   *  there) or a round trip through an untracked page. */
  | "reload"
  /** Fresh forward navigation. */
  | "push"
  /** Returned to the immediate referrer. */
  | "back"
  /** Returned to a page deeper in the trail (the bottom-nav tab return). */
  | "return";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota/private-mode failure loses the nicety, never the page.
  }
}

/** window.location.pathname with any configured basePath stripped, so it is
 *  comparable to usePathname() values. */
export function currentBrowserPath(): string {
  const path = window.location.pathname;
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  if (base && path.startsWith(base)) {
    return path.slice(base.length) || "/";
  }
  return path;
}

/** Record arriving at `path` and classify the movement (see NavAction). */
export function recordVisit(path: string): NavAction {
  const stack = read<string[]>(STACK_KEY, []);
  let action: NavAction;
  if (stack.length === 0) {
    write(STACK_KEY, [path]);
    action = "initial";
  } else if (stack[stack.length - 1] === path) {
    action = "reload";
  } else if (stack[stack.length - 2] === path) {
    stack.pop();
    write(STACK_KEY, stack);
    action = "back";
  } else {
    const earlier = stack.lastIndexOf(path);
    if (earlier !== -1) {
      write(STACK_KEY, stack.slice(0, earlier + 1));
      action = "return";
    } else {
      stack.push(path);
      write(STACK_KEY, stack.slice(-MAX_ENTRIES));
      action = "push";
    }
  }
  window.dispatchEvent(new Event(NAV_STACK_EVENT));
  return action;
}

/** The page the member came from, or null on a cold entry. Correct whether
 *  or not the tracker has recorded `currentPath` yet. */
export function referrerPath(currentPath: string): string | null {
  const stack = read<string[]>(STACK_KEY, []);
  const top = stack[stack.length - 1];
  if (top === currentPath) {
    return stack.length >= 2 ? stack[stack.length - 2] : null;
  }
  return top ?? null;
}

export function saveScrollPosition(path: string, y: number) {
  const map = read<Record<string, number>>(SCROLL_KEY, {});
  map[path] = Math.round(y);
  const keys = Object.keys(map);
  if (keys.length > MAX_ENTRIES) {
    for (const key of keys.slice(0, keys.length - MAX_ENTRIES)) {
      delete map[key];
    }
  }
  write(SCROLL_KEY, map);
}

export function savedScrollPosition(path: string): number {
  return read<Record<string, number>>(SCROLL_KEY, {})[path] ?? 0;
}

/**
 * An explicit action link (the bottom-nav Log picker) marks its navigation
 * fresh: the member asked for the logger, so landing back where they last
 * scrolled on that page would hide it. Consumed by the destination tracker.
 */
export function markFreshNavigation() {
  try {
    window.sessionStorage.setItem(FRESH_KEY, "1");
  } catch {
    // Losing the marker only means scroll memory applies; harmless.
  }
}

export function consumeFreshNavigation(): boolean {
  try {
    const marked = window.sessionStorage.getItem(FRESH_KEY) === "1";
    if (marked) {
      window.sessionStorage.removeItem(FRESH_KEY);
    }
    return marked;
  } catch {
    return false;
  }
}
