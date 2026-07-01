import { z } from "zod";

// One source of truth for auth validation, shared by the client forms
// (react-hook-form via zodResolver) and the server actions (final enforcement).
// The messages here are what render inline under each field — there is no
// separate hand-written copy anywhere.

export const PASSWORD_MIN_LENGTH = 8;

// The live requirements checklist (ACC-18). This single list drives BOTH the
// ticking UI in <PasswordStrength> AND the zod rule below, so the checkboxes a
// user sees are exactly what the server enforces — they can never disagree.
// The rules (regex + copy) are taken verbatim from Origin UI's comp-51
// (github.com/origin-space/originui @ 731f798 · registry/default/components/comp-51.tsx),
// the same component <PasswordStrength> is ported from.
export const PASSWORD_REQUIREMENTS = [
  { label: "At least 8 characters", test: (v: string) => /.{8,}/.test(v) },
  { label: "At least 1 number", test: (v: string) => /[0-9]/.test(v) },
  {
    label: "At least 1 lowercase letter",
    test: (v: string) => /[a-z]/.test(v),
  },
  {
    label: "At least 1 uppercase letter",
    test: (v: string) => /[A-Z]/.test(v),
  },
] as const;

// Kept for the sign-in helper text only ("At least 8 characters"): sign-up now
// shows the full checklist instead.
export const PASSWORD_REQUIREMENT = `At least ${PASSWORD_MIN_LENGTH} characters`;

const emailField = z
  .string()
  .min(1, "Email is required")
  .email("Enter a valid email address");

// A new password must satisfy every requirement in the checklist. The message
// is deliberately generic — the checklist itself tells the user which rule is
// unmet, so the FormMessage would just be noise if it repeated them.
const newPasswordField = z
  .string()
  .min(1, "Password is required")
  .refine(
    (v) => PASSWORD_REQUIREMENTS.every((r) => r.test(v)),
    "Password doesn't meet all the requirements below"
  );

// Adds a "confirm password" field to an object schema and enforces that the two
// match, surfacing the error on the confirm field (where the affordance lives).
const withConfirm = <T extends z.ZodRawShape>(shape: T) =>
  z
    .object({
      ...shape,
      confirmPassword: z.string().min(1, "Please re-enter your password"),
    })
    .refine((d) => d.password === d.confirmPassword, {
      message: "Passwords don't match",
      path: ["confirmPassword"],
    });

// --- Server-side schemas (password-only; no confirm field is sent) -----------

// Sign in: keep the password rule permissive (just "required") so existing
// members created under older rules are never locked out of their account.
export const loginFormSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Password is required"),
});

// Sign up (server): enforce the full requirements checklist.
export const registerSchema = z.object({
  email: emailField,
  password: newPasswordField,
});

// Forgot password: just the email to send a reset link to.
export const requestResetSchema = z.object({
  email: emailField,
});

// Reset password (server): the emailed token plus the new password.
export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: newPasswordField,
});

// --- Client form schemas (add the confirm-password field + match rule) -------

export const registerFormSchema = withConfirm({
  email: emailField,
  password: newPasswordField,
});

// The reset form only edits the password (the token comes from the URL).
export const resetPasswordFormSchema = withConfirm({
  password: newPasswordField,
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;
export type RegisterFormValues = z.infer<typeof registerFormSchema>;
export type RequestResetValues = z.infer<typeof requestResetSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
export type ResetPasswordFormValues = z.infer<typeof resetPasswordFormSchema>;
