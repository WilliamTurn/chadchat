"use client";

import { formatDistance } from "date-fns";
import {
  Download,
  FileText,
  FolderOpen,
  History,
  ImageIcon,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Search,
  Sheet,
  SquareCode,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  deleteDocumentAction,
  deleteUploadAction,
  renameDocumentAction,
} from "@/app/files/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { downloadRemoteFile } from "@/lib/files/download";
import { cn } from "@/lib/utils";

// Serialized shapes handed over by the /files server component (dates as ISO
// strings so the boundary stays plain).
export type FileDocumentItem = {
  id: string;
  title: string;
  kind: "text" | "code" | "image" | "sheet";
  description: string | null;
  category: string | null;
  chatId: string | null;
  versionCount: number;
  createdAt: string;
  updatedAt: string;
};

export type FileUploadItem = {
  id: string;
  url: string;
  name: string;
  contentType: string;
  size: number | null;
  createdAt: string;
};

const KIND_LABEL: Record<string, string> = {
  text: "Document",
  code: "Script",
  sheet: "Spreadsheet",
  image: "Image",
};

const CATEGORY_LABEL: Record<string, string> = {
  training: "Training",
  nutrition: "Nutrition",
  recovery: "Recovery",
  progress: "Progress",
  other: "Other",
};

type TypeFilter = "all" | "documents" | "uploads";

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All files" },
  { value: "documents", label: "Chad's documents" },
  { value: "uploads", label: "Your uploads" },
];

function KindIcon({ kind }: { kind: string }) {
  if (kind === "code") {
    return <SquareCode className="size-4" />;
  }
  if (kind === "sheet") {
    return <Sheet className="size-4" />;
  }
  return <FileText className="size-4" />;
}

function relative(iso: string): string {
  return formatDistance(new Date(iso), new Date(), { addSuffix: true });
}

