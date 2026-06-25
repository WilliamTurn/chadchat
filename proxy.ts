import { type NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { guestRegex, isDevelopmentEnvironment } from "./lib/constants";

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
    pathname === "/reset-password";
  // Public share links must work for logged-out visitors (the page itself only
  // renders chats whose visibility is "public").
  const isPublicShare = pathname.startsWith("/share/");

  if (!token) {
    if (isAuthPage || isPublicShare) {
      return NextResponse.next();
    }

    if (pathname.startsWith("/api")) {
      return NextResponse.next();
    }

    const redirectUrl = encodeURIComponent(new URL(request.url).pathname);

    return NextResponse.redirect(
      new URL(`${base}/login?redirectUrl=${redirectUrl}`, request.url)
    );
  }

  const isGuest = guestRegex.test(token?.email ?? "");

  // After signing in, land members on the dashboard (a populated home screen)
  // rather than a bare chat box — it reads as a real product, not just a chat.
  if (
    token &&
    !isGuest &&
    (pathname === "/login" || pathname === "/register")
  ) {
    return NextResponse.redirect(new URL(`${base}/today`, request.url));
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

    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
