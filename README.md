[![CodeQL](https://github.com/guiruggiero/guiddleware/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/guiruggiero/guiddleware/actions/workflows/github-code-scanning/codeql)
[![Dependencies](https://github.com/guiruggiero/guiddleware/actions/workflows/dependabot/dependabot-updates/badge.svg)](https://github.com/guiruggiero/guiddleware/actions/workflows/dependabot/dependabot-updates)

Shared backend middleware for [Guimail](https://github.com/guiruggiero/guimail), [GuiDo](https://github.com/guiruggiero/guido), and Guiwise (part of [website](https://github.com/guiruggiero/website)) — one place for Splitwise, Google Calendar, FlightAware, Google Tasks, Google Sheets, and Claude Code integrations, instead of each interface hand-rolling its own.

### 🏗️ Architecture

Three independently-deployed pieces:

#### Firebase Cloud Function (`tools/`, deployed as the `guiddleware` function — folder name and deploy name are independent)
- Splitwise: create expenses (solo, equal split, uneven split, group), list friends, list groups
- Google Calendar: create events, per-calendar routing
- FlightAware: resolve an IATA flight number to a live-tracking link
- Google Tasks: create/list/complete to-do items (OAuth2, since personal task lists have no service-account sharing mechanism)
- Google Sheets: batch-write cell ranges to any spreadsheet the service account can access; no hardcoded spreadsheet, callers say which one
- One Cloud Function wrapping an Express app (real internal path routing), deployed into the same shared Firebase project as Guimail's and the website's own functions
- Per-consumer bearer token auth; each caller is tagged for attribution, never for branching logic

#### Claude Code Gateway (`claude-code/`)
- Spawns `claude -p` as a child process, exposed over HTTP
- Runs on code-server specifically via PM2 (the only piece that needs simultaneous access to all repos) — everything else in this repo deploys elsewhere

#### WhatsApp Router (`whatsapp-router/`)
- Cloudflare Worker routing incoming WhatsApp webhooks to Agendadô or GuiDo, with local-dev (ngrok) routing for the developer's own number
- Deploys independently via `wrangler` to Cloudflare's edge

### 📦 Dependencies
- `express` - internal path routing for `tools/`
- `axios` and `axios-retry` - API communication with retry logic
- `googleapis` - Google Calendar, Sheets, and Tasks (OAuth2) integration
- `@sentry/node` - error tracking and monitoring
- `firebase-functions` and `firebase-tools` - serverless backend and deployment
- `helmet` - HTTP header security (`claude-code/`)
- `eslint` and `stylistic`/`eslint-config-google` - code linting
- `wrangler` - Cloudflare Worker deployment (`whatsapp-router/`)

---

#### 📄 License
This project is licensed under the [MIT License](LICENSE). Attribution is required.

#### ⚠️ Disclaimer
This software is provided "as is" without any warranties. Use at your own risk. The author is not responsible for any consequences of using this software.