function formatSize(bytes: number | null): string | null {
  if (bytes == null) {
    return null;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function FilesBrowser({
  documents,
  uploads,
}: {
  documents: FileDocumentItem[];
  uploads: FileUploadItem[];
}) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [query, setQuery] = useState("");

  const [renaming, setRenaming] = useState<FileDocumentItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingDoc, setDeletingDoc] = useState<FileDocumentItem | null>(null);
  const [deletingUpload, setDeletingUpload] = useState<FileUploadItem | null>(
    null
  );
  const [pending, startTransition] = useTransition();

  const q = query.trim().toLowerCase();

  // Category chips only appear for categories that actually exist.
  const presentCategories = useMemo(() => {
    const set = new Set<string>();
    for (const doc of documents) {
      if (doc.category && CATEGORY_LABEL[doc.category]) {
        set.add(doc.category);
      }
    }
    return Object.keys(CATEGORY_LABEL).filter((key) => set.has(key));
  }, [documents]);

  const visibleDocuments = useMemo(() => {
    if (typeFilter === "uploads") {
      return [];
    }
    return documents.filter((doc) => {
      if (categoryFilter !== "all" && doc.category !== categoryFilter) {
        return false;
      }
      if (!q) {
        return true;
      }
      return (
        doc.title.toLowerCase().includes(q) ||
        (doc.description ?? "").toLowerCase().includes(q) ||
        (doc.category ? CATEGORY_LABEL[doc.category] ?? "" : "")
          .toLowerCase()
          .includes(q)
      );
    });
  }, [documents, typeFilter, categoryFilter, q]);

  const visibleUploads = useMemo(() => {
    if (typeFilter === "documents") {
      return [];
    }
    return uploads.filter((upload) => {
      if (!q) {
        return true;
      }
      return upload.name.toLowerCase().includes(q);
    });
  }, [uploads, typeFilter, q]);

  // One newest-first stream, documents and photos together (Drive-style).
  const items = useMemo(() => {
    const docs = visibleDocuments.map((doc) => ({
      sortDate: doc.updatedAt,
      key: `doc-${doc.id}`,
      doc,
      upload: null as FileUploadItem | null,
    }));
    const ups = visibleUploads.map((upload) => ({
      sortDate: upload.createdAt,
      key: `upload-${upload.id}`,
      doc: null as FileDocumentItem | null,
      upload,
    }));
    return [...docs, ...ups].sort((a, b) =>
      a.sortDate < b.sortDate ? 1 : -1
    );
  }, [visibleDocuments, visibleUploads]);

  const nothingAtAll = documents.length === 0 && uploads.length === 0;

  function submitRename() {
    if (!renaming) {
      return;
    }
    const target = renaming;
    const title = renameValue;
    startTransition(async () => {
      const result = await renameDocumentAction({ id: target.id, title });
      if (result.ok) {
        toast.success("Renamed.");
        setRenaming(null);
      } else {
        toast.error(result.error);
      }
    });
  }

  function confirmDeleteDoc() {
    if (!deletingDoc) {
      return;
    }
    const target = deletingDoc;
    startTransition(async () => {
      const result = await deleteDocumentAction({ id: target.id });
      if (result.ok) {
        toast.success("Document deleted.");
        setDeletingDoc(null);
      } else {
        toast.error(result.error);
      }
    });
  }

  function confirmDeleteUpload() {
    if (!deletingUpload) {
      return;
    }
    const target = deletingUpload;
    startTransition(async () => {
      const result = await deleteUploadAction({ id: target.id });
      if (result.ok) {
        toast.success("Photo deleted.");
        setDeletingUpload(null);
      } else {
        toast.error(result.error);
      }
    });
  }

  if (nothingAtAll) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card px-6 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <FolderOpen className="size-6" />
        </div>
        <div>
          <p className="font-medium">No files yet</p>
          <p className="mx-auto mt-1 max-w-md text-muted-foreground text-sm">
            When Chad writes you a plan or guide in chat, it lands here
            automatically. Photos you send Chad land here too.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/">Ask Chad for a plan in chat</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Toolbar: type filter chips + search. */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {TYPE_FILTERS.map((filter) => (
            <button
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors max-sm:py-2.5",
                typeFilter === filter.value
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              key={filter.value}
              onClick={() => setTypeFilter(filter.value)}
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="relative w-full lg:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search your files"
            className="pl-9 max-sm:h-11 [&::-webkit-search-cancel-button]:appearance-none"
            enterKeyHint="search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your files"
            type="search"
            value={query}
          />
        </div>
      </div>

      {/* Category chips (documents only; shown when categories exist). */}
      {typeFilter !== "uploads" && presentCategories.length > 0 ? (
        <div className="-mt-2 flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs">Category:</span>
          <button
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors max-sm:py-2",
              categoryFilter === "all"
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            onClick={() => setCategoryFilter("all")}
            type="button"
          >
            All categories
          </button>
          {presentCategories.map((key) => (
            <button
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors max-sm:py-2",
                categoryFilter === key
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              key={key}
              onClick={() => setCategoryFilter(key)}
              type="button"
            >
              {CATEGORY_LABEL[key]}
            </button>
          ))}
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-12 text-center text-muted-foreground text-sm">
          <span>No files match your search.</span>
          {q ? (
            <Button
              className="max-sm:h-11"
              onClick={() => setQuery("")}
              size="sm"
              variant="outline"
            >
              Clear search
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) =>
            item.doc ? (
              <DocumentCard
                doc={item.doc}
                key={item.key}
                onDelete={() => setDeletingDoc(item.doc)}
                onRename={() => {
                  setRenaming(item.doc);
                  setRenameValue(item.doc?.title ?? "");
                }}
              />
            ) : item.upload ? (
              <UploadCard
                key={item.key}
                onDelete={() => setDeletingUpload(item.upload)}
                upload={item.upload}
              />
            ) : null
          )}
        </div>
      )}

      {/* Rename (small quick action, Drive/Claude-style). */}
      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setRenaming(null);
          }
        }}
        open={renaming !== null}
      >
        <DialogContent
          className="sm:max-w-md"
          // Never auto-focus the input: on phones that pops the keyboard
          // uninvited the instant the dialog opens (owner law
          // nothing-starts-uninvited). The member taps the field to type.
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Rename document</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submitRename();
            }}
          >
            <Input
              aria-label="Document name"
              maxLength={120}
              onChange={(event) => setRenameValue(event.target.value)}
              value={renameValue}
            />
            <p className="mt-1.5 text-right text-muted-foreground text-xs tabular-nums">
              {renameValue.length}/120
            </p>
            <DialogFooter className="mt-2">
              <Button
                className="max-sm:h-11"
                onClick={() => setRenaming(null)}
                type="button"
                variant="ghost"
              >
                Cancel
              </Button>
              <Button
                className="max-sm:h-11"
                disabled={pending || !renameValue.trim()}
                type="submit"
              >
                {pending ? "Saving..." : "Save name"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete document confirmation. */}
      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            setDeletingDoc(null);
          }
        }}
        open={deletingDoc !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this document?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deletingDoc?.title}" and all of its versions will be deleted.
              This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="max-sm:h-11" disabled={pending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="max-sm:h-11"
              variant="destructive"
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                confirmDeleteDoc();
              }}
            >
              {pending ? "Deleting..." : "Delete document"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete upload confirmation. */}
      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            setDeletingUpload(null);
          }
        }}
        open={deletingUpload !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this photo?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deletingUpload?.name}" will be deleted from your files. This
              can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="max-sm:h-11" disabled={pending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="max-sm:h-11"
              variant="destructive"
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                confirmDeleteUpload();
              }}
            >
              {pending ? "Deleting..." : "Delete photo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DocumentCard({
  doc,
  onRename,
  onDelete,
}: {
  doc: FileDocumentItem;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group relative flex min-w-0 flex-col rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-muted/40">
      <Link
        aria-label={`Open ${doc.title}`}
        className="absolute inset-0 z-0 rounded-2xl"
        href={`/files/${doc.id}`}
      />

      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <KindIcon kind={doc.kind} />
          </div>
          <Badge variant="outline">{KIND_LABEL[doc.kind] ?? "Document"}</Badge>
          {doc.category && CATEGORY_LABEL[doc.category] ? (
            <Badge variant="secondary">{CATEGORY_LABEL[doc.category]}</Badge>
          ) : null}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={`Actions for ${doc.title}`}
              className="relative z-10 size-8 shrink-0 text-muted-foreground max-sm:size-11"
              size="icon"
              variant="ghost"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/files/${doc.id}`}>
                <FileText className="size-4" />
                Open
              </Link>
            </DropdownMenuItem>
            {doc.chatId ? (
              <DropdownMenuItem asChild>
                <Link href={`/chat/${doc.chatId}`}>
                  <MessageSquare className="size-4" />
                  Open the chat it came from
                </Link>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onSelect={onRename}>
              <Pencil className="size-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={onDelete}
            >
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-3 min-w-0">
        <p className="truncate font-medium">{doc.title}</p>
        <p className="mt-1 line-clamp-2 text-muted-foreground text-sm">
          {doc.description ?? "Written by Chad in chat."}
        </p>
      </div>

      {/* mt-auto pins the date row to the card bottom so equal-height grid
          rows read as designed rather than leaving a dead gap. */}
      <div className="mt-auto flex items-center gap-1.5 pt-3 text-muted-foreground text-xs">
        <History className="size-3.5" />
        <span>
          Updated {relative(doc.updatedAt)}
          {doc.versionCount > 1
            ? ` · ${doc.versionCount} versions`
            : ""}
        </span>
      </div>
    </div>
  );
}

function UploadCard({
  upload,
  onDelete,
}: {
  upload: FileUploadItem;
  onDelete: () => void;
}) {
  const size = formatSize(upload.size);

  return (
    <div className="group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:bg-muted/40">
      <a
        aria-label={`View ${upload.name} full size`}
        className="absolute inset-0 z-0"
        href={upload.url}
        rel="noopener noreferrer"
        target="_blank"
      />

      {/* eslint-disable-next-line @next/next/no-img-element -- Blob-hosted member photo */}
      <img
        alt={upload.name}
        className="h-36 w-full object-cover"
        loading="lazy"
        src={upload.url}
      />

      <div className="flex items-start justify-between gap-2 p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ImageIcon className="size-4 shrink-0 text-muted-foreground" />
            <p className="truncate font-medium text-sm">{upload.name}</p>
          </div>
          <p className="mt-1 text-muted-foreground text-xs">
            Uploaded by you {relative(upload.createdAt)}
            {size ? ` · ${size}` : ""}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={`Actions for ${upload.name}`}
              className="relative z-10 size-8 shrink-0 text-muted-foreground max-sm:size-11"
              size="icon"
              variant="ghost"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <a href={upload.url} rel="noopener noreferrer" target="_blank">
                <ImageIcon className="size-4" />
                View full size
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                downloadRemoteFile({ url: upload.url, filename: upload.name });
              }}
            >
              <Download className="size-4" />
              Download
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={onDelete}
            >
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
