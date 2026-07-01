"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { deleteMemberAction, type GrantState } from "@/app/ops-x9f2q7k3/actions";
import { Button } from "@/components/ui/button";

const INITIAL: GrantState = { status: "idle", message: "" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      className="sm:w-auto"
      disabled={pending}
      type="submit"
      variant="destructive"
    >
      {pending ? "Deleting…" : "Permanently delete this member"}
    </Button>
  );
}

/**
 * In-context delete for a member's detail page. Carries the user id in a hidden
 * field so the admin never has to re-type an email, and requires the confirm
 * checkbox. On success the action redirects back to the directory.
 */
export function DeleteMemberButton({
  id,
  email,
}: {
  id: string;
  email: string;
}) {
  const [state, formAction] = useActionState(deleteMemberAction, INITIAL);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input name="id" type="hidden" value={id} />

      <label className="flex items-center gap-2 text-muted-foreground text-sm">
        <input
          className="size-4 rounded border-input accent-destructive"
          name="confirm"
          type="checkbox"
        />
        Yes, permanently delete {email} and all their data.
      </label>

      <SubmitButton />

      {state.status !== "idle" && (
        <p
          className={
            state.status === "success"
              ? "text-emerald-600 text-sm dark:text-emerald-400"
              : "text-destructive text-sm"
          }
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
