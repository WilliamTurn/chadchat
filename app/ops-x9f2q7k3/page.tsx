import Link from "next/link";
import { Suspense } from "react";
import { DeleteUserForm } from "@/components/admin/delete-user-form";
import { GrantAccessForm } from "@/components/admin/grant-access-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ADMIN_PATH } from "@/lib/admin";
import { requireAdmin } from "@/lib/admin-guard";
import { getUsageStats, getUserStats } from "@/lib/db/queries";
import { lockPanelAction } from "./actions";

// Placeholder controls — visible so the dashboard reflects the full intended
// surface, but not yet wired. Each becomes a real card as it's built.
const COMING_SOON: { title: string; description: string }[] = [
  {
    title: "Revenue & MRR",
    description:
      "Live monthly recurring revenue, trials converting, churn, and refunds — pulled from Stripe.",
  },
  {
    title: "Broadcast message",
    description:
      "Send an announcement or coaching nudge to all members, or just one tier.",
  },
  {
    title: "Feature flags",
    description:
      "Toggle photo analysis, memory, new models, or experiments on/off without a deploy.",
  },
  {
    title: "Audit log",
    description:
      "A running record of every admin action (who granted what, when) for accountability.",
  },
];

export default function AdminPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col px-4 py-16">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">
            Admin dashboard
          </h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Control the site, manage members, and monitor usage.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <form action={lockPanelAction}>
            <Button size="sm" type="submit" variant="ghost">
              Lock panel
            </Button>
          </form>
          <Button asChild size="sm" variant="ghost">
            <Link href="/">Back to Chad</Link>
          </Button>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="h-96 animate-pulse rounded-2xl border border-border bg-card" />
        }
      >
        <AdminContent />
      </Suspense>
    </main>
  );
}

async function AdminContent() {
  // Security boundary: allowlisted admin (404s otherwise, so the page's
  // existence isn't leaked) AND passphrase-unlocked (redirects to /unlock).
  await requireAdmin();

  const [stats, usage] = await Promise.all([getUserStats(), getUsageStats()]);

  return (
    <div className="flex flex-col gap-8">
      {/* Live stats strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total users" value={stats.totalUsers} />
        <StatCard label="Paid members" value={stats.paidMembers} />
        <StatCard label="Messages (24h)" value={usage.messagesLast24h} />
        <StatCard label="New signups (7d)" value={usage.signups7d} />
      </div>

      {/* Membership mix */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="On trial" value={usage.trialing} />
        <StatCard label="Basic" value={usage.basic} />
        <StatCard label="Pro" value={usage.pro} />
      </div>

      {/* Members directory + abuse review */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-1 flex items-center gap-3">
          <h2 className="font-medium text-lg">Members</h2>
          <Badge variant="secondary">Live</Badge>
        </div>
        <p className="mb-5 text-muted-foreground text-sm">
          Search members, see each one's plan and activity, and review their
          conversations with Chad — for safety and abuse checks.
        </p>
        <Button asChild>
          <Link href={`${ADMIN_PATH}/users`}>Open member directory</Link>
        </Button>
      </section>

      {/* The one working control */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-1 flex items-center gap-3">
          <h2 className="font-medium text-lg">Grant access</h2>
          <Badge variant="secondary">Live</Badge>
        </div>
        <p className="mb-5 text-muted-foreground text-sm">
          Give any registered user a paid tier instantly — no Stripe, no charge.
          Takes effect the next time they load the site. Use “Revoke access” to
          remove it. They must have signed up first.
        </p>
        <GrantAccessForm />
      </section>

      {/* Delete a user — built for clearing out throwaway test accounts */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-1 flex items-center gap-3">
          <h2 className="font-medium text-lg">Delete user</h2>
          <Badge variant="secondary">Live</Badge>
        </div>
        <p className="mb-5 text-muted-foreground text-sm">
          Permanently remove a user and everything they own — chats, memory, the
          lot — and free up their email to register again. Made for clearing out
          throwaway test accounts. This can’t be undone, and it doesn’t touch
          Stripe (cancel a real subscriber there first).
        </p>
        <DeleteUserForm />
      </section>

      {/* Placeholder controls */}
      <section>
        <h2 className="mb-4 font-medium text-lg">More controls</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {COMING_SOON.map((c) => (
            <div
              className="rounded-2xl border border-border border-dashed bg-card/50 p-5"
              key={c.title}
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="font-medium text-sm">{c.title}</span>
                <Badge variant="outline">Coming soon</Badge>
              </div>
              <p className="text-muted-foreground text-sm">{c.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="font-semibold text-3xl tracking-tight">
        {value.toLocaleString()}
      </div>
      <div className="mt-1 text-muted-foreground text-sm">{label}</div>
    </div>
  );
}
