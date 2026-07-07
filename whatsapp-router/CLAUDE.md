# WhatsApp Router Reference

## Architecture

This is a **Cloudflare Worker** (`src/index.js`) that acts as a webhook router sitting in front of the WhatsApp webhook runtime backend.

**Request flow:**
1. Validate the incoming path against `PATH_AGENDADO` or `PATH_GUIDO` (return 404 otherwise)
2. Parse the JSON request body to extract `from` (sender's phone number)
3. If the sender matches `PHONE_NUMBER` (the developer), attempt to reach `NGROK_BASE_URL` with a 2-second timeout — this enables local development routing
4. If ngrok is reachable, forward to it; otherwise forward to `RUNTIME_BASE_URL` (production)
5. The original request is forwarded as-is to the resolved target
6. Query string (`url.search`) is preserved on forwarded requests — required for WhatsApp webhook verification GETs (`hub.challenge` etc.)

The ngrok reachability check hits `NGROK_BASE_URL` (base URL, not the webhook path) — any resolved response means the tunnel is up; connection errors/timeouts are caught and fall back to runtime.

## Environment Variables

All managed as Cloudflare secrets via `wrangler secret put`:
- `PATH_AGENDADO`, `PATH_GUIDO` — valid webhook paths
- `PHONE_NUMBER` — developer phone number for dev routing
- `RUNTIME_BASE_URL` — production backend URL
- `NGROK_BASE_URL` — local dev tunnel URL

The worker has no production dependencies — it uses only native Cloudflare/Web APIs (`fetch`, `URL`, `Request`, `Response`, `AbortController`).
