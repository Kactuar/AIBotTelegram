export type MiniAppLanguage = "ru" | "en";

type Copy = {
  nav: Record<"invite" | "videos" | "montage" | "balance" | "profile", string>;
  common: { darkTheme: string; close: string; back: string; unavailable: string; comingSoon: string };
  montage: {
    colors: string[]; video: string; requirements: string; upload: string; uploadHint: string; stylesSoon: string;
    parameters: string; generate: string; trial: string; topUp: string; connecting: string; processing: string;
    trialHint: string; topUpHint: (missing: number) => string; balance: string; tokens: string;
    fileInvalid: string; videoInvalid: string; ready: string; videoUnreadable: string; chooseVideo: string;
    projectFailed: string; projectReady: string; uploadFailed: string; createFailed: string; queueFailed: string;
    trialQueued: string; queued: string; introClose: string; introTitle: string; introSubtitle: string;
  };
  requirements: { title: string; carousel: string; correct: string; incorrect: string; paragraphs: string[] };
  profile: {
    videos: (count: number) => string; completed: (count: number) => string; topUp: string; support: string; channel: string;
    language: string; documents: string; offer: string; privacy: string; profile: string; noUsername: string;
  };
  support: { title: string; subtitle: string; contact: string; questions: { question: string; answer: string }[] };
  balance: {
    title: string; balance: string; enoughFor: (count: number) => string; history: string; bonusTitle: string; bonusBody: string;
    choosePackage: string; popular: string; videos: (count: number) => string; tokens: (count: number) => string; perVideo: (amount: number) => string;
    paymentMethod: string; total: string; receive: string; toAccount: string; toPay: string; agree: string; offer: string; privacy: string;
    pay: (amount: string) => string; processing: string; disabled: string; mockConfirm: string; paymentAdded: (tokens: number) => string;
    cancelled: string; operationFailed: string; noOperations: string; pending: string; cancelledStatus: string; paidStatus: (tokens: number) => string;
  };
  payment: { packageTitles: string[]; methods: string[] };
};

