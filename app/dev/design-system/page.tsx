import {
  Dumbbell,
  Ellipsis,
  Home,
  MessageCircle,
  Plus,
  TrendingUp,
  User,
  Utensils,
} from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { bodoni, playfair } from "./fonts";
import "./ds-sheet.css";

/**
 * DESIGN-SYSTEM REFERENCE SHEET (dev fixture, design-system-port session).
 *
 * The owner-approved proposal-2 sheet (chadlatest /design-system,
 * approved 2026-07-17) rebuilt through THIS repo's wiring: the tokens
 * resolve from app/globals.css :root and the display faces load from
 * app/dev/design-system/fonts.ts. It is the in-repo spec the design
 * waves compose against, and the proof the port is faithful.
 *
 * Markup and copy are 1:1 with chadlatest/app/design-system/page.tsx —
 * do not "improve" this page; fidelity to the approved sheet IS its job.
 *
 * Production exclusion: hard 404 outside development (the app/dev/fixtures
 * convention), FIXTURES_ENABLED=1 as the CI escape hatch, plus noindex.
 */

export const metadata: Metadata = {
  title: "Design system · reference sheet",
  robots: { index: false, follow: false },
};

/* Static star field for the reference stage (positions in % of stage).
   Hue follows the zone: white/gold near the ember, cyan near the water,
   purple in the sleep field. Only g-flagged stars glow. */
const STARS: Array<{ top: string; left: string; s: number; c: string; o: number; g?: boolean }> = [
  { top: "2%", left: "58%", s: 2, c: "#ffd9b0", o: 0.7, g: true },
  { top: "3%", left: "40%", s: 1, c: "#fff", o: 0.3 },
  { top: "4%", left: "78%", s: 3, c: "#ffc590", o: 0.95, g: true },
  { top: "6%", left: "66%", s: 1, c: "#fff3e0", o: 0.5 },
  { top: "7%", left: "84%", s: 2, c: "#ffe9d0", o: 0.6 },
  { top: "9%", left: "72%", s: 1, c: "#ffd9b0", o: 0.45 },
  { top: "10%", left: "50%", s: 1, c: "#fff", o: 0.25 },
  { top: "11%", left: "90%", s: 2, c: "#ffc590", o: 0.65, g: true },
  { top: "13%", left: "63%", s: 1, c: "#fff", o: 0.35 },
  { top: "15%", left: "80%", s: 2, c: "#ffe0b8", o: 0.55 },
  { top: "17%", left: "93%", s: 1, c: "#ffc590", o: 0.5 },
  { top: "19%", left: "70%", s: 1, c: "#fff", o: 0.3 },
  { top: "21%", left: "86%", s: 2, c: "#ffd9b0", o: 0.5 },
  { top: "22%", left: "8%", s: 1, c: "#fff", o: 0.28 },
  { top: "24%", left: "76%", s: 1, c: "#ffe9d0", o: 0.4 },
  { top: "26%", left: "90%", s: 1, c: "#fff", o: 0.3 },
  { top: "28%", left: "16%", s: 1, c: "#fff", o: 0.25 },
  { top: "34%", left: "88%", s: 2, c: "#bfe3ff", o: 0.5 },
  { top: "36%", left: "70%", s: 1, c: "#fff", o: 0.28 },
  { top: "37%", left: "6%", s: 1, c: "#bfe3ff", o: 0.45 },
  { top: "40%", left: "92%", s: 2, c: "#9bd6ff", o: 0.6, g: true },
  { top: "43%", left: "12%", s: 1, c: "#dcefff", o: 0.4 },
  { top: "44%", left: "55%", s: 1, c: "#dcefff", o: 0.3 },
  { top: "46%", left: "84%", s: 1, c: "#9bd6ff", o: 0.5 },
  { top: "48%", left: "20%", s: 2, c: "#bfe3ff", o: 0.45 },
  { top: "51%", left: "94%", s: 1, c: "#fff", o: 0.35 },
  { top: "53%", left: "8%", s: 2, c: "#9bd6ff", o: 0.55, g: true },
  { top: "56%", left: "78%", s: 1, c: "#bfe3ff", o: 0.4 },
  { top: "58%", left: "15%", s: 1, c: "#fff", o: 0.3 },
  { top: "61%", left: "88%", s: 2, c: "#bfe3ff", o: 0.5 },
  { top: "65%", left: "10%", s: 1, c: "#cdbcff", o: 0.5 },
  { top: "67%", left: "90%", s: 2, c: "#cdbcff", o: 0.6, g: true },
  { top: "70%", left: "30%", s: 1, c: "#b9a5f5", o: 0.4 },
  { top: "72%", left: "46%", s: 2, c: "#cdbcff", o: 0.5 },
  { top: "75%", left: "6%", s: 1, c: "#a68bfa", o: 0.45 },
  { top: "77%", left: "92%", s: 3, c: "#cdbcff", o: 0.75, g: true },
  { top: "80%", left: "60%", s: 1, c: "#b9a5f5", o: 0.4 },
  { top: "82%", left: "22%", s: 2, c: "#a68bfa", o: 0.55, g: true },
  { top: "85%", left: "84%", s: 1, c: "#cdbcff", o: 0.4 },
  { top: "87%", left: "40%", s: 1, c: "#fff", o: 0.3 },
  { top: "90%", left: "70%", s: 2, c: "#cdbcff", o: 0.5 },
  { top: "93%", left: "14%", s: 1, c: "#a68bfa", o: 0.4 },
];

