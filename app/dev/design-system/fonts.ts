import localFont from "next/font/local";

/* Design-system display faces (self-hosted, OFL) — ported 1:1 from
   chadlatest/app/design-system/fonts.ts (the approved sheet's wiring).
   Bodoni Moda moved to app/fonts.ts and app/layout.tsx in W3, when
   /progress/training became the first member surface composed from
   --f-display (the move this file's original note called for). Playfair
   stays registered here ONLY: it exists for the sheet's section-02
   comparison row, never for member surfaces. */

export { bodoni } from "@/app/fonts";

export const playfair = localFont({
  src: [
    {
      path: "../../fonts/PlayfairDisplay-Variable.ttf",
      weight: "400 900",
      style: "normal",
    },
    {
      path: "../../fonts/PlayfairDisplay-Italic-Variable.ttf",
      weight: "400 900",
      style: "italic",
    },
  ],
  variable: "--ds-playfair",
});
