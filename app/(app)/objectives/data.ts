import type { createClient } from "@/app/utils/supabase/server";

type Client = ReturnType<typeof createClient>;

export type AlternativeOption = { id: string; title: string };

/** Other active objectives plus any already linked as an alternative, whatever their status (RN-21). */
export async function getAlternativeOptions(supabase: Client, objectiveId?: string) {
  const [objectivesResult, linksResult] = await Promise.all([
    supabase.from("objectives").select("id, title, archived_at").order("created_at"),
    objectiveId
      ? supabase
          .from("objective_alternatives")
          .select("alternative_id")
          .eq("objective_id", objectiveId)
      : null,
  ]);
  if (objectivesResult.error) throw objectivesResult.error;
  if (linksResult?.error) throw linksResult.error;

  const linkedIds = linksResult?.data.map((link) => link.alternative_id) ?? [];
  const options: AlternativeOption[] = objectivesResult.data
    .filter(
      (objective) =>
        objective.id !== objectiveId &&
        (!objective.archived_at || linkedIds.includes(objective.id)),
    )
    .map(({ id, title }) => ({ id, title }));
  return { options, linkedIds };
}
