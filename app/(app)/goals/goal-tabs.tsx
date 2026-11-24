"use client";

import { useState } from "react";
import ui from "../objectives/objectives.module.css";
import { GoalCard, type GoalCardData } from "./goal-card";
import styles from "./goals.module.css";

const TABS = [
  { id: "active", label: "Ativas", empty: "Nenhuma meta ativa. Crie uma para dar direção aos seus objetivos." },
  { id: "completed", label: "Concluídas", empty: "Nenhuma meta concluída ainda." },
  { id: "closed", label: "Encerradas", empty: "Nenhuma meta expirada ou abandonada." },
] as const;

type TabId = (typeof TABS)[number]["id"];

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
                <GoalCard card={card} />
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
