"use server";

import { z } from "zod";

import {
  expiryFromNow,
  generateToken,
  hashToken,
  PASSWORD_RESET_TTL_MS,
  VERIFICATION_TOKEN_TTL_MS,
} from "@/lib/auth/tokens";
import {
  consumePasswordResetToken,
  createEmailVerificationToken,
  createPasswordResetToken,
  createUser,
  getUser,
  getUserById,
  markEmailVerified,
  updateUserPassword,
} from "@/lib/db/queries";
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "@/lib/email/auth-emails";
import {
  loginFormSchema,
  registerFormSchema,
  requestResetSchema,
  resetPasswordSchema,
} from "@/lib/validation/auth";

import { auth, signIn } from "./auth";

/**
 * Generate + store a verification token and email the link. Best-effort: a
 * failure here must never block signup, so callers wrap it in try/catch.
 */
async function issueVerificationEmail(userId: string, email: string) {
  const token = generateToken();
  await createEmailVerificationToken(
    userId,
    hashToken(token),
    expiryFromNow(VERIFICATION_TOKEN_TTL_MS)
  );
  await sendVerificationEmail(email, token);
}

export type LoginActionState = {
  status: "idle" | "in_progress" | "success" | "failed" | "invalid_data";
};

export const login = async (
  _: LoginActionState,
  formData: FormData
): Promise<LoginActionState> => {
  try {
    const validatedData = loginFormSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    await signIn("credentials", {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
    });

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "invalid_data" };
    }

    return { status: "failed" };
  }
};

export type RegisterActionState = {
  status:
    | "idle"
    | "in_progress"
    | "success"
    | "failed"
    | "user_exists"
    | "invalid_data";
};

export const register = async (
  _: RegisterActionState,
  formData: FormData
): Promise<RegisterActionState> => {
  try {
    const validatedData = registerFormSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    const [user] = await getUser(validatedData.email);

    if (user) {
      return { status: "user_exists" } as RegisterActionState;
    }

    await createUser(validatedData.email, validatedData.password);

    // Soft email verification: send the link but never block signup on it.
    try {
      const [created] = await getUser(validatedData.email);
      if (created) {
        await issueVerificationEmail(created.id, created.email);
      }
    } catch (_emailError) {
      // Swallow — the user can resend from the in-app banner.
    }

    await signIn("credentials", {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
    });

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "invalid_data" };
    }

    return { status: "failed" };
  }
};

export type ResendVerificationState = {
  status: "idle" | "success" | "already_verified" | "failed";
};

/** Re-send the verification email to the currently signed-in user. */
export const resendVerificationEmail =
  async (): Promise<ResendVerificationState> => {
    try {
      const session = await auth();
      if (!session?.user?.id) {
        return { status: "failed" };
      }

      const dbUser = await getUserById(session.user.id);
      if (!dbUser || dbUser.isAnonymous) {
        return { status: "failed" };
      }
      if (dbUser.emailVerified) {
        return { status: "already_verified" };
      }

      await issueVerificationEmail(dbUser.id, dbUser.email);
      return { status: "success" };
    } catch (_error) {
      return { status: "failed" };
    }
  };

export type RequestResetActionState = {
  status: "idle" | "success" | "invalid_data" | "failed";
};

/**
 * Start a password reset. Always reports success (even for unknown emails) so
 * the form can't be used to discover which addresses have accounts.
 */
export const requestPasswordReset = async (
  _: RequestResetActionState,
  formData: FormData
): Promise<RequestResetActionState> => {
  try {
    const { email } = requestResetSchema.parse({
      email: formData.get("email"),
    });

    const [dbUser] = await getUser(email);
    if (dbUser && !dbUser.isAnonymous) {
      const token = generateToken();
      await createPasswordResetToken(
        dbUser.id,
        hashToken(token),
        expiryFromNow(PASSWORD_RESET_TTL_MS)
      );
      try {
        await sendPasswordResetEmail(dbUser.email, token);
      } catch (_emailError) {
        // Don't reveal send failures to the client; the link is still valid
        // and can be re-requested.
      }
    }

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "invalid_data" };
    }
    return { status: "failed" };
  }
};

export type ResetPasswordActionState = {
  status: "idle" | "success" | "invalid_token" | "invalid_data" | "failed";
};

export const resetPassword = async (
  _: ResetPasswordActionState,
  formData: FormData
): Promise<ResetPasswordActionState> => {
  try {
    const { token, password } = resetPasswordSchema.parse({
      token: formData.get("token"),
      password: formData.get("password"),
    });

    const userId = await consumePasswordResetToken(hashToken(token));
    if (!userId) {
      return { status: "invalid_token" };
    }

    await updateUserPassword(userId, password);
    // Resetting via the emailed link also proves they own the inbox.
    await markEmailVerified(userId);

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "invalid_data" };
    }
    return { status: "failed" };
  }
};
