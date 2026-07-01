import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PlanBadge } from "@/app/ops-x9f2q7k3/users/page";
import { DeleteMemberButton } from "@/components/admin/delete-member-button";
import { Button } from "@/components/ui/button";
import { ADMIN_PATH, isAdminEmail } from "@/lib/admin";
import { requireAdmin } from "@/lib/admin-guard";
import {
  getChatsByUserId,
  getUserById,
  getUserMemory,
} from "@/lib/db/queries";

export default function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col px-4 py-16">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-semibold text-2xl tracking-tight">Member</h1>
        <Button asChild size="sm" variant="ghost">
          <Link href={`${ADMIN_PATH}/users`}>Back to members</Link>
        </Button>
      </div>

      <Suspense
        fallback={
          <div className="h-96 animate-pulse rounded-2xl border border-border bg-card" />
        }
      >
        <Detail params={params} />
      </Suspense>
    </main>
  );
}

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const member = await getUserById(id);
  if (!member) {
    notFound();
  }

  const [{ chats }, memory] = await Promise.all([
    getChatsByUserId({ id, limit: 100, startingAfter: null, endingBefore: null }),
    getUserMemory(id),
  ]);

  return (
    <div className="flex flex-col gap-8">
      {/* Identity + plan */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="truncate font-medium text-lg">{member.email}</div>
            <div className="mt-1 text-muted-foreground text-sm">
              Joined {member.createdAt.toLocaleDateString()} ·{" "}
              {member.emailVerified ? "Email verified" : "Email unverified"}
            </div>
          </div>
          <PlanBadge
            status={member.subscriptionStatus}
            tier={member.subscriptionTier}
          />
        </div>
      </section>

      {/* What Chad remembers about them */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-3 font-medium text-lg">Chad's memory</h2>
        {memory?.profile ? (
          <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-muted/40 p-4 text-muted-foreground text-sm">
            {memory.profile}
          </pre>
        ) : (
          <p className="text-muted-foreground text-sm">
            No memory profile yet (memory may be off, or they haven't chatted
            enough).
          </p>
        )}
      </section>

      {/* Their conversations */}
      <section>
        <h2 className="mb-4 font-medium text-lg">
          Conversations{" "}
          <span className="font-normal text-muted-foreground text-sm">
            ({chats.length})
          </span>
        </h2>
        {chats.length === 0 ? (
          <p className="text-muted-foreground text-sm">No chats yet.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border">
            {chats.map((c, i) => (
              <Link
                className={`flex items-center justify-between gap-4 bg-card px-5 py-3.5 transition-colors hover:bg-muted/40 ${
                  i === 0 ? "" : "border-border border-t"
                }`}
                href={`${ADMIN_PATH}/users/${id}/chats/${c.id}`}
                key={c.id}
              >
                <span className="truncate text-sm">{c.title}</span>
                <span className="shrink-0 text-muted-foreground text-xs">
                  {c.createdAt.toLocaleDateString()}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Danger zone — delete this member in context (no re-typing their email). */}
      <section className="rounded-2xl border border-destructive/30 bg-card p-6">
        <h2 className="mb-1 font-medium text-destructive text-lg">
          Danger zone
        </h2>
        <p className="mb-4 text-muted-foreground text-sm">
          Permanently delete this member and all their data — chats, messages,
          progress, nutrition, and memory. This cannot be undone.
        </p>
        {isAdminEmail(member.email) ? (
          <p className="text-muted-foreground text-sm">
            This is an admin account — it can't be deleted from here.
          </p>
        ) : (
          <DeleteMemberButton email={member.email} id={member.id} />
        )}
      </section>
    </div>
  );
}
