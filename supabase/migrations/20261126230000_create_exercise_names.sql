-- Shared Portuguese names for catalog exercises (the catalog is English only). Any signed-in user can
-- give or fix a name, wiki style, and everyone sees it in the search. Saved workouts keep their own
-- snapshot name, so changing a shared name never rewrites anyone's workout.
create table public.exercise_names (
  source text not null,
  source_id text not null,
  name text not null,
  -- Who last named it; null for the names shipped with this migration or a deleted account.
  updated_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exercise_names_pkey primary key (source, source_id),
  constraint exercise_names_name_length check (char_length(btrim(name)) between 1 and 80)
);

create trigger exercise_names_set_updated_at
  before update on public.exercise_names
  for each row execute function public.set_updated_at();

alter table public.exercise_names enable row level security;

create policy "Signed-in users can view exercise names"
  on public.exercise_names for select to authenticated
  using (true);

create policy "Signed-in users can add exercise names"
  on public.exercise_names for insert to authenticated
  with check ((select auth.uid()) = updated_by);

create policy "Signed-in users can fix exercise names"
  on public.exercise_names for update to authenticated
  using (true)
  with check ((select auth.uid()) = updated_by);

-- Local stacks still apply broad default privileges; revoke first so only these grants apply.
revoke all on table public.exercise_names from anon, authenticated;
grant select, insert on table public.exercise_names to authenticated;
grant update (name, updated_by) on table public.exercise_names to authenticated;

