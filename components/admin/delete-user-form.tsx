"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { deleteUserAction, type GrantState } from "@/app/ops-x9f2q7k3/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
      {pending ? "Deleting…" : "Delete user"}
    </Button>
  );
}

export function DeleteUserForm() {
  const [state, formAction] = useActionState(deleteUserAction, INITIAL);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="delete-email">User email</Label>
        <Input
          autoComplete="off"
          id="delete-email"
          name="email"
          placeholder="throwaway@example.com"
          type="email"
        />
      </div>

      <label className="flex items-center gap-2 text-muted-foreground text-sm">
        <input
          className="size-4 rounded border-input accent-destructive"
          name="confirm"
          type="checkbox"
        />
        Yes, permanently delete this user and all their data.
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
