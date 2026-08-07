# tools/CLAUDE.md

Firebase Cloud Function (`tools/index.js`). Single exported function `guiddleware`, wrapping an Express app so every route below is one deployed function/URL with real internal path routing — not one Cloud Function per capability (contrast with `guipt`/`guiwise` in the `website` repo, which are separate functions). Deployed into the shared `guiruggiero` Firebase project, alongside Guimail's `guimail` function and the website's `guipt`/`guiwise`.

**URL**: `https://us-central1-guiruggiero.cloudfunctions.net/guiddleware` — same stable `cloudfunctions.net` shape as `guimail`/`guipt`/`guiwise`. `firebase deploy` prints a `*.run.app` URL after deploying (the underlying Cloud Run revision) — ignore that one, it's not what callers should use.

## Routes

- `POST /splitwise/expenses` — **being migrated off, see below**. Creates a Splitwise expense; consolidates solo/equal/uneven/group logic Guimail, GuiDo, and Guiwise each used to implement separately. Accepts `{description, amount, currency, details?, date?, splitWith?, paidBy?, owedAmounts?, groupId?, source?}`. Falls back to a solo expense (with a note) if a name can't be resolved or `owedAmounts` don't sum to `amount`.
- `GET /splitwise/friends` — parsed `SPLITWISE_FRIENDS` list (`{id, name, nickname}[]`), for a friend picker.
- `GET /splitwise/groups` — user's Splitwise groups (`{id, name}[]`), for a group picker.
- `POST /settleup/expenses` — Settle Up replacement for `/splitwise/expenses` (Splitwise started charging for API usage). Not interface-compatible, and not general-purpose: scoped to exactly two fixed people (Gui, Georgia) and two fixed groups, no arbitrary friends. Accepts `{description, amount, currency, details?, date?, split?, paidBy?, category?, source?}`.
  - `split` omitted → solo expense in the personal group (Gui only)
  - `split: "equal"` → 50/50 in the household group
  - `split: {gui, georgia}` → exact amounts in the household group, must sum to `amount`
  - `paidBy` (`"gui"` default or `"georgia"`) only applies when `split` is set
  - Returns `{expense: {id}}`
- `POST /calendar/events` — creates a Google Calendar event; accepts `{summary, start, end, timeZone?, location?, description?, calendar?: "default"|"shared", reminders?, isSpecialProject?}`. All-day vs timed is inferred from whether `start` contains `T`.
- `GET /flightaware/track?flightNumber=<IATA>` — resolves an IATA flight number to a live-tracking URL, or `{url: null}`. Callers compose this with `/calendar/events` themselves.
- `POST /tasks` — creates a Google Task; accepts `{title, notes?, due?, taskListId?}`. `due` is date-only — Google Tasks silently discards time-of-day.
- `GET /tasks` — lists tasks (`taskListId?`, `showCompleted?`); returns `{id, title, notes, due, status}[]`.
- `PATCH /tasks/:id` — updates a task's status (default `"completed"`); accepts `{status?, taskListId?}`.
- `POST /sheets/values` — batch-writes cell ranges; accepts `{spreadsheetId, data: [{range, values}]}` (`valueInputOption` fixed to `"USER_ENTERED"`). No default spreadsheet — callers always specify one.

## Auth

Each route requires `Authorization: Bearer <token>`, validated in `auth.js` against any env var named `GUIDDLEWARE_SECRET_<CONSUMER>`. The matched consumer is tagged on Sentry events (`req.consumer`), not used for branching.

`index.js` sets `invoker: "public"` — v2 Cloud Functions default to requiring an IAM `roles/run.invoker` grant, which would 401 before reaching Express. Access control is the bearer-token check above, not IAM.

Rate-limited to 10 requests per 10 minutes per consumer (`express-rate-limit`, keyed off `req.consumer`). `helmet()` disables `X-Powered-By` and other HTTP header hardening.

## Utilities

Each in `tools/utils/`, ported/consolidated from Guimail's equivalents. `axiosClient.js`, `googleAuth.js`, `googleCalendar.js`, `flightAware.js`, `googleSheets.js` are unchanged. `splitwise.js` is the consolidated version, with an optional `groupId` threaded through every expense creator plus `getFriendsList`/`getGroups` for picker UIs.

