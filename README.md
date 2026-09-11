# Brandly-style Telegram Mini App

One Next.js application receives the Telegram webhook and serves `/mini-app`. A separate PM2 worker reads queued projects from SQLite and calls Runway Aleph 2.

The Mini App implements the Brandly-inspired montage screen: light/dark themes, animated color selection, an intro modal, local preview, drag-and-drop upload, stored settings, and polling. The four other navigation tabs are visual placeholders by design.

## What is real and simplified

- Telegram Mini App `initData` is verified on the server. A signed `HttpOnly` session cookie lasts 24 hours.
- Only IDs in `TELEGRAM_ALLOWED_USER_IDS` can run Runway. They get 100 mock tokens at first login; a project reserves 23 and returns them when Runway fails.
- Source files are written outside the public directory as `.part`, then atomically renamed. The worker deletes sources after a successful Runway handoff. Results are held for 72 hours and require an expiring signed link.
- There are no payments, transcription, FFmpeg, guaranteed captions, or exact cut timing. Enabled toggles are fixed prompt blocks, so captions, sound, cards and camera movement are best-effort model instructions.

## Local setup

Use Node.js 24 (`.nvmrc`). The SQLite driver requires at least Node.js 22.

1. Copy `.env.example` to `.env.local` and set values such as:

```env
BOT_TOKEN=token-from-BotFather
APP_URL=http://localhost:3000
MINI_APP_URL=http://localhost:3000/mini-app
SESSION_SECRET=long-random-string
TELEGRAM_ALLOWED_USER_IDS=123456789
RUNWAYML_API_SECRET=runway-secret
```

2. Run `npm run dev` for the web app and `npm run worker` in another terminal for the queue.
3. Run `npm run verify`. It checks the current bot keyboard, prompt ordering/toggle exclusion, and valid/tampered Telegram `initData`.

Browser-only development can inspect the layout but cannot start a project: genuine `initData` is supplied only by Telegram.

## Hetzner layout

```text
/srv/aibot/current       deployed application
/srv/aibot/.env          production secrets, mode 600
/srv/aibot/data/app.sqlite
/srv/aibot/storage/<telegram-id>/<project-id>/result.mp4
```

`DATABASE_PATH` and `STORAGE_ROOT` in `/srv/aibot/.env` must match these paths. The web process binds only to `127.0.0.1:3010`; Caddy is the public listener.

## Production deployment

1. Copy the app to `/srv/aibot/current`. Load nvm with `source ~/.nvm/nvm.sh`, install Node.js 24 with `nvm install 24`, then select it in this shell with `nvm use 24`. Keep the existing default alias and Bookilion processes unchanged. Run `npm ci`, `npm run verify`, then `npm run build` under Node.js 24. Reinstall dependencies when changing the Node.js major version because SQLite contains a native binary.
2. Create `/srv/aibot/.env` from `.env.example`, set secrets, and make it readable only by the deploy user. Symlink it as `/srv/aibot/current/.env.local` so Next.js receives the same values; the worker reads `/srv/aibot/.env` via `AIBOT_ENV_PATH`. Do not put secrets into `deploy/ecosystem.config.cjs`.
3. Set `export AIBOT_NODE="$(nvm which 24)"`, then run the existing PM2 CLI: `/home/deploy/.nvm/versions/node/v20.20.2/bin/pm2 start deploy/ecosystem.config.cjs --only aibot-web,aibot-worker`. The ecosystem file explicitly sets each bot process's Node interpreter to `AIBOT_NODE`; it does not depend on the PM2 daemon's Node version. Do not restart or upgrade the shared PM2 daemon. `aibot-web` serves port 3010 locally; `aibot-worker` polls projects every five seconds and cleans expired results hourly.
4. Check `curl http://127.0.0.1:3010/mini-app` before touching Caddy.
5. Add `deploy/Caddyfile.aibot.http-challenge` as a separate, temporary site, run `caddy validate --config /etc/caddy/Caddyfile`, then reload only if validation succeeds. It serves `/var/www/acme` on the raw IP and makes the HTTP challenge reachable.
6. The Ubuntu repository offers Certbot 4.0, which is too old for IP certificates. Install the verified Snap channel instead: `sudo snap install --classic certbot` (currently 5.8.0), then request the certificate with `sudo certbot certonly --webroot -w /var/www/acme --preferred-profile shortlived --ip-address 95.216.200.181 -m YOUR_EMAIL --agree-tos --non-interactive`.
7. Certbot's private key is root-only while this server's Caddy service runs as `caddy`. Before configuring TLS, copy both certificate files into `/etc/caddy/certs/aibot` owned by `caddy`; Caddy must point to those copies. Replace the temporary site with `deploy/Caddyfile.aibot`, validate the entire config, and reload Caddy. It proxies only the IP to port 3010.
8. Install `deploy/renew-aibot-certificate.sh` as Certbot's deploy-hook. It exits for every certificate except `95.216.200.181`; for that IP certificate it copies the renewed root-only files to Caddy's private directory, validates, then reloads Caddy. Configure the Certbot timer to attempt renewal twice per day because IP certificates are short-lived.
9. Verify `https://95.216.200.181/mini-app` externally. Then put that IP URL into local `APP_URL` and `MINI_APP_URL`, and run `npm run telegram:setup`. The script calls `setWebhook` for `/api/telegram`, sets the Menu Button URL, and reads both values back.

Do not use Caddy's internal certificate because Telegram will not trust it.

Rollback: run `npm run telegram:setup` with the former Vercel URLs, stop `aibot-web` and `aibot-worker`, then remove only this IP-specific Caddy site.
