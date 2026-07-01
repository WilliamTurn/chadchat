"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { type GrantState, grantTierAction } from "@/app/ops-x9f2q7k3/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INITIAL: GrantState = { status: "idle", message: "" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button className="sm:w-auto" disabled={pending} type="submit">
      {pending ? "Applying…" : "Apply"}
    </Button>
  );
}

export function GrantAccessForm() {
  const [state, formAction] = useActionState(grantTierAction, INITIAL);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="admin-email">User email</Label>
        <Input
          autoComplete="off"
          id="admin-email"
          name="email"
          placeholder="someone@example.com"
          type="email"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="admin-tier">Tier</Label>
        <select
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          defaultValue="pro"
          id="admin-tier"
          name="tier"
        >
          <option value="pro">Chad Pro</option>
          <option value="basic">Chad Basic</option>
          <option value="none">Revoke access</option>
        </select>
      </div>

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
