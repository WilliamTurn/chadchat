import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { auth } from "@/app/(auth)/auth";
import {
  FilesBrowser,
  type FileDocumentItem,
  type FileUploadItem,
} from "@/components/files/files-browser";
import { BackToDashboard } from "@/components/nav/back-to-dashboard";
import { PageShell } from "@/components/nav/page-shell";
import { FilesSkeleton } from "@/components/dashboard/page-skeletons";
import { canAccessChad } from "@/lib/admin";
import {
  getUserById,
  getUserFileDocuments,
  getUserUploads,
} from "@/lib/db/queries";

export default function FilesPage() {
  return (
    // Full-width desktop layout (LAY-1): the wide frame, filled with a real
    // library grid (toolbar + responsive file-card grid).
    <PageShell active="/files" className="max-w-[1500px]">
      <Toaster position="top-center" richColors theme="system" />

      <div className="mb-8">
        <BackToDashboard />
        <h1 className="font-semibold text-2xl tracking-tight">Files</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Every document Chad has written for you and every photo you've sent
          him, in one place.
        </p>
      </div>

      <Suspense fallback={<FilesSkeleton />}>
        <FilesContent />
      </Suspense>
    </PageShell>
  );
}

async function FilesContent() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await getUserById(session.user.id);
  if (!user) {
    redirect("/login");
  }
  // Legal gate (BLK-4): accept the Terms before using the product.
  if (!user.acceptedTermsAt) {
    redirect("/legal");
  }
  if (!canAccessChad(user)) {
    redirect("/pricing");
  }

  const [fileDocuments, uploads] = await Promise.all([
    getUserFileDocuments({ userId: user.id }),
    getUserUploads({ userId: user.id }),
  ]);

  const documentItems: FileDocumentItem[] = fileDocuments.map((entry) => ({
    id: entry.latest.id,
    title: entry.latest.title,
    kind: entry.latest.kind,
    description: entry.latest.description,
    category: entry.latest.category,
    chatId: entry.latest.chatId,
    versionCount: entry.versionCount,
    createdAt: entry.firstCreatedAt.toISOString(),
    updatedAt: entry.latest.createdAt.toISOString(),
  }));

  const uploadItems: FileUploadItem[] = uploads.map((upload) => ({
    id: upload.id,
    url: upload.url,
    name: upload.name,
    contentType: upload.contentType,
    size: upload.size,
    createdAt: upload.createdAt.toISOString(),
  }));

  return <FilesBrowser documents={documentItems} uploads={uploadItems} />;
}
