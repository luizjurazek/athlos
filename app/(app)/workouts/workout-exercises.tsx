"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatDayMonth } from "@/app/utils/dates";
import {
  describeLoadChange,
  formatLoad,
  getLoadOn,
  hasLoadErrors,
  sameLoad,
  validateLoad,
  type LoadVersion,
} from "@/app/utils/workout-loads";
import { Sheet, SheetError, useSheetAction } from "../dashboard/sheet";
import sheetStyles from "../dashboard/dashboard.module.css";
import g from "../goals/goals.module.css";
import ui from "../objectives/objectives.module.css";
import type { WorkoutExercise } from "./data";
import {
  addExercise,
  moveExercise,
  removeExercise,
  searchExerciseCatalog,
  updateExercise,
} from "./exercise-actions";
import { ExerciseImage, PreviewImage } from "./exercise-image";
import {
  describeExercise,
  EXERCISE_SOURCE,
  EXERCISE_SOURCE_URL,
  MUSCLE_LABELS,
  MUSCLES,
  type Muscle,
} from "./exercise-labels";
import type { ExerciseResult, ExerciseSearchResult } from "./exercise-search";
import { LoadFields, toLoadDraft, toLoadValues, type LoadDraft } from "./load-fields";
import { EXERCISE_NAME_MAX_LENGTH, EXERCISE_NOTES_MAX_LENGTH } from "./validation";
import styles from "./workouts.module.css";

type WorkoutInfo = { id: string; label: string; description: string | null };

type SheetState =
  | { kind: "search" }
  | { kind: "preview"; result: ExerciseResult; back: "search" | "add" }
  | { kind: "add"; result: ExerciseResult | null; name: string }
  | { kind: "edit"; exercise: WorkoutExercise }
  | null;

const SEARCH_DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

function workoutName(workout: WorkoutInfo) {
  return `Treino ${workout.label}${workout.description ? ` · ${workout.description}` : ""}`;
}