/* Hand-drawn hydration droplet: thin outline with an inner wave (A4);
   no stock icon matches the mock's glyph. */
function DropletGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2.8 C9 7.2, 5.9 10.7, 5.9 14.3 a6.1 6.1 0 0 0 12.2 0 C18.1 10.7, 15 7.2, 12 2.8 Z"
        stroke="#46c2ff"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M8 14.6 c1.5 -1.7, 2.7 1.3, 4.1 -0.1 s2.6 -1.5, 3.7 -0.3"
        stroke="#46c2ff"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* Track nav glyph: dot inside a thin circle at icon size (C8). */
function TrackGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.4" stroke="#46c2ff" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="2.7" fill="#46c2ff" />
    </svg>
  );
}

function MacroCol({
  label,
  value,
  target,
  pct,
  color,
}: {
  label: string;
  value: number;
  target: string;
  pct: number;
  color: string;
}) {
  return (
    <div className="m-macro" style={{ "--c": color } as CSSProperties}>
      <div className="label t-label" style={{ color }}>
        {label}
      </div>
      <div className="num">
        {value}
        <span className="unit">g</span>
      </div>
      <div className="m-track">
        <div className="m-fill" style={{ width: `${pct}%` }} />
        <div className="m-knob" style={{ left: `${pct}%` }} />
        <div className="m-tick" />
      </div>
      <div className="target">{target}</div>
      <div className="pct">{pct}%</div>
    </div>
  );
}

function TypeRow({
  name,
  spec,
  children,
}: {
  name: string;
  spec: string;
  children: ReactNode;
}) {
  return (
    <div className="type-row">
      <div className="type-spec">
        <span className="t-spec name">{name}</span>
        <span className="t-spec">{spec}</span>
      </div>
      <div>{children}</div>
    </div>
  );
}

