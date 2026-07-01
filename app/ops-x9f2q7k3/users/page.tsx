import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ADMIN_PATH } from "@/lib/admin";
import { requireAdmin } from "@/lib/admin-guard";
import { type AdminUserRow, getUserDirectory } from "@/lib/db/queries";

export default function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col px-4 py-16">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">Members</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Look up any member, see their plan and activity, and review their
            chats with Chad.
          </p>
        </div>
        <Button asChild size="sm" variant="ghost">
          <Link href={ADMIN_PATH}>Back to admin</Link>
        </Button>
      </div>

      <Suspense
        fallback={
          <div className="h-96 animate-pulse rounded-2xl border border-border bg-card" />
        }
      >
        <Directory searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Directory({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin();
  const { q } = await searchParams;
  const users = await getUserDirectory({ search: q, limit: 100 });

  return (
    <div className="flex flex-col gap-6">
      {/* Plain GET form — no client JS needed; submitting reloads with ?q= */}
      <form className="flex gap-2" method="get">
        <Input
          autoComplete="off"
          defaultValue={q ?? ""}
          name="q"
          placeholder="Search by email or name…"
          type="search"
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {users.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {q ? `No members match “${q}”.` : "No members yet."}
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border">
          {users.map((u, i) => (
            <UserRow first={i === 0} key={u.id} user={u} />
          ))}
        </div>
      )}
    </div>
  );
}

function UserRow({ user, first }: { user: AdminUserRow; first: boolean }) {
  return (
    <Link
      className={`flex items-center justify-between gap-4 bg-card px-5 py-4 transition-colors hover:bg-muted/40 ${
        first ? "" : "border-border border-t"
      }`}
      href={`${ADMIN_PATH}/users/${user.id}`}
    >
      <div className="min-w-0">
        <div className="truncate font-medium text-sm">
          {user.email}
          {user.name ? (
            <span className="ml-2 font-normal text-muted-foreground">
              {user.name}
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 text-muted-foreground text-xs">
          Joined {user.createdAt.toLocaleDateString()} · {user.chatCount} chats ·{" "}
          {user.messageCount} messages
        </div>
      </div>
      <PlanBadge status={user.subscriptionStatus} tier={user.subscriptionTier} />
    </Link>
  );
}

export function PlanBadge({
  tier,
  status,
}: {
  tier: "basic" | "pro" | "elite" | null;
  status: string | null;
}) {
  if (!status) {
    return <Badge variant="outline">No plan</Badge>;
  }
  if (status === "trialing") {
    return <Badge variant="secondary">Trial · {tier ?? "—"}</Badge>;
  }
  const label =
    tier === "elite"
      ? "Elite"
      : tier === "pro"
        ? "Pro"
        : tier === "basic"
          ? "Basic"
          : status;
  const active = status === "active" || status === "past_due";
  return <Badge variant={active ? "default" : "outline"}>{label}</Badge>;
}
