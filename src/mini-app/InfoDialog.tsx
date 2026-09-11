"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "@/app/mini-app/page.module.css";
import { copy, type MiniAppLanguage } from "./i18n";

export default function InfoDialog({ labelledBy, onClose, children, language = "ru" }: { labelledBy: string; onClose(): void; children: ReactNode; language?: MiniAppLanguage }) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current!;
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      previousFocus?.focus({ preventScroll: true });
    };
  }, []);

  return <dialog ref={dialog} className={styles.requirements} aria-labelledby={labelledBy} tabIndex={-1} autoFocus onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={styles.requirementsContent}>
      {children}
      <button type="button" className={styles.requirementsClose} onClick={onClose}>{copy[language].common.close}</button>
    </div>
  </dialog>;
}
