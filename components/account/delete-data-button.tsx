"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteMyData } from "@/app/account/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * "Delete my data" on /account: wipes every log, chat, photo record, and
 * everything Chad has written about the member, keeping the account + plan.
 * Standard destructive pattern: confirm dialog + typed DELETE guard.
 */
export function DeleteDataButton() {
  const [confirmText, setConfirmText] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteMyData();
        toast.success("Done. All of your data has been deleted.");
      } catch {
        toast.error("Couldn't delete your data. Try again.");
      }
    });
  }

  return (
    <AlertDialog onOpenChange={() => setConfirmText("")}>
      <AlertDialogTrigger asChild>
        <Button className="gap-2" variant="destructive">
          <Trash2 className="size-4" />
          Delete my data
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete all of your data?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes everything: your chats with Chad, workout
            and nutrition logs, weigh-ins, photos, sleep and water logs, goals
            and plans, reports, and everything Chad remembers about you. Your
            account and membership stay so you can start over. This can&apos;t
            be undone. Type <span className="font-semibold">DELETE</span> to
            confirm.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Input
          aria-label="Type DELETE to confirm"
          autoComplete="off"
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="DELETE"
          value={confirmText}
        />
        <AlertDialogFooter>
          <AlertDialogCancel>Keep my data</AlertDialogCancel>
          {/* variant (not class overrides): AlertDialogAction slots classes
              together without tailwind-merge, so bg utilities collide and the
              ghosted state rendered gray-on-gray (owner report, s157). The
              destructive variant + a readable disabled opacity keep "Delete
              everything" legible even before DELETE is typed. */}
          <AlertDialogAction
            className="disabled:opacity-60"
            disabled={confirmText.trim() !== "DELETE" || isPending}
            onClick={handleDelete}
            variant="destructive"
          >
            {isPending ? "Deleting..." : "Delete everything"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
