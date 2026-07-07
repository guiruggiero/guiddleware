// Imports
import {google} from "googleapis";

// One-off script to find a Google Task list ID, needed for
// GOOGLE_TASKS_LIST_ID. Not deployed with the function; run locally after
// obtaining a refresh token via getGoogleOAuthToken.js, e.g.:
//   node --env-file=.env scripts/listGoogleTaskLists.js
const auth = new google.auth.OAuth2(
  process.env.GOOGLE_OAUTH_CLIENT_ID,
  process.env.GOOGLE_OAUTH_CLIENT_SECRET,
);
auth.setCredentials({refresh_token: process.env.GOOGLE_TASKS_REFRESH_TOKEN});

const tasks = google.tasks({version: "v1", auth});
const {data} = await tasks.tasklists.list();

for (const {id, title} of data.items ?? []) {
  console.log(`${title}: ${id}`);
}
