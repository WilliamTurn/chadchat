import type { NextAuthConfig } from "next-auth";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const authConfig = {
  basePath: "/api/auth",
  trustHost: true,
  pages: {
    signIn: `${base}/login`,
    newUser: `${base}/today`,
    // Surface OAuth/sign-in failures on the login page (it reads `?error=` and
    // toasts a friendly message) instead of the default bare /api/auth/error.
    error: `${base}/login`,
  },
  providers: [],
  callbacks: {},
} satisfies NextAuthConfig;
