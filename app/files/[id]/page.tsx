import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/app/(auth)/auth";
import {
  DocumentView,
  type DocumentVersion,
} from "@/components/files/document-view";
import { PageShell } from "@/components/nav/page-shell";
import { canAccessChad } from "@/lib/admin";
import { getDocumentsById, getUserById } from "@/lib/db/queries";

/**
 * The full-page view of one Chad-generated document (FEAT-45), following the
 * /plans/[id] page pattern. Owner-scoped; anyone else's id is a 404. Reading
 * and version browsing live here; editing stays in the chat viewer.
 */

export default function FileDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <PageShell active="/files">
      <div className="mb-8">
        <Link
          className="-mt-2 mb-1 inline-flex items-center gap-1 py-2 text-muted-foreground text-sm transition-colors hover:text-foreground"
          href="/files"
        >
          <ChevronLeft className="size-4" />
          Back to Files
        </Link>
        <h1 className="font-semibold text-2xl tracking-tight">Document</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          The full document, exactly as Chad wrote it for you.
        </p>
      </div>

      <Suspense
        fallback={
          <div className="flex flex-col gap-4">
            <div className="h-8 w-2/5 animate-pulse rounded-md bg-muted-foreground/10" />
            <div className="h-64 animate-pulse rounded-2xl bg-muted-foreground/5" />
          </div>
        }
      >
        <FileDocumentContent params={params} />
      </Suspense>
    </PageShell>
  );
}

async function FileDocumentContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await getUserById(session.user.id);
  if (!user) {
    redirect("/login");
  }
  if (!user.acceptedTermsAt) {
    redirect("/legal");
  }
  if (!canAccessChad(user)) {
    redirect("/pricing");
  }

  const versions = await getDocumentsById({ id });
  if (versions.length === 0 || versions[0].userId !== user.id) {
    notFound();
  }

  const latest = versions.at(-1);
  if (!latest) {
    notFound();
  }

  const serialized: DocumentVersion[] = versions.map((version) => ({
    title: version.title,
    content: version.content ?? "",
    createdAt: version.createdAt.toISOString(),
  }));

  return (
    <DocumentView
      category={latest.category}
      chatId={latest.chatId}
      description={latest.description}
      id={id}
      kind={latest.kind}
      versions={serialized}
    />
  );
}
