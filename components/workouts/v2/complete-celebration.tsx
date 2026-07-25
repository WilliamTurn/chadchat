// Workout-complete celebration header (S2, owner order 2026-07-22): the red
// PartyPopper square becomes a struck gold medal: reward gold is the EARNED
// color (Q-C; --reward ramp in globals.css): with the title stamped in by
// the impact. All motion lives in complete-celebration.css (reduced-motion
// variant included there). Server component: the sequence is pure CSS.

import localFont from "next/font/local";
import "./complete-celebration.css";

/* The approved display face (wave0 Q-DS), registered scoped to this surface
   exactly like app/dev/design-system/fonts.ts does for the sheet: the
   variable resolves under this component's root only, so no other member
   surface pays for the font until the design-system port lands. Only the
   italic file loads: the title is the sheet-title voice (italic 400). */
const bodoni = localFont({
  src: [
    {
      path: "../../../app/fonts/BodoniModa-Italic-Variable.ttf",
      weight: "400 900",
      style: "italic",
    },
  ],
  variable: "--ds-bodoni",
  display: "swap",
});

/* Forge sparks thrown by the strike: fixed vectors (px), deterministic so
   server and client render identically. Upward-biased, max travel 76px -
   well inside a 320px viewport. */
const SPARKS: {
  dx: number;
  dy: number;
  s: number;
  delay: number;
  dur: number;
}[] = [
  { dx: -58, dy: -34, s: 3, delay: 0.5, dur: 0.62 },
  { dx: 44, dy: -52, s: 2.5, delay: 0.5, dur: 0.58 },
  { dx: -30, dy: -64, s: 2, delay: 0.52, dur: 0.7 },
  { dx: 62, dy: -18, s: 3, delay: 0.51, dur: 0.55 },
  { dx: 18, dy: -70, s: 2.5, delay: 0.53, dur: 0.75 },
  { dx: -70, dy: -8, s: 2, delay: 0.5, dur: 0.6 },
  { dx: 34, dy: -40, s: 2, delay: 0.54, dur: 0.52 },
  { dx: -46, dy: -50, s: 2.5, delay: 0.55, dur: 0.66 },
  { dx: 70, dy: -36, s: 2, delay: 0.52, dur: 0.72 },
  { dx: -16, dy: -56, s: 3, delay: 0.56, dur: 0.58 },
  { dx: 52, dy: 8, s: 2, delay: 0.53, dur: 0.5 },
  { dx: -60, dy: 18, s: 2, delay: 0.55, dur: 0.54 },
];

/* Reeded coin edge: 56 radial ticks between r=50.5 and r=55, the struck-coin
   signature detail. Deterministic module-scope math. */
const REEDING = Array.from({ length: 56 }, (_, i) => {
  const a = (i * Math.PI * 2) / 56;
  return {
    x1: 60 + Math.cos(a) * 50.5,
    y1: 60 + Math.sin(a) * 50.5,
    x2: 60 + Math.cos(a) * 55,
    y2: 60 + Math.sin(a) * 55,
  };
});

/* The app's own barbell mark (app/icon.svg geometry) engraved on the face:
   a medal carries its issuer's mark. Rendered twice: a warm highlight
   copy offset 1.2px below the dark cut, the classic engraving bevel.
   Scale 3.0 puts the mark at 48px of the 98px face (~49%), the Apple
   Fitness emblem band (taste-audit F-11: 1.9 left ~70% of the face
   empty). Far corner sits 26.6px from center, well inside the r=43.5
   engraved ring, so the reeded edge stays clear of the mark. */
function EngravedMark({ variant }: { variant: "cut" | "bevel" }) {
  return (
    <g
      fill="none"
      stroke={variant === "cut" ? "var(--reward-shadow)" : "var(--reward-hot)"}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeOpacity={variant === "cut" ? 0.85 : 0.5}
      strokeWidth={1.25}
      transform={`translate(12 ${variant === "cut" ? 12 : 13.2}) scale(3)`}
    >
      <path d="M10 16 H22" />
      <path d="M8 11.5 V20.5" />
      <path d="M11 13 V19" />
      <path d="M24 11.5 V20.5" />
      <path d="M21 13 V19" />
    </g>
  );
}

