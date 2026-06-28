"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { AuthSubmitButton } from "@/components/chat/auth-submit-button";
import { toast } from "@/components/chat/toast";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  type RequestResetValues,
  requestResetSchema,
} from "@/lib/validation/auth";
import { type RequestResetActionState, requestPasswordReset } from "../actions";

export default function Page() {
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const form = useForm<RequestResetValues>({
    resolver: zodResolver(requestResetSchema),
    defaultValues: { email: "" },
    mode: "onTouched",
  });

  const [state, formAction, isPending] = useActionState<
    RequestResetActionState,
    FormData
  >(requestPasswordReset, { status: "idle" });

  useEffect(() => {
    if (state.status === "failed" || state.status === "invalid_data") {
      toast({
        type: "error",
        description: "Something went wrong. Please try again.",
      });
    } else if (state.status === "success") {
      setSubmittedEmail(form.getValues("email"));
    }
  }, [state.status, form]);

  if (submittedEmail) {
    return (
      <>
        <h1 className="font-semibold text-2xl tracking-tight">
          Check your email
        </h1>
        <p className="text-muted-foreground text-sm">
          {`If an account exists for ${submittedEmail}, we've sent a link to reset your password. The link expires in 1 hour.`}
        </p>
        <Link
          className="text-[13px] text-foreground underline-offset-4 hover:underline"
          href="/login"
        >
          Back to sign in
        </Link>
      </>
    );
  }

  const onSubmit = (values: RequestResetValues) => {
    const formData = new FormData();
    formData.set("email", values.email);
    formAction(formData);
  };

  return (
    <>
      <h1 className="font-semibold text-2xl tracking-tight">
        Reset your password
      </h1>
      <p className="text-muted-foreground text-sm">
        Enter your email and we'll send you a link to set a new password.
      </p>
      <Form {...form}>
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
          <AuthSubmitButton isPending={isPending}>
            Send reset link
          </AuthSubmitButton>
          <p className="text-center text-[13px] text-muted-foreground">
            {"Remembered it? "}
            <Link
              className="text-foreground underline-offset-4 hover:underline"
              href="/login"
            >
              Sign in
            </Link>
          </p>
        </form>
      </Form>
    </>
  );
}
