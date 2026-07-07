# functions/CLAUDE.md

Firebase Cloud Function (`functions/index.js`). Single exported function `guiddleware`, wrapping an Express app so every route below is one deployed function/URL with real internal path routing — not one Cloud Function per capability (contrast with `guipt`/`guiwise` in the `website` repo, which are separate functions). Deployed into the shared `guiruggiero` Firebase project, alongside Guimail's `guimail` function and the website's `guipt`/`guiwise`.

**URL**: `https://us-central1-guiruggiero.cloudfunctions.net/guiddleware` — same stable `cloudfunctions.net` shape as `guimail`/`guipt`/`guiwise`. `firebase deploy` prints a `*.run.app` URL after deploying (the underlying Cloud Run revision) — ignore that one, it's not what callers should use.

## Routes

- `POST /splitwise/expenses` — creates a Splitwise expense; consolidates the union of what Guimail, GuiDo, and Guiwise each used to implement separately (solo, equal split, uneven split, group). Accepts `{description, amount, currency, details?, date?, splitWith?, paidBy?, owedAmounts?, groupId?, source?}`. Falls back to a solo expense (with a note) if a name can't be resolved or uneven `owedAmounts` don't sum to `amount`. `source` is appended to the expense details as "Created with `<source>`" — formatting/attribution stays the caller's choice, this just threads it through.
- `GET /splitwise/friends` — returns the parsed `SPLITWISE_FRIENDS` list (`{id, name, nickname}[]`) for callers building a friend picker.
- `GET /splitwise/groups` — returns the user's Splitwise groups (`{id, name}[]`) for callers building a group picker.
- `POST /calendar/events` — creates a Google Calendar event; accepts `{summary, start, end, timeZone?, location?, description?, calendar?: "default"|"shared", reminders?, isSpecialProject?}`. All-day vs timed is inferred from whether `start` contains `T`.
- `GET /flightaware/track?flightNumber=<IATA>` — resolves an IATA flight number to a live-tracking URL, or `{url: null}` if not found. Composition (building a calendar description that embeds this link) is the caller's job — callers call this first, then `/calendar/events` — not handled server-side, to keep `/calendar/events` generic for callers that don't care about flights.

## Auth

Each route requires `Authorization: Bearer <token>`, validated in `auth.js` against any env var named `GUIDDLEWARE_SECRET_<CONSUMER>` (e.g. `GUIDDLEWARE_SECRET_GUIMAIL`). The matched consumer name is tagged on Sentry events (`req.consumer`) for attribution, not used for branching logic.

`index.js` sets `invoker: "public"` on the function — v2 Cloud Functions default to requiring an IAM `roles/run.invoker` grant on the caller, which would 401 every request before it even reaches Express. Access control here is meant to be the bearer-token check above, not IAM, so the invoker is deliberately public.

## Utilities

Each in `functions/utils/`, ported/consolidated from Guimail's equivalents (`axiosClient.js`, `googleAuth.js`, `googleCalendar.js`, `flightAware.js` are unchanged; `splitwise.js` is the consolidated version, with an optional `groupId` threaded through every expense creator and `getFriendsList`/`getGroups` added for picker UIs).

## Required env vars

`SENTRY_DSN`, `SPLITWISE_API_KEY`, `SPLITWISE_FRIENDS`, `SPLITWISE_ID_GUI`, `SPLITWISE_ID_GEORGIA`, `GOOGLE_CAL_DEFAULT_ID`, `GOOGLE_CAL_SHARED_ID`, `FLIGHTAWARE_AEROAPI_KEY`, one `GUIDDLEWARE_SECRET_<CONSUMER>` per consumer — kept in `functions/.env` (gitignored). Also needs `functions/service-account-key.json` (gitignored) for Google Calendar auth, same file Guimail used to hold.

- `SPLITWISE_FRIENDS` — minified JSON array of `{id, name, nickname}`; source of truth is `functions/scripts/friends.json` (gitignored, moved here from Guimail); run `npm run friends` to update `.env`; names are indexed by first name, full name, and each nickname token (split on spaces)

## Local testing

The Firebase emulator (`npx firebase emulators:start --only functions`) refuses to load without `firebase-admin` present in `node_modules`, even though nothing in this codebase uses it. Don't add it to `package.json` (dev or prod) — Cloud Build installs the full `node_modules` tree (devDependencies included) before deploying, and `firebase-admin@14` conflicts with `firebase-functions@7`'s peer requirement (`^11 || ^12 || ^13`), which fails the deploy with `ERESOLVE`. If you need the emulator locally, `npm install firebase-admin` transiently and uninstall it again before deploying/committing.

## Deploy

`npm run deploy` → `firebase deploy --only functions:guiddleware`, into the shared `guiruggiero` project.
