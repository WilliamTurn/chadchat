import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Script from "next/script";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { AppSidebar } from "@/components/chat/app-sidebar";
import { DataStreamProvider } from "@/components/chat/data-stream-provider";
import { ChatShell } from "@/components/chat/shell";
import { VerifyEmailBanner } from "@/components/chat/verify-email-banner";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ActiveChatProvider } from "@/hooks/use-active-chat";
import { canAccessChad } from "@/lib/admin";
import { getUserById } from "@/lib/db/queries";
import {
  type PlanStatusSummary,
  toPlanStatusSummary,
} from "@/lib/subscription";
import { auth } from "../(auth)/auth";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js"
        strategy="lazyOnload"
      />
      <DataStreamProvider>
        <Suspense fallback={<div className="flex h-dvh bg-sidebar" />}>
          <SidebarShell>{children}</SidebarShell>
        </Suspense>
      </DataStreamProvider>
    </>
  );
}

async function SidebarShell({ children }: { children: React.ReactNode }) {
  const [session, cookieStore] = await Promise.all([auth(), cookies()]);

  // Paywall: send anyone without an active trial/subscription to pricing.
  // (Unauthenticated users are already redirected to /login by proxy.ts.)
  let plan: PlanStatusSummary | null = null;
  let showVerifyBanner = false;
  if (session?.user?.id) {
    const dbUser = await getUserById(session.user.id);
    // Admins are comped (canAccessChad) — the owner is never trapped on /pricing.
    if (!(dbUser && canAccessChad(dbUser))) {
      redirect("/pricing");
    }
    // First-run onboarding (ONB-1): send a new member through the welcome wizard
    // once before they land straight in the chat.
    if (!dbUser.onboardedAt) {
      redirect("/welcome");
    }
    plan = toPlanStatusSummary(dbUser);
    // Soft verification: nudge unverified real accounts without blocking them.
    showVerifyBanner = !(dbUser.emailVerified || dbUser.isAnonymous);
  }

  const isCollapsed = cookieStore.get("sidebar_state")?.value !== "true";

  return (
    <SidebarProvider defaultOpen={!isCollapsed}>
      <AppSidebar plan={plan} user={session?.user} />
      <SidebarInset>
        {showVerifyBanner && <VerifyEmailBanner />}
        <Toaster
          position="top-center"
          theme="system"
          toastOptions={{
            className:
              "!bg-card !text-foreground !border-border/50 !shadow-[var(--shadow-float)]",
          }}
        />
        <Suspense fallback={<div className="flex h-dvh" />}>
          <ActiveChatProvider>
            <ChatShell />
          </ActiveChatProvider>
        </Suspense>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
