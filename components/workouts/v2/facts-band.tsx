// Key-facts band (W5, audit F-2): flat figures + spaced-caps labels for the
// workout detail and celebration states (comp-canon 05 #35/#87). All layout
// and rung reasoning lives in facts-band.css. Server component: pure markup.

import localFont from "next/font/local";
import "./facts-band.css";

/* The approved serif display face for data numerals (ds.css --f-display;
   upright, unlike the celebration title's italic file), registered scoped to
   this component's root exactly like complete-celebration.tsx does: the
   variable resolves under .fb-root only, so no other surface pays for the
   font until the app-wide registration lands. */
const bodoni = localFont({
  src: [
    {
      path: "../../../app/fonts/BodoniModa-Variable.ttf",
      weight: "400 900",
      style: "normal",
    },
  ],
  variable: "--fb-bodoni",
  display: "swap",
});

/* "1 h 12 min" → numerals full-size, unit words at 0.6em in --ink-soft (the
   design sheet's stat anatomy). A token is a numeral if it contains a digit
   ("12,450", "~320"); anything else ("h", "min") is a unit word. */
function Figure({ value }: { value: string }) {
  return (
    <dd className="fb-figure">
      {value.split(" ").map((token, i) => (
        <span
          className={/\d/.test(token) ? undefined : "fb-unit"}
          key={`${token}-${i}`}
        >
          {i > 0 ? " " : ""}
          {token}
        </span>
      ))}
    </dd>
  );
}

export function FactsBand({
  facts,
  center,
  className = "",
}: {
  facts: { label: string; value: string }[];
  center?: boolean;
  className?: string;
}) {
  return (
    <dl
      className={`fb-root ${bodoni.variable} ${center ? "fb-center" : ""} ${className}`}
    >
      {facts.map((fact) => (
        <div key={fact.label}>
          <dt className="fb-label">{fact.label}</dt>
          <Figure value={fact.value} />
        </div>
      ))}
    </dl>
  );
}
