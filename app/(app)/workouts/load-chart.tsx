"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { diffDays, formatDayMonth } from "@/app/utils/dates";
import { formatKg, formatLoad } from "@/app/utils/workout-loads";
import type { EvolutionVersion } from "./data";
import styles from "./workouts.module.css";

const MARGIN = { top: 24, right: 56, bottom: 28, left: 44 };
const MOBILE_HEIGHT = 160;
const WIDE_HEIGHT = 220;
const WIDE_FROM = 560;

type Point = EvolutionVersion & { loadKg: number; x: number; y: number };

function niceTicks(min: number, max: number) {
  const span = Math.max(max - min, 1);
  const rawStep = span / 3;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * magnitude).find((value) => value >= rawStep) ?? rawStep;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let value = start; value <= end + step / 2; value += step) ticks.push(Math.round(value * 100) / 100);
  return ticks;
}

function describeDiff(point: Point, previous: Point | undefined) {
  if (!previous) return null;
  const diff = point.loadKg - previous.loadKg;
  if (diff === 0) return null;
  return `${diff > 0 ? "↑" : "↓"} ${formatKg(Math.abs(diff))}`;
}

/** Step-after chart of the load (kg) over time: each version holds until the next one (RN-27). */
export function LoadChart({ versions, today }: { versions: EvolutionVersion[]; today: string }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const weighted = versions.filter((version): version is EvolutionVersion & { loadKg: number } => version.loadKg != null);
  const height = width >= WIDE_FROM ? WIDE_HEIGHT : MOBILE_HEIGHT;
  const plotWidth = Math.max(width - MARGIN.left - MARGIN.right, 1);
  const plotHeight = height - MARGIN.top - MARGIN.bottom;

  const first = weighted[0]?.effectiveFrom ?? today;
  const last = weighted.at(-1)?.effectiveFrom ?? today;
  const end = today > last ? today : last;
  const totalDays = Math.max(diffDays(first, end), 1);
  const loads = weighted.map((version) => version.loadKg);
  const ticks = niceTicks(Math.min(...loads), Math.max(...loads));
  const yMin = ticks[0];
  const yMax = ticks.at(-1) ?? yMin + 1;
  const xOf = (day: string) => MARGIN.left + (diffDays(first, day) / totalDays) * plotWidth;
  const yOf = (kg: number) => MARGIN.top + plotHeight - ((kg - yMin) / Math.max(yMax - yMin, 1)) * plotHeight;

  const points: Point[] = weighted.map((version) => ({ ...version, x: xOf(version.effectiveFrom), y: yOf(version.loadKg) }));
  const endX = xOf(end);
  const path = points
    .map((point, index) => {
      const nextX = index < points.length - 1 ? points[index + 1].x : endX;
      const move = index === 0 ? `M${point.x.toFixed(1)},${point.y.toFixed(1)}` : `V${point.y.toFixed(1)}`;
      return `${move} H${nextX.toFixed(1)}`;
    })
    .join(" ");

  function handlePointer(event: PointerEvent<SVGRectElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - box.left + MARGIN.left;
    const index = points.findLastIndex((point) => point.x <= x + 1);
    setActive(index < 0 ? 0 : index);
  }

  const activePoint = active != null ? points[active] : null;
  const lastPoint = points.at(-1);

  return (
    <div ref={wrapperRef} className={styles.chart} style={{ height }}>
      {width > 0 && points.length > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`Carga de ${formatKg(points[0].loadKg)} em ${formatDayMonth(points[0].effectiveFrom)} a ${formatKg(lastPoint?.loadKg ?? 0)} em ${formatDayMonth(lastPoint?.effectiveFrom ?? first)}. A lista abaixo tem todas as versões.`}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line className={styles.chartGrid} x1={MARGIN.left} x2={MARGIN.left + plotWidth} y1={yOf(tick)} y2={yOf(tick)} />
              <text className={styles.chartLabel} x={MARGIN.left - 8} y={yOf(tick)} textAnchor="end" dominantBaseline="middle">
                {tick}
              </text>
            </g>
          ))}
          <text className={styles.chartLabel} x={MARGIN.left} y={height - 6}>
            {formatDayMonth(first)}
          </text>
          <text className={styles.chartLabel} x={MARGIN.left + plotWidth} y={height - 6} textAnchor="end">
            {end === today ? "hoje" : formatDayMonth(end)}
          </text>

          {points
            .filter((point) => point.planStart)
            .map((point) => (
              <g key={`plan-${point.exerciseId}`}>
                <line className={styles.chartPlanLine} x1={point.x} x2={point.x} y1={MARGIN.top - 8} y2={MARGIN.top + plotHeight} />
                <text className={styles.chartLabel} x={point.x + 4} y={MARGIN.top - 10}>
                  {point.planTitle}
                </text>
              </g>
            ))}

          <path className={styles.chartLine} d={path} />
          {points.map((point, index) => (
            <circle key={`${point.exerciseId}-${point.effectiveFrom}`} className={styles.chartMarker} cx={point.x} cy={point.y} r={index === active ? 5 : 4} />
          ))}
          {lastPoint && (
            <text className={styles.chartValue} x={endX + 6} y={lastPoint.y} dominantBaseline="middle">
              {formatKg(lastPoint.loadKg)}
            </text>
          )}

          {activePoint && (
            <line className={styles.chartCrosshair} x1={activePoint.x} x2={activePoint.x} y1={MARGIN.top} y2={MARGIN.top + plotHeight} />
          )}
          <rect
            className={styles.chartHit}
            x={MARGIN.left}
            y={0}
            width={plotWidth}
            height={height}
            onPointerMove={handlePointer}
            onPointerDown={handlePointer}
            onPointerLeave={() => setActive(null)}
          />
        </svg>
      )}
      {activePoint && (
        <div
          className={styles.chartTooltip}
          style={{
            left: Math.min(Math.max(activePoint.x - 80, 0), Math.max(width - 160, 0)),
            top: Math.max(activePoint.y - 64, 0),
          }}
          aria-hidden="true"
        >
          <strong>{formatDayMonth(activePoint.effectiveFrom)}</strong>
          <span>{formatLoad(activePoint)}</span>
          {describeDiff(activePoint, active ? points[active - 1] : undefined) && (
            <span>{describeDiff(activePoint, active ? points[active - 1] : undefined)}</span>
          )}
        </div>
      )}
    </div>
  );
}
