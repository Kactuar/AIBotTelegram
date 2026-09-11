"use client";

import { useEffect, useState } from "react";
import InfoDialog from "./InfoDialog";
import { copy, type MiniAppLanguage } from "./i18n";
import styles from "@/app/mini-app/page.module.css";

const slides = [
  { src: "/images/video-requirements/correct.png", alt: "Suitable video example" },
  { src: "/images/video-requirements/incorrect.png", alt: "Unsuitable video example" },
];

export default function VideoRequirements({ onClose, language }: { onClose(): void; language: MiniAppLanguage }) {
  const [slide, setSlide] = useState(0);
  const t = copy[language].requirements;
  useEffect(() => { const timer = window.setInterval(() => setSlide((current) => current + 1), 5000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { if (slide !== slides.length) return; const timer = window.setTimeout(() => setSlide(0), 450); return () => window.clearTimeout(timer); }, [slide]);
  return <InfoDialog labelledBy="video-requirements-title" onClose={onClose} language={language}>
    <div className={styles.requirementsImages} aria-label={t.carousel} aria-roledescription="carousel">
      <div className={styles.requirementsTrack} style={{ transform: `translateX(-${slide * 100}%)`, transition: slide === 0 ? "none" : undefined }}>
        {[...slides, slides[0]].map((item, index) => <img key={index} src={item.src} alt={item.alt} aria-hidden={index !== slide} width={450} height={504} draggable={false} />)}
      </div>
    </div>
    <div className={styles.requirementsDots}>{slides.map((item, index) => <button key={item.src} type="button" aria-label={index ? t.incorrect : t.correct} aria-pressed={slide % slides.length === index} onClick={() => setSlide(index)}><span /></button>)}</div>
    <h2 id="video-requirements-title">{t.title}</h2>
    {t.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
  </InfoDialog>;
}