export function WorkoutExercises({
  workout,
  exercises,
  today,
  loadDay,
  readOnly,
}: {
  workout: WorkoutInfo;
  exercises: WorkoutExercise[];
  today: string;
  /** Day the initial load and adjustments start: today, or the plan start when it is later. */
  loadDay: string;
  readOnly: boolean;
}) {
  const [sheet, setSheet] = useState<SheetState>(null);
  // Kept here so going back from the preview or the load step returns to the same search.
  const [search, setSearch] = useState<SearchState>({ query: "", muscle: null });
  const close = () => {
    setSheet(null);
    setSearch({ query: "", muscle: null });
  };
  const pick = (result: ExerciseResult) =>
    setSheet({ kind: "add", result, name: result.localName ?? result.name });
  const takenSourceIds = new Set(exercises.flatMap((exercise) => (exercise.sourceId ? [exercise.sourceId] : [])));

  return (
    <section className={ui.section}>
      {exercises.length === 0 ? (
        <p className={ui.empty}>Este treino ainda não tem exercícios.</p>
      ) : (
        <ul className={`${ui.list} ${styles.list}`}>
          {exercises.map((exercise) => {
            const { current, previous } = getLoadOn(exercise.versions, today);
            const content = (
              <>
                <ExerciseImage src={exercise.imageUrl} />
                <span className={ui.rowText}>
                  <span className={ui.rowTitle}>{exercise.name}</span>
                  {current && <span className={styles.loadLine}>{formatLoad(current)}</span>}
                  <span className={ui.rowMeta}>
                    {current ? describeLoadChange(current, previous, today) : "Sem carga"}
                    {!exercise.source && " · escrito à mão"}
                  </span>
                </span>
              </>
            );
            return (
              <li key={exercise.id}>
                {readOnly ? (
                  <Link className={styles.exerciseRow} href={`/workouts/exercises/${exercise.id}`}>
                    {content}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className={styles.exerciseRow}
                    aria-label={`${exercise.name}${current ? `, ${formatLoad(current)}` : ""}. Editar`}
                    onClick={() => setSheet({ kind: "edit", exercise })}
                  >
                    {content}
                    <svg className={ui.rowChevron} viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m9 5 7 7-7 7" />
                    </svg>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!readOnly && (
        <button className={g.addStage} type="button" onClick={() => setSheet({ kind: "search" })}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Adicionar exercício
        </button>
      )}

      {sheet?.kind === "search" && (
        <SearchSheet
          workout={workout}
          takenSourceIds={takenSourceIds}
          search={search}
          onSearchChange={setSearch}
          onClose={close}
          onPick={pick}
          onPreview={(result) => setSheet({ kind: "preview", result, back: "search" })}
          onWrite={(name) => setSheet({ kind: "add", result: null, name })}
        />
      )}
      {sheet?.kind === "preview" && (
        <PreviewSheet
          result={sheet.result}
          taken={takenSourceIds.has(sheet.result.sourceId) ? workout.label : null}
          onBack={() =>
            setSheet(sheet.back === "search" ? { kind: "search" } : { kind: "add", result: sheet.result, name: sheet.result.localName ?? sheet.result.name })
          }
          onPick={sheet.back === "search" ? () => pick(sheet.result) : null}
          onClose={close}
        />
      )}
      {sheet?.kind === "add" && (
        <AddSheet
          workout={workout}
          result={sheet.result}
          initialName={sheet.name}
          loadDay={loadDay}
          today={today}
          onPreview={(result) => setSheet({ kind: "preview", result, back: "add" })}
          onBack={() => setSheet({ kind: "search" })}
          onClose={close}
        />
      )}
      {sheet?.kind === "edit" && (
        <EditSheet
          workout={workout}
          exercise={sheet.exercise}
          isFirst={exercises[0]?.id === sheet.exercise.id}
          isLast={exercises.at(-1)?.id === sheet.exercise.id}
          today={today}
          loadDay={loadDay}
          onClose={close}
        />
      )}
    </section>
  );
}

type SearchState = { query: string; muscle: Muscle | null };

function SearchSheet({
  workout,
  takenSourceIds,
  search: { query, muscle },
  onSearchChange,
  onClose,
  onPick,
  onPreview,
  onWrite,
}: {
  workout: WorkoutInfo;
  takenSourceIds: Set<string>;
  search: SearchState;
  onSearchChange: (search: SearchState) => void;
  onClose: () => void;
  onPick: (result: ExerciseResult) => void;
  onPreview: (result: ExerciseResult) => void;
  onWrite: (name: string) => void;
}) {
  const setQuery = (value: string) => onSearchChange({ query: value, muscle });
  const setMuscle = (update: (current: Muscle | null) => Muscle | null) =>
    onSearchChange({ query, muscle: update(muscle) });
  const [search, setSearch] = useState<{ key: string; result: ExerciseSearchResult } | null>(null);
  const latestKey = useRef("");
  const trimmed = query.trim();
  const ready = trimmed.length >= MIN_QUERY_LENGTH || muscle !== null;
  const key = `${trimmed}|${muscle ?? ""}`;

  useEffect(() => {
    latestKey.current = key;
    if (!ready) return;
    const timer = setTimeout(async () => {
      let result: ExerciseSearchResult;
      try {
        result = await searchExerciseCatalog(trimmed, muscle);
      } catch {
        result = { ok: false, reason: "unavailable" };
      }
      // Ignore answers to queries the user already typed past.
      if (latestKey.current === key) setSearch({ key, result });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [key, ready, trimmed, muscle]);

  const current = ready && search?.key === key ? search.result : null;
  const loading = ready && !current;

  return (
    <Sheet title="Adicionar exercício" subtitle={workoutName(workout)} onClose={onClose}>
      <div className={`${ui.group} ${styles.searchField}`}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          className={ui.input}
          type="search"
          autoComplete="off"
          enterKeyHint="search"
          placeholder="Buscar exercício"
          aria-label="Buscar exercício"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <p className={sheetStyles.sheetInfo}>Busque em português ou em inglês. Sem nome em português? Dê um ao adicionar e ele vale para todos.</p>
      <div className={styles.chips} role="group" aria-label="Filtrar por músculo">
        {MUSCLES.map((item) => (
          <button
            key={item}
            type="button"
            className={ui.chip}
            aria-pressed={muscle === item}
            onClick={() => setMuscle((currentMuscle) => (currentMuscle === item ? null : item))}
          >
            {MUSCLE_LABELS[item]}
          </button>
        ))}
      </div>

      <div className={styles.results} data-ready={ready || undefined} aria-live="polite" aria-busy={loading}>
        {!ready && <p className={sheetStyles.sheetInfo}>Digite pelo menos 2 letras.</p>}
        {loading && (
          <ul className={`${ui.list} ${styles.list}`} aria-hidden="true">
            {[0, 1, 2, 3].map((item) => (
              <li key={item} className={styles.resultSkeleton} />
            ))}
          </ul>
        )}
        {current && !current.ok && (
          <div className={styles.unavailable}>
            <p>Busca indisponível agora. Você ainda pode escrever o exercício.</p>
            <button type="button" className={sheetStyles.primaryButton} onClick={() => onWrite(trimmed)}>
              {trimmed ? `Escrever "${trimmed}"` : "Escrever exercício"}
            </button>
          </div>
        )}
        {current?.ok && current.results.length === 0 && (
          <p className={sheetStyles.sheetInfo}>
            Nada encontrado{trimmed ? ` para "${trimmed}"` : ""}. Tente em inglês ou escreva o exercício.
          </p>
        )}
        {current?.ok && current.results.length > 0 && (
          <ul className={`${ui.list} ${styles.list}`}>
            {current.results.map((result) => {
              const taken = takenSourceIds.has(result.sourceId);
              return (
                <li key={result.sourceId} className={styles.resultRow}>
                  <button
                    type="button"
                    className={styles.previewButton}
                    aria-label={`Ver ${result.localName ?? result.name} ampliado`}
                    onClick={() => onPreview(result)}
                  >
                    <ExerciseImage src={result.imageUrl} size="md" />
                    <svg className={styles.zoomIcon} viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="11" cy="11" r="6" />
                      <path d="m20 20-4.5-4.5M11 8.5v5M8.5 11h5" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className={sheetStyles.optionRow}
                    aria-disabled={taken || undefined}
                    onClick={() => !taken && onPick(result)}
                  >
                    <span className={ui.rowText}>
                      <span className={sheetStyles.rowTitle}>{result.localName ?? result.name}</span>
                      <span className={ui.rowMeta}>
                        {taken
                          ? `Já está no treino ${workout.label}`
                          : [
                              result.localName ? result.name : "Sem nome em português",
                              describeExercise(result.muscles, result.equipment),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                      </span>
                    </span>
                    {!taken && (
                      <svg className={styles.plusIcon} viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <button className={g.addStage} type="button" onClick={() => onWrite(trimmed)}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" />
        </svg>
        {current?.ok && current.results.length === 0 && trimmed ? `Escrever "${trimmed}"` : "Escrever exercício"}
      </button>
      <p className={styles.attribution}>
        Dados e imagens:{" "}
        <a href={EXERCISE_SOURCE_URL} target="_blank" rel="noreferrer">
          {EXERCISE_SOURCE}
        </a>{" "}
        (domínio público)
      </p>
    </Sheet>
  );
}

function AddSheet({
  workout,
  result,
  initialName,
  loadDay,
  today,
  onPreview,
  onBack,
  onClose,
}: {
  workout: WorkoutInfo;
  result: ExerciseResult | null;
  initialName: string;
  loadDay: string;
  today: string;
  onPreview: (result: ExerciseResult) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const { pending, error, run } = useSheetAction(onClose);
  const [name, setName] = useState(initialName);
  const [shareChoice, setShareChoice] = useState<boolean | null>(null);
  const share = getShareOption(result, name);
  const shareName = share !== null && (shareChoice ?? share.suggested);
  const [notes, setNotes] = useState("");
  const [load, setLoad] = useState<LoadDraft>(toLoadDraft(null));
  const [showErrors, setShowErrors] = useState(false);
  const values = toLoadValues(load);
  const loadErrors = validateLoad(values);
  const nameError = name.trim() ? undefined : "Dê um nome ao exercício.";

  function submit() {
    if (nameError || hasLoadErrors(loadErrors)) {
      setShowErrors(true);
      return;
    }
    run(() =>
      addExercise(workout.id, {
        name,
        notes,
        load: values,
        snapshot: result && {
          sourceId: result.sourceId,
          imageUrl: result.imageUrl,
          muscles: result.muscles,
          equipment: result.equipment,
        },
        shareName,
      }),
    );
  }

  return (
    <Sheet
      title={result ? (result.localName ?? result.name) : "Escrever exercício"}
      subtitle={
        result
          ? [result.localName && result.name, describeExercise(result.muscles, result.equipment)].filter(Boolean).join(" · ") ||
            workoutName(workout)
          : workoutName(workout)
      }
      onClose={onClose}
    >
      {result && (
        <button
          type="button"
          className={styles.previewButton}
          aria-label={`Ver ${result.localName ?? result.name} ampliado`}
          onClick={() => onPreview(result)}
        >
          <ExerciseImage src={result.imageUrl} size="md" />
          <svg className={styles.zoomIcon} viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6" />
            <path d="m20 20-4.5-4.5M11 8.5v5M8.5 11h5" />
          </svg>
        </button>
      )}
      <LoadFields value={load} onChange={setLoad} errors={showErrors ? loadErrors : undefined} />
      <label className={g.field}>
        <span className={g.label}>{result ? "Nome no treino" : "Nome"}</span>
        <span className={ui.group} data-invalid={(showErrors && Boolean(nameError)) || undefined}>
          <input
            className={ui.input}
            type="text"
            autoComplete="off"
            placeholder="Ex.: Crucifixo no cross unilateral"
            maxLength={EXERCISE_NAME_MAX_LENGTH}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </span>
        {showErrors && nameError && <span className={g.fieldError}>{nameError}</span>}
      </label>
      {share && (
        <ShareNameOption
          option={share}
          checked={shareName}
          onChange={setShareChoice}
          englishName={result?.name ?? ""}
        />
      )}
      <label className={g.field}>
        <span className={g.label}>Observação (opcional)</span>
        <span className={ui.group}>
          <input
            className={ui.input}
            type="text"
            autoComplete="off"
            placeholder="Ex.: pegada fechada, banco 30°"
            maxLength={EXERCISE_NOTES_MAX_LENGTH}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </span>
      </label>
      <p className={sheetStyles.sheetInfo}>
        A carga vale a partir de {loadDay === today ? "hoje" : formatDayMonth(loadDay)}.
      </p>
      <SheetError error={error} />
      <div className={sheetStyles.sheetActions}>
        <button type="button" className={sheetStyles.secondaryButton} onClick={onBack} disabled={pending}>
          Voltar à busca
        </button>
        <button type="button" className={sheetStyles.primaryButton} onClick={submit} disabled={pending}>
          {pending
            ? "Adicionando..."
            : hasLoadErrors(loadErrors)
              ? "Adicionar exercício"
              : `Adicionar com ${formatLoad(values)}`}
        </button>
      </div>
    </Sheet>
  );
}

function EditSheet({
  workout,
  exercise,
  isFirst,
  isLast,
  today,
  loadDay,
  onClose,
}: {
  workout: WorkoutInfo;
  exercise: WorkoutExercise;
  isFirst: boolean;
  isLast: boolean;
  today: string;
  loadDay: string;
  onClose: () => void;
}) {
  const { pending, error, run } = useSheetAction(onClose);
  const { current, previous } = getLoadOn(exercise.versions, loadDay);
  const [name, setName] = useState(exercise.name);
  const [notes, setNotes] = useState(exercise.notes ?? "");
  const [load, setLoad] = useState<LoadDraft>(toLoadDraft(current));
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [shareName, setShareName] = useState(false);
  const canShare = Boolean(exercise.sourceId) && name.trim() !== "" && name.trim() !== exercise.name;
  const values = toLoadValues(load);
  const loadErrors = validateLoad(values);
  const loadChanged = !current || !sameLoad(values, current);
  const hasHistory = exercise.versions.some((version: LoadVersion) => version.effectiveFrom < today);
  const fromLabel = loadDay === today ? "a partir de hoje" : `a partir de ${formatDayMonth(loadDay)}`;

  function submit() {
    if (!name.trim() || hasLoadErrors(loadErrors)) return;
    run(() =>
      updateExercise(exercise.id, { name, notes, load: loadChanged ? values : null, shareName: canShare && shareName }),
    );
  }

  return (
    <Sheet title={exercise.name} subtitle={workoutName(workout)} onClose={onClose}>
      {current && (
        <p className={sheetStyles.sheetInfo}>
          {previous && current.effectiveFrom === loadDay
            ? `Antes: ${formatLoad(previous)} desde ${formatDayMonth(previous.effectiveFrom)}`
            : `Atual: ${formatLoad(current)} desde ${formatDayMonth(current.effectiveFrom)}`}
        </p>
      )}
      <LoadFields value={load} onChange={setLoad} errors={loadErrors} />
      <label className={g.field}>
        <span className={g.label}>Nome no treino</span>
        <span className={ui.group} data-invalid={!name.trim() || undefined}>
          <input
            className={ui.input}
            type="text"
            autoComplete="off"
            maxLength={EXERCISE_NAME_MAX_LENGTH}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </span>
        {!name.trim() && <span className={g.fieldError}>Dê um nome ao exercício.</span>}
      </label>
      {canShare && (
        <label className={styles.checkRow}>
          <input
            className={g.checkbox}
            type="checkbox"
            checked={shareName}
            onChange={(event) => setShareName(event.target.checked)}
          />
          <span className={styles.shareText}>
            <span>Usar este nome para todos</span>
            <span className={styles.shareHint}>Vale para a busca de todo mundo. Os treinos já salvos não mudam.</span>
          </span>
        </label>
      )}
      <label className={g.field}>
        <span className={g.label}>Observação (opcional)</span>
        <span className={ui.group}>
          <input
            className={ui.input}
            type="text"
            autoComplete="off"
            maxLength={EXERCISE_NOTES_MAX_LENGTH}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </span>
      </label>
      <SheetError error={error} />
      <div className={sheetStyles.sheetActions}>
        <button type="button" className={sheetStyles.primaryButton} onClick={submit} disabled={pending}>
          {pending
            ? "Salvando..."
            : loadChanged && !hasLoadErrors(loadErrors)
              ? `Salvar ${formatLoad(values)} ${fromLabel}`
              : "Salvar"}
        </button>
      </div>
      <div className={styles.exerciseTools}>
        <button
          type="button"
          className={sheetStyles.secondaryButton}
          disabled={pending || isFirst}
          onClick={() => run(() => moveExercise(exercise.id, -1))}
        >
          Subir
        </button>
        <button
          type="button"
          className={sheetStyles.secondaryButton}
          disabled={pending || isLast}
          onClick={() => run(() => moveExercise(exercise.id, 1))}
        >
          Descer
        </button>
        {confirmRemove ? (
          <button
            type="button"
            className={`${sheetStyles.secondaryButton} ${ui.danger}`}
            disabled={pending}
            onClick={() => run(() => removeExercise(exercise.id))}
          >
            {hasHistory ? "Confirmar: arquivar" : "Confirmar remoção"}
          </button>
        ) : (
          <button
            type="button"
            className={`${sheetStyles.secondaryButton} ${ui.danger}`}
            disabled={pending}
            onClick={() => setConfirmRemove(true)}
          >
            Remover
          </button>
        )}
      </div>
      <Link className={styles.evolutionLink} href={`/workouts/exercises/${exercise.id}`}>
        Ver evolução
      </Link>
      {confirmRemove && (
        <p className={sheetStyles.sheetInfo}>
          {hasHistory
            ? "Este exercício já tem histórico de carga: ele sai do treino, mas a evolução continua guardada."
            : "Este exercício ainda não tem histórico e será apagado."}
        </p>
      )}
    </Sheet>
  );
}

type ShareOption = { kind: "give" | "fix"; current: string | null; suggested: boolean };

/**
 * Shared Portuguese names (wiki style): offered when the exercise has none yet, or when the name typed
 * differs from the shared one. Giving a first name is pre-checked; changing someone's name is opt-in.
 */
function getShareOption(result: ExerciseResult | null, name: string): ShareOption | null {
  const typed = name.trim();
  if (!result || !typed) return null;
  if (!result.localName) {
    return typed.toLowerCase() === result.name.trim().toLowerCase()
      ? null
      : { kind: "give", current: null, suggested: true };
  }
  return typed === result.localName ? null : { kind: "fix", current: result.localName, suggested: false };
}

function ShareNameOption({
  option,
  checked,
  onChange,
  englishName,
}: {
  option: ShareOption;
  checked: boolean;
  onChange: (checked: boolean) => void;
  englishName: string;
}) {
  return (
    <label className={styles.checkRow}>
      <input
        className={g.checkbox}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className={styles.shareText}>
        <span>{option.kind === "give" ? "Usar este nome para todos" : "Corrigir o nome para todos"}</span>
        <span className={styles.shareHint}>
          {option.kind === "give"
            ? `Quem buscar "${englishName}" vai ver este nome.`
            : `Hoje todos veem "${option.current}". Os treinos já salvos não mudam.`}
        </span>
      </span>
    </label>
  );
}

function PreviewSheet({
  result,
  taken,
  onBack,
  onPick,
  onClose,
}: {
  result: ExerciseResult;
  /** Workout label when the exercise is already in it. */
  taken: string | null;
  onBack: () => void;
  onPick: (() => void) | null;
  onClose: () => void;
}) {
  const captions = ["Início do movimento", "Fim do movimento"];
  return (
    <Sheet
      title={result.localName ?? result.name}
      subtitle={[result.localName && result.name, describeExercise(result.muscles, result.equipment)]
        .filter(Boolean)
        .join(" · ")}
      onClose={onClose}
    >
      {result.images.length === 0 ? (
        <p className={sheetStyles.sheetInfo}>Este exercício não tem imagem.</p>
      ) : (
        <div className={styles.previewImages}>
          {result.images.slice(0, 2).map((image, index) => (
            <figure key={image} className={styles.previewFigure}>
              <PreviewImage src={image} alt={`${result.localName ?? result.name}: ${captions[index].toLowerCase()}`} />
              {result.images.length > 1 && <figcaption>{captions[index]}</figcaption>}
            </figure>
          ))}
        </div>
      )}
      {taken && <p className={sheetStyles.sheetInfo}>Já está no treino {taken}.</p>}
      <div className={sheetStyles.sheetActions}>
        <button type="button" className={sheetStyles.secondaryButton} onClick={onBack}>
          Voltar
        </button>
        {onPick && (
          <button type="button" className={sheetStyles.primaryButton} disabled={Boolean(taken)} onClick={onPick}>
            Usar este exercício
          </button>
        )}
      </div>
    </Sheet>
  );
}
