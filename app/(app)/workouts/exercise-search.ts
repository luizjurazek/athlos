// RN-31: the catalog is queried live, never copied into the database. free-exercise-db has no
// search endpoint, so its static JSON goes through Next's data cache and is filtered here.

import { EXERCISE_SOURCE, type Muscle } from "./exercise-labels";

const SOURCE = EXERCISE_SOURCE;
const BASE_URL = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main";
const CATALOG_URL = `${BASE_URL}/dist/exercises.json`;
const IMAGE_BASE_URL = `${BASE_URL}/exercises/`;
const CATALOG_REVALIDATE_SECONDS = 60 * 60 * 24;
const TIMEOUT_MS = 4000;
const MAX_RESULTS = 30;

export type ExerciseResult = {
  source: typeof SOURCE;
  sourceId: string;
  name: string;
  imageUrl: string | null;
  muscles: string[];
  equipment: string | null;
};

export type ExerciseSearchResult =
  | { ok: true; results: ExerciseResult[] }
  | { ok: false; reason: "unavailable" };

// The catalog is English only (doubt 5.2): names are shown as they come, but common Portuguese gym
// terms are mapped so "supino" or "agachamento" still find something. Longer phrases come first.
const PORTUGUESE_TERMS: [string, string][] = [
  ["levantamento terra", "deadlift"],
  ["terra romeno", "romanian deadlift"],
  ["elevacao lateral", "lateral raise"],
  ["elevacao frontal", "front raise"],
  ["cadeira extensora", "leg extension"],
  ["cadeira flexora", "leg curl"],
  ["mesa flexora", "leg curl"],
  ["barra fixa", "pull up"],
  ["agachamento bulgaro", "split squat"],
  ["peck deck", "butterfly"],
  ["supino", "bench press"],
  ["agachamento", "squat"],
  ["remada", "row"],
  ["rosca", "curl"],
  ["puxada", "pulldown"],
  ["desenvolvimento", "shoulder press"],
  ["panturrilha", "calf"],
  ["abdominal", "crunch"],
  ["afundo", "lunge"],
  ["avanco", "lunge"],
  ["crucifixo", "fly"],
  ["voador", "butterfly"],
  ["encolhimento", "shrug"],
  ["prancha", "plank"],
  ["flexao", "push up"],
  ["fundos", "dip"],
  ["paralelas", "dip"],
  ["terra", "deadlift"],
  ["martelo", "hammer"],
  ["frances", "french"],
  ["testa", "lying triceps"],
  ["inclinado", "incline"],
  ["declinado", "decline"],
  ["halteres", "dumbbell"],
  ["halter", "dumbbell"],
  ["barra", "barbell"],
  ["maquina", "machine"],
  ["polia", "cable"],
  ["cabo", "cable"],
  ["cross", "cable"],
  ["gluteo", "glute"],
  ["sumo", "sumo"],
];

const IGNORED_WORDS = new Set(["reto", "de", "do", "da", "com", "no", "na", "em", "o", "a", "e"]);

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function toSearchTerms(query: string): string[] {
  let text = ` ${normalize(query)} `;
  for (const [portuguese, english] of PORTUGUESE_TERMS) {
    text = text.replaceAll(` ${portuguese} `, ` ${english} `);
  }
  return text.split(" ").filter((word) => word && !IGNORED_WORDS.has(word));
}

type CatalogEntry = {
  id: string;
  name: string;
  equipment: string | null;
  primaryMuscles: string[];
  images: string[];
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function toCatalogEntry(value: unknown): CatalogEntry | null {
  if (typeof value !== "object" || value === null) return null;
  const { id, name, equipment, primaryMuscles, images }: Record<string, unknown> =
    Object.fromEntries(Object.entries(value));
  if (typeof id !== "string" || typeof name !== "string") return null;
  return {
    id,
    name,
    equipment: typeof equipment === "string" ? equipment : null,
    primaryMuscles: isStringArray(primaryMuscles) ? primaryMuscles : [],
    images: isStringArray(images) ? images : [],
  };
}

async function fetchCatalog(): Promise<CatalogEntry[]> {
  // Racing instead of passing an AbortSignal keeps the request eligible for the data cache.
  const response = await Promise.race([
    fetch(CATALOG_URL, { next: { revalidate: CATALOG_REVALIDATE_SECONDS } }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS),
    ),
  ]);
  if (!response.ok) throw new Error(`catalog ${response.status}`);
  const body: unknown = await response.json();
  if (!Array.isArray(body)) throw new Error("catalog is not a list");
  return body.map(toCatalogEntry).filter((entry) => entry !== null);
}

function rank(name: string, phrase: string) {
  if (name === phrase) return 0;
  if (name.startsWith(phrase)) return 1;
  if (name.includes(phrase)) return 2;
  return 3;
}

export async function searchExercises(
  query: string,
  { muscle }: { muscle?: Muscle } = {},
): Promise<ExerciseSearchResult> {
  const terms = toSearchTerms(query);
  if (terms.length === 0 && !muscle) return { ok: true, results: [] };

  let catalog: CatalogEntry[];
  try {
    catalog = await fetchCatalog();
  } catch (error) {
    console.error("Exercise catalog unavailable", error);
    return { ok: false, reason: "unavailable" };
  }

  const phrase = terms.join(" ");
  const scored = catalog
    .filter((entry) => !muscle || entry.primaryMuscles.includes(muscle))
    .map((entry) => {
      const name = normalize(entry.name);
      const text = `${name} ${name.replaceAll(" ", "")} ${normalize(entry.equipment ?? "")}`;
      const missing = terms.filter((term) => !text.includes(term)).length;
      return { entry, name, missing };
    });
  // A translated query rarely matches the English name word for word ("supino inclinado halteres"
  // has "bench", the catalog says "Incline Dumbbell Press"), so longer queries tolerate one missing
  // term; full matches still come first.
  const allowedMissing = terms.length >= 3 ? 1 : 0;
  const results = scored
    .filter(({ missing }) => missing <= allowedMissing)
    .sort(
      (a, b) =>
        a.missing - b.missing ||
        rank(a.name, phrase) - rank(b.name, phrase) ||
        a.name.length - b.name.length,
    )
    .slice(0, MAX_RESULTS)
    .map(({ entry }): ExerciseResult => ({
      source: SOURCE,
      sourceId: entry.id,
      name: entry.name,
      imageUrl: entry.images[0] ? `${IMAGE_BASE_URL}${entry.images[0]}` : null,
      muscles: entry.primaryMuscles,
      equipment: entry.equipment,
    }));

  return { ok: true, results };
}