insert into public.exercise_names (source, source_id, name, updated_by) values
  ('free-exercise-db', 'Crunches', 'Abdominal', null),
  ('free-exercise-db', 'Sit-Up', 'Abdominal completo', null),
  ('free-exercise-db', 'Reverse_Crunch', 'Abdominal infra', null),
  ('free-exercise-db', 'Ab_Crunch_Machine', 'Abdominal na máquina', null),
  ('free-exercise-db', 'Cable_Crunch', 'Abdominal na polia', null),
  ('free-exercise-db', 'Oblique_Crunches', 'Abdominal oblíquo', null),
  ('free-exercise-db', 'Barbell_Lunge', 'Afundo com barra', null),
  ('free-exercise-db', 'Dumbbell_Lunges', 'Afundo com halteres', null),
  ('free-exercise-db', 'Split_Squat_with_Dumbbells', 'Agachamento búlgaro com halteres', null),
  ('free-exercise-db', 'Dumbbell_Squat', 'Agachamento com halteres', null),
  ('free-exercise-db', 'Barbell_Full_Squat', 'Agachamento completo com barra', null),
  ('free-exercise-db', 'Front_Barbell_Squat', 'Agachamento frontal com barra', null),
  ('free-exercise-db', 'Goblet_Squat', 'Agachamento goblet', null),
  ('free-exercise-db', 'Hack_Squat', 'Agachamento hack', null),
  ('free-exercise-db', 'Bodyweight_Squat', 'Agachamento livre (peso corporal)', null),
  ('free-exercise-db', 'Barbell_Squat', 'Agachamento livre com barra', null),
  ('free-exercise-db', 'Smith_Machine_Squat', 'Agachamento no Smith', null),
  ('free-exercise-db', 'Barbell_Walking_Lunge', 'Avanço caminhando com barra', null),
  ('free-exercise-db', 'Pullups', 'Barra fixa', null),
  ('free-exercise-db', 'Band_Assisted_Pull-Up', 'Barra fixa com elástico', null),
  ('free-exercise-db', 'Chin-Up', 'Barra fixa supinada', null),
  ('free-exercise-db', 'Good_Morning', 'Bom dia (good morning) com barra', null),
  ('free-exercise-db', 'Thigh_Abductor', 'Cadeira abdutora', null),
  ('free-exercise-db', 'Thigh_Adductor', 'Cadeira adutora', null),
  ('free-exercise-db', 'Leg_Extensions', 'Cadeira extensora', null),
  ('free-exercise-db', 'Single-Leg_Leg_Extension', 'Cadeira extensora unilateral', null),
  ('free-exercise-db', 'Seated_Leg_Curl', 'Cadeira flexora', null),
  ('free-exercise-db', 'Cable_Crossover', 'Crucifixo com cabos (crossover)', null),
  ('free-exercise-db', 'Flat_Bench_Cable_Flyes', 'Crucifixo com cabos no banco', null),
  ('free-exercise-db', 'Incline_Cable_Flye', 'Crucifixo inclinado com cabos', null),
  ('free-exercise-db', 'Incline_Dumbbell_Flyes', 'Crucifixo inclinado com halteres', null),
  ('free-exercise-db', 'Reverse_Flyes', 'Crucifixo invertido com halteres', null),
  ('free-exercise-db', 'Reverse_Machine_Flyes', 'Crucifixo invertido na máquina', null),
  ('free-exercise-db', 'Dumbbell_Flyes', 'Crucifixo reto com halteres', null),
  ('free-exercise-db', 'Arnold_Dumbbell_Press', 'Desenvolvimento Arnold', null),
  ('free-exercise-db', 'Barbell_Shoulder_Press', 'Desenvolvimento com barra', null),
  ('free-exercise-db', 'Dumbbell_Shoulder_Press', 'Desenvolvimento com halteres', null),
  ('free-exercise-db', 'Machine_Shoulder_Military_Press', 'Desenvolvimento na máquina', null),
  ('free-exercise-db', 'Smith_Machine_Overhead_Shoulder_Press', 'Desenvolvimento no Smith', null),
  ('free-exercise-db', 'Standing_Barbell_Calf_Raise', 'Elevação de panturrilha em pé com barra', null),
  ('free-exercise-db', 'Standing_Dumbbell_Calf_Raise', 'Elevação de panturrilha em pé com halteres', null),
  ('free-exercise-db', 'Barbell_Seated_Calf_Raise', 'Elevação de panturrilha sentado com barra', null),
  ('free-exercise-db', 'Hanging_Leg_Raise', 'Elevação de pernas na barra', null),
  ('free-exercise-db', 'Flat_Bench_Lying_Leg_Raise', 'Elevação de pernas no banco', null),
  ('free-exercise-db', 'Front_Plate_Raise', 'Elevação frontal com anilha', null),
  ('free-exercise-db', 'Front_Dumbbell_Raise', 'Elevação frontal com halteres', null),
  ('free-exercise-db', 'Side_Lateral_Raise', 'Elevação lateral com halteres', null),
  ('free-exercise-db', 'Side_Leg_Raises', 'Elevação lateral de perna', null),
  ('free-exercise-db', 'Cable_Seated_Lateral_Raise', 'Elevação lateral na polia', null),
  ('free-exercise-db', 'Lying_One-Arm_Lateral_Raise', 'Elevação lateral unilateral deitado', null),
  ('free-exercise-db', 'One-Arm_Incline_Lateral_Raise', 'Elevação lateral unilateral inclinado', null),
  ('free-exercise-db', 'Barbell_Hip_Thrust', 'Elevação pélvica com barra', null),
  ('free-exercise-db', 'Barbell_Shrug', 'Encolhimento de ombros com barra', null),
  ('free-exercise-db', 'Dumbbell_Shrug', 'Encolhimento de ombros com halteres', null),
  ('free-exercise-db', 'Triceps_Overhead_Extension_with_Rope', 'Extensão de tríceps na polia alta com corda', null),
  ('free-exercise-db', 'Face_Pull', 'Face pull na polia', null),
  ('free-exercise-db', 'Standing_Leg_Curl', 'Flexora em pé', null),
  ('free-exercise-db', 'Push_Up_to_Side_Plank', 'Flexão com prancha lateral', null),
  ('free-exercise-db', 'Pushups', 'Flexão de braço', null),
  ('free-exercise-db', 'Push-Up_Wide', 'Flexão de braço aberta', null),
  ('free-exercise-db', 'Decline_Push-Up', 'Flexão de braço declinada', null),
  ('free-exercise-db', 'Incline_Push-Up', 'Flexão de braço inclinada', null),
  ('free-exercise-db', 'Russian_Twist', 'Giro russo', null),
  ('free-exercise-db', 'Glute_Kickback', 'Glúteo coice (peso corporal)', null),
  ('free-exercise-db', 'One-Legged_Cable_Kickback', 'Glúteo coice na polia', null),
  ('free-exercise-db', 'Hyperextensions_Back_Extensions', 'Hiperextensão lombar', null),
  ('free-exercise-db', 'Leg_Press', 'Leg press', null),
  ('free-exercise-db', 'Barbell_Deadlift', 'Levantamento terra', null),
  ('free-exercise-db', 'Romanian_Deadlift', 'Levantamento terra romeno', null),
  ('free-exercise-db', 'Sumo_Deadlift', 'Levantamento terra sumô', null),
  ('free-exercise-db', 'Dips_-_Chest_Version', 'Mergulho nas paralelas (peito)', null),
  ('free-exercise-db', 'Dips_-_Triceps_Version', 'Mergulho nas paralelas (tríceps)', null),
  ('free-exercise-db', 'Bench_Dips', 'Mergulho no banco', null),
  ('free-exercise-db', 'Lying_Leg_Curls', 'Mesa flexora', null),
  ('free-exercise-db', 'Standing_Calf_Raises', 'Panturrilha em pé na máquina', null),
  ('free-exercise-db', 'Calf_Press_On_The_Leg_Press_Machine', 'Panturrilha no leg press', null),
  ('free-exercise-db', 'Seated_Calf_Raise', 'Panturrilha sentado na máquina', null),
  ('free-exercise-db', 'Barbell_Glute_Bridge', 'Ponte de glúteo com barra', null),
  ('free-exercise-db', 'Plank', 'Prancha', null),
  ('free-exercise-db', 'Straight-Arm_Pulldown', 'Pulldown com braços estendidos', null),
  ('free-exercise-db', 'Bent-Arm_Dumbbell_Pullover', 'Pullover com halter', null),
  ('free-exercise-db', 'V-Bar_Pulldown', 'Puxada com triângulo', null),
  ('free-exercise-db', 'Wide-Grip_Lat_Pulldown', 'Puxada frontal aberta', null),
  ('free-exercise-db', 'Close-Grip_Front_Lat_Pulldown', 'Puxada frontal fechada', null),
  ('free-exercise-db', 'Underhand_Cable_Pulldowns', 'Puxada supinada', null),
  ('free-exercise-db', 'Upright_Barbell_Row', 'Remada alta com barra', null),
  ('free-exercise-db', 'Standing_Dumbbell_Upright_Row', 'Remada alta com halteres', null),
  ('free-exercise-db', 'Leverage_High_Row', 'Remada alta na máquina', null),
  ('free-exercise-db', 'Lying_T-Bar_Row', 'Remada cavalinho', null),
  ('free-exercise-db', 'T-Bar_Row_with_Handle', 'Remada cavalinho com pegador', null),
  ('free-exercise-db', 'Bent_Over_Barbell_Row', 'Remada curvada com barra', null),
  ('free-exercise-db', 'Reverse_Grip_Bent-Over_Rows', 'Remada curvada com barra, pegada supinada', null),
  ('free-exercise-db', 'Bent_Over_Two-Dumbbell_Row', 'Remada curvada com halteres', null),
  ('free-exercise-db', 'Leverage_Iso_Row', 'Remada sentada na máquina', null),
  ('free-exercise-db', 'Seated_Cable_Rows', 'Remada sentada na polia', null),
  ('free-exercise-db', 'One-Arm_Dumbbell_Row', 'Remada unilateral com halter (serrote)', null),
  ('free-exercise-db', 'Preacher_Curl', 'Rosca Scott com barra', null),
  ('free-exercise-db', 'Machine_Preacher_Curls', 'Rosca Scott na máquina', null),
  ('free-exercise-db', 'Dumbbell_Alternate_Bicep_Curl', 'Rosca alternada com halteres', null),
  ('free-exercise-db', 'Dumbbell_Bicep_Curl', 'Rosca com halteres', null),
  ('free-exercise-db', 'Concentration_Curls', 'Rosca concentrada', null),
  ('free-exercise-db', 'Barbell_Curl', 'Rosca direta com barra', null),
  ('free-exercise-db', 'EZ-Bar_Curl', 'Rosca direta com barra W', null),
  ('free-exercise-db', 'Standing_Biceps_Cable_Curl', 'Rosca direta na polia', null),
  ('free-exercise-db', 'Incline_Dumbbell_Curl', 'Rosca inclinada com halteres', null),
  ('free-exercise-db', 'Alternate_Hammer_Curl', 'Rosca martelo alternada', null),
  ('free-exercise-db', 'Hammer_Curls', 'Rosca martelo com halteres', null),
  ('free-exercise-db', 'Cable_Hammer_Curls_-_Rope_Attachment', 'Rosca martelo na polia com corda', null),
  ('free-exercise-db', 'Machine_Bicep_Curl', 'Rosca na máquina', null),
  ('free-exercise-db', 'Stiff-Legged_Barbell_Deadlift', 'Stiff com barra', null),
  ('free-exercise-db', 'Stiff-Legged_Dumbbell_Deadlift', 'Stiff com halteres', null),
  ('free-exercise-db', 'Decline_Barbell_Bench_Press', 'Supino declinado com barra', null),
  ('free-exercise-db', 'Decline_Dumbbell_Bench_Press', 'Supino declinado com halteres', null),
  ('free-exercise-db', 'Close-Grip_Barbell_Bench_Press', 'Supino fechado com barra', null),
  ('free-exercise-db', 'Barbell_Incline_Bench_Press_-_Medium_Grip', 'Supino inclinado com barra', null),
  ('free-exercise-db', 'Incline_Dumbbell_Press', 'Supino inclinado com halteres', null),
  ('free-exercise-db', 'Smith_Machine_Incline_Bench_Press', 'Supino inclinado no Smith', null),
  ('free-exercise-db', 'Machine_Bench_Press', 'Supino na máquina', null),
  ('free-exercise-db', 'Barbell_Bench_Press_-_Medium_Grip', 'Supino reto com barra', null),
  ('free-exercise-db', 'Wide-Grip_Barbell_Bench_Press', 'Supino reto com barra, pegada aberta', null),
  ('free-exercise-db', 'Dumbbell_Bench_Press', 'Supino reto com halteres', null),
  ('free-exercise-db', 'Smith_Machine_Bench_Press', 'Supino reto no Smith', null),
  ('free-exercise-db', 'Tricep_Dumbbell_Kickback', 'Tríceps coice com halter', null),
  ('free-exercise-db', 'Standing_Dumbbell_Triceps_Extension', 'Tríceps francês com halter', null),
  ('free-exercise-db', 'Cable_Rope_Overhead_Triceps_Extension', 'Tríceps francês na polia com corda', null),
  ('free-exercise-db', 'Standing_One-Arm_Dumbbell_Triceps_Extension', 'Tríceps francês unilateral com halter', null),
  ('free-exercise-db', 'Machine_Triceps_Extension', 'Tríceps na máquina', null),
  ('free-exercise-db', 'Triceps_Pushdown', 'Tríceps na polia', null),
  ('free-exercise-db', 'Triceps_Pushdown_-_V-Bar_Attachment', 'Tríceps na polia com barra V', null),
  ('free-exercise-db', 'Triceps_Pushdown_-_Rope_Attachment', 'Tríceps na polia com corda', null),
  ('free-exercise-db', 'Reverse_Grip_Triceps_Pushdown', 'Tríceps na polia com pegada invertida', null),
  ('free-exercise-db', 'EZ-Bar_Skullcrusher', 'Tríceps testa com barra W', null),
  ('free-exercise-db', 'Butterfly', 'Voador (peck deck)', null);

-- Gives or fixes the shared name of a catalog exercise (wiki style: the last edit wins).
create function public.set_exercise_name(source text, source_id text, name text)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.exercise_names (source, source_id, name, updated_by)
  values (set_exercise_name.source, set_exercise_name.source_id, btrim(set_exercise_name.name), (select auth.uid()))
  on conflict on constraint exercise_names_pkey
  do update set name = excluded.name, updated_by = excluded.updated_by;
$$;

revoke execute on function public.set_exercise_name(text, text, text) from public, anon;
grant execute on function public.set_exercise_name(text, text, text) to authenticated;
