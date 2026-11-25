import type { ReactNode } from "react";
import styles from "./dashboard.module.css";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <div className={styles.typography}>{children}</div>;
}
