# Guiddleware

Shared backend middleware for Guimail, GuiDo, and Guiwise (and future consumers like an Index 01/Pebble webhook), replacing logic that used to be duplicated across those repos.

This repo holds multiple independently-deployed pieces, each with its own deploy target:

- `claude-code/` — Express server that spawns `claude -p` as a child process. Deploys and runs on code-server specifically (needs simultaneous access to all repos), via PM2. See `claude-code/CLAUDE.md`.
- `functions/` — Firebase Cloud Function (Splitwise, Calendar, FlightAware, Google Tasks), deployed into the shared `guiruggiero` Firebase project (the same one Guimail's and the website's functions already use) as the `guiddleware` function. See `functions/CLAUDE.md`.
- `whatsapp-router/` — Cloudflare Worker routing WhatsApp webhooks to Agendadô/GuiDo, relocated here from `runtime-server/`. Deploys independently via `wrangler` (Cloudflare's edge, not code-server or Firebase) — same "source lives here, deploy target is elsewhere" shape as `claude-code/`.

## Consumers

Each consumer (Guimail, GuiDo, Guiwise, future webhooks) authenticates with its own per-consumer bearer token, issued separately for `claude-code` and for `functions/`.

- **Guimail** calls `functions/` directly from its own Cloud Function (server-to-server, no browser involved) — see `guimail/functions/utils/guiddleware.js`.
- **Guiwise** does *not* call `functions/` directly, even though its own UI is a browser: the `website` repo is public, so its bearer token can't live in committed frontend JS. Guiwise's own Cloud Function (`guiwise.js`, in the `website` repo) holds the `GUIDDLEWARE_SECRET_GUIWISE` token server-side and proxies for the browser instead.
- **GuiDo** calls `functions/` directly from its own Express server (server-to-server) — see `guido/src/utils/guiddleware.js`. Covers Google Tasks, Splitwise, and Calendar.