function Spark() {
  return (
    <svg className="spark" width="64" height="16" viewBox="0 0 64 16" fill="none" aria-hidden="true">
      <path
        d="M1 13 L12 11 L22 12 L32 8 L42 9 L52 4 L63 2"
        stroke="#3ce6a4"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function DesignSystemSheet() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.FIXTURES_ENABLED !== "1"
  ) {
    notFound();
  }
  return (
    <main className={`ds2 ${playfair.variable} ${bodoni.variable}`}>
      <div className="ds2-wrap">
        {/* ================= sheet head ================= */}
        <header className="sheet-head">
          <p className="t-spec sheet-kicker">Chad · design system · proposal 2 · 2026-07-16</p>
          <h1 className="sheet-title">One continuous surface</h1>
          <p className="sheet-intro">
            Tokens and primitives derived from the reference mock: editorial serif numerals,
            spaced-caps labels, semantic color, and zones composed by proximity and atmosphere
            instead of containers.
          </p>
        </header>

        {/* ================= 01 · reference rebuild ================= */}
        <section className="band">
          <div className="band-head">
            <span className="t-spec">01 · The reference, rebuilt in code</span>
          </div>
          <h2 className="band-title">Proof the system reproduces the mock</h2>
          <p className="band-note">
            Live HTML and CSS, no image except the reserved jug slot. Wisp filaments and the jug
            are future generated assets; glows, type, bars, orbit, and composition are real code.
            Nav labels here are the mock&apos;s own; the production nav primitive is in section 05.
          </p>

          <div className="stage-outer">
            <div className="stage">
              <div className="stage-atmo">
                <div className="atmo-ember" />
                <div className="atmo-hydro" />
                <div className="atmo-sleep" />
                {/* ember filaments: mass on the right 45%, arcing from the
                    2,140 baseline region toward the top-right corner (C12) */}
                <svg className="wisps" style={{ top: 0, right: 0 }} viewBox="0 0 430 300" fill="none" aria-hidden="true">
                  <path d="M228 185 C315 150, 350 85, 432 20" stroke="#ff9a55" strokeWidth="2" opacity="0.7" />
                  <path d="M255 200 C335 168, 372 110, 432 60" stroke="#ffb475" strokeWidth="1.4" opacity="0.45" />
                  <path d="M285 215 C355 190, 398 145, 432 105" stroke="#ff8a45" strokeWidth="1" opacity="0.35" />
                </svg>
                <svg className="wisps-soft" style={{ top: 0, right: 0 }} viewBox="0 0 430 300" fill="none" aria-hidden="true">
                  <path d="M240 190 C320 155, 355 90, 432 32" stroke="#ff7a38" strokeWidth="9" opacity="0.45" />
                </svg>
                {STARS.map((st, i) => (
                  <span
                    key={i}
                    className="star"
                    style={{
                      top: st.top,
                      left: st.left,
                      width: st.s,
                      height: st.s,
                      background: st.c,
                      opacity: st.o,
                      boxShadow: st.g ? `0 0 ${st.s * 3}px ${st.c}` : "none",
                    }}
                  />
                ))}
              </div>

              <div className="stage-inner">
                {/* editorial header */}
                <p className="m-date t-label">Monday, July 14</p>
                <h3 className="m-headline">Your day at a glance</h3>
                <p className="m-hero glow">2,140</p>
                <p className="m-subline t-label">
                  <span>Calories fueled</span>
                  <span className="dot">·</span>
                  <span className="left">360 left</span>
                </p>

                {/* macro band */}
                <div className="m-macros">
                  <MacroCol label="Protein" value={128} target="160g" pct={80} color="#ffa14f" />
                  <MacroCol label="Carbs" value={210} target="250g" pct={84} color="#3fe3cb" />
                  <MacroCol label="Fat" value={64} target="90g" pct={71} color="#b78bff" />
                </div>

                {/* hydration scene */}
                <div className="m-hydro">
                  {/* energy wave: crests from the jug's right edge, passes under
                      "of 80 oz", brightest mid-right, runs to the stage edge (C3) */}
                  <svg
                    className="m-wave"
                    viewBox="0 0 520 100"
                    preserveAspectRatio="none"
                    fill="none"
                    aria-hidden="true"
                  >
                    <defs>
                      <linearGradient id="dsWave" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0" stopColor="#46c2ff" stopOpacity="0" />
                        <stop offset="0.3" stopColor="#5ecdff" stopOpacity="0.8" />
                        <stop offset="0.55" stopColor="#d9f6ff" stopOpacity="1" />
                        <stop offset="0.78" stopColor="#7fd9ff" stopOpacity="0.85" />
                        <stop offset="1" stopColor="#46c2ff" stopOpacity="0.4" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M0 80 C 90 96, 175 34, 260 18 C 340 4, 440 38, 520 52"
                      stroke="url(#dsWave)"
                      strokeWidth="2.6"
                    />
                    <path
                      d="M10 90 C 110 102, 200 52, 285 38 C 360 26, 450 52, 520 64"
                      stroke="url(#dsWave)"
                      strokeWidth="1.4"
                      opacity="0.6"
                    />
                    <path
                      d="M0 66 C 95 80, 190 22, 275 12 C 350 4, 445 26, 520 40"
                      stroke="url(#dsWave)"
                      strokeWidth="0.9"
                      opacity="0.4"
                    />
                  </svg>
                  <div className="jug-slot">
                    <div className="halo" />
                    <svg className="jug-ripples" viewBox="0 0 160 30" fill="none" aria-hidden="true">
                      <ellipse cx="80" cy="15" rx="76" ry="9" stroke="#46c2ff" strokeWidth="1" opacity="0.3" />
                      <ellipse cx="80" cy="15" rx="52" ry="6" stroke="#9bd6ff" strokeWidth="0.8" opacity="0.25" />
                    </svg>
                    <p className="slot-label t-spec">
                      Jug art
                      <br />
                      asset slot
                    </p>
                  </div>
                  <div className="m-hydro-data">
                    <div className="head">
                      <DropletGlyph />
                      <span className="label t-label" style={{ color: "var(--hydro)" }}>
                        Hydration
                      </span>
                    </div>
                    <div className="num glow">
                      56<span className="unit">oz</span>
                    </div>
                    <div className="of">of 80 oz</div>
                    <div className="goal-line t-label" style={{ color: "var(--hydro)" }}>
                      70% of daily goal
                    </div>
                  </div>
                </div>

                {/* sleep scene */}
                <div className="m-sleep">
                  <div className="m-sleep-text">
                    <p className="label t-label">Sleep last night</p>
                    <p className="time">
                      7<span className="unit">h</span> 24<span className="unit">m</span>
                    </p>
                    <p className="label t-label score-label">Sleep score</p>
                    <p className="score">85</p>
                    <p className="verdict">Excellent</p>
                  </div>
                  <div className="orbit">
                    {/* owner's zero-overlap bar: every label lives in flow above or
                        below the svg, so no text can sit on a dial pixel; the
                        ellipse no longer bleeds under the text column */}
                    <div className="orbit-label orbit-top">
                      <div className="big">8h</div>
                      <div className="cap t-label">Target</div>
                    </div>
                    <svg viewBox="0 28 320 154" fill="none" aria-hidden="true">
                      <defs>
                        <radialGradient id="dsNebula" cx="0.5" cy="0.5" r="0.5">
                          <stop offset="0" stopColor="#7c5be0" stopOpacity="0.3" />
                          <stop offset="0.55" stopColor="#6a4ac8" stopOpacity="0.16" />
                          <stop offset="1" stopColor="#6a4ac8" stopOpacity="0" />
                        </radialGradient>
                      </defs>
                      <g transform="rotate(-16 160 105)">
                        {/* soft nebula filling the ellipse interior */}
                        <ellipse cx="160" cy="105" rx="154" ry="56" fill="url(#dsNebula)" />
                        <ellipse cx="160" cy="105" rx="150" ry="54" stroke="#7f5fd6" strokeWidth="1" opacity="0.5" />
                        <ellipse cx="160" cy="105" rx="122" ry="43" stroke="#7f5fd6" strokeWidth="0.8" opacity="0.34" />
                        <ellipse cx="160" cy="105" rx="96" ry="33" stroke="#7f5fd6" strokeWidth="0.7" opacity="0.24" />
                        <ellipse cx="160" cy="105" rx="70" ry="23" stroke="#7f5fd6" strokeWidth="0.6" opacity="0.16" />
                        <ellipse cx="160" cy="105" rx="46" ry="14" stroke="#7f5fd6" strokeWidth="0.5" opacity="0.1" />
                        {/* dense dial tick ring on the outer edge */}
                        <ellipse
                          cx="160" cy="105" rx="158" ry="58"
                          stroke="#a68bfa" strokeWidth="2.5" opacity="0.5"
                          strokeDasharray="0.22 0.78" pathLength={100}
                        />
                        {/* bright progress arc, lower-left sweep */}
                        <ellipse
                          cx="160" cy="105" rx="150" ry="54"
                          stroke="#b895ff" strokeWidth="2.5" opacity="0.95"
                          strokeDasharray="34 66" strokeDashoffset="-28" pathLength={100}
                          style={{ filter: "drop-shadow(0 0 4px #a68bfa) drop-shadow(0 0 10px rgba(127, 95, 214, 0.8))" }}
                        />
                        {/* gold target segment + marker (top right) */}
                        <ellipse
                          cx="160" cy="105" rx="150" ry="54"
                          stroke="#f5c95c" strokeWidth="2" opacity="0.95"
                          strokeDasharray="6 94" strokeDashoffset="-88" pathLength={100}
                          style={{ filter: "drop-shadow(0 0 5px #f5c95c)" }}
                        />
                        <circle cx="282" cy="74" r="4" fill="#f5c95c" style={{ filter: "drop-shadow(0 0 6px #f5c95c)" }} />
                        <circle cx="97" cy="149" r="3.5" fill="#f2eefc" style={{ filter: "drop-shadow(0 0 5px #cdbcff)" }} />
                      </g>
                    </svg>
                    <div className="orbit-bottom">
                      <div className="orbit-label orbit-now">7h 24m</div>
                      <div className="orbit-label orbit-target">
                        Target 8h
                        <br />
                        <span className="short">36m short</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* recreation nav (mock labels) */}
                <nav className="m-nav" style={{ marginInline: "-6.6cqw" }}>
                  <div className="m-nav-item active">
                    <Home strokeWidth={1.75} />
                    <span className="nav-label">Home</span>
                    <span className="dot" />
                  </div>
                  <div className="m-nav-item">
                    <Dumbbell strokeWidth={1.75} style={{ transform: "rotate(-45deg)" }} />
                    <span className="nav-label">Activity</span>
                  </div>
                  <div className="m-nav-item track">
                    <TrackGlyph />
                    <span className="nav-label">Track</span>
                  </div>
                  <div className="m-nav-item">
                    <Utensils strokeWidth={1.75} />
                    <span className="nav-label">Nutrition</span>
                  </div>
                  <div className="m-nav-item">
                    <User strokeWidth={1.75} />
                    <span className="nav-label">Mindset</span>
                  </div>
                </nav>
              </div>
            </div>
          </div>
        </section>

        {/* ================= 02 · typography ================= */}
        <section className="band">
          <div className="band-head">
            <span className="t-spec">02 · Typography</span>
          </div>
          <h2 className="band-title">Editorial hierarchy, not uniform bold</h2>
          <p className="band-note">
            Every number the user reads as a fact is set in the serif display face. Labels are
            spaced uppercase sans. Body is quiet sans. Italic serif is reserved for editorial
            headlines. All sizes are fluid between 320px and desktop.
          </p>

          <TypeRow name="Hero" spec="serif 500 opsz 12 · track .05em · clamp 56→108 · lh 1.02">
            <span className="sp-hero glow">2,140</span>
          </TypeRow>
          <TypeRow name="Display" spec="serif 500 opsz 12 · track .05em · clamp 52→92 · lh 1.05">
            <span className="sp-display">
              56<span style={{ fontSize: "0.45em", color: "var(--hydro)" }}> oz</span>
            </span>
          </TypeRow>
          <TypeRow name="Stat large" spec="serif 400 · clamp 34→54 · lh 1.1">
            <span className="sp-stat-lg">
              7<span style={{ fontSize: "0.55em", color: "var(--sleep)" }}>h</span> 24
              <span style={{ fontSize: "0.55em", color: "var(--sleep)" }}>m</span>
            </span>
          </TypeRow>
          <TypeRow name="Stat" spec="serif 400 · clamp 26→38 · lh 1.1">
            <span className="sp-stat">
              128<span style={{ fontSize: "0.62em", color: "var(--ink-soft)" }}>g</span>
            </span>
          </TypeRow>
          <TypeRow name="Headline" spec="serif italic 400 · clamp 22→32">
            <span className="sp-headline">Your day at a glance</span>
          </TypeRow>
          <TypeRow name="Value" spec="serif 400 · clamp 17→20">
            <span className="sp-value">of 80 oz</span>
          </TypeRow>
          <TypeRow name="Body" spec="sans 400 · 15 · lh 1.55">
            <span className="sp-body">
              You are 360 calories under target. Protein is on pace; water is 24 oz behind.
            </span>
          </TypeRow>
          <TypeRow name="Label large" spec="sans caps 500 · 13 · track .16em">
            <span className="sp-label-lg t-label">Sleep last night</span>
          </TypeRow>
          <TypeRow name="Label" spec="sans caps 500 · 11 · track .18em">
            <span className="sp-label t-label">Calories fueled · 360 left</span>
          </TypeRow>
          <TypeRow name="Micro" spec="sans caps 500 · 10 · track .14em">
            <span className="sp-micro t-label">Target</span>
          </TypeRow>

          <div className="face-grid">
            <div className="face face-bodoni">
              <div className="specimen">
                2,140 <span className="it">glance</span>
              </div>
              <p className="t-spec face-name">
                Bodoni Moda <span className="face-tag">· recommended</span>
              </p>
              <p className="t-spec">the mock&apos;s didone: hairline horizontals, flat razor serifs, calm open italic</p>
            </div>
            <div className="face face-playfair">
              <div className="specimen">
                2,140 <span className="it">glance</span>
              </div>
              <p className="t-spec face-name">Playfair Display</p>
              <p className="t-spec">first-pass face: stems too heavy for the mock, italic reads busy</p>
            </div>
            <div className="face face-instrument">
              <div className="specimen">
                2,140 <span className="it">glance</span>
              </div>
              <p className="t-spec face-name">Instrument Serif · already in repo</p>
              <p className="t-spec">lighter and narrower than the mock, single weight only</p>
            </div>
          </div>
        </section>

        {/* ================= 03 · color ================= */}
        <section className="band">
          <div className="band-head">
            <span className="t-spec">03 · Color</span>
          </div>
          <h2 className="band-title">Named by meaning, never by hue</h2>
          <p className="band-note">
            The four semantic tokens carry the Wave-0 Q-C meanings and are shown as the controls
            they color. Atmosphere families tint zones and data, never actions. Two meanings never
            share one hue on the same surface.
          </p>

          <div className="sem-grid">
            <div className="sem">
              <div className="demo">
                <button className="btn btn-go" type="button">Start workout</button>
              </div>
              <p className="meaning">Go. Actions that begin or advance: start, finish, save.</p>
              <p className="t-spec hex">go · #2fd478</p>
            </div>
            <div className="sem">
              <div className="demo">
                <div className="progress-ind">
                  <span className="line">
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="#3ce6a4" aria-hidden="true">
                      <path d="M5 0 L10 8 L0 8 Z" />
                    </svg>
                    2.4 lb closer to goal
                  </span>
                  <Spark />
                </div>
              </div>
              <p className="meaning">Positive progress. Movement toward a goal; may glow subtly.</p>
              <p className="t-spec hex">progress · #3ce6a4</p>
            </div>
            <div className="sem">
              <div className="demo">
                <span className="reward-chip">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="#f5c95c" aria-hidden="true">
                    <path d="M7 0 L8.8 4.8 L14 5.2 L10 8.6 L11.3 14 L7 11 L2.7 14 L4 8.6 L0 5.2 L5.2 4.8 Z" />
                  </svg>
                  14 day streak
                </span>
              </div>
              <p className="meaning">Reward. Celebration moments only: streaks, milestones, confirmations of good behavior.</p>
              <p className="t-spec hex">reward · #f5c95c</p>
            </div>
            <div className="sem">
              <div className="demo">
                <button className="btn btn-danger" type="button">Delete workout</button>
              </div>
              <p className="meaning">Danger. Destructive and warning contexts only. Red appears nowhere else.</p>
              <p className="t-spec hex">danger · #ff4f43</p>
            </div>
          </div>

          <div className="fam-grid">
            {[
              { name: "Energy", c: "#ffa14f", v: "2,140", u: "", w: 78 },
              { name: "Carbs", c: "#3fe3cb", v: "210", u: "g", w: 84 },
              { name: "Fat", c: "#b78bff", v: "64", u: "g", w: 71 },
              { name: "Hydration", c: "#46c2ff", v: "56", u: "oz", w: 70 },
              { name: "Sleep", c: "#a68bfa", v: "85", u: "", w: 92 },
            ].map((f) => (
              <div className="fam" key={f.name} style={{ "--c": f.c } as CSSProperties}>
                <div className="label t-label">{f.name}</div>
                <div className="num">
                  {f.v}
                  {f.u && <span className="unit">{f.u}</span>}
                </div>
                <div className="fam-track">
                  <div className="m-fill" style={{ width: `${f.w}%` }} />
                  <div className="m-knob" style={{ left: `${f.w}%` }} />
                </div>
                <p className="t-spec hex">{f.c}</p>
              </div>
            ))}
          </div>

          <div className="neutral-list">
            <div className="neutral-row">
              <span style={{ color: "var(--ink)", fontFamily: "var(--f-display)", fontSize: "1.25rem" }}>
                Ink: serif numerals and headlines
              </span>
              <span className="t-spec">#fbfafa</span>
            </div>
            <div className="neutral-row">
              <span style={{ color: "var(--ink-soft)" }}>Ink soft: body text and units</span>
              <span className="t-spec">rgba 251 250 250 · 80%</span>
            </div>
            <div className="neutral-row">
              <span className="t-label" style={{ color: "var(--mute)", fontSize: "var(--t-label)" }}>
                Mute: labels and captions
              </span>
              <span className="t-spec">rgba 205 203 221 · 60%</span>
            </div>
            <div className="neutral-row">
              <span style={{ color: "var(--faint)" }}>Faint: targets and de-emphasis</span>
              <span className="t-spec">rgba 205 203 221 · 36%</span>
            </div>
            <div className="neutral-row">
              <span style={{ color: "var(--mute)" }}>Hairline: 1px rules, 9% white</span>
              <span className="t-spec">canvas · #06070c</span>
            </div>
          </div>
        </section>

        {/* ================= 04 · spacing ================= */}
        <section className="band">
          <div className="band-head">
            <span className="t-spec">04 · Spacing &amp; grouping</span>
          </div>
          <h2 className="band-title">Whitespace is the container</h2>
          <p className="band-note">
            4px base scale. Grouping follows proximity: 8 to 12px inside a cluster, 24px between
            clusters, and a fluid 56 to 96px between zones. Hairlines separate columns inside one
            band; whitespace alone separates zones. Page gutter is fluid 24 to 48px on an
            invisible alignment grid.
          </p>

          <div className="space-ladder">
            {[
              ["sp-2 · 8", 8],
              ["sp-3 · 12", 12],
              ["sp-5 · 24", 24],
              ["sp-7 · 48", 48],
              ["sp-8 · 64", 64],
              ["zone · 56–96", 80],
            ].map(([name, h]) => (
              <div className="space-row" key={name as string}>
                <span className="t-spec">{name}</span>
                <div className="block" style={{ height: h as number }} />
              </div>
            ))}
          </div>

          <div className="rhythm-demo">
            <div>
              <p className="t-label" style={{ fontSize: "var(--t-label)", color: "var(--hydro)" }}>Hydration</p>
              <p className="t-serif" style={{ fontSize: "var(--t-stat)", marginTop: 8 }}>
                56<span style={{ fontSize: "0.6em", color: "var(--hydro)" }}>oz</span>
              </p>
              <p style={{ color: "var(--mute)", marginTop: 12 }}>of 80 oz</p>
              <p className="t-label" style={{ fontSize: "var(--t-label)", color: "var(--sleep-soft)", marginTop: 64 }}>
                Sleep last night
              </p>
              <p className="t-serif" style={{ fontSize: "var(--t-stat)", marginTop: 8 }}>
                7<span style={{ fontSize: "0.6em", color: "var(--sleep)" }}>h</span> 24
                <span style={{ fontSize: "0.6em", color: "var(--sleep)" }}>m</span>
              </p>
            </div>
            <div className="gap-note">
              <p className="t-spec">8 inside cluster</p>
              <p className="t-spec" style={{ marginTop: 6 }}>12 to caption</p>
              <p className="t-spec" style={{ marginTop: 6 }}>64 zone break ↑</p>
            </div>
          </div>

          <div className="divider-demo">
            <p className="t-spec">Hairline · 1px · 9% white</p>
            <div className="h-sample" />
            <div className="cols">
              <div>
                <p className="t-label" style={{ fontSize: "var(--t-label)", color: "var(--energy)" }}>Protein</p>
                <p className="t-serif" style={{ fontSize: "1.4rem", marginTop: 6 }}>128g</p>
              </div>
              <div>
                <p className="t-label" style={{ fontSize: "var(--t-label)", color: "var(--carbs)" }}>Carbs</p>
                <p className="t-serif" style={{ fontSize: "1.4rem", marginTop: 6 }}>210g</p>
              </div>
              <div>
                <p className="t-label" style={{ fontSize: "var(--t-label)", color: "var(--fat)" }}>Fat</p>
                <p className="t-serif" style={{ fontSize: "1.4rem", marginTop: 6 }}>64g</p>
              </div>
            </div>
          </div>
        </section>

        {/* ================= 05 · primitives ================= */}
        <section className="band">
          <div className="band-head">
            <span className="t-spec">05 · Primitives</span>
          </div>
          <h2 className="band-title">The parts every surface composes from</h2>
          <p className="band-note">
            Each primitive is shown production-ready. Copy follows the Wave-0 naming decisions:
            neutral product voice, second person, no invented labels.
          </p>

          <div className="prim-row">
            <div className="prim">
              <p className="t-spec prim-name">Metric column</p>
              <div className="metric-col" style={{ "--c": "#ffa14f" } as CSSProperties}>
                <div className="label t-label">Protein</div>
                <div className="num">
                  128<span className="unit">g</span>
                </div>
                <div className="track">
                  <div className="m-fill" style={{ width: "80%" }} />
                  <div className="m-knob" style={{ left: "80%" }} />
                  <div className="m-tick" />
                </div>
                <div className="target">160g</div>
                <div className="pct">80%</div>
              </div>
              <p className="prim-note">
                Label, serif value, glow track with end knob, target tick at 100%, then target and
                share. Tints from the atmosphere family of its zone.
              </p>
            </div>

            <div className="prim">
              <p className="t-spec prim-name">Radial gauge · compact variant</p>
              <div className="gauge">
                <svg viewBox="0 0 168 168" fill="none" aria-hidden="true">
                  <circle cx="84" cy="84" r="72" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                  <circle
                    cx="84" cy="84" r="72"
                    stroke="#a68bfa" strokeWidth="3" strokeLinecap="round"
                    strokeDasharray="92.5 7.5" pathLength={100}
                    transform="rotate(-90 84 84)"
                    style={{ filter: "drop-shadow(0 0 6px rgba(166,139,250,0.8))" }}
                  />
                  <circle
                    cx="84" cy="84" r="72"
                    stroke="#f5c95c" strokeWidth="3"
                    strokeDasharray="1.2 98.8" pathLength={100}
                    transform="rotate(-90 84 84)"
                    style={{ filter: "drop-shadow(0 0 4px #f5c95c)" }}
                  />
                </svg>
                <div className="center">
                  <span className="val">
                    7<span className="unit">h</span> 24<span className="unit">m</span>
                  </span>
                  <span className="t-label" style={{ fontSize: "var(--t-micro)", color: "var(--sleep-soft)" }}>
                    36m short of 8h
                  </span>
                </div>
              </div>
              <p className="prim-note">
                Utility version of the sleep orbit: progress ring, gold target tick, serif value.
                The tilted orbital treatment stays the hero variant for scene zones.
              </p>
            </div>

            <div className="prim">
              <p className="t-spec prim-name">Scene zone anatomy</p>
              <div className="scene-schema">
                <div className="atmo" />
                <div className="art">
                  <span className="t-spec">
                    Art slot
                    <br />
                    generated asset
                  </span>
                </div>
                <div className="data">
                  <p className="label t-label">Hydration</p>
                  <p className="num">
                    56<span className="unit"> oz</span>
                  </p>
                  <p className="of">of 80 oz</p>
                </div>
              </div>
              <p className="prim-note">
                Recipe: one atmosphere gradient bleeding past the zone, one art asset, one serif
                hero value, supporting values beneath. No box anywhere.
              </p>
            </div>

            <div className="prim">
              <p className="t-spec prim-name">Actions</p>
              <div className="btn-stack">
                <button className="btn btn-go" type="button">Start workout</button>
                <button className="btn btn-tonal" type="button">View Sleep History</button>
                <button className="btn btn-quiet" type="button">Not now</button>
                <button className="btn btn-danger" type="button">Delete</button>
                <button className="btn btn-disabled" type="button" disabled>Saved</button>
              </div>
              <p className="prim-note">
                One go-action per view. Tonal for secondary navigation, quiet for dismissals,
                danger only on destructive confirms. 48px tall, 12px radius.
              </p>
            </div>

            <div className="prim">
              <p className="t-spec prim-name">Bottom nav · production labels</p>
              <div className="nav-prim">
                <div className="item active">
                  <Home strokeWidth={1.75} />
                  <span className="nav-label">Home</span>
                </div>
                <div className="item">
                  <TrendingUp strokeWidth={1.75} />
                  <span className="nav-label">Progress</span>
                </div>
                <div className="item log">
                  <span className="disc">
                    <Plus strokeWidth={2.25} />
                  </span>
                  <span className="nav-label">Log</span>
                </div>
                <div className="item">
                  <MessageCircle strokeWidth={1.75} />
                  <span className="nav-label">Coach</span>
                </div>
                <div className="item">
                  <Ellipsis strokeWidth={1.75} />
                  <span className="nav-label">More</span>
                </div>
              </div>
              <p className="prim-note">
                The shipped five-item phone nav with Wave-0 names and the white Log action. Active
                tint pending the accent-token decision flagged in review.
              </p>
            </div>
          </div>
        </section>

        {/* ================= token table ================= */}
        <section className="band">
          <div className="band-head">
            <span className="t-spec">06 · Token values</span>
          </div>
          <div className="hex-table t-spec">
            {[
              ["--ink", "#fbfafa", "serif numerals, headlines"],
              ["--ink-soft", "80% ink", "body, units"],
              ["--mute", "60% lavender", "labels, captions"],
              ["--faint", "36% lavender", "targets, de-emphasis"],
              ["--hairline", "9% white", "1px rules"],
              ["--bg", "#06070c", "canvas"],
              ["--danger", "#ff4f43", "destructive + warning only"],
              ["--go", "#2fd478", "start / advance"],
              ["--progress", "#3ce6a4", "toward goal, may glow"],
              ["--reward", "#f5c95c", "celebrations, glows"],
              ["--energy", "#ffa14f", "calories, training effort"],
              ["--carbs", "#3fe3cb", "carbohydrate data"],
              ["--fat", "#b78bff", "fat data"],
              ["--hydro", "#46c2ff", "hydration zone + data"],
              ["--sleep", "#a68bfa", "sleep zone + data"],
            ].map(([name, hex, meaning]) => (
              <div key={name} style={{ display: "contents" }}>
                <span>
                  {String(hex).startsWith("#") && (
                    <span className="swatch" style={{ background: String(hex) }} />
                  )}
                  {name}
                </span>
                <span>{hex}</span>
                <span>{meaning}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
