import { withBotId } from "botid/next/config";
import type { NextConfig } from "next";

const basePath = process.env.IS_DEMO === "1" ? "/demo" : "";

const nextConfig: NextConfig = {
  ...(basePath
    ? {
        basePath,
        assetPrefix: "/demo-assets",
      }
    : {}),
  redirects: async () => [
    // "Dashboard" is the nav label for /today; /dashboard itself was never a
    // route and used to hard-404 (NAV-32). Alias it to the real dashboard so a
    // guessed/bookmarked /dashboard lands somewhere sensible. Runs before the
    // auth proxy, so it works whether or not the visitor is signed in.
    { source: "/dashboard", destination: "/today", permanent: false },
    // FIX-20 (P3) alias redirects: guessed/legacy URLs land on the registered
    // destination (`lib/contracts/routes.ts`) instead of a 404. All temporary
    // (307): P5 re-maps /progress to a cross-domain view, so nothing here may
    // cache as permanent.
    { source: "/chat", destination: "/", permanent: false },
    { source: "/coach", destination: "/", permanent: false },
    { source: "/water", destination: "/hydration", permanent: false },
    // FIX-31 (P5, DEC-02): body tracking moved to /progress/body; /progress is
    // now the cross-domain overview. Legacy body aliases land on the body page.
    { source: "/weight", destination: "/progress/body", permanent: false },
    { source: "/body", destination: "/progress/body", permanent: false },
    { source: "/food", destination: "/nutrition", permanent: false },
    { source: "/meals", destination: "/nutrition", permanent: false },
    { source: "/calories", destination: "/nutrition", permanent: false },
    { source: "/workout", destination: "/workouts", permanent: false },
    { source: "/settings", destination: "/account", permanent: false },
    { source: "/billing", destination: "/account", permanent: false },
    { source: "/report", destination: "/reports", permanent: false },
    { source: "/quit", destination: "/quit-date", permanent: false },
    { source: "/quit-test", destination: "/quit-date", permanent: false },
    ...(basePath
      ? [
          {
            source: "/",
            destination: basePath,
            permanent: false,
            basePath: false as const,
          },
        ]
      : []),
  ],
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  cacheComponents: true,
  // jspdf is a browser-only PDF lib (loaded lazily client-side for goal/plan
  // export). Externalize it so its Node build — which pulls in a Web Worker
  // path Turbopack can't bundle — isn't pulled into the server/SSR graph.
  serverExternalPackages: ["jspdf"],
  devIndicators: false,
  poweredByHeader: false,
  reactCompiler: true,
  logging: {
    fetches: {
      fullUrl: false,
    },
    incomingRequests: false,
  },
  images: {
    remotePatterns: [
      {
        hostname: "avatar.vercel.sh",
      },
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
  experimental: {
    prefetchInlining: true,
    cachedNavigations: true,
    appNewScrollHandler: true,
    inlineCss: true,
    turbopackFileSystemCacheForDev: true,
  },
};

export default withBotId(nextConfig);
