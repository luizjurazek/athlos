export const DEFAULT_UNIT_LABEL = "checks";

export function formatCount(count: number, unitLabel: string | null | undefined) {
  return `${count} ${unitLabel?.trim() || DEFAULT_UNIT_LABEL}`;
}

export const ENTRY_UNIT_LABEL = "registros";

/** Unit shown for a goal; entry goals without a label count "registros", not "checks". */
export function unitOf(goal: { unitLabel: string | null; progressSource: "checks" | "entries" }) {
  return goal.unitLabel?.trim() || (goal.progressSource === "entries" ? ENTRY_UNIT_LABEL : null);
}

/**
 * The stage name is optional. Without one a stage is named by what it reaches: its target
 * ("12 livros"), or its position when targets are per objective or it is a milestone.
 */
export function getStageName(
  goal: { unitLabel: string | null; progressSource: "checks" | "entries" },
  stage: {
    title: string | null;
    position: number;
    targetCount: number;
    baseCount: number;
    objectiveTargets?: unknown[];
  },
) {
  if (stage.title) return stage.title;
  if (isMilestone(goal, stage)) return `Marco ${stage.position}`;
  if (stage.objectiveTargets?.length) return `Etapa ${stage.position}`;
  return formatCount(stage.targetCount, unitOf(goal));
}

/**
 * In entry goals a stage that adds a single entry to the plan is a milestone ("Correr 5km"): it is
 * reached or not, never "0 de 1". Targets are cumulative, so "5km" then "10km" are targets 1 and 2.
 */
export function isMilestone(
  goal: { progressSource: "checks" | "entries" },
  stage: { targetCount: number; baseCount: number },
) {
  return goal.progressSource === "entries" && stage.targetCount - stage.baseCount === 1;
}
