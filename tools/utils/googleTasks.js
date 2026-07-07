// Imports
import {google} from "googleapis";

// Promise-cached Google Tasks client. Uses OAuth2 with a refresh token,
// not the shared service account used for Calendar/Sheets — personal Task
// lists have no sharing/ACL mechanism to grant the service account access.
let clientPromise;
export const getTasksClient = () => {
  if (!clientPromise) {
    clientPromise = (async () => {
      const auth = new google.auth.OAuth2(
        process.env.GOOGLE_OAUTH_CLIENT_ID,
        process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      );
      auth.setCredentials({
        refresh_token: process.env.GOOGLE_TASKS_REFRESH_TOKEN,
      });
      return google.tasks({version: "v1", auth});
    })();
  }
  return clientPromise;
};
