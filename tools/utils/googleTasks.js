// Imports
import {google} from "googleapis";

// OAuth2, not the shared service account — Task lists have no ACL to grant it
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
