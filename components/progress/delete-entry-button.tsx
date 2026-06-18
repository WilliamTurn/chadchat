"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { removeProgressEntry } from "@/app/progress/actions";
import { Button } from "@/components/ui/button";

export function DeleteEntryButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      className="text-muted-foreground"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await removeProgressEntry(id);
          if (result.ok) {
            router.refresh();
          } else {
            toast.error(result.error ?? "Couldn't delete that entry.");
          }
        })
      }
      size="sm"
      variant="ghost"
    >
      {pending ? "Deleting…" : "Delete"}
    </Button>
  );
}
