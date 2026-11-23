import { ObjectiveIcon } from "./objective-icon";
import { isObjectiveColor } from "./options";
import styles from "./objectives.module.css";

export function ObjectiveBadge({ color, icon }: { color: string | null; icon: string | null }) {
  return (
    <span className={styles.badge} data-color={isObjectiveColor(color) ? color : "neutral"}>
      <ObjectiveIcon name={icon} className={styles.badgeIcon} />
    </span>
  );
}
