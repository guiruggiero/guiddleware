# Guiddleware

Shared backend middleware for Guimail and GuiDo (including Guindex), replacing logic that used to be duplicated across those repos.

Three independently-deployed pieces, each with its own deploy target — see each folder's own CLAUDE.md:

| Path | What | Deploy target | Command |
|---|---|---|---|
| `claude-code/` | Express server that spawns `claude -p` as a child process | code-server specifically (needs simultaneous access to all repos), via PM2 | `npm run pm2` |
| `tools/` | Firebase Cloud Function (Splitwise, Settle Up, Calendar, FlightAware, Google Tasks, Sheets, Trello), deployed as the `guiddleware` function into the shared `guiruggiero` Firebase project — the same one Guimail's and the website's functions already use | Firebase | `npm run deploy` |
| `whatsapp-router/` | Cloudflare Worker routing WhatsApp webhooks to Agendadô/GuiDo, relocated here from `runtime-server/` | Cloudflare's edge, via `wrangler` | `npm run deploy` |

`claude-code/` and `whatsapp-router/` share the same "source lives here, deploy target is elsewhere" shape — neither deploys to Firebase.

## Consumers

Each consumer (Guimail, GuiDo, future webhooks) authenticates with its own per-consumer bearer token, issued separately for `claude-code` and for `tools/`.

- **Guimail** calls `tools/` directly from its own Cloud Function (server-to-server, no browser involved) — see `guimail/agent/utils/guiddleware.js`
- **GuiDo** calls `tools/` directly from its own Express server (`guido/src/utils/guiddleware.js`), covering Google Tasks, Splitwise, Calendar, FlightAware, and Trello. Also calls `claude-code/` directly (`guido/src/utils/claudeCode.js`), as a `CLAUDE_CODE_GATEWAY_SECRET_GUIDO` consumer

## SonarQube Cloud

Project key `guiruggiero_guiddleware`.
