# BRANDLY — Telegram-бот

Mock-реализация Telegram-интерфейса BRANDLY на Next.js, TypeScript и grammY. Бот использует webhook и подходит для Vercel. В этой версии нет обработки видео, AI, базы данных, оплат или реального учёта токенов.

## Требования

- Node.js 20 или новее
- бот из [@BotFather](https://t.me/BotFather)
- аккаунт Vercel для production-развёртывания

## Локальный запуск

1. Выполните `npm install`.
2. Скопируйте `.env.example` в `.env.local` и заполните:

   ```env
   BOT_TOKEN=токен_из_BotFather
   MINI_APP_URL=http://localhost:3000/mini-app
   APP_URL=https://ваш-публичный-домен
   SUPPORT_URL=https://t.me/example_support
   ```

   `APP_URL` должен быть доступен Telegram по HTTPS. Для локальной проверки webhook используйте туннель.
3. Выполните `npm run dev`.
4. После появления публичного URL выполните `npm run telegram:setup`.

Проверка mock-данных и динамических клавиатур: `npm run verify`.

## Деплой Vercel

1. Импортируйте репозиторий в Vercel или выполните `vercel deploy`.
2. В настройках Vercel добавьте `BOT_TOKEN`, `MINI_APP_URL`, `APP_URL`, `SUPPORT_URL`.
3. Задайте `APP_URL` как URL production-деплоя, а `MINI_APP_URL` как `${APP_URL}/mini-app`.
4. В терминале с production-переменными выполните `npm run telegram:setup`.

Скрипт регистрирует `POST ${APP_URL}/api/telegram` как webhook и устанавливает Menu Button «Приложение ✨». Для проверки отправьте `/start` боту. Webhook можно посмотреть через `getWebhookInfo` Telegram Bot API; не публикуйте токен в URL.

## Интерфейсы Telegram

- `ReplyKeyboardMarkup` — постоянное нижнее меню с пятью основными действиями.
- `InlineKeyboardMarkup` — кнопки под сообщением, которые вызывают callbacks и обновляют карточки.
- Menu Button / Web App — системная кнопка «Приложение ✨», открывающая `/mini-app` в Telegram WebView.

## Структура

```text
app/api/telegram/route.ts  webhook Next.js
app/mini-app/page.tsx      страница Mini App
src/bot/bot.ts             единый экземпляр grammY и регистрация handlers
src/bot/handlers/          сценарии Telegram
src/bot/keyboards/         Reply и Inline клавиатуры
src/bot/mock/data.ts       временные ролики, баланс и тарифы
scripts/setup-telegram.ts  установка webhook и Menu Button
```

`bot.start()` отсутствует: production-обновления Telegram передаёт в `POST /api/telegram`.

push