# Google Tasks OAuth setup

One-time manual setup to enable Google Tasks in Guiddleware. Personal Task
lists have no sharing/ACL mechanism (unlike Calendar events or Sheets/Drive
files), so the shared service account can't be granted access — this needs
OAuth2 consent from your own account instead. Do these in order.

## 1. Enable the Tasks API

In the same GCP project as the existing service account (used for
Calendar/Sheets):

1. Go to [APIs & Services > Library](https://console.cloud.google.com/apis/library)
2. Search for "Google Tasks API"
3. Click **Enable**

## 2. Create an OAuth 2.0 Client ID

1. Go to [APIs & Services > Credentials](https://console.cloud.google.com/apis/credentials)
2. Click **Create Credentials > OAuth client ID**
3. Application type: **Desktop app**
4. Name it something like "Guiddleware CLI"
5. Save the **Client ID** and **Client Secret** shown after creation

## 3. Publish the OAuth consent screen

1. Go to [APIs & Services > OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)
2. If the publish status is **Testing**, click **Publish App** to move it to
   **In production**
   - This matters: refresh tokens issued while in "Testing" status expire
     after 7 days. "In production" tokens don't expire on a fixed schedule.
   - You do not need Google's verification review for personal, single-user
     use with a non-restricted scope like `tasks` — you'll just see an
     "unverified app" warning during consent (expected, click through it).

## 4. Add client credentials to `tools/.env`

```
GOOGLE_OAUTH_CLIENT_ID=<client ID from step 2>
GOOGLE_OAUTH_CLIENT_SECRET=<client secret from step 2>
```

## 5. Get a Tasks refresh token

From `tools/`, run:

```
node --env-file=.env scripts/getGoogleOAuthToken.js https://www.googleapis.com/auth/tasks
```

1. Open the printed URL in any browser, sign in as
   `guilherme.ruggiero@gmail.com`, and approve access
2. Google redirects to a `localhost` URL that fails to load — that's
   expected. Copy the `code` value (or the whole URL) from the browser's
   address bar
3. Paste it back into the terminal prompt
4. Copy the printed refresh token into `tools/.env` as:

```
GOOGLE_TASKS_REFRESH_TOKEN=<printed refresh token>
```

This is meant to be one-off — as long as the consent screen is "In
production" (step 3), this token keeps working indefinitely without
repeating this flow.

## 6. Find a task list ID

From `tools/`, run:

```
node --env-file=.env scripts/listGoogleTaskLists.js
```

This prints every task list on the account with its `id`. Copy the `id` of
the list Guiddleware should use into `tools/.env` as:

```
GOOGLE_TASKS_LIST_ID=<task list id>
```

## 7. Redeploy and test

`npm run deploy`, then exercise `POST /tasks`, `GET /tasks`, and
`PATCH /tasks/:id` directly to confirm real tasks are created/listed/
completed in the Google Tasks app.
