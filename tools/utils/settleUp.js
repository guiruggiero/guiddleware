// Import
import {createRetryClient} from "./axiosClient.js";

// Axios instances for Settle Up and Firebase Auth APIs
const settleUpClient = createRetryClient({
  baseURL: process.env.SETTLEUP_DATABASE_URL,
  timeout: 10000, // 10s
});
const authClient = createRetryClient({
  baseURL: "https://identitytoolkit.googleapis.com/v1",
  timeout: 10000, // 10s
});
const refreshClient = createRetryClient({
  baseURL: "https://securetoken.googleapis.com/v1",
  timeout: 10000, // 10s
});

// ID tokens expire hourly; refresh a bit early to avoid racing the deadline
const REFRESH_MARGIN_MS = 5 * 60 * 1000; // 5min

// In-memory session for the bot account, lazily created and kept fresh
let session = null;

// Signs in as the bot and starts a fresh session
const signIn = async () => {
  const {data} = await authClient.post(
    "/accounts:signInWithPassword",
    {
      email: process.env.SETTLEUP_BOT_EMAIL,
      password: process.env.SETTLEUP_BOT_PASSWORD,
      returnSecureToken: true,
    },
    {params: {key: process.env.SETTLEUP_WEB_API_KEY}},
  );

  session = {
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    expiresAt: Date.now() + Number(data.expiresIn) * 1000,
  };
};

// Exchanges the current refresh token for a new ID token/refresh token pair
const refresh = async () => {
  const {data} = await refreshClient.post(
    "/token",
    {grant_type: "refresh_token", refresh_token: session.refreshToken},
    {params: {key: process.env.SETTLEUP_WEB_API_KEY}},
  );

  session = {
    idToken: data.id_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + Number(data.expires_in) * 1000,
  };
};

// Returns a valid ID token, signing in or refreshing as needed
const getIdToken = async () => {
  if (!session) await signIn();
  else if (Date.now() > session.expiresAt - REFRESH_MARGIN_MS) await refresh();

  return session.idToken;
};

// Settle Up error checker ({error: "message"})
const checkSettleUpError = (data) => {
  if (data?.error) throw new Error(`Settle Up API: ${data.error}`);
};

// Creates an expense transaction
export const createExpense = async (
  {groupId, description, currency, date, whoPaid, items, category}) => {
  const idToken = await getIdToken();

  const transaction = {
    type: "expense",
    purpose: description,
    currencyCode: currency,
    dateTime: date ? new Date(date).getTime() : Date.now(),
    category,
    fixedExchangeRate: true, // Writes are rejected without this present
    whoPaid,
    items, // Can hold multiple {amount, forWhom}
  };

  // Firebase returns the transaction ID
  const res = await settleUpClient.post(
    `/transactions/${groupId}.json`, transaction, {params: {auth: idToken}});
  checkSettleUpError(res.data);

  return res.data; // {name: "<generated txId>"}
};
