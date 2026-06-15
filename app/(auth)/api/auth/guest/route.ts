import { NextResponse } from "next/server";

// Guest access is disabled: Chad is paywalled, so there are no anonymous
// accounts. Any hit to this legacy endpoint is sent to the login page.
export function GET(request: Request) {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return NextResponse.redirect(new URL(`${base}/login`, request.url));
}
