"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  removeMealAnalysis,
  undoRemoveMealAnalysis,
} from "@/app/nutrition/actions";
import { Button } from "@/components/ui/button";

export function DeleteAnalysisButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      className="text-muted-foreground"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await removeMealAnalysis(id);
          if (!result.ok) {
            toast.error(result.error ?? "Couldn't delete that.");
            return;
          }
          router.refresh();
          // Undo-on-delete (FN-10): the standard Gmail/Hevy pattern. The row
          // is already gone server-side; Undo re-inserts it.
          const deleted = result.deleted;
          if (deleted) {
            toast(deleted.kind === "meal" ? "Meal deleted." : "Photo deleted.", {
              duration: 8000,
              action: {
                label: "Undo",
                onClick: () => {
                  startTransition(async () => {
                    const restored = await undoRemoveMealAnalysis(deleted);
                    if (restored.ok) {
                      router.refresh();
                    } else {
                      toast.error(
                        restored.error ?? "Couldn't restore that entry."
                      );
                    }
                  });
                },
              },
            });
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
