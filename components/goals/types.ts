/** The serializable goal shape the goal surfaces share (list, doc, form).
 *  Lived in the retired goal-editor dialog before MOB-19. */
export type EditableGoal = {
  id: string;
  title: string;
  detail: string;
  targetDate: string | null;
  status: "active" | "achieved" | "archived";
  metric: "weight" | "bodyfat" | "measurement" | "custom" | "lift" | null;
  /** Exercise a "lift" goal tracks (its est. 1RM). Null for other metrics. */
  metricRef: string | null;
  startValue: number | null;
  targetValue: number | null;
  unit: string | null;
  /** Display-only "set on" date ("Jun 20"), preformatted in the member's
   *  timezone. Anchors relative deadlines like "8 weeks" (LC-5). Not
   *  editable; the update schema strips it. */
  createdAtLabel?: string | null;
};
