"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { AvailableProject, ProjectsResponse } from "@/src/domain/api";
import { Icon } from "./AppShell";
import { montageColors } from "@/src/domain/montage";
import { copy, type MiniAppLanguage } from "./i18n";
import styles from "@/app/mini-app/page.module.css";

type State = { kind: "loading" } | { kind: "error" } | { kind: "ready"; projects: AvailableProject[] };

function displayDate(value: string, language: MiniAppLanguage) {
  return new Intl.DateTimeFormat(language === "ru" ? "ru-RU" : "en-US", { day: "numeric", month: "short" }).format(new Date(value)).replace(".", "");
}

export default function VideosScreen({ authorized, authPending, header, language, nav }: { authorized: boolean; authPending: boolean; header: ReactNode; language: MiniAppLanguage; nav: ReactNode }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [retry, setRetry] = useState(0);
  const t = copy[language].videos;

  useEffect(() => {
    if (authPending) return;
    if (!authorized) { setState({ kind: "error" }); return; }
    const controller = new AbortController();
    async function load() {
      setState({ kind: "loading" });
      try {
        const response = await fetch("/api/projects", { signal: controller.signal });
        const data = await response.json() as ProjectsResponse;
        if (!response.ok) throw new Error(data.error || "projects_unavailable");
        if (!controller.signal.aborted) setState({ kind: "ready", projects: data.projects });
      } catch {
        if (!controller.signal.aborted) setState({ kind: "error" });
      }
    }
    void load();
    return () => controller.abort();
  }, [authorized, authPending, retry]);

  return <section className={styles.app}>
    {header}
    <main className={styles.videosContent}>
      <h1>{t.title}</h1>
      {state.kind === "loading" && <p className={styles.videosState}>{t.loading}</p>}
      {state.kind === "error" && <div className={styles.videosState}><p>{t.failed}</p><button onClick={() => setRetry((value) => value + 1)}>{t.retry}</button></div>}
      {state.kind === "ready" && !state.projects.length && <p className={styles.videosState}>{t.empty}</p>}
      {state.kind === "ready" && <div className={styles.videoList}>{state.projects.map((project) => <article className={styles.videoCard} key={project.id}>
        <div className={styles.videoThumb}><Icon name="films" /></div>
        <div className={styles.videoDetails}>
          <strong>Glass · {copy[language].montage.colors[montageColors.indexOf(project.settings.color)]}</strong>
          <span>{displayDate(project.createdAt, language)} · {project.isTrial && !project.trialUnlockedAt ? t.trial : t.ready} · {t.expires(displayDate(project.resultExpiresAt!, language))}</span>
          <a href={project.downloadUrl} target="_blank" rel="noreferrer">{t.download}</a>
        </div>
      </article>)}</div>}
    </main>
    {nav}
  </section>;
}
