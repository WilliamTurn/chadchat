/**
 * The curated time-zone list for the /account picker. Every mainstream app
 * shows a short list of major cities grouped by region, not the browser's
 * full ~400-entry IANA dump (the dump was the user complaint: "lists
 * virtually every location on planet earth").
 *
 * The zone a member actually lives in is normally captured silently from the
 * browser (TimezoneSync), so this list only needs to cover the zones a human
 * would deliberately switch to. A stored/detected zone that isn't in the list
 * is still shown and selectable (the picker appends it), so nobody's real
 * zone ever becomes unrepresentable.
 */

export type CuratedZone = {
  /** IANA id, what we store. */
  id: string;
  /** Human label: major city (region hint where it helps). */
  label: string;
};

export type TimezoneGroup = {
  region: string;
  zones: CuratedZone[];
};

export const TIMEZONE_GROUPS: TimezoneGroup[] = [
  {
    region: "United States & Canada",
    zones: [
      { id: "America/New_York", label: "New York (Eastern)" },
      { id: "America/Chicago", label: "Chicago (Central)" },
      { id: "America/Denver", label: "Denver (Mountain)" },
      { id: "America/Phoenix", label: "Phoenix (Arizona)" },
      { id: "America/Los_Angeles", label: "Los Angeles (Pacific)" },
      { id: "America/Anchorage", label: "Anchorage (Alaska)" },
      { id: "Pacific/Honolulu", label: "Honolulu (Hawaii)" },
      { id: "America/Toronto", label: "Toronto" },
      { id: "America/Vancouver", label: "Vancouver" },
      { id: "America/Edmonton", label: "Edmonton" },
      { id: "America/Winnipeg", label: "Winnipeg" },
      { id: "America/Halifax", label: "Halifax (Atlantic)" },
      { id: "America/St_Johns", label: "St. John's (Newfoundland)" },
    ],
  },
  {
    region: "Mexico, Central & South America",
    zones: [
      { id: "America/Mexico_City", label: "Mexico City" },
      { id: "America/Guatemala", label: "Guatemala City" },
      { id: "America/Panama", label: "Panama City" },
      { id: "America/Bogota", label: "Bogota" },
      { id: "America/Lima", label: "Lima" },
      { id: "America/Caracas", label: "Caracas" },
      { id: "America/Santiago", label: "Santiago" },
      { id: "America/Argentina/Buenos_Aires", label: "Buenos Aires" },
      { id: "America/Sao_Paulo", label: "Sao Paulo" },
      { id: "America/Puerto_Rico", label: "Puerto Rico" },
    ],
  },
  {
    region: "Europe",
    zones: [
      { id: "Europe/London", label: "London" },
      { id: "Europe/Dublin", label: "Dublin" },
      { id: "Europe/Lisbon", label: "Lisbon" },
      { id: "Europe/Madrid", label: "Madrid" },
      { id: "Europe/Paris", label: "Paris" },
      { id: "Europe/Amsterdam", label: "Amsterdam" },
      { id: "Europe/Brussels", label: "Brussels" },
      { id: "Europe/Berlin", label: "Berlin" },
      { id: "Europe/Zurich", label: "Zurich" },
      { id: "Europe/Rome", label: "Rome" },
      { id: "Europe/Vienna", label: "Vienna" },
      { id: "Europe/Prague", label: "Prague" },
      { id: "Europe/Warsaw", label: "Warsaw" },
      { id: "Europe/Stockholm", label: "Stockholm" },
      { id: "Europe/Oslo", label: "Oslo" },
      { id: "Europe/Copenhagen", label: "Copenhagen" },
      { id: "Europe/Helsinki", label: "Helsinki" },
      { id: "Europe/Athens", label: "Athens" },
      { id: "Europe/Bucharest", label: "Bucharest" },
      { id: "Europe/Kyiv", label: "Kyiv" },
      { id: "Europe/Istanbul", label: "Istanbul" },
      { id: "Europe/Moscow", label: "Moscow" },
    ],
  },
  {
    region: "Africa & Middle East",
    zones: [
      { id: "Africa/Casablanca", label: "Casablanca" },
      { id: "Africa/Lagos", label: "Lagos" },
      { id: "Africa/Cairo", label: "Cairo" },
      { id: "Africa/Nairobi", label: "Nairobi" },
      { id: "Africa/Johannesburg", label: "Johannesburg" },
      { id: "Asia/Jerusalem", label: "Jerusalem" },
      { id: "Asia/Riyadh", label: "Riyadh" },
      { id: "Asia/Dubai", label: "Dubai" },
      { id: "Asia/Tehran", label: "Tehran" },
    ],
  },
  {
    region: "Asia",
    zones: [
      { id: "Asia/Karachi", label: "Karachi" },
      { id: "Asia/Kolkata", label: "India (Mumbai, Delhi)" },
      { id: "Asia/Dhaka", label: "Dhaka" },
      { id: "Asia/Bangkok", label: "Bangkok" },
      { id: "Asia/Jakarta", label: "Jakarta" },
      { id: "Asia/Singapore", label: "Singapore" },
      { id: "Asia/Hong_Kong", label: "Hong Kong" },
      { id: "Asia/Shanghai", label: "China (Beijing, Shanghai)" },
      { id: "Asia/Taipei", label: "Taipei" },
      { id: "Asia/Manila", label: "Manila" },
      { id: "Asia/Seoul", label: "Seoul" },
      { id: "Asia/Tokyo", label: "Tokyo" },
    ],
  },
  {
    region: "Australia & Pacific",
    zones: [
      { id: "Australia/Perth", label: "Perth" },
      { id: "Australia/Adelaide", label: "Adelaide" },
      { id: "Australia/Brisbane", label: "Brisbane" },
      { id: "Australia/Sydney", label: "Sydney" },
      { id: "Australia/Melbourne", label: "Melbourne" },
      { id: "Pacific/Auckland", label: "Auckland" },
    ],
  },
];

const CURATED_IDS = new Set(
  TIMEZONE_GROUPS.flatMap((g) => g.zones.map((z) => z.id))
);

export function isCuratedZone(id: string): boolean {
  return CURATED_IDS.has(id);
}

/**
 * "GMT-5" style current-offset label for a zone (DST-correct because it's
 * computed from the real current date). Empty string when the runtime doesn't
 * know the zone.
 */
export function zoneOffsetLabel(id: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: id,
      timeZoneName: "shortOffset",
    }).formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}
