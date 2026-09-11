"use client";

import { useEffect, useState } from "react";
import InfoDialog from "./InfoDialog";
import styles from "@/app/mini-app/page.module.css";

const slides = [
  { src: "/images/video-requirements/correct.png", alt: "Так правильно: вы в кадре и говорите — до 3 минут. Сервис делает ролик из вашей речи." },
  { src: "/images/video-requirements/incorrect.png", alt: "Неправильно: не слышно голоса, нет человека в кадре или видео длиннее 3 минут." },
];

export default function VideoRequirements({ onClose }: { onClose(): void }) {
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setSlide((current) => current + 1), 5000);
    return () => window.clearInterval(timer);
  }, []);

  // The duplicate first image lets every automatic transition move forward.
  useEffect(() => {
    if (slide !== slides.length) return;
    const timer = window.setTimeout(() => setSlide(0), 450);
    return () => window.clearTimeout(timer);
  }, [slide]);

  return <InfoDialog labelledBy="video-requirements-title" onClose={onClose}>
      <div className={styles.requirementsImages} aria-label="Примеры видео" aria-roledescription="карусель">
        <div className={styles.requirementsTrack} style={{ transform: `translateX(-${slide * 100}%)`, transition: slide === 0 ? "none" : undefined }}>
          {[...slides, slides[0]].map((item, index) => <img key={index} src={item.src} alt={item.alt} aria-hidden={index !== slide} width={450} height={504} draggable={false} />)}
        </div>
      </div>
      <div className={styles.requirementsDots}>
        {slides.map((item, index) => <button key={item.src} type="button" aria-label={`Показать пример: ${index === 0 ? "правильно" : "неправильно"}`} aria-pressed={slide % slides.length === index} onClick={() => setSlide(index)}><span /></button>)}
      </div>
      <h2 id="video-requirements-title">Требования к видео</h2>
      <p>Отправьте видео (15 сек - 3 мин), где вы говорите на камеру — например, рассказываете о работе, делитесь мыслью, показываете процесс.</p>
      <p>❌ Не подойдёт: видео без вашей речи (танцы, тренировки, природа и т.д.) — монтаж работает именно с разговорной речью.</p>
      <p>📱 Готовый ролик всегда вертикальный (9:16) — под Reels и Shorts. Горизонтальное видео тоже подойдёт: кадрируем его под вертикаль, держа в кадре того, кто говорит.</p>
  </InfoDialog>;
}
