# functions/CLAUDE.md

Firebase Cloud Function (`functions/index.js`). Single exported function `guiddleware`, wrapping an Express app so every route below is one deployed function/URL with real internal path routing — not one Cloud Function per capability (contrast with `guipt`/`guiwise` in the `website` repo, which are separate functions). Deployed into the shared `guiruggiero` Firebase project, alongside Guimail's `guimail` function and the website's `guipt`/`guiwise`.

## Routes

- `POST /splitwise/expenses` — creates a Splitwise expense; consolidates the union of what Guimail, GuiDo, and Guiwise each used to implement separately (solo, equal split, uneven split, group). Accepts `{description, amount, currency, details?, date?, splitWith?, paidBy?, owedAmounts?, groupId?, source?}`. Falls back to a solo expense (with a note) if a name can't be resolved or uneven `owedAmounts` don't sum to `amount`. `source` is appended to the expense details as "Created via `<source>`" — formatting/attribution stays the caller's choice, this just threads it through.
- `GET /splitwise/friends` — returns the parsed `SPLITWISE_FRIENDS` list (`{id, name, nickname}[]`) for callers building a friend picker.
- `GET /splitwise/groups` — returns the user's Splitwise groups (`{id, name}[]`) for callers building a group picker.
- `POST /calendar/events` — creates a Google Calendar event; accepts `{summary, start, end, timeZone?, location?, description?, calendar?: "default"|"shared", reminders?, isSpecialProject?}`. All-day vs timed is inferred from whether `start` contains `T`.
- `GET /flightaware/track?flightNumber=<IATA>` — resolves an IATA flight number to a live-tracking URL, or `{url: null}` if not found. Composition (building a calendar description that embeds this link) is the caller's job — callers call this first, then `/calendar/events` — not handled server-side, to keep `/calendar/events` generic for callers that don't care about flights.

## Auth

Each route requires `Authorization: Bearer <token>`, validated in `auth.js` against any env var named `GUIDDLEWARE_SECRET_<CONSUMER>` (e.g. `GUIDDLEWARE_SECRET_GUIMAIL`). The matched consumer name is tagged on Sentry events (`req.consumer`) for attribution, not used for branching logic.

## Utilities

Each in `functions/utils/`, ported/consolidated from Guimail's equivalents (`axiosClient.js`, `googleAuth.js`, `googleCalendar.js`, `flightAware.js` are unchanged; `splitwise.js` is the consolidated version, with an optional `groupId` threaded through every expense creator and `getFriendsList`/`getGroups` added for picker UIs).

## Required env vars

`SENTRY_DSN`, `SPLITWISE_API_KEY`, `SPLITWISE_FRIENDS`, `SPLITWISE_ID_GUI`, `SPLITWISE_ID_GEORGIA`, `GOOGLE_CAL_DEFAULT_ID`, `GOOGLE_CAL_SHARED_ID`, `FLIGHTAWARE_AEROAPI_KEY`, one `GUIDDLEWARE_SECRET_<CONSUMER>` per consumer — kept in `functions/.env` (gitignored). Also needs `functions/service-account-key.json` (gitignored) for Google Calendar auth, same file Guimail uses.

## Local testing

`firebase-admin` is a devDependency solely because the Firebase emulator (`npx firebase emulators:start --only functions`) refuses to load without it present in `node_modules`, even though nothing in this codebase uses it — it's excluded from the deployed bundle (`firebase deploy` only installs `dependencies`, not `devDependencies`).

## Deploy

`npm run deploy` → `firebase deploy --only functions:guiddleware`, into the shared `guiruggiero` project.
