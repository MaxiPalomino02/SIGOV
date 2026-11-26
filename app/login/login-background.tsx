import styles from "./login.module.css";

export function LoginBackground({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden className={`${styles.fondo} pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <span className={`${styles.fondoRojo} absolute`} />
      <span className={`${styles.fondoAmbar} absolute`} />
    </span>
  );
}
