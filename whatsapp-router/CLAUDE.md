# WhatsApp Router Reference

**Cloudflare Worker** (`src/index.js`) that routes WhatsApp webhooks to the runtime backend, or to a local ngrok tunnel during development.

## Request flow

1. Validate the incoming path against `PATH_AGENDADO` or `PATH_GUIDO` (return 404 otherwise)
2. Parse the JSON request body to extract `from` (sender's phone number)
3. If the sender matches `PHONE_NUMBER` (the developer), attempt to reach `NGROK_BASE_URL` with a 2-second timeout — this is what enables local development routing
4. Forward to ngrok if reachable, otherwise to `RUNTIME_BASE_URL` (production); the original request is forwarded as-is
5. Query string (`url.search`) is preserved on forwarded requests — required for WhatsApp webhook verification GETs (`hub.challenge` etc.)

The ngrok reachability check hits `NGROK_BASE_URL` (base URL, not the webhook path) — any resolved response means the tunnel is up; connection errors/timeouts are caught and fall back to runtime.

## Environment variables

All managed as Cloudflare secrets via `wrangler secret put`:

- `PATH_AGENDADO`, `PATH_GUIDO` — valid webhook paths
- `PHONE_NUMBER` — developer phone number for dev routing
- `RUNTIME_BASE_URL` — production backend URL
- `NGROK_BASE_URL` — local dev tunnel URL
- `SENTRY_DSN` — shared `guiddleware` Sentry project (same one `claude-code/` and `tools/` report to)

The routing logic uses only native Cloudflare/Web APIs (`fetch`, `URL`, `Request`, `Response`, `AbortController`); `@sentry/cloudflare` (`Sentry.withSentry` wrapping the `fetch` handler) is its only production dependency, added for error tracking.
