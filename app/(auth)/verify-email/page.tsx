import { Suspense } from "react";

import { AuthStatus } from "@/components/chat/auth-status";
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
        <AuthStatus
          description="Confirming your email address."
          title="Verifying…"
          variant="pending"
        />
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

  return verified ? (
    <AuthStatus
      action={{ href: "/today", label: "Continue to Chad" }}
      description="Thanks — your email address is confirmed. You're all set."
      title="Email verified"
      variant="success"
    />
  ) : (
    <AuthStatus
      action={{ href: "/today", label: "Go to Chad" }}
      description="This verification link is invalid or has expired. Sign in and resend a new one from the banner at the top of the app."
      title="Link expired"
      variant="expired"
    />
  );
}
