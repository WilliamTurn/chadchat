"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useActionState, useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { AuthForm } from "@/components/chat/auth-form";
import { LoaderIcon } from "@/components/chat/icons";
import { toast } from "@/components/chat/toast";
import { Button } from "@/components/ui/button";
import { type LoginFormValues, loginFormSchema } from "@/lib/validation/auth";
import { type LoginActionState, login } from "../actions";

export default function Page() {
  const router = useRouter();
  const [isSuccessful, setIsSuccessful] = useState(false);

  const form = useForm<LoginFormValues>({
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
    if (state.status === "failed" || state.status === "invalid_data") {
      toast({ type: "error", description: "Invalid email or password." });
    } else if (state.status === "success") {
      setIsSuccessful(true);
      updateSession();
      router.refresh();
    }
  }, [state.status]);

  const onSubmit = (values: LoginFormValues) => {
    const formData = new FormData();
    formData.set("email", values.email);
    formData.set("password", values.password);
    formAction(formData);
  };

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="text-sm text-muted-foreground">
        Sign in to your account to continue
      </p>
      <AuthForm form={form} onSubmit={onSubmit}>
        <Button
          className="relative"
          disabled={isPending || isSuccessful}
          type="submit"
        >
          Sign in
          {(isPending || isSuccessful) && (
            <span className="absolute right-4 animate-spin">
              <LoaderIcon />
            </span>
          )}
        </Button>
        <p className="text-center text-[13px] text-muted-foreground">
          {"No account? "}
          <Link
            className="text-foreground underline-offset-4 hover:underline"
            href="/register"
          >
            Sign up
          </Link>
        </p>
      </AuthForm>
    </>
  );
}
