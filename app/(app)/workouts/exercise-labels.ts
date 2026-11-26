export const EXERCISE_SOURCE = "free-exercise-db";
export const EXERCISE_SOURCE_URL = "https://github.com/yuhonas/free-exercise-db";

export const MUSCLES = [
  "chest",
  "shoulders",
  "triceps",
  "biceps",
  "forearms",
  "lats",
  "middle back",
  "lower back",
  "traps",
  "neck",
  "abdominals",
  "quadriceps",
  "hamstrings",
  "glutes",
  "calves",
  "adductors",
  "abductors",
] as const;

export type Muscle = (typeof MUSCLES)[number];

export const MUSCLE_LABELS: Record<Muscle, string> = {
  chest: "Peito",
  shoulders: "Ombros",
  triceps: "Tríceps",
  biceps: "Bíceps",
  forearms: "Antebraços",
  lats: "Dorsais",
  "middle back": "Meio das costas",
  "lower back": "Lombar",
  traps: "Trapézio",
  neck: "Pescoço",
  abdominals: "Abdômen",
  quadriceps: "Quadríceps",
  hamstrings: "Posteriores",
  glutes: "Glúteos",
  calves: "Panturrilhas",
  adductors: "Adutores",
  abductors: "Abdutores",
};

const EQUIPMENT_LABELS: Record<string, string> = {
  barbell: "Barra",
  dumbbell: "Halteres",
  cable: "Polia",
  machine: "Máquina",
  "body only": "Peso corporal",
  kettlebells: "Kettlebell",
  bands: "Elástico",
  "medicine ball": "Medicine ball",
  "exercise ball": "Bola suíça",
  "foam roll": "Rolo",
  "e-z curl bar": "Barra W",
  other: "Outro",
};

export function isMuscle(value: unknown): value is Muscle {
  return MUSCLES.some((muscle) => muscle === value);
}

export function describeExercise(muscles: string[] | null, equipment: string | null) {
  const muscle = muscles?.find(isMuscle);
  return [muscle && MUSCLE_LABELS[muscle], equipment && (EQUIPMENT_LABELS[equipment] ?? equipment)]
    .filter(Boolean)
    .join(" · ");
}
