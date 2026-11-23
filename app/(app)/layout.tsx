import { AppNav } from "@/app/components/AppNav";
import styles from "./shell.module.css";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <AppNav />
      {children}
    </div>
  );
}
