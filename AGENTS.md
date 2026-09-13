# AIBotTelegram engineering rules

## Architecture

- Keep this repository a modular monolith. Dependencies flow from entrypoints (`app/api`, bot, worker, Mini App) to `src/domain` and `src/server`.
- `src/domain` is pure TypeScript: no React, Next.js, grammY, SQLite, filesystem, or network imports.
- `src/server` owns configuration, auth, persistence, files, providers, and server-only workflows. Client code under `src/mini-app` must use HTTP APIs and must never import it.
- Keep Next route handlers thin: parse and validate HTTP input, authenticate, invoke server code, and serialize the existing response contract.
- Do not add a dependency, service interface, factory, global store, or generic helper without two real callers or a concrete current need.

## Data and product invariants

- Preserve public routes, JSON fields, cookies, environment names, SQLite tables, project statuses, token prices, trial behavior, and deployment flow unless a task explicitly changes them.
- SQLite migrations must be additive and backward compatible. Add a legacy-schema regression test with every schema change.
- Token reservation/refund, payment completion, and referral rewards are transactional and idempotent.
- Credit referral rewards only after a confirmed paid operation. A valid first referrer is permanent and must not be overwritten.
- Keep all visible ru/en text in localization modules. Do not invent referral figures or payment confirmations.

## Working rules

- Keep structural refactors separate from product changes and preserve unrelated working-tree edits.
- Do not change production, PM2, Caddy, DNS, deployment scripts, or secrets as part of ordinary application work.
- Before handoff run `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:watermark`, and `npm run build` as applicable. If FFmpeg fails with local `spawn EPERM`, state that boundary and rely on Linux CI for that integration check.
