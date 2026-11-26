"use client";

import Image from "next/image";
import { useState } from "react";
import styles from "./workouts.module.css";

const SIZES = { sm: 40, md: 56 } as const;

/** RN-31: images stay as links to the source; a broken one becomes the placeholder. */
export function ExerciseImage({ src, size = "sm" }: { src: string | null; size?: keyof typeof SIZES }) {
  const [broken, setBroken] = useState(false);
  const className = `${styles.thumb} ${size === "md" ? styles.thumbMd : ""}`;
  if (!src || broken) {
    return (
      <span className={`${className} ${styles.thumbPlaceholder}`} aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="5" r="2" />
          <path d="M12 7v7M7 10h10M12 14l-3 6M12 14l3 6" />
        </svg>
      </span>
    );
  }
  return (
    <Image
      className={className}
      src={src}
      alt=""
      width={SIZES[size]}
      height={SIZES[size]}
      onError={() => setBroken(true)}
    />
  );
}
