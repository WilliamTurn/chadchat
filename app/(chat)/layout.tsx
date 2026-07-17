import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Script from "next/script";
import { Suspense } from "react";
import { AppSidebar } from "@/components/chat/app-sidebar";
import { DataStreamProvider } from "@/components/chat/data-stream-provider";
import { ChatShell } from "@/components/chat/shell";
import { VerifyEmailBanner } from "@/components/chat/verify-email-banner";
import { BottomNav } from "@/components/nav/bottom-nav";
import { NavTracker } from "@/components/nav/nav-tracker";
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
      {/* RC-1 (SYS-15/16): record chat visits in the shared nav stack so a
          dashboard → Coach → dashboard round trip still classifies as a
          return (restoring scroll) and back controls can walk history to
          chat. Record-only: the chat shell is h-dvh and owns its scroll. */}
      <Suspense fallback={null}>
        <NavTracker manageScroll={false} />
      </Suspense>
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
    // Legal gate (BLK-4): Terms/Privacy acceptance comes before everything,
    // including the paywall — Google signups and pre-gate accounts accept once.
    if (dbUser && !dbUser.acceptedTermsAt) {
      redirect("/legal");
    }
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
      {/* h-dvh lives HERE, not on the chat shell (P34-A audit fix): the shell
          must share the viewport with siblings (the verify banner above it,
          the reserved tab-bar band below), so it fills the remainder via
          flex-1. A blind h-dvh on the shell overflowed the viewport by the
          banner's height and pushed the composer/disclaimer under the phone
          tab bar. */}
      <SidebarInset className="h-dvh overflow-hidden">
        {showVerifyBanner && <VerifyEmailBanner />}
        <Suspense fallback={<div className="min-h-0 flex-1" />}>
          <ActiveChatProvider>
            <ChatShell />
          </ActiveChatProvider>
        </Suspense>
        {children}
        {/* FIX-21: the phone bottom tab bar. No spacer here: the chat shell
            is h-dvh (nothing scrolls under the bar) and reserves the bar's
            height itself via pb-tabbar. Chat routes all mark Coach active. */}
        <BottomNav active="/" spacer={false} />
      </SidebarInset>
    </SidebarProvider>
  );
}
