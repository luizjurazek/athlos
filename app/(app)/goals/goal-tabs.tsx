"use client";

import Link from "next/link";
import { useState } from "react";
import ui from "../objectives/objectives.module.css";
import type { GoalStatus } from "./data";
import styles from "./goals.module.css";

export type GoalCardData = {
  id: string;
  title: string;
  status: GoalStatus;
  stageLabel: string;
  done: number;
  target: string;
  objectives: string;
};

const TABS = [
  { id: "active", label: "Ativas", empty: "Nenhuma meta ativa. Crie uma para dar direção aos seus objetivos." },
  { id: "completed", label: "Concluídas", empty: "Nenhuma meta concluída ainda." },
  { id: "closed", label: "Encerradas", empty: "Nenhuma meta expirada ou abandonada." },
] as const;

type TabId = (typeof TABS)[number]["id"];

const STATUS_LABELS: Partial<Record<GoalStatus, string>> = {
  expired: "Expirada",
  abandoned: "Abandonada",
};

export function GoalTabs(lists: Record<TabId, GoalCardData[]>) {
  const [tab, setTab] = useState<TabId>("active");
  const current = TABS.find((item) => item.id === tab)!;
  const cards = lists[tab];

  return (
    <section className={styles.section}>
      <div className={styles.tabs} role="tablist" aria-label="Situação das metas">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`goals-tab-${item.id}`}
            aria-selected={item.id === tab}
            aria-controls="goals-panel"
            className={styles.tab}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div id="goals-panel" role="tabpanel" aria-labelledby={`goals-tab-${tab}`}>
        {cards.length === 0 ? (
          <p className={ui.empty}>{current.empty}</p>
        ) : (
          <ul className={styles.cards}>
            {cards.map((card) => (
              <li key={card.id}>
                <Link className={styles.card} href={`/goals/${card.id}/edit`}>
                  <span className={styles.cardHeader}>
                    <span className={styles.cardTitle}>{card.title}</span>
                    {STATUS_LABELS[card.status] && (
                      <span className={styles.statusPill}>{STATUS_LABELS[card.status]}</span>
                    )}
                  </span>
                  <span className={styles.cardMeta}>{card.stageLabel}</span>
                  <span className={styles.cardFooter}>
                    <span>
                      <strong className={styles.cardCount}>{card.done}</strong> de {card.target}
                    </span>
                    <span className={styles.cardObjectives}>{card.objectives}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {tab === "closed" && (
        <p className={`${ui.hint} ${styles.info}`}>
          Encerradas reúne metas expiradas e abandonadas, com o status em cada card.
        </p>
      )}
    </section>
  );
}
