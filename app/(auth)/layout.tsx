import Image from "next/image";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import styles from "./auth.module.css";

const HIGHLIGHTS = [
  "Objetivos diários com um check por dia",
  "Metas com prazo, divididas em etapas",
  "Histórico e sequência para manter o ritmo",
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className={styles.container}>
      <ThemeToggle className={styles.themeToggle} />
      <div className={styles.shell}>
        <aside className={styles.brandPanel}>
          <Image
            className={styles.brandLogo}
            src="/logotipo-icone.svg"
            alt=""
            width={88}
            height={88}
            unoptimized
          />
          <p className={styles.brandName}>Athlos</p>
          <p className={styles.brandTagline}>Seu dia a dia, um check de cada vez.</p>
          <ul className={styles.highlights}>
            {HIGHLIGHTS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </aside>
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
      </div>
    </main>
  );
}