function MedalCoin() {
  return (
    <svg
      aria-hidden="true"
      className="cc-coin"
      role="presentation"
      viewBox="0 0 120 120"
    >
      <defs>
        <linearGradient id="cc-rim" x1="0" x2="1" y1="1" y2="0">
          <stop offset="0" style={{ stopColor: "var(--reward-shadow)" }} />
          <stop offset="0.35" style={{ stopColor: "var(--reward-deep)" }} />
          <stop offset="0.7" style={{ stopColor: "var(--reward)" }} />
          <stop offset="1" style={{ stopColor: "var(--reward-hot)" }} />
        </linearGradient>
        {/* Face base, lit top-left. The dark half ends at --reward-ember,
            never --reward-shadow: dark yellow at the ramp's hue reads
            olive at low luminance (taste-audit F-11); ember pulls the
            shadow toward warm bronze. Shadow stays on cuts and the rim. */}
        <linearGradient id="cc-face" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--reward-hot)" }} />
          <stop offset="0.4" style={{ stopColor: "var(--reward)" }} />
          <stop offset="0.75" style={{ stopColor: "var(--reward-deep)" }} />
          <stop offset="1" style={{ stopColor: "var(--reward-ember)" }} />
        </linearGradient>
        {/* Specular structure (F-11): a defined highlight lobe with tight
            falloff, painted as a tilted ellipse offset toward the
            top-left light source - not a centered radial wash. Reused at
            low opacity lower-right as the bounce light off the rim. */}
        <radialGradient id="cc-lobe">
          <stop
            offset="0"
            style={{ stopColor: "var(--reward-hot)", stopOpacity: 0.95 }}
          />
          <stop
            offset="0.32"
            style={{ stopColor: "var(--reward-hot)", stopOpacity: 0.5 }}
          />
          <stop
            offset="0.68"
            style={{ stopColor: "var(--reward-hot)", stopOpacity: 0.12 }}
          />
          <stop
            offset="1"
            style={{ stopColor: "var(--reward-hot)", stopOpacity: 0 }}
          />
        </radialGradient>
        {/* Broad low ambient so the face keeps a soft sheen outside the
            lobe (the old wash, demoted). */}
        <radialGradient cx="0.36" cy="0.3" id="cc-ambient" r="0.85">
          <stop
            offset="0"
            style={{ stopColor: "var(--reward-hot)", stopOpacity: 0.15 }}
          />
          <stop
            offset="1"
            style={{ stopColor: "var(--reward-hot)", stopOpacity: 0 }}
          />
        </radialGradient>
        {/* Edge occlusion: the face curves away toward the rim. */}
        <radialGradient id="cc-vin">
          <stop
            offset="0.72"
            style={{ stopColor: "var(--reward-ember)", stopOpacity: 0 }}
          />
          <stop
            offset="1"
            style={{ stopColor: "var(--reward-ember)", stopOpacity: 0.5 }}
          />
        </radialGradient>
        <clipPath id="cc-face-clip">
          <circle cx="60" cy="60" r="49" />
        </clipPath>
      </defs>
      {/* rim (bevel gradient runs opposite the face) */}
      <circle cx="60" cy="60" fill="url(#cc-rim)" r="57" />
      <circle
        cx="60"
        cy="60"
        fill="none"
        r="56.5"
        stroke="var(--reward-shadow)"
        strokeOpacity="0.55"
        strokeWidth="1"
      />
      {/* reeded edge */}
      <g stroke="var(--reward-shadow)" strokeOpacity="0.3" strokeWidth="1">
        {REEDING.map((t) => (
          <line
            key={`${t.x1}-${t.y1}`}
            x1={t.x1}
            x2={t.x2}
            y1={t.y1}
            y2={t.y2}
          />
        ))}
      </g>
      {/* polished face: base, then the lighting stack clipped to the face
          (the lobe kisses the upper-left rim like a real reflection),
          then the edge occlusion. Lighting sits under the engraving so
          the cuts stay crisp. */}
      <circle cx="60" cy="60" fill="url(#cc-face)" r="49" />
      <g clipPath="url(#cc-face-clip)">
        <circle cx="60" cy="60" fill="url(#cc-ambient)" r="49" />
        <ellipse
          fill="url(#cc-lobe)"
          rx="26"
          ry="15"
          transform="translate(41 36) rotate(-33)"
        />
        <ellipse
          fill="url(#cc-lobe)"
          opacity="0.16"
          rx="21"
          ry="10"
          transform="translate(77 83) rotate(-33)"
        />
      </g>
      <circle cx="60" cy="60" fill="url(#cc-vin)" r="49" />
      {/* engraved inner ring: dark cut with a light lower bevel */}
      <circle
        cx="60"
        cy="60.8"
        fill="none"
        r="43.5"
        stroke="var(--reward-hot)"
        strokeOpacity="0.4"
        strokeWidth="1"
      />
      <circle
        cx="60"
        cy="60"
        fill="none"
        r="43.5"
        stroke="var(--reward-shadow)"
        strokeOpacity="0.45"
        strokeWidth="1"
      />
      {/* the issuer's mark, struck into the face */}
      <EngravedMark variant="bevel" />
      <EngravedMark variant="cut" />
    </svg>
  );
}

export function CompleteCelebration({ title }: { title: string }) {
  return (
    <div className={`cc-root ${bodoni.variable}`}>
      <div aria-hidden="true" className="cc-atmo" />
      <div aria-hidden="true" className="cc-stage">
        <div className="cc-bloom" />
        <div className="cc-halo" />
        <div className="cc-medal-drop">
          <div className="cc-medal-settle">
            <MedalCoin />
            <div className="cc-sheen-clip">
              <div className="cc-sheen" />
            </div>
          </div>
        </div>
        <div className="cc-ring" />
        {SPARKS.map((p) => (
          <span
            className="cc-spark"
            key={`${p.dx}-${p.dy}`}
            style={
              {
                "--dx": `${p.dx}px`,
                "--dy": `${p.dy}px`,
                "--s": `${p.s}px`,
                "--delay": `${p.delay}s`,
                "--dur": `${p.dur}s`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
      <h1 className="cc-title">
        <span className="cc-title-sweep">Workout complete</span>
      </h1>
      <p className="cc-sub">
        {/* Explicit separator string: JSX dropped the space between the
            title expression and the middot. Non-breaking space before
            "too": at 384-390px the line wrapped with "too." alone under
            the headline (taste-audit F-9). */}
        {title}
        {" · "}saved to your history. Chad sees it&nbsp;too.
      </p>
    </div>
  );
}
