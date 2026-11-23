import Image from "next/image";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import styles from "./auth.module.css";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className={styles.container}>
      <ThemeToggle className={styles.themeToggle} />
      <div className={styles.column}>
        <Image
          className={styles.logo}
          src="/logotipo-icone.svg"
          alt="Athlos"
          width={64}
          height={64}
          priority
          unoptimized
        />
        {children}
      </div>
    </main>
  );
}
