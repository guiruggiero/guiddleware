// Import
import {createRetryClient} from "./axiosClient.js";

const splitwiseClient = createRetryClient({
  baseURL: "https://secure.splitwise.com/api/v3.0",
  timeout: 10000, // 10s
  headers: {"Authorization": `Bearer ${process.env.SPLITWISE_API_KEY}`},
});

// Splitwise error checker
const checkSplitwiseError = (expenseData) => {
  const {error, errors} = expenseData;

  if (error) throw new Error(`Splitwise API: ${error}`); // {error: ""}

  if (errors && Object.keys(errors).length > 0) { // {errors: {base: [""]}}
    const errorMessage = Object.values(errors).flat().join(", ");
    throw new Error(`Splitwise API: ${errorMessage}`);
  }
};

// Normalizes a bare date (no time) to noon UTC, avoiding day-shift issues
const normalizeDate = (date) => {
  if (!date) return undefined;
  return date.includes("T") ? date : `${date}T12:00:00Z`;
};

// Creator for solo expenses (single-user), optionally against a group
export const createSoloExpense = async (
  description, amount, currency, details = "", date, groupId = 0) => {
  const res = await splitwiseClient.post("/create_expense", {
    cost: amount.toFixed(2),
    description,
    details,
    currency_code: currency,
    date: normalizeDate(date),
    group_id: groupId,
    split_equally: true,
  });
  checkSplitwiseError(res.data);
  return res;
};

// Creator for expenses from arbitrary per-person paid/owed shares
export const createExpenseFromShares = async (
  description, amount, currency, shares, details = "", date, groupId = 0) => {
  const payload = {
    cost: amount.toFixed(2),
    description,
    details,
    currency_code: currency,
    date: normalizeDate(date),
    group_id: groupId,
  };

  shares.forEach(({userId, paid, owed}, i) => {
    payload[`users__${i}__user_id`] = userId;
    payload[`users__${i}__paid_share`] = paid;
    payload[`users__${i}__owed_share`] = owed;
  });

  const res = await splitwiseClient.post("/create_expense", payload);
  checkSplitwiseError(res.data);
  return res;
};

// Equal-split calculator for N+1 people (payer + others)
const splitEqual = (amount, numOthers) => {
  const totalParts = numOthers + 1;
  const totalCents = Math.round(amount * 100);
  const perCents = Math.floor(totalCents / totalParts);
  const remainderCents = totalCents - perCents * totalParts;
  return {
    cost: (totalCents / 100).toFixed(2),
    payerOwed: ((perCents + remainderCents) / 100).toFixed(2),
    otherOwed: (perCents / 100).toFixed(2),
  };
};

// Creator for shared expenses (payer + N others, split equally)
export const createSharedExpense = async (
  description, amount, currency, otherPersonIds, payerId, details = "",
  date, groupId = 0) => {
  const {cost, payerOwed, otherOwed} = splitEqual(
    amount, otherPersonIds.length);

  const shares = [
    {userId: payerId, paid: cost, owed: payerOwed},
    ...otherPersonIds.map((id) => (
      {userId: id, paid: "0.00", owed: otherOwed})),
  ];

  return createExpenseFromShares(
    description, amount, currency, shares, details, date, groupId);
};

// Friend registry (lookup by name) and friend list (for display), both
// lazily parsed once from the SPLITWISE_FRIENDS env var
let friendsList = null;
let friendRegistry = null;

const loadFriends = () => {
  if (friendsList) return;
  friendsList = [];
  friendRegistry = new Map();

  const raw = process.env.SPLITWISE_FRIENDS;
  if (!raw) return;

  let friends;
  try {
    friends = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Failed to parse SPLITWISE_FRIENDS: ${error.message}`, {cause: error});
  }

  for (const {id, name, nickname} of friends) {
    const sid = String(id);
    friendsList.push({id: sid, name, nickname});

    const [firstName] = name.split(" ");
    friendRegistry.set(firstName.toLowerCase(), sid);
    friendRegistry.set(name.toLowerCase(), sid);

    if (nickname) {
      for (const part of nickname.split(/\s+or\s+/i)) {
        friendRegistry.set(part.trim().toLowerCase(), sid);
      }
    }
  }
};

// Name (lowercase) -> Splitwise user ID, for server-side resolution
export const getFriendRegistry = () => {
  loadFriends();
  return friendRegistry;
};

// {id, name, nickname}[], for callers backing a friend picker UI
export const getFriendsList = () => {
  loadFriends();
  return friendsList;
};

// Lists the user's Splitwise groups, for callers backing a group picker UI
export const getGroups = async () => {
  const res = await splitwiseClient.get("/get_groups");
  checkSplitwiseError(res.data);

  return res.data.groups
    .filter((group) => group.id !== 0) // excludes the "non-group" pseudo-group
    .map(({id, name}) => ({id: String(id), name}));
};
