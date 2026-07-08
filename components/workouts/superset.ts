/**
 * Superset display tokens shared by the logger and the history cards.
 * Static class strings (one per chart token) so Tailwind keeps them.
 */

const GROUP_LETTERS = "ABCDEFGHIJ";

export const GROUP_RAILS = [
  "border-l-chart-1",
  "border-l-chart-2",
  "border-l-chart-3",
  "border-l-chart-4",
  "border-l-chart-5",
] as const;

export const GROUP_CHIPS = [
  "bg-chart-1/15 text-chart-1",
  "bg-chart-2/15 text-chart-2",
  "bg-chart-3/15 text-chart-3",
  "bg-chart-4/15 text-chart-4",
  "bg-chart-5/15 text-chart-5",
] as const;

export function supersetLabel(groupNo: number): string {
  return `Superset ${GROUP_LETTERS[(groupNo - 1) % GROUP_LETTERS.length]}`;
}
