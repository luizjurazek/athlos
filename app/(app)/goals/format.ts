export const DEFAULT_UNIT_LABEL = "checks";

export function formatCount(count: number, unitLabel: string | null | undefined) {
  return `${count} ${unitLabel?.trim() || DEFAULT_UNIT_LABEL}`;
}

export const ENTRY_UNIT_LABEL = "registros";

/** Unit shown for a goal; entry goals without a label count "registros", not "checks". */
export function unitOf(goal: { unitLabel: string | null; progressSource: "checks" | "entries" }) {
  return goal.unitLabel?.trim() || (goal.progressSource === "entries" ? ENTRY_UNIT_LABEL : null);
}

/** In entry goals a stage with target 1 is a milestone: it is reached or not, never "0 de 1". */
export function isMilestone(goal: { progressSource: "checks" | "entries" }, stage: { targetCount: number }) {
  return goal.progressSource === "entries" && stage.targetCount === 1;
}
