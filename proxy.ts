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
  const isAuthPage = pathname === "/login" || pathname === "/register";

  if (!token) {
    if (isAuthPage) {
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

  if (token && !isGuest && isAuthPage) {
    return NextResponse.redirect(new URL(`${base}/`, request.url));
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