`settleUp.js` is the Settle Up client, replacing `splitwise.js`:
- Auth is Firebase email/password for a dedicated bot account, inline in this file (unlike `googleAuth.js`, which is its own file because two consumers share it — Settle Up auth has only one consumer)
- Signs in once, refreshes the ID token 5 minutes before its hourly expiry
- `createExpense` takes an explicit `groupId` (the route picks household vs personal) and posts to `/transactions/<groupId>/<txId>.json`
- Always sends `fixedExchangeRate: true` — undocumented in Settle Up's API docs, but required (confirmed by testing; writes without it get rejected)
- No member registry — only two fixed people, so `routes/settleUp.js` references their IDs directly from env vars

Settle Up group/permission/member creation can't be scripted over REST — security rules reject those writes (and even reads) outside the app itself, confirmed by testing. See `scripts/settleup-setup.md`. Two groups exist: household (Gui + Georgia) and personal (Gui only, mirrors Splitwise's groupless/personal bucket — Settle Up has no such concept, every transaction belongs to a group).

`googleTasks.js` authenticates via OAuth2 with a refresh token, not `googleAuth.js`'s service account — personal Task lists have no ACL to grant it. See `scripts/tasks-setup.md`.

## Required env vars

`SENTRY_DSN`, `SPLITWISE_API_KEY`, `SPLITWISE_FRIENDS`, `SPLITWISE_ID_GUI`, `SPLITWISE_ID_GEORGIA`, `SETTLEUP_WEB_API_KEY`, `SETTLEUP_DATABASE_URL`, `SETTLEUP_BOT_EMAIL`, `SETTLEUP_BOT_PASSWORD`, `SETTLEUP_GROUP_ID_HOUSEHOLD`, `SETTLEUP_GROUP_ID_PERSONAL`, `SETTLEUP_MEMBER_ID_GUI_HOUSEHOLD`, `SETTLEUP_MEMBER_ID_GEORGIA_HOUSEHOLD`, `SETTLEUP_MEMBER_ID_GUI_PERSONAL`, `GOOGLE_CAL_DEFAULT_ID`, `GOOGLE_CAL_SHARED_ID`, `FLIGHTAWARE_AEROAPI_KEY`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_TASKS_REFRESH_TOKEN`, `GOOGLE_TASKS_LIST_ID`, one `GUIDDLEWARE_SECRET_<CONSUMER>` per consumer — kept in `tools/.env` (gitignored). Also needs `tools/service-account-key.json` (gitignored).

- `SPLITWISE_FRIENDS` — minified JSON array of `{id, name, nickname}`; source is `tools/scripts/friends.json` (gitignored); run `npm run friends` to update `.env`; indexed by first name, full name, and each nickname token
- `SETTLEUP_WEB_API_KEY`/`SETTLEUP_DATABASE_URL` — sandbox: public key + `https://settle-up-sandbox.firebaseio.com`; live: key must come from Step Up Labs, don't hardcode until confirmed
- `SETTLEUP_BOT_EMAIL`/`SETTLEUP_BOT_PASSWORD` — dedicated bot credentials, created manually; see `scripts/settleup-setup.md`
- `SETTLEUP_GROUP_ID_HOUSEHOLD`/`SETTLEUP_GROUP_ID_PERSONAL` — the bot needs read/write permission (level `20`) on each, granted via the app
- `SETTLEUP_MEMBER_ID_GUI_HOUSEHOLD`/`SETTLEUP_MEMBER_ID_GEORGIA_HOUSEHOLD`/`SETTLEUP_MEMBER_ID_GUI_PERSONAL` — per-group IDs (Gui's ID differs between groups); found via `node --env-file=.env scripts/settleUpDiscover.js`
- `GOOGLE_OAUTH_CLIENT_ID`/`GOOGLE_OAUTH_CLIENT_SECRET`/`GOOGLE_TASKS_REFRESH_TOKEN`/`GOOGLE_TASKS_LIST_ID` — see `scripts/tasks-setup.md`; `getGoogleOAuthToken.js`/`listGoogleTaskLists.js` are one-off local scripts, not deployed

## Local testing

The Firebase emulator refuses to load without `firebase-admin` in `node_modules`, even though nothing here uses it. Don't add it to `package.json` — Cloud Build installs full `node_modules` before deploying, and `firebase-admin@14` conflicts with `firebase-functions@7`'s peer requirement, failing the deploy with `ERESOLVE`. If needed locally, `npm install firebase-admin` transiently and uninstall before deploying/committing.

## Deploy

`npm run deploy` → `firebase deploy --only functions:guiddleware`, into the shared `guiruggiero` project.