const ru: Copy = {
  nav: { invite: "Пригласить", videos: "Ролики", montage: "Монтаж", balance: "Баланс", profile: "Профиль" },
  common: { darkTheme: "Тёмная тема", close: "Понятно", back: "Назад", unavailable: "Сейчас недоступно", comingSoon: "Скоро появится" },
  montage: {
    colors: ["Янтарь", "Лазурь", "Лайм", "Багровый"], video: "Видео", requirements: "Требования к видео", upload: "Загрузите видео", uploadHint: ".mp4, .mov, .mkv, .webm · 2–30 сек · до 100 МБ", stylesSoon: "СКОРО", parameters: "Параметры", generate: "Создать ролик", trial: "Сделать пробный ролик", topUp: "Пополнить баланс", connecting: "Подключаем Telegram…", processing: "Монтируем ролик…", trialHint: "с водяным знаком", topUpHint: (missing) => `не хватает ${missing} токенов`, balance: "БАЛАНС", tokens: "токенов", fileInvalid: "Нужен MP4, MOV, MKV или WebM до 100 МБ.", videoInvalid: "Нужен вертикальный ролик длительностью от 2 до 30 секунд.", ready: "Ролик готов к загрузке.", videoUnreadable: "Не удалось прочитать параметры видео.", chooseVideo: "Сначала выберите видео.", projectFailed: "Runway не смог обработать ролик. 23 токена возвращены.", projectReady: "Ролик готов — ссылка отправлена в чат с ботом.", uploadFailed: "Загрузка не удалась.", createFailed: "Не удалось создать проект.", queueFailed: "Не удалось запустить монтаж.", trialQueued: "Пробный ролик поставлен в очередь. Он будет доступен с водяными знаками.", queued: "Монтаж поставлен в очередь. Это может занять несколько минут.", introClose: "Понятно", introTitle: "Бот для автомонтажа", introSubtitle: "Загрузите свой ролик",
  },
  requirements: { title: "Требования к видео", carousel: "Примеры видео", correct: "Показать подходящий пример", incorrect: "Показать неподходящий пример", paragraphs: ["Загрузите вертикальное видео длиной от 2 до 30 секунд. Поддерживаются MP4, MOV, MKV и WebM, размер файла — до 100 МБ.", "Лучше всего подойдут ролики с понятной речью и главным героем в кадре.", "Готовый ролик создаётся в вертикальном формате 9:16 для Reels, Shorts и Клипов."] },
  profile: { videos: (count) => `${count} ${pluralRu(count, "ролик", "ролика", "роликов")}`, completed: (count) => `Смонтирован${count === 1 ? "" : "о"} ${pluralRu(count, "ролик", "ролика", "роликов")}`, topUp: "Пополнить баланс", support: "Поддержка", channel: "Официальный канал", language: "Язык", documents: "ДОКУМЕНТЫ", offer: "Публичная оферта", privacy: "Политика конфиденциальности", profile: "Профиль", noUsername: "Telegram-пользователь" },
  support: { title: "Поддержка", subtitle: "Короткие ответы на частые вопросы. Если нужного нет — напишите оператору, разберёмся.", contact: "Написать в поддержку", questions: [
    { question: "Как это работает?", answer: "Выберите настройки, загрузите подходящее видео и запустите монтаж. Когда ролик будет готов, ссылка придёт в чат с ботом." },
    { question: "В каком формате будет готовый ролик?", answer: "Готовый ролик вертикальный, 9:16 — для Reels, Shorts и Клипов. На вход принимаются только вертикальные видео." },
    { question: "Сколько стоит ролик и где посмотреть цены?", answer: "Один обычный монтаж стоит 23 токена. Пакеты токенов доступны на вкладке «Баланс»; подписки и автоматических списаний нет." },
    { question: "Что такое токены и где их взять?", answer: "Токены — внутренний баланс для монтажа. Выберите подходящий пакет на вкладке «Баланс». До первой оплаты доступен один пробный ролик с водяным знаком." },
    { question: "Сколько хранятся готовые ролики?", answer: "Результаты хранятся 72 часа, затем файлы удаляются." },
  ] },
  balance: { title: "БАЛАНС", balance: "Баланс", enoughFor: (count) => `Хватит на ${count} монтажей`, history: "История операций", bonusTitle: "Бесплатно, сверх пакета", bonusBody: "Пробный ролик без водяного знака придёт сразу после оплаты — токены за него не спишутся.", choosePackage: "ВЫБЕРИТЕ ПАКЕТ", popular: "ПОПУЛЯРНЫЙ", videos: (count) => `${count} роликов`, tokens: (count) => `${count} токенов`, perVideo: (amount) => `${amount} ₽ за ролик`, paymentMethod: "СПОСОБ ОПЛАТЫ", total: "ИТОГ", receive: "Получите", toAccount: "Токенов на счёт", toPay: "К оплате", agree: "Согласен с", offer: "офертой", privacy: "политикой конфиденциальности", pay: (amount) => `Оплатить ${amount}`, processing: "Обрабатываем…", disabled: "Оплата временно недоступна", mockConfirm: "Это тестовая оплата. Начислить токены?", paymentAdded: (tokens) => `Баланс пополнен на ${tokens} токенов.`, cancelled: "Оплата отменена.", operationFailed: "Не удалось выполнить оплату.", noOperations: "Операций пока нет.", pending: "В обработке", cancelledStatus: "Отменено", paidStatus: (tokens) => `+${tokens} токенов` },
  payment: { packageTitles: ["Старт", "Для активных", "Контент-завод"], methods: ["Карта РФ / СБП 💳", "Зарубежная карта #1 🌍", "Зарубежная карта #2 🌍", "Telegram Stars ⭐"] },
};

