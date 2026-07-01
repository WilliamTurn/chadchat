"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState, useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { AuthStatus } from "@/components/chat/auth-status";
import { AuthSubmitButton } from "@/components/chat/auth-submit-button";
import { PasswordInput } from "@/components/chat/password-input";
import { PasswordStrength } from "@/components/chat/password-strength";
import { toast } from "@/components/chat/toast";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  type ResetPasswordFormValues,
  resetPasswordFormSchema,
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

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: { password: "", confirmPassword: "" },
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

  // useWatch (not form.watch) so this component re-renders on each keystroke
  // even with the React Compiler enabled.
  const password = useWatch({ control: form.control, name: "password" });
  const confirmPassword = useWatch({
    control: form.control,
    name: "confirmPassword",
  });
  const confirmMatches = !!confirmPassword && confirmPassword === password;

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

  const onSubmit = (values: ResetPasswordFormValues) => {
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
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-normal text-muted-foreground">
                  New password
                </FormLabel>
                <FormControl>
                  <PasswordInput
                    autoComplete="new-password"
                    autoFocus
                    placeholder="••••••••"
                    {...field}
                  />
                </FormControl>
                <PasswordStrength password={field.value} />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-normal text-muted-foreground">
                  Confirm new password
                </FormLabel>
                <FormControl>
                  <PasswordInput
                    autoComplete="new-password"
                    placeholder="••••••••"
                    {...field}
                  />
                </FormControl>
                {confirmMatches ? (
                  <p className="flex items-center gap-1.5 text-[12px] text-emerald-600 dark:text-emerald-500">
                    <CheckIcon className="size-3.5" strokeWidth={3} />
                    Passwords match
                  </p>
                ) : (
                  <FormMessage />
                )}
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
