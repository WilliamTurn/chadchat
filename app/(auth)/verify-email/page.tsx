import Link from "next/link";
import { Suspense } from "react";

import { buttonVariants } from "@/components/ui/button";
import { hashToken } from "@/lib/auth/tokens";
import {
  consumeEmailVerificationToken,
  markEmailVerified,
} from "@/lib/db/queries";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <>
          <h1 className="font-semibold text-2xl tracking-tight">
            Verifying…
          </h1>
          <p className="text-muted-foreground text-sm">
            Confirming your email address.
          </p>
        </>
      }
    >
      <VerifyResult searchParams={searchParams} />
    </Suspense>
  );
}

async function VerifyResult({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  let verified = false;
  if (token) {
    const userId = await consumeEmailVerificationToken(hashToken(token));
    if (userId) {
      await markEmailVerified(userId);
      verified = true;
    }
  }

  return (
    <>
      <h1 className="font-semibold text-2xl tracking-tight">
        {verified ? "Email verified" : "Link expired"}
      </h1>
      <p className="text-muted-foreground text-sm">
        {verified
          ? "Thanks — your email address is confirmed. You're all set."
          : "This verification link is invalid or has expired. Sign in and resend a new one from the banner at the top of the app."}
      </p>
      <Link className={buttonVariants({ className: "mt-2" })} href="/">
        {verified ? "Continue to Chad" : "Go to Chad"}
      </Link>
    </>
  );
}