const en: Copy = {
  nav: { invite: "Invite", videos: "Videos", montage: "Edit", balance: "Balance", profile: "Profile" },
  common: { darkTheme: "Dark theme", close: "Got it", back: "Back", unavailable: "Unavailable now", comingSoon: "Coming soon" },
  montage: {
    colors: ["Amber", "Azure", "Lime", "Crimson"], video: "Video", requirements: "Video requirements", upload: "Upload video", uploadHint: ".mp4, .mov, .mkv, .webm · 2–30 sec · up to 100 MB", stylesSoon: "SOON", parameters: "Settings", generate: "Create video", trial: "Create trial video", topUp: "Top up balance", connecting: "Connecting Telegram…", processing: "Editing video…", trialHint: "with watermark", topUpHint: (missing) => `${missing} tokens needed`, balance: "BALANCE", tokens: "tokens", fileInvalid: "Use MP4, MOV, MKV, or WebM up to 100 MB.", videoInvalid: "Use a vertical video from 2 to 30 seconds.", ready: "Video is ready to upload.", videoUnreadable: "Could not read the video details.", chooseVideo: "Choose a video first.", projectFailed: "Runway could not process the video. 23 tokens were refunded.", projectReady: "Your video is ready — a link was sent in the bot chat.", uploadFailed: "Upload failed.", createFailed: "Could not create the project.", queueFailed: "Could not start editing.", trialQueued: "Trial video is queued. It will include watermarks.", queued: "Editing is queued. It may take a few minutes.", introClose: "Got it", introTitle: "Automatic video editing bot", introSubtitle: "Upload your video",
  },
  requirements: { title: "Video requirements", carousel: "Video examples", correct: "Show a suitable example", incorrect: "Show an unsuitable example", paragraphs: ["Upload a vertical video from 2 to 30 seconds. MP4, MOV, MKV, and WebM are supported up to 100 MB.", "Videos with clear speech and a main person in frame work best.", "The finished video is vertical, 9:16 — for Reels, Shorts, and Clips."] },
  profile: { videos: (count) => `${count} video${count === 1 ? "" : "s"}`, completed: (count) => `${count} edited video${count === 1 ? "" : "s"}`, topUp: "Top up balance", support: "Support", channel: "Official channel", language: "Language", documents: "DOCUMENTS", offer: "Public offer", privacy: "Privacy policy", profile: "Profile", noUsername: "Telegram user" },
  support: { title: "Support", subtitle: "Quick answers to common questions. If yours is missing, write to our support team.", contact: "Contact support", questions: [
    { question: "How does it work?", answer: "Choose settings, upload a suitable video, and start editing. Once it is ready, a link arrives in your bot chat." },
    { question: "What format will the finished video use?", answer: "Finished videos are vertical, 9:16 — for Reels, Shorts, and Clips. Only vertical source videos are accepted." },
    { question: "How much does a video cost and where are prices?", answer: "One regular edit costs 23 tokens. Token packages are on the Balance tab; there are no subscriptions or automatic charges." },
    { question: "What are tokens and where can I get them?", answer: "Tokens are the internal balance for editing. Pick a package on the Balance tab. Before first payment, one watermarked trial video is available." },
    { question: "How long are finished videos stored?", answer: "Results are stored for 72 hours, then their files are deleted." },
  ] },
  balance: { title: "BALANCE", balance: "Balance", enoughFor: (count) => `Enough for ${count} edits`, history: "Transaction history", bonusTitle: "Free, in addition to your package", bonusBody: "The trial video without a watermark arrives after payment — no tokens are charged for it.", choosePackage: "CHOOSE A PACKAGE", popular: "POPULAR", videos: (count) => `${count} videos`, tokens: (count) => `${count} tokens`, perVideo: (amount) => `${amount} ₽ per video`, paymentMethod: "PAYMENT METHOD", total: "TOTAL", receive: "You receive", toAccount: "Tokens to your account", toPay: "To pay", agree: "I agree to the", offer: "offer", privacy: "privacy policy", pay: (amount) => `Pay ${amount}`, processing: "Processing…", disabled: "Payments are unavailable", mockConfirm: "This is a test payment. Add tokens?", paymentAdded: (tokens) => `${tokens} tokens added to your balance.`, cancelled: "Payment cancelled.", operationFailed: "Could not complete the payment.", noOperations: "No transactions yet.", pending: "Processing", cancelledStatus: "Cancelled", paidStatus: (tokens) => `+${tokens} tokens` },
  payment: { packageTitles: ["Starter", "For active users", "Content factory"], methods: ["Russian card / SBP 💳", "Foreign card #1 🌍", "Foreign card #2 🌍", "Telegram Stars ⭐"] },
};

export const copy: Record<MiniAppLanguage, Copy> = { ru, en };

export function pluralRu(value: number, one: string, few: string, many: string) {
  const remainder = Math.abs(value) % 100;
  const last = remainder % 10;
  return remainder > 10 && remainder < 20 ? many : last === 1 ? one : last >= 2 && last <= 4 ? few : many;
}
