import { type NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { isDevelopmentEnvironment } from "./lib/constants";

/**
 * Validate a `redirectUrl` query param before bouncing a freshly-signed-in user
 * to it. Only same-origin absolute paths are allowed — anything else (absolute
 * URLs, protocol-relative `//evil.com`, backslash tricks) is rejected to close
 * the open-redirect hole, and we never loop back to an auth page.
 */
function safeRedirectPath(raw: string | null): string | null {
  if (!raw) {
    return null;
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }

  if (
    !decoded.startsWith("/") ||
    decoded.startsWith("//") ||
    decoded.startsWith("/\\")
  ) {
    return null;
  }

  const path = decoded.split("?")[0];
  if (path === "/login" || path === "/register") {
    return null;
  }

  return decoded;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/ping")) {
    return new Response("pong", { status: 200 });
  }

  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    // NOTE for local prod smoke-tests (next start over http): this reads
    // ONLY the __Secure- cookie name in production mode, while AuthJS on
    // http sets the non-secure name, so a plain login can't pass the proxy
    // AND a minted __Secure- cookie alone breaks client hydration (the
    // session API reads the other name; React #310). Test with BOTH: a real
    // credential login PLUS a minted __Secure-authjs.session-token (AuthJS
    // v5 encode salt = the cookie name). Real https prod is unaffected.
    secureCookie: !isDevelopmentEnvironment,
  });

  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  // Paywall: no anonymous guests. Unauthenticated visitors must sign in /
  // register. Auth pages stay public so people can actually do that, and API
  // routes are left to return their own 401 instead of an HTML redirect.
  const isAuthPage =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    // Email-verification links are clicked from an inbox, typically in a
    // browser with no session. The page consumes the token server-side and
    // safely handles invalid/expired links, so it must stay reachable
    // logged-out — otherwise the paywall redirect eats the token.
    pathname === "/verify-email";
  // Public share links must work for logged-out visitors: /share/[id] only
  // renders chats whose visibility is "public", and /q/[id] (FEAT-23) is the
  // quit-prediction share page + its OG card image — social scrapers and
  // click-throughs never have a session, and the unguessable uuid is the
  // capability.
  const isPublicShare =
    pathname.startsWith("/share/") || pathname.startsWith("/q/");

  // The fixture harness (P2-A) renders deterministic FIXTURE data only, never
  // member data, and hard-404s in production (app/dev/fixtures/layout.tsx).
  // It stays reachable logged-out so auditors and the FIX-39 screenshot suite
  // can drive it without a session.
  const isDevFixtures = pathname.startsWith("/dev/fixtures");

  if (!token) {
    if (isAuthPage || isPublicShare || isDevFixtures) {
      return NextResponse.next();
    }

    if (pathname.startsWith("/api")) {
      return NextResponse.next();
    }

    // Preserve the full path + querystring so the user lands exactly where they
    // were headed (e.g. a shared deep link with params) after signing in.
    const redirectUrl = encodeURIComponent(
      request.nextUrl.pathname + request.nextUrl.search
    );

    return NextResponse.redirect(
      new URL(`${base}/login?redirectUrl=${redirectUrl}`, request.url)
    );
  }

  // After signing in, honor where the user was originally headed (the
  // `redirectUrl` the paywall stamped on, validated same-origin); otherwise
  // land them on the dashboard — a populated home screen that reads as a real
  // product, not a bare chat box.
  if (token && (pathname === "/login" || pathname === "/register")) {
    const target = safeRedirectPath(
      request.nextUrl.searchParams.get("redirectUrl")
    );
    return NextResponse.redirect(
      new URL(target ?? `${base}/home`, request.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/chat/:id",
    "/api/:path*",
    "/login",
    "/register",

    // `images` is excluded so static /public marketing assets (e.g. the
    // logged-out /login montage) aren't caught by the paywall redirect.
    // `zxing` is the barcode engine's wasm binary - redirecting a wasm fetch
    // to the login page breaks the scanner.
    "/((?!_next/static|_next/image|images|zxing|favicon.ico|icon.svg|sitemap.xml|robots.txt).*)",
  ],
};
