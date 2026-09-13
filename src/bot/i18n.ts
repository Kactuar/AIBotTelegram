import type { Context } from "grammy";
import { getBotLanguage } from "@/src/lib/database";

export type Language = "ru" | "en";
export const languageOf = (ctx: Pick<Context, "from">): Language => ctx.from ? getBotLanguage(String(ctx.from.id)) : "ru";

const ru = {
  menu: { montage: "▷ Начать монтаж", balance: "▣ Баланс", videos: "▣ Мои ролики", referral: "🎁 Реф. программа", support: "🎧 Поддержка" },
  welcome: "Добро пожаловать!\n\nВыберите действие:",
  languageSaved: "Язык: Русский ✅",
  error: "Произошла ошибка. Попробуйте ещё раз.",
  back: "← Назад",
  support: "Чем помочь?\n\nВ FAQ — короткие ответы на частые вопросы: сколько стоит ролик, лимиты видео, как считаются токены и сколько хранятся готовые ролики.\n\nЕсли видео не проходит, монтаж завис, списались лишние токены или вопрос не из FAQ — пишите оператору, разберёмся.",
  operator: "🎧 Оператор",
  noOperator: "Связь с оператором пока недоступна.",
  faq: "FAQ\n\nОдин монтаж стоит 23 токена. Сейчас монтаж доступен тестовым аккаунтам.\n\nВидео: вертикальное, от 2 до 30 секунд, до 100 МБ. Форматы: MP4, MOV, MKV, WebM.\n\nЕсли обработка не удалась, зарезервированные токены возвращаются.\n\nГотовый ролик доступен для скачивания 72 часа.",
  montage: "✨ Всего четыре шага:\n\n1. Выбираете стиль\n2. Выбираете цвет\n3. Настраиваете основные параметры\n4. Присылаете сырое видео и через несколько минут забираете готовый Reels в Full HD",
  begin: "▷ Приступить",
  continueInBot: "🤖 Продолжить в боте",
  selectStyle: "Выберите стиль монтажа:",
  selectedStyle: (style: string) => `Выбран стиль: ${style}\n\nСледующий этап будет реализован позже.`,
  balance: (tokens: number, completed: number) => `Ваш баланс: ${tokens} токенов\nХватит на ~${Math.floor(tokens / 23)} монтажа\nСмонтировано всего: ${completed} роликов`,
  topUp: "💎 Пополнить баланс",
  invite: "🎁 Пригласить друга",
  tariffs: "Цены\n\nТокены не сгорают.\nБез подписки и автосписаний — платите только за смонтированные ролики.\n\nВыберите пакет:",
  tariff: (rubles: number, tokens: number, videos: number) => `${rubles} ₽ — ${tokens} токенов (~${videos} роликов)`,
  payment: (tokens: number) => `Вы выбрали пакет: ${tokens} токенов.\n\nПодключение оплаты будет реализовано позже.`,
  referral: (link: string, invited: number, earned: number) => `Приглашайте друзей — получайте токены.\n\nЗа каждую успешную оплату приглашённого друга вы получаете 10% от купленных им токенов.\n\nВаша ссылка:\n${link}\n\nПриглашено: ${invited} человек\nЗаработано: ${earned} токенов`,
  noUsername: "Недоступна: у бота нет username.",
  videoList: "Ваши ролики — нажмите на карточку, чтобы посмотреть детали:",
  statuses: { draft: "📝 Черновик", processing: "⏳ Обрабатывается", completed: "✅ Готово", failed: "❌ Ошибка" },
  video: (id: number, status: string, style: string, color: string, price: number, date: string) => `Ролик #${id}\nСтатус: ${status}\nСтиль: ${style}\nЦвет: ${color}\nСтоимость: ${price} токенов\nДата: ${date}`,
  download: "↓ Скачать",
  backToVideos: "← Назад к списку",
  completed: (link: string) => `Ролик готов. Скачать его можно по ссылке: ${link}`,
};

const en: typeof ru = {
  menu: { montage: "▷ Start editing", balance: "▣ Balance", videos: "▣ My videos", referral: "🎁 Referral program", support: "🎧 Support" },
  welcome: "Welcome!\n\nChoose an action:",
  languageSaved: "Language: English ✅",
  error: "Something went wrong. Please try again.",
  back: "← Back",
  support: "How can we help?\n\nThe FAQ covers common questions: video pricing, upload limits, tokens, and how long completed videos are stored.\n\nIf your video cannot be uploaded, editing is stuck, extra tokens were charged, or your question is not in the FAQ, contact our support team.",
  operator: "🎧 Support agent",
  noOperator: "Contacting a support agent is not available yet.",
  faq: "FAQ\n\nEach edit costs 23 tokens. Editing is currently available to test accounts.\n\nVideo: vertical, 2–30 seconds, up to 100 MB. Formats: MP4, MOV, MKV, WebM.\n\nReserved tokens are refunded if processing fails.\n\nCompleted videos are available to download for 72 hours.",
  montage: "✨ Just four steps:\n\n1. Choose a style\n2. Choose a color\n3. Adjust the settings\n4. Send your raw video and receive a finished Full HD Reel in a few minutes",
  begin: "▷ Get started",
  continueInBot: "🤖 Continue in bot",
  selectStyle: "Choose an editing style:",
  selectedStyle: (style) => `Selected style: ${style}\n\nThe next step will be added later.`,
  balance: (tokens, completed) => `Your balance: ${tokens} tokens\nEnough for ~${Math.floor(tokens / 23)} edits\nCompleted videos: ${completed}`,
  topUp: "💎 Top up balance",
  invite: "🎁 Invite a friend",
  tariffs: "Pricing\n\nTokens do not expire.\nNo subscriptions or automatic charges — pay only for edited videos.\n\nChoose a package:",
  tariff: (rubles, tokens, videos) => `${rubles} ₽ — ${tokens} tokens (~${videos} videos)`,
  payment: (tokens) => `You selected ${tokens} tokens.\n\nPayments will be added later.`,
  referral: (link: string, invited: number, earned: number) => `Invite friends and earn tokens.\n\nFor each successful payment by an invited friend, you receive 10% of the tokens they purchase.\n\nYour link:\n${link}\n\nFriends invited: ${invited}\nTokens earned: ${earned}`,
  noUsername: "Unavailable: the bot has no username.",
  videoList: "Your videos — tap a card to see details:",
  statuses: { draft: "📝 Draft", processing: "⏳ Processing", completed: "✅ Ready", failed: "❌ Failed" },
  video: (id, status, style, color, price, date) => `Video #${id}\nStatus: ${status}\nStyle: ${style}\nColor: ${color}\nPrice: ${price} tokens\nDate: ${date}`,
  download: "↓ Download",
  backToVideos: "← Back to list",
  completed: (link) => `Your video is ready. Download it here: ${link}`,
};

export const translations = { ru, en };
