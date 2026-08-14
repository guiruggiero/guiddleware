# Guiddleware

Shared backend middleware for Guimail and GuiDo (and future consumers like an Index 01/Pebble webhook), replacing logic that used to be duplicated across those repos.

This repo holds multiple independently-deployed pieces, each with its own deploy target:

- `claude-code/` — Express server that spawns `claude -p` as a child process. Deploys and runs on code-server specifically (needs simultaneous access to all repos), via PM2. See `claude-code/CLAUDE.md`.
- `tools/` — Firebase Cloud Function (Splitwise, Calendar, FlightAware, Google Tasks, Google Sheets), deployed into the shared `guiruggiero` Firebase project (the same one Guimail's and the website's functions already use) as the `guiddleware` function. See `tools/CLAUDE.md`.
- `whatsapp-router/` — Cloudflare Worker routing WhatsApp webhooks to Agendadô/GuiDo, relocated here from `runtime-server/`. Deploys independently via `wrangler` (Cloudflare's edge, not code-server or Firebase) — same "source lives here, deploy target is elsewhere" shape as `claude-code/`.

## Consumers

Each consumer (Guimail, GuiDo, future webhooks) authenticates with its own per-consumer bearer token, issued separately for `claude-code` and for `tools/`.

- **Guimail** calls `tools/` directly from its own Cloud Function (server-to-server, no browser involved) — see `guimail/agent/utils/guiddleware.js`.
- **GuiDo** calls `tools/` directly from its own Express server (server-to-server) — see `guido/src/utils/guiddleware.js`. Covers Google Tasks, Splitwise, Calendar, FlightAware, and Trello. Also calls `claude-code/` directly (see `guido/src/utils/claudeCode.js`), as a `CLAUDE_CODE_GATEWAY_SECRET_GUIDO` consumer.

## SonarQube Cloud

Project key `guiruggiero_guiddleware`.
