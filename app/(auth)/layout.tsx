import { ArrowLeftIcon, Dumbbell } from "lucide-react";
import Link from "next/link";
import { Toaster } from "sonner";
import { Preview } from "@/components/chat/preview";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh w-screen bg-sidebar">
      {/* Without this, the sign-up / sign-in error messages (e.g. "use at least
          8 characters", "account already exists") never render. */}
      <Toaster
        position="top-center"
        theme="system"
        toastOptions={{
          className:
            "!bg-card !text-foreground !border-border/50 !shadow-[var(--shadow-float)]",
        }}
      />
      {/* overflow-y-auto (not hidden): a tall form (e.g. sign-up with the
          password checklist + confirm field) must scroll, never clip the
          submit button. justify-center still centers it when it fits. */}
      <div className="relative flex w-full flex-col overflow-y-auto bg-background p-8 xl:w-[600px] xl:shrink-0 xl:rounded-r-2xl xl:border-r xl:border-border/40 md:p-16">
        {/* Brand warmth on the screens too narrow for the showcase panel (below
            xl): a faint blood glow so the form doesn't sit on a flat slab. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-blood/[0.06] blur-3xl xl:hidden"
        />
        <Link
          className="flex w-fit items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          href="/"
        >
          <ArrowLeftIcon className="size-3.5" />
          Back
        </Link>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-10">
          <div className="flex flex-col gap-2">
            {/* ACC-3: the real CHAD mark (dumbbell + wordmark), matching the
                in-app header, instead of a generic sparkles icon. */}
            <div className="mb-2 flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-lg bg-muted/60 ring-1 ring-border/50">
                <Dumbbell className="text-blood" size={16} strokeWidth={2.5} />
              </span>
              <span className="font-display font-bold text-[15px] tracking-[0.14em]">
                CHAD
              </span>
            </div>
            {children}
          </div>
        </div>
      </div>

      {/* ACC-16: the cinematic hype-reel montage carries its own branding, so
          it bleeds to the panel edges (just a little inset breathing room). */}
      <div className="hidden flex-1 overflow-hidden p-3 xl:block">
        <Preview />
      </div>
    </div>
  );
}
