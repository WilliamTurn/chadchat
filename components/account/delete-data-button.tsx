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
import { Label } from "@/components/ui/label";

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
        toast.success("All of your data is deleted.");
      } catch {
        toast.error("Your data wasn't deleted. Nothing was removed. Try again.");
      }
    });
  }

  return (
    <AlertDialog onOpenChange={() => setConfirmText("")}>
      <AlertDialogTrigger asChild>
        {/* "your" not "my": copy never mixes my/your (canon 04 §138). */}
        <Button className="gap-2" variant="destructive">
          <Trash2 className="size-4" />
          Delete your data
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
            be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {/* The typed guard gets a visible, persistent label; a placeholder
            vanishes on the first keystroke (canon 04 §137, canon 01 §30). */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="delete-confirm-input">
            Type <span className="font-semibold">DELETE</span> to confirm.
          </Label>
          <Input
            autoComplete="off"
            id="delete-confirm-input"
            onChange={(e) => setConfirmText(e.target.value)}
            value={confirmText}
          />
        </div>
        <AlertDialogFooter>
          {/* Dismiss says "Cancel" (canon 01 §132); "Keep my data" also mixed
              my/your (canon 04 §138). */}
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          {/* variant (not class overrides): AlertDialogAction slots classes
              together without tailwind-merge, so bg utilities collide and the
              ghosted state rendered gray-on-gray (owner report, s157). The
              destructive variant + a readable disabled opacity keep "Delete
              everything" legible even before DELETE is typed. */}
          {/* One object phrase at every step: zone header, trigger, title,
              and confirm all say "your data" (canon 04 §132; canon 01 §132,
              §149 scope in the label; "everything" wrongly implied the
              account goes too). */}
          <AlertDialogAction
            className="disabled:opacity-60"
            disabled={confirmText.trim() !== "DELETE" || isPending}
            onClick={handleDelete}
            variant="destructive"
          >
            {isPending ? "Deleting..." : "Delete all of your data"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
