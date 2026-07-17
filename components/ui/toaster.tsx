"use client";

import { useTheme } from "next-themes";
import { Toaster as SonnerToaster, type ToasterProps } from "sonner";

/**
 * THE app toast render surface (RC-5, the XPK-15 lost-confirmation class).
 * Mounted exactly ONCE, in the root layout: a toast fired right before a
 * navigation must survive the page it was fired on, and only a root mount
 * persists across every route change. Never mount a second <Toaster>
 * anywhere; two mounts on one route render every toast twice.
 *
 * Theme follows the app's ThemeProvider (members default to dark, DS-14),
 * not sonner's own OS detection, so toasts always match the surface they
 * sit on. richColors keeps success green and error red on every surface.
 */
export function Toaster() {
  const { theme = "system" } = useTheme();

  return (
    <SonnerToaster
      position="top-center"
      richColors
      theme={theme as ToasterProps["theme"]}
    />
  );
}
