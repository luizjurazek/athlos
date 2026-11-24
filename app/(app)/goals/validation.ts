import { isDay } from "@/app/utils/dates";

export const GOAL_TITLE_MAX_LENGTH = 80;
export const STAGE_TITLE_MAX_LENGTH = 80;
export const UNIT_LABEL_MAX_LENGTH = 24;
export const STAGE_TARGET_MAX = 10000;

export type StageDraft = { title: string; target: string; dueOn: string };

export type GoalDraft = {
  title: string;
  description: string;
  unitLabel: string;
  startsOn: string;
  stages: StageDraft[];
  objectiveIds: string[];
};

export type StageErrors = { title?: string; target?: string; dueOn?: string };

export type GoalErrors = {
  title?: string;
  unitLabel?: string;
  startsOn?: string;
  stages: StageErrors[];
  stagesList?: string;
  objectives?: string;
};

export const STAGE_ORDER_ERROR = "O prazo desta etapa precisa ser depois da etapa anterior.";
export const FIRST_STAGE_ERROR = "O prazo precisa ser depois do início da meta.";

export function parseTarget(value: string) {
  const target = Number(value);
  return Number.isInteger(target) && target > 0 && target <= STAGE_TARGET_MAX ? target : null;
}

export function validateStageDates(startsOn: string, stages: StageDraft[]) {
  return stages.map((stage, index): string | undefined => {
    if (!isDay(stage.dueOn)) return "Escolha o prazo da etapa.";
    const previous = index === 0 ? startsOn : stages[index - 1].dueOn;
    if (!isDay(previous) || stage.dueOn > previous) return undefined;
    return index === 0 ? FIRST_STAGE_ERROR : STAGE_ORDER_ERROR;
  });
}

export function validateGoal(draft: GoalDraft): GoalErrors {
  const errors: GoalErrors = { stages: [] };
  const title = draft.title.trim();
  if (!title) errors.title = "Dê um nome à meta.";
  else if (title.length > GOAL_TITLE_MAX_LENGTH) {
    errors.title = `O nome pode ter no máximo ${GOAL_TITLE_MAX_LENGTH} caracteres.`;
  }

  if (draft.unitLabel.trim().length > UNIT_LABEL_MAX_LENGTH) {
    errors.unitLabel = `Use no máximo ${UNIT_LABEL_MAX_LENGTH} caracteres.`;
  }

  if (!isDay(draft.startsOn)) errors.startsOn = "Escolha a data de início.";

  if (draft.stages.length === 0) errors.stagesList = "Adicione pelo menos uma etapa.";

  const dateErrors = validateStageDates(draft.startsOn, draft.stages);
  errors.stages = draft.stages.map((stage, index) => {
    const stageErrors: StageErrors = {};
    const stageTitle = stage.title.trim();
    if (!stageTitle) stageErrors.title = "Dê um nome à etapa.";
    else if (stageTitle.length > STAGE_TITLE_MAX_LENGTH) {
      stageErrors.title = `O nome pode ter no máximo ${STAGE_TITLE_MAX_LENGTH} caracteres.`;
    }
    if (parseTarget(stage.target) === null) {
      stageErrors.target = `O alvo precisa ser um número inteiro de 1 a ${STAGE_TARGET_MAX}.`;
    }
    if (dateErrors[index]) stageErrors.dueOn = dateErrors[index];
    return stageErrors;
  });

  if (draft.objectiveIds.length === 0) {
    errors.objectives = "Escolha pelo menos um objetivo para a meta.";
  }

  return errors;
}

export function countErrors(errors: GoalErrors) {
  const top = [errors.title, errors.unitLabel, errors.startsOn, errors.stagesList, errors.objectives];
  const stageCount = errors.stages.reduce(
    (total, stage) => total + Object.values(stage).filter(Boolean).length,
    0,
  );
  return top.filter(Boolean).length + stageCount;
}
