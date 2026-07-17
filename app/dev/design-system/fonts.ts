import localFont from "next/font/local";

/* Design-system display faces (self-hosted, OFL) — ported 1:1 from
   chadlatest/app/design-system/fonts.ts (the approved sheet's wiring).
   Bodoni Moda is the canonical display face; Playfair Display stays loaded
   for the sheet's section-02 comparison row.

   DELIBERATELY imported ONLY by the /dev/design-system fixture: the fonts
   must not load on any member surface until the design waves compose real
   screens from --f-display. When that happens, move these registrations to
   app/layout.tsx so --ds-bodoni / --ds-playfair resolve app-wide. */

export const bodoni = localFont({
  src: [
    {
      path: "../../fonts/BodoniModa-Variable.ttf",
      weight: "400 900",
      style: "normal",
    },
    {
      path: "../../fonts/BodoniModa-Italic-Variable.ttf",
      weight: "400 900",
      style: "italic",
    },
  ],
  variable: "--ds-bodoni",
});

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
