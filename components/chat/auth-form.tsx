"use client";

import { CheckIcon } from "lucide-react";
import { type UseFormReturn, useWatch } from "react-hook-form";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "./password-input";
import { PasswordStrength } from "./password-strength";

// Login and register share the same field shape; only their validation differs.
// Register also carries a confirm-password field (optional here so login, which
// never renders it, still type-checks). Both pages type their form to this
// superset so this component can stay concrete (a generic form type trips
// react-hook-form's `Path<T>` inference).
export type AuthFormValues = {
  email: string;
  password: string;
  confirmPassword?: string;
};

export function AuthForm({
  form,
  onSubmit,
  showPasswordStrength = false,
  showConfirmPassword = false,
  children,
}: {
  form: UseFormReturn<AuthFormValues>;
  onSubmit: (values: AuthFormValues) => void;
  // Sign-up shows a live strength meter + requirements checklist (ACC-18).
  showPasswordStrength?: boolean;
  // Sign-up also asks the user to re-enter and match their password.
  showConfirmPassword?: boolean;
  children: React.ReactNode;
}) {
  // useWatch (not form.watch) so this parent re-renders on every keystroke —
  // form.watch's subscription gets memoized away by the React Compiler here,
  // which left the match affordance stale.
  const password = useWatch({ control: form.control, name: "password" });
  const confirmPassword = useWatch({
    control: form.control,
    name: "confirmPassword",
  });
  // If the two are equal there's no mismatch error to worry about, so a plain
  // value comparison is enough; the red FormMessage handles the not-equal case.
  const confirmMatches =
    showConfirmPassword && !!confirmPassword && confirmPassword === password;

  return (
    <Form {...form}>
      {/* noValidate: our inline messages replace the browser's native popups. */}
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-normal text-muted-foreground">
                Email
              </FormLabel>
              <FormControl>
                <Input
                  autoComplete="email"
                  autoFocus
                  placeholder="you@someo.ne"
                  type="email"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-normal text-muted-foreground">
                Password
              </FormLabel>
              <FormControl>
                <PasswordInput
                  autoComplete={
                    showConfirmPassword ? "new-password" : "current-password"
                  }
                  placeholder="••••••••"
                  {...field}
                />
              </FormControl>
              {showPasswordStrength && (
                <PasswordStrength password={field.value} />
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        {showConfirmPassword && (
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-normal text-muted-foreground">
                  Confirm password
                </FormLabel>
                <FormControl>
                  <PasswordInput
                    autoComplete="new-password"
                    placeholder="••••••••"
                    {...field}
                  />
                </FormControl>
                {/* Positive affordance once the two match; the red FormMessage
                    takes over when they don't. */}
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
        )}

        {children}
      </form>
    </Form>
  );
}
