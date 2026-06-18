import { z } from "zod";

// One source of truth for auth validation, shared by the client forms
// (react-hook-form via zodResolver) and the server actions (final enforcement).
// The messages here are what render inline under each field — there is no
// separate hand-written copy anywhere.

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_REQUIREMENT = `At least ${PASSWORD_MIN_LENGTH} characters`;

const emailField = z
  .string()
  .min(1, "Email is required")
  .email("Enter a valid email address");

// Sign in: keep the password rule permissive (just "required") so existing
// members created under older rules are never locked out of their account.
export const loginFormSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Password is required"),
});

// Sign up: enforce the current standard — 8+ characters.
export const registerFormSchema = z.object({
  email: emailField,
  password: z
    .string()
    .min(1, "Password is required")
    .min(PASSWORD_MIN_LENGTH, PASSWORD_REQUIREMENT),
});

// Forgot password: just the email to send a reset link to.
export const requestResetSchema = z.object({
  email: emailField,
});

// Reset password: the emailed token plus the new password (same 8+ rule).
export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z
    .string()
    .min(1, "Password is required")
    .min(PASSWORD_MIN_LENGTH, PASSWORD_REQUIREMENT),
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;
export type RegisterFormValues = z.infer<typeof registerFormSchema>;
export type RequestResetValues = z.infer<typeof requestResetSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
