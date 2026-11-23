import type { Tables } from "@/app/utils/supabase/database.types";

export type Objective = Tables<"objectives">;

export const TITLE_MAX_LENGTH = 80;

// Stored as the name; each maps to the --color-objective-<name> token in app/theme.css.
export const OBJECTIVE_COLORS = [
  { value: "red", label: "Vermelho" },
  { value: "orange", label: "Laranja" },
  { value: "yellow", label: "Amarelo" },
  { value: "green", label: "Verde" },
  { value: "teal", label: "Turquesa" },
  { value: "blue", label: "Azul" },
  { value: "purple", label: "Roxo" },
  { value: "pink", label: "Rosa" },
] as const;

export const OBJECTIVE_ICONS = [
  { value: "check", label: "Check" },
  { value: "dumbbell", label: "Academia" },
  { value: "activity", label: "Atividade" },
  { value: "book", label: "Leitura" },
  { value: "water", label: "Água" },
  { value: "leaf", label: "Alimentação" },
  { value: "moon", label: "Sono" },
  { value: "sun", label: "Manhã" },
  { value: "heart", label: "Saúde" },
  { value: "star", label: "Destaque" },
] as const;

export type ObjectiveColor = (typeof OBJECTIVE_COLORS)[number]["value"];
export type ObjectiveIconName = (typeof OBJECTIVE_ICONS)[number]["value"];

export function isObjectiveColor(value: unknown): value is ObjectiveColor {
  return OBJECTIVE_COLORS.some((color) => color.value === value);
}

export function isObjectiveIcon(value: unknown): value is ObjectiveIconName {
  return OBJECTIVE_ICONS.some((icon) => icon.value === value);
}
