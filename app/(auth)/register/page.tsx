"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Suspense, useActionState, useEffect, useState } from "react";
import { type Resolver, useForm } from "react-hook-form";

import { AuthForm, type AuthFormValues } from "@/components/chat/auth-form";
import { AuthSubmitButton } from "@/components/chat/auth-submit-button";
import { GoogleSignIn } from "@/components/chat/google-sign-in";
import { toast } from "@/components/chat/toast";
import { registerFormSchema } from "@/lib/validation/auth";
import { type RegisterActionState, register } from "../actions";

export default function Page() {
  // useSearchParams (here and inside GoogleSignIn) needs a Suspense boundary
  // to prerender — same structure as the login page.
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
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

  // Keep the paywall's original destination (e.g. /pricing?plan=pro from the
  // landing funnel, ACC-20) alive when the user hops to the sign-in page.
  const redirectUrl = searchParams.get("redirectUrl");
  const loginHref = redirectUrl
    ? `/login?redirectUrl=${encodeURIComponent(redirectUrl)}`
    : "/login";

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
            href={loginHref}
          >
            Sign in
          </Link>
        </p>
      </AuthForm>
    </>
  );
}
