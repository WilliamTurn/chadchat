"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

/**
 * Client chrome for the fixture harness (P2-A): theme toggle + live viewport
 * width readout, so auditors and screenshot scripts always know exactly what
 * they are looking at. Dev-only surface; never imported by product pages.
 */
export function FixtureChrome() {
  const { resolvedTheme, setTheme } = useTheme();
  const [width, setWidth] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const update = () => setWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div className="flex items-center gap-3">
      <span
        className="font-mono text-muted-foreground text-xs tabular-nums"
        data-testid="viewport-width"
      >
        {width == null ? "" : `${width}px`}
      </span>
      {mounted && (
        <button
          aria-label={
            resolvedTheme === "dark"
              ? "Switch to light theme"
              : "Switch to dark theme"
          }
          className="flex size-11 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-muted"
          data-testid="theme-toggle"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          type="button"
        >
          {resolvedTheme === "dark" ? (
            <Sun className="size-4" />
          ) : (
            <Moon className="size-4" />
          )}
        </button>
      )}
    </div>
  );
}
