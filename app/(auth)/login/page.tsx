"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Suspense, useActionState, useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { AuthForm, type AuthFormValues } from "@/components/chat/auth-form";
import { AuthSubmitButton } from "@/components/chat/auth-submit-button";
import { GoogleSignIn } from "@/components/chat/google-sign-in";
import { toast } from "@/components/chat/toast";
import { loginFormSchema } from "@/lib/validation/auth";
import { type LoginActionState, login } from "../actions";

/** Friendly copy for the `?error=` code Auth.js appends after a failed OAuth flow. */
function oauthErrorMessage(code: string): string {
  switch (code) {
    case "OAuthAccountNotLinked":
      return "That email is already registered with a password. Sign in with your email and password below.";
    case "AccessDenied":
      return "Google sign-in was cancelled or denied. Please try again.";
    default:
      return "Couldn't sign in with Google. Please try again.";
  }
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSuccessful, setIsSuccessful] = useState(false);

  const form = useForm<AuthFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: "", password: "" },
    mode: "onTouched",
  });

  const [state, formAction, isPending] = useActionState<
    LoginActionState,
    FormData
  >(login, { status: "idle" });

  const { update: updateSession } = useSession();

  // biome-ignore lint/correctness/useExhaustiveDependencies: router/updateSession are stable refs
  useEffect(() => {
    if (state.status === "google_only") {
      toast({
        type: "error",
        description:
          'This account uses Google sign-in. Use "Continue with Google" above.',
      });
    } else if (state.status === "failed" || state.status === "invalid_data") {
      toast({ type: "error", description: "Invalid email or password." });
    } else if (state.status === "success") {
      setIsSuccessful(true);
      updateSession();
      router.refresh();
    }
  }, [state.status]);

  // Surface a failed OAuth round-trip (Auth.js redirects here with `?error=`).
  useEffect(() => {
    const error = searchParams.get("error");
    if (error) {
      toast({ type: "error", description: oauthErrorMessage(error) });
    }
  }, [searchParams]);

  const onSubmit = (values: AuthFormValues) => {
    const formData = new FormData();
    formData.set("email", values.email);
    formData.set("password", values.password);
    formAction(formData);
  };

  // Keep the paywall's original destination (e.g. /pricing?plan=pro from the
  // landing funnel, ACC-20) alive when the user hops to the register page.
  const redirectUrl = searchParams.get("redirectUrl");
  const registerHref = redirectUrl
    ? `/register?redirectUrl=${encodeURIComponent(redirectUrl)}`
    : "/register";

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="text-sm text-muted-foreground">
        Sign in to your account to continue
      </p>
      <GoogleSignIn />
      <AuthForm form={form} onSubmit={onSubmit}>
        <AuthSubmitButton isPending={isPending} isSuccessful={isSuccessful}>
          Sign in
        </AuthSubmitButton>
        <p className="text-center text-[13px] text-muted-foreground">
          <Link
            className="text-foreground underline-offset-4 hover:underline"
            href="/forgot-password"
          >
            Forgot password?
          </Link>
        </p>
        <p className="text-center text-[13px] text-muted-foreground">
          {"No account? "}
          <Link
            className="text-foreground underline-offset-4 hover:underline"
            href={registerHref}
          >
            Sign up
          </Link>
        </p>
      </AuthForm>
    </>
  );
}
