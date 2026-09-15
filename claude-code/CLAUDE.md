# claude-code/CLAUDE.md

Claude Code Gateway (`claude-code/index.js`). Express server that spawns `claude -p` as a child process and exposes it as an HTTP endpoint. Lives in the `guiddleware` repo alongside the other shared middleware (Guiddleware's Cloud Function, `whatsapp-router`), but is the only piece that deploys and runs on code-server specifically — it needs simultaneous access to all repos, which nothing else here does. Called directly by any consumer that needs Claude (e.g. Guimail's `askClaudeCode` tool handler) — not proxied through Guiddleware's Cloud Function.

## Behavior

- **Auth** (`auth.js`): any env var named `CLAUDE_CODE_GATEWAY_SECRET_<CONSUMER>` (e.g. `CLAUDE_CODE_GATEWAY_SECRET_GUIMAIL`) is a valid token for that consumer; the matched consumer name is tagged on Sentry events and included in logs for attribution. Per-consumer tokens mean any one can be rotated/revoked independently
- Rate-limited to 3 requests per 10 minutes per consumer (`express-rate-limit`, keyed off the identity `auth.js` resolves)
- 3-minute timeout, `MAX_CONCURRENCY = 2`, 5mb request body limit
- Sends `process.send("ready")` for PM2 readiness detection
- **Multi-turn sessions**: optional `sessionId` and `resumePrompt` in the request body resume via `claude --resume <sessionId> -p <resumePrompt>`; falls back to a fresh session if resume fails (expired or missing session ID)

**`GET /health`**: unauthenticated status route (its own looser `healthRateLimit`, 60 per 10 minutes), registered before `app.use(authenticate)` so it's deliberately exempt. Polled by the guiruggiero.com admin dashboard. Returns `{commit}` with an `Access-Control-Allow-Origin` header echoed back only for origins in the local `allowedOrigins` list. `commit` comes from `git rev-parse --short HEAD` run at startup, not an env var — this repo has no CI/CD deploy step, it runs straight from the checkout on code-server.

## Required env vars

`CLAUDE_CODE_GATEWAY_PATH` (never state its value here, this repo is public; it spawns `claude -p`. Every consumer holds the same value under the same var name in its own `.env`/Infisical), one `CLAUDE_CODE_GATEWAY_SECRET_<CONSUMER>` per consumer, `EXPRESS_PORT`, `SENTRY_DSN` — kept in `claude-code/.env` (gitignored).

## PM2 and Cloudflare Tunnel

App name `claudeCodeGateway`, managed via `claude-code/pm2.config.js`, running on code-server bound to `127.0.0.1:3131` only. `npm run pm2` restarts it; `npm run pm2-config` re-registers the app, needed after editing `pm2.config.js`.

Code-server runs its own `cloudflared` tunnel (separate from runtime-server's), fronting `claudecode.guiruggiero.com`. Zero Trust → Networks → Tunnels has explicit **Published application routes** forwarded unstripped to `http://localhost:3131`, deliberately not a `*` catch-all.
