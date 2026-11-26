"use client";

import { useState, type ReactNode } from "react";
import { Sheet } from "../dashboard/sheet";
import sheetStyles from "../dashboard/dashboard.module.css";
import { ExerciseImage, PreviewImage } from "./exercise-image";
import styles from "./workouts.module.css";

const CAPTIONS = ["Início do movimento", "Fim do movimento"];
const CATALOG_FIRST_FRAME = /^(https:\/\/raw\.githubusercontent\.com\/yuhonas\/free-exercise-db\/main\/exercises\/[^/]+\/)0\.jpg$/;

/**
 * A saved exercise keeps only its first photo (snapshot). The catalog stores the end of the movement
 * next to it as 1.jpg, so the preview derives it; a missing one is simply hidden.
 */
export function getExerciseImages(imageUrl: string | null): string[] {
  if (!imageUrl) return [];
  const match = CATALOG_FIRST_FRAME.exec(imageUrl);
  return match ? [imageUrl, `${match[1]}1.jpg`] : [imageUrl];
}

/** Thumbnail that opens the full-size preview (its own button, never inside another one). */
export function PreviewThumb({
  src,
  name,
  size = "sm",
  onOpen,
}: {
  src: string | null;
  name: string;
  size?: "sm" | "md";
  onOpen: () => void;
}) {
  if (!src) return <ExerciseImage src={null} size={size} />;
  return (
    <button type="button" className={styles.previewButton} aria-label={`Ver ${name} ampliado`} onClick={onOpen}>
      <ExerciseImage src={src} size={size} />
      <svg className={styles.zoomIcon} viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="6" />
        <path d="m20 20-4.5-4.5M11 8.5v5M8.5 11h5" />
      </svg>
    </button>
  );
}

export function ExercisePreviewSheet({
  title,
  subtitle,
  images,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  images: string[];
  onClose: () => void;
  /** Extra info and the action buttons; defaults to a single "Fechar". */
  children?: ReactNode;
}) {
  const [hidden, setHidden] = useState<string[]>([]);
  // The first photo stays even when broken (it shows the placeholder); a derived second one just goes away.
  const visible = images.slice(0, 2).filter((image, index) => index === 0 || !hidden.includes(image));

  return (
    <Sheet title={title} subtitle={subtitle} onClose={onClose}>
      {visible.length === 0 ? (
        <p className={sheetStyles.sheetInfo}>Este exercício não tem imagem.</p>
      ) : (
        <div className={styles.previewImages}>
          {visible.map((image, index) => (
            <figure key={image} className={styles.previewFigure}>
              <PreviewImage
                src={image}
                alt={`${title}: ${CAPTIONS[index].toLowerCase()}`}
                onError={index > 0 ? () => setHidden((current) => [...current, image]) : undefined}
              />
              {visible.length > 1 && <figcaption>{CAPTIONS[index]}</figcaption>}
            </figure>
          ))}
        </div>
      )}
      {children ?? (
        <div className={sheetStyles.sheetActions}>
          <button type="button" className={sheetStyles.secondaryButton} onClick={onClose}>
            Fechar
          </button>
        </div>
      )}
    </Sheet>
  );
}
