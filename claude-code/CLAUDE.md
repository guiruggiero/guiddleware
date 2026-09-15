# claude-code/CLAUDE.md

Claude Code Gateway (`claude-code/index.js`). Express server that spawns `claude -p` as a child process and exposes it as an HTTP endpoint. Lives in the `guiddleware` repo alongside the other shared middleware (Guiddleware's Cloud Function, `whatsapp-router`), but is the only piece that deploys and runs on code-server specifically — it needs simultaneous access to all repos, which nothing else here does. Called directly by any consumer that needs Claude (e.g. Guimail's `askClaudeCode` tool handler) — not proxied through Guiddleware's Cloud Function.

## Behavior

- Authenticates via a per-consumer bearer token, in `auth.js`: any env var named `CLAUDE_CODE_GATEWAY_SECRET_<CONSUMER>` (e.g. `CLAUDE_CODE_GATEWAY_SECRET_GUIMAIL`) is a valid token for that consumer; the matched consumer name is tagged on Sentry events and included in logs for attribution. Each consumer gets its own token so any one can be rotated/revoked independently.
- Rate-limited to 3 requests per 10 minutes per consumer (`express-rate-limit`, keyed off the identity `auth.js` resolves)
- Enforces a 3-minute timeout and `MAX_CONCURRENCY = 2`
- Sends `process.send("ready")` for PM2 readiness detection
- 5mb request body limit

**Multi-turn sessions**: accepts optional `sessionId` and `resumePrompt` in the request body; resumes via `claude --resume <sessionId> -p <resumePrompt>`; falls back to a fresh session if resume fails (expired or missing session ID).

**`GET /health`**: unauthenticated status route (its own looser `healthRateLimit`, 60 per 10 minutes), registered before `app.use(authenticate)` so it's deliberately exempt. Polled by the guiruggiero.com admin dashboard. Returns `{commit}` with an `Access-Control-Allow-Origin` header echoed back only for origins in the local `allowedOrigins` list. `commit` comes from `git rev-parse --short HEAD` run at startup, not an env var — this repo has no CI/CD deploy step, it runs straight from the checkout on code-server.

## Required env vars

`CLAUDE_CODE_GATEWAY_PATH` (the `POST` endpoint's path, currently `/run` — also hardcoded as a literal string in every consumer's `claudeCode.js`, both public repos, so hiding the value here would be pointless; the bearer token, not path secrecy, is the actual security boundary), one `CLAUDE_CODE_GATEWAY_SECRET_<CONSUMER>` per consumer, `EXPRESS_PORT`, `SENTRY_DSN` — kept in `claude-code/.env` (gitignored).

## PM2

App name: `claudeCodeGateway`. Managed via `claude-code/pm2.config.js`. Runs on code-server, bound to `127.0.0.1:3131` only.

## Cloudflare Tunnel

Code-server runs its own `cloudflared` tunnel (separate from runtime-server's), fronting `claudecode.guiruggiero.com`. Zero Trust → Networks → Tunnels has explicit **Published application routes** for both `run` and `health` — both forwarded unstripped to `http://localhost:3131`, deliberately not a `*` catch-all, so only these two paths ever reach the gateway process at all.
