"use client";

import type { UseFormReturn } from "react-hook-form";

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
import { PASSWORD_REQUIREMENT } from "@/lib/validation/auth";
import { PasswordStrength } from "./password-strength";

// Login and register share the same field shape; only their validation differs.
type AuthFormValues = {
  email: string;
  password: string;
};

export function AuthForm({
  form,
  onSubmit,
  showPasswordRequirement = false,
  showPasswordStrength = false,
  children,
}: {
  form: UseFormReturn<AuthFormValues>;
  onSubmit: (values: AuthFormValues) => void;
  // Sign-up shows the password rule as persistent helper text under the field.
  showPasswordRequirement?: boolean;
  // Sign-up also shows a live strength meter (UX nudge, not a hard gate).
  showPasswordStrength?: boolean;
  children: React.ReactNode;
}) {
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
                  // biome-ignore lint/a11y/noAutofocus: first field of a dedicated auth screen
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
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel className="font-normal text-muted-foreground">
                Password
              </FormLabel>
              <FormControl>
                <Input
                  autoComplete={
                    showPasswordRequirement ? "new-password" : "current-password"
                  }
                  placeholder="••••••••"
                  type="password"
                  {...field}
                />
              </FormControl>
              {showPasswordStrength && <PasswordStrength password={field.value} />}
              {/* Show the requirement as muted helper text; once it's violated,
                  the red FormMessage replaces it (same line turns red) rather
                  than stacking two identical lines. */}
              {showPasswordRequirement && !fieldState.error && (
                <FormDescription>{PASSWORD_REQUIREMENT}</FormDescription>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        {children}
      </form>
    </Form>
  );
}
