/**
 * Water unit helpers (DSH-24). Hydration is stored in milliliters in the DB
 * (WaterLog.amountMl) — unchanged — but the /today tracker speaks US customary
 * units: fluid ounces and gallons. These convert + format for display, and back
 * for logging. The daily goal defaults to one US gallon and is user-customizable.
 */

export const ML_PER_OZ = 29.5735; // US fluid ounce
export const OZ_PER_GALLON = 128; // US gallon
export const ML_PER_GALLON = ML_PER_OZ * OZ_PER_GALLON; // ≈ 3785.41

/** Default daily hydration goal: one US gallon. */
export const DEFAULT_WATER_GOAL_ML = Math.round(ML_PER_GALLON); // 3785

export function mlToOz(ml: number): number {
  return ml / ML_PER_OZ;
}

export function ozToMl(oz: number): number {
  return Math.round(oz * ML_PER_OZ);
}

/** Whole-ounce readout, e.g. "96 oz". */
export function formatOz(ml: number): string {
  return `${Math.round(mlToOz(ml))} oz`;
}

/**
 * Goal-style label: a whole or half gallon reads as gallons ("1 gal", "½ gal"),
 * anything else falls back to ounces ("100 oz"). Used for the goal, where round
 * gallon targets are the common case.
 */
export function formatVolume(ml: number): string {
  const oz = mlToOz(ml);
  const gal = oz / OZ_PER_GALLON;
  const halves = Math.round(gal * 2) / 2;
  if (gal >= 0.5 && Math.abs(gal - halves) < 0.03) {
    if (halves === 0.5) {
      return "½ gal";
    }
    const whole = Math.floor(halves);
    const frac = halves - whole > 0 ? "½" : "";
    return `${whole}${frac} gal`;
  }
  return `${Math.round(oz)} oz`;
}

/** Compact axis number in ounces, e.g. "96oz". */
export function formatOzAxis(ml: number): string {
  return `${Math.round(mlToOz(ml))}oz`;
}
