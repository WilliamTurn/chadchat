"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useActionState, useEffect, useState } from "react";
import { type Resolver, useForm } from "react-hook-form";

import { AuthForm, type AuthFormValues } from "@/components/chat/auth-form";
import { AuthSubmitButton } from "@/components/chat/auth-submit-button";
import { GoogleSignIn } from "@/components/chat/google-sign-in";
import { toast } from "@/components/chat/toast";
import { registerFormSchema } from "@/lib/validation/auth";
import { type RegisterActionState, register } from "../actions";

export default function Page() {
  const router = useRouter();
  const [isSuccessful, setIsSuccessful] = useState(false);

  const form = useForm<AuthFormValues>({
    // Cast: the schema makes confirmPassword required (for the match rule) while
    // the shared AuthFormValues keeps it optional (login has no such field).
    resolver: zodResolver(registerFormSchema) as Resolver<AuthFormValues>,
    defaultValues: { email: "", password: "", confirmPassword: "" },
    mode: "onTouched",
  });

  const [state, formAction, isPending] = useActionState<
    RegisterActionState,
    FormData
  >(register, { status: "idle" });

  const { update: updateSession } = useSession();

  // biome-ignore lint/correctness/useExhaustiveDependencies: router/updateSession/form are stable refs
  useEffect(() => {
    if (state.status === "user_exists") {
      // Surface inline on the field that caused it, not as a vague toast.
      form.setError("email", {
        message: "An account with this email already exists",
      });
    } else if (state.status === "failed" || state.status === "invalid_data") {
      toast({
        type: "error",
        description: "Something went wrong. Please try again.",
      });
    } else if (state.status === "success") {
      setIsSuccessful(true);
      updateSession();
      router.refresh();
    }
  }, [state.status]);

  const onSubmit = (values: AuthFormValues) => {
    const formData = new FormData();
    formData.set("email", values.email);
    formData.set("password", values.password);
    formAction(formData);
  };

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Create account</h1>
      <p className="text-sm text-muted-foreground">Get started for free</p>
      <GoogleSignIn />
      <AuthForm
        form={form}
        onSubmit={onSubmit}
        showConfirmPassword
        showPasswordStrength
      >
        <AuthSubmitButton isPending={isPending} isSuccessful={isSuccessful}>
          Sign up
        </AuthSubmitButton>
        <p className="text-center text-[13px] text-muted-foreground">
          {"Have an account? "}
          <Link
            className="text-foreground underline-offset-4 hover:underline"
            href="/login"
          >
            Sign in
          </Link>
        </p>
      </AuthForm>
    </>
  );
}
