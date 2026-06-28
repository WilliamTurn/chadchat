"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState, useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { AuthStatus } from "@/components/chat/auth-status";
import { AuthSubmitButton } from "@/components/chat/auth-submit-button";
import { PasswordStrength } from "@/components/chat/password-strength";
import { toast } from "@/components/chat/toast";
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
      <AuthStatus
        action={{ href: "/login", label: "Go to sign in" }}
        description="Your password has been changed. You can now sign in with it."
        title="Password updated"
        variant="success"
      />
    );
  }

  if (!token) {
    return (
      <AuthStatus
        action={{ href: "/forgot-password", label: "Request a new link" }}
        description="This link is missing its reset token. Request a new one."
        title="Invalid reset link"
        variant="expired"
      />
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
                    placeholder="••••••••"
                    type="password"
                    {...field}
                  />
                </FormControl>
                <PasswordStrength password={field.value} />
                {!fieldState.error && (
                  <FormDescription>{PASSWORD_REQUIREMENT}</FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
          <AuthSubmitButton isPending={isPending} isSuccessful={isDone}>
            Update password
          </AuthSubmitButton>
        </form>
      </Form>
    </>
  );
}
