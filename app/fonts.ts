import localFont from "next/font/local";

/* Bodoni Moda: the design system's canonical display face (--f-display in
   globals.css). Registered app-wide per the W2 port plan ("move these
   registrations to app/layout.tsx so --ds-bodoni resolves app-wide" once a
   real member surface composes from --f-display) — W3 (/progress/training)
   is that surface. Playfair stays registered inside the /dev/design-system
   fixture only: it exists for the sheet's comparison row, not for members. */
export const bodoni = localFont({
  src: [
    {
      path: "./fonts/BodoniModa-Variable.ttf",
      weight: "400 900",
      style: "normal",
    },
    {
      path: "./fonts/BodoniModa-Italic-Variable.ttf",
      weight: "400 900",
      style: "italic",
    },
  ],
  variable: "--ds-bodoni",
});
