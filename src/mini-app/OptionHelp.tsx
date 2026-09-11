"use client";

import type { MontageSettings } from "@/src/montage/types";
import InfoDialog from "./InfoDialog";
import styles from "@/app/mini-app/page.module.css";

type MontageOption = {
  key: Exclude<keyof MontageSettings, "style" | "color">;
  label: string;
  paragraphs: string[];
  image?: { src: string; alt: string; width: number; height: number };
};

export const toggles: MontageOption[] = [
  {
    key: "trimVideo", label: "Нарезать видео",
    paragraphs: [
      "Включите, чтобы мы вырезали паузы и повторы, а ролик собрали из лучших фрагментов.",
      "Выключите, если присылаете уже готовый, смонтированный ролик — монтаж и тайминг не тронем, только подчистим «эээ» и речевой мусор из звука и субтитров.",
    ],
  },
  {
    key: "generateHook", label: "Придумать хук к видео",
    paragraphs: ["Включите, чтобы модель получила инструкцию сделать начало видео более цепляющим."],
  },
  {
    key: "soundEffects", label: "Звуковые эффекты",
    paragraphs: ["Короткие звуковые акценты на смену сцен и субтитров."],
  },
  {
    key: "mediaCards", label: "Медиа-карточки",
    paragraphs: ["Включите, чтобы сгенерированные картинки автоматически добавлялись по смыслу поверх видео."],
    image: { src: "/images/option-help/media-cards.png", alt: "Пример медиа-карточки: смартфон с изображением горного озера поверх видео.", width: 341, height: 450 },
  },
  {
    key: "emojiSubtitles", label: "Эмодзи в субтитрах",
    paragraphs: ["Включите, чтобы добавить эмодзи в субтитры — в подходящих по смыслу местах."],
    image: { src: "/images/option-help/emoji-subtitles.png", alt: "Пример эмодзи инструментов рядом со словом «работа» в субтитрах.", width: 450, height: 142 },
  },
  {
    key: "badges", label: "Плашки и карточки",
    paragraphs: ["Включите, чтобы добавить текстовые плашки-акценты поверх видео — ключевые фразы, цифры."],
    image: { src: "/images/option-help/badges.png", alt: "Пример текстовой плашки: «полностью монтирует готовые ролики».", width: 451, height: 120 },
  },
  {
    key: "cameraMotion", label: "Движение камеры",
    paragraphs: ["Лёгкое движение/приближение кадра вместо статичной картинки."],
  },
];

export default function OptionHelp({ option, onClose }: { option: MontageOption; onClose(): void }) {
  return <InfoDialog labelledBy="option-help-title" onClose={onClose}>
    {option.image && <img {...option.image} className={`${styles.helpImage} ${option.key === "mediaCards" ? styles.helpPortrait : ""}`} />}
    <h2 id="option-help-title">{option.label}</h2>
    {option.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
  </InfoDialog>;
}
