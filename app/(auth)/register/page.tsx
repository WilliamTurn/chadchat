"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useActionState, useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { AuthForm } from "@/components/chat/auth-form";
import { GoogleSignIn } from "@/components/chat/google-sign-in";
import { LoaderIcon } from "@/components/chat/icons";
import { toast } from "@/components/chat/toast";
import { Button } from "@/components/ui/button";
import {
  type RegisterFormValues,
  registerFormSchema,
} from "@/lib/validation/auth";
import { type RegisterActionState, register } from "../actions";

export default function Page() {
  const router = useRouter();
  const [isSuccessful, setIsSuccessful] = useState(false);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: { email: "", password: "" },
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

  const onSubmit = (values: RegisterFormValues) => {
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
        showPasswordRequirement
        showPasswordStrength
      >
        <Button
          className="relative"
          disabled={isPending || isSuccessful}
          type="submit"
        >
          Sign up
          {(isPending || isSuccessful) && (
            <span className="absolute right-4 animate-spin">
              <LoaderIcon />
            </span>
          )}
        </Button>
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
