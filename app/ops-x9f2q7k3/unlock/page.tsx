import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/app/(auth)/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ADMIN_PATH, isAdminEmail } from "@/lib/admin";
import {
  checkPanelSecret,
  isPanelConfigured,
  isPanelUnlocked,
  setPanelCookie,
} from "@/lib/admin-gate";
import { getUserById } from "@/lib/db/queries";

/**
 * The passphrase lock screen (NAV-34). Only allowlisted admins can see it (a
 * non-admin gets a 404, so the obscure route stays hidden); an admin who hasn't
 * entered the shared secret yet lands here from `requireAdmin`.
 */

/** 404 for anyone who isn't an allowlisted admin — never leak this page. */
async function requireAdminEmail() {
  const session = await auth();
  const me = session?.user?.id ? await getUserById(session.user.id) : undefined;
  if (!(me && isAdminEmail(me.email))) {
    notFound();
  }
}

async function unlockAction(formData: FormData) {
  "use server";
  // Re-check admin: the cookie is worthless without an admin session, but gate
  // the setter anyway so a non-admin can't brute-force the secret from here.
  await requireAdminEmail();

  const passphrase = String(formData.get("passphrase") ?? "");
  if (!checkPanelSecret(passphrase)) {
    redirect(`${ADMIN_PATH}/unlock?error=1`);
  }
  await setPanelCookie();
  redirect(ADMIN_PATH);
}

export default function UnlockPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-16">
      <Suspense
        fallback={
          <div className="h-64 animate-pulse rounded-2xl border border-border bg-card" />
        }
      >
        <UnlockGate searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function UnlockGate({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdminEmail();

  // Already unlocked — go straight in.
  if (await isPanelUnlocked()) {
    redirect(ADMIN_PATH);
  }

  const { error } = await searchParams;

  if (!isPanelConfigured()) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8">
        <h1 className="font-semibold text-xl tracking-tight">
          Admin panel locked
        </h1>
        <p className="mt-3 text-muted-foreground text-sm">
          No passphrase is configured yet. Set the{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            ADMIN_PANEL_SECRET
          </code>{" "}
          environment variable (in Vercel for production, or{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            .env.local
          </code>{" "}
          locally), then reload this page to unlock.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-8">
      <h1 className="font-semibold text-xl tracking-tight">Admin panel</h1>
      <p className="mt-2 text-muted-foreground text-sm">
        Enter the panel passphrase to continue.
      </p>

      <form action={unlockAction} className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="passphrase">Passphrase</Label>
          <Input
            autoComplete="off"
            autoFocus
            id="passphrase"
            name="passphrase"
            placeholder="••••••••••••"
            type="password"
          />
        </div>

        <Button type="submit">Unlock</Button>

        {error ? (
          <p className="text-destructive text-sm">
            Wrong passphrase. Try again.
          </p>
        ) : null}
      </form>
    </div>
  );
}
