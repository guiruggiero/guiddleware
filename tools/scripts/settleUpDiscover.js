// Import
import axios from "axios";

// Discover groupId/member IDs for groups
// Run `node --env-file=.env scripts/settleUpDiscover.js`
const apiKey = process.env.SETTLEUP_WEB_API_KEY;
const databaseUrl = process.env.SETTLEUP_DATABASE_URL;
const email = process.env.SETTLEUP_BOT_EMAIL;
const password = process.env.SETTLEUP_BOT_PASSWORD;
if (!apiKey || !databaseUrl || !email || !password) {
  console.error(
    "Missing SETTLEUP_WEB_API_KEY, SETTLEUP_DATABASE_URL, " +
      "SETTLEUP_BOT_EMAIL, or SETTLEUP_BOT_PASSWORD in .env");
  process.exit(1);
}

// Signs in as the bot to get an ID token and uid
const {data: signIn} = await axios.post(
  "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword",
  {email, password, returnSecureToken: true},
  {params: {key: apiKey}},
);
const {idToken, localId: uid} = signIn;

const db = axios.create({baseURL: databaseUrl});
const auth = {params: {auth: idToken}};

// Finds every group the bot has been granted access to
const {data: userGroups} = await db.get(`/userGroups/${uid}.json`, auth);
const idPattern = /^[\w-]+$/;
const groupIds = Object.keys(userGroups ?? {})
  .filter((id) => idPattern.test(id));
if (groupIds.length === 0) {
  console.error(
    "Bot has no groups. Create one in the app first (see settleup-setup.md)");
  process.exit(1);
}

// Prints each group's name/ID and every member's name/ID
for (const groupId of groupIds) {
  const {data: group} = await db.get(`/groups/${groupId}.json`, auth);
  const {data: members} = await db.get(`/members/${groupId}.json`, auth);

  console.log(`\nGroup: ${group?.name ?? "(unnamed)"} (${groupId})`);
  for (const [memberId, member] of Object.entries(members ?? {})) {
    console.log(`  ${member.name}: ${memberId}`);
  }
}
