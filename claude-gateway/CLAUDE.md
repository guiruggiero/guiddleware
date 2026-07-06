# claude-gateway/CLAUDE.md

Claude Code Gateway (`claude-gateway/index.js`). Express server that spawns `claude -p` as a child process and exposes it as an HTTP endpoint. Lives in the `guiddleware` repo alongside the other shared middleware (Guiddleware's Cloud Function, `whatsapp-router`), but is the only piece that deploys and runs on code-server specifically — it needs simultaneous access to all repos, which nothing else here does. Called directly by any consumer that needs Claude (e.g. Guimail's `askClaudeCode` tool handler) — not proxied through Guiddleware's Cloud Function.

## Behavior

- Authenticates via a per-consumer bearer token: any env var named `CLAUDE_CODE_GATEWAY_SECRET_<CONSUMER>` (e.g. `CLAUDE_CODE_GATEWAY_SECRET_GUIMAIL`) is a valid token for that consumer; the matched consumer name is tagged on Sentry events and included in logs for attribution. Each consumer gets its own token so any one can be rotated/revoked independently.
- Enforces a 3-minute timeout and `MAX_CONCURRENCY = 3`
- Sends `process.send("ready")` for PM2 readiness detection
- 5mb request body limit

**Multi-turn sessions**: accepts optional `sessionId` and `resumePrompt` in the request body; resumes via `claude --resume <sessionId> -p <resumePrompt>`; falls back to a fresh session if resume fails (expired or missing session ID).

## Required env vars

`CLAUDE_CODE_GATEWAY_PATH` (HTTP endpoint path, e.g. `/run`), one `CLAUDE_CODE_GATEWAY_SECRET_<CONSUMER>` per consumer, `EXPRESS_PORT`, `SENTRY_DSN` — kept in `claude-gateway/.env` (gitignored).

## PM2

App name: `claudeCodeGateway`. Managed via `claude-gateway/pm2.config.js`. Runs on code-server.
