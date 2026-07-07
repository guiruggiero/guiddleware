# Guiddleware

Shared backend middleware for Guimail, GuiDo, and Guiwise (and future consumers like an Index 01/Pebble webhook), replacing logic that used to be duplicated across those repos.

This repo holds multiple independently-deployed pieces, each with its own deploy target:

- `claude-code/` — Express server that spawns `claude -p` as a child process. Deploys and runs on code-server specifically (needs simultaneous access to all repos), via PM2. See `claude-code/CLAUDE.md`.
- `functions/` — Firebase Cloud Function (Splitwise, Calendar, FlightAware). Not yet built.
- `whatsapp-router/` — Cloudflare Worker routing WhatsApp webhooks. Not yet relocated here.

## Consumers

Each consumer (Guimail, GuiDo, Guiwise, future webhooks) authenticates with its own per-consumer bearer token, issued separately for `claude-code` and for the Cloud Function once it exists.
