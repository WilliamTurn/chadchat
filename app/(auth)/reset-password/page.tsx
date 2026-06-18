"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState, useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { LoaderIcon } from "@/components/chat/icons";
import { toast } from "@/components/chat/toast";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  PASSWORD_REQUIREMENT,
  type ResetPasswordValues,
  resetPasswordSchema,
} from "@/lib/validation/auth";
import { type ResetPasswordActionState, resetPassword } from "../actions";

const inputClassName =
  "h-10 rounded-lg border-border/50 bg-muted/50 text-sm transition-colors focus:border-foreground/20 focus:bg-muted";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [isDone, setIsDone] = useState(false);

  const form = useForm<Pick<ResetPasswordValues, "password">>({
    resolver: zodResolver(resetPasswordSchema.pick({ password: true })),
    defaultValues: { password: "" },
    mode: "onTouched",
  });

  const [state, formAction, isPending] = useActionState<
    ResetPasswordActionState,
    FormData
  >(resetPassword, { status: "idle" });

  useEffect(() => {
    if (state.status === "invalid_token") {
      toast({
        type: "error",
        description: "This reset link is invalid or has expired.",
      });
    } else if (state.status === "failed" || state.status === "invalid_data") {
      toast({
        type: "error",
        description: "Something went wrong. Please try again.",
      });
    } else if (state.status === "success") {
      setIsDone(true);
    }
  }, [state.status]);

  if (isDone) {
    return (
      <>
        <h1 className="font-semibold text-2xl tracking-tight">
          Password updated
        </h1>
        <p className="text-muted-foreground text-sm">
          Your password has been changed. You can now sign in with it.
        </p>
        <Link
          className="text-[13px] text-foreground underline-offset-4 hover:underline"
          href="/login"
        >
          Go to sign in
        </Link>
      </>
    );
  }

  if (!token) {
    return (
      <>
        <h1 className="font-semibold text-2xl tracking-tight">
          Invalid reset link
        </h1>
        <p className="text-muted-foreground text-sm">
          This link is missing its reset token. Request a new one.
        </p>
        <Link
          className="text-[13px] text-foreground underline-offset-4 hover:underline"
          href="/forgot-password"
        >
          Request a new link
        </Link>
      </>
    );
  }

  const onSubmit = (values: Pick<ResetPasswordValues, "password">) => {
    const formData = new FormData();
    formData.set("token", token);
    formData.set("password", values.password);
    formAction(formData);
  };

  return (
    <>
      <h1 className="font-semibold text-2xl tracking-tight">
        Set a new password
      </h1>
      <p className="text-muted-foreground text-sm">
        Choose a new password for your account.
      </p>
      <Form {...form}>
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <FormField
            control={form.control}
            name="password"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel className="font-normal text-muted-foreground">
                  New password
                </FormLabel>
                <FormControl>
                  <Input
                    autoComplete="new-password"
                    autoFocus
                    className={inputClassName}
                    placeholder="••••••••"
                    type="password"
                    {...field}
                  />
                </FormControl>
                {!fieldState.error && (
                  <FormDescription>{PASSWORD_REQUIREMENT}</FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            className="relative"
            disabled={isPending || isDone}
            type="submit"
          >
            Update password
            {isPending && (
              <span className="absolute right-4 animate-spin">
                <LoaderIcon />
              </span>
            )}
          </Button>
        </form>
      </Form>
    </>
  );
}
