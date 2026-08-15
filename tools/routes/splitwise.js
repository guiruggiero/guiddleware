// Imports
import {Router} from "express";
import * as Sentry from "@sentry/node";
import {
  createSoloExpense,
  createExpenseFromShares,
  createSharedExpense,
  getFriendRegistry,
  getFriendsList,
  getGroups,
} from "../utils/splitwise.js";
import {createExpense as createSettleUpExpense} from "../utils/settleUp.js";

const router = Router();

// Settle Up mirror — env vars for dual-write
const SU_HOUSEHOLD_GROUP = process.env.SETTLEUP_GROUP_ID_HOUSEHOLD;
const SU_PERSONAL_GROUP = process.env.SETTLEUP_GROUP_ID_PERSONAL;
const SU_GUI = process.env.SETTLEUP_MEMBER_ID_GUI_HOUSEHOLD;
const SU_GEORGIA = process.env.SETTLEUP_MEMBER_ID_GEORGIA_HOUSEHOLD;
const SU_GUI_PERSONAL = process.env.SETTLEUP_MEMBER_ID_GUI_PERSONAL;

// Resolves a lowercase name to a Splitwise ID
const resolveId = (name, friends) =>
  name === "gui" ? process.env.SPLITWISE_ID_GUI : friends.get(name);

// Capitalizes a lowercase name for display in fallback messages
const capitalize = (name) => name.charAt(0).toUpperCase() + name.slice(1);

// Validates the raw request body shape
function validateExpenseRequest(
  {description, amount, currency, splitWith, paidBy, owedAmounts}) {
  if (!description || typeof amount !== "number" || !currency) {
    return "Missing description, amount, or currency";
  }
  if (splitWith !== undefined && !Array.isArray(splitWith)) {
    return "splitWith must be an array";
  }
  if (paidBy !== undefined && typeof paidBy !== "string") {
    return "paidBy must be a string";
  }
  const isValidShare = (s) =>
    typeof s?.name === "string" && typeof s?.owed === "number";
  if (owedAmounts !== undefined &&
    (!Array.isArray(owedAmounts) || !owedAmounts.every(isValidShare))) {
    return "owedAmounts must be an array of {name, owed}";
  }
  return null;
}

// Uneven split: single payer, different owed amounts per person
async function resolveUnevenSplit(
  {owedAmounts, amount, currency, description, fullDetails, date, groupId,
    friends, payerId}) {
  const unknownNames = [];
  const resolvedOwed = [];
  for (const {name, owed} of owedAmounts) {
    const lowerName = name.toLowerCase();
    const id = resolveId(lowerName, friends);
    if (id) resolvedOwed.push({userId: id, owed});
    else unknownNames.push(lowerName);
  }

  const totalOwed = owedAmounts.reduce((sum, s) => sum + s.owed, 0);
  const sumValid = Math.abs(totalOwed - amount) < 0.01;

  // Fall back to a solo expense if names couldn't be resolved or the
  // owed amounts don't add up
  if (unknownNames.length > 0 || !sumValid) {
    const issues = [];
    if (unknownNames.length > 0) {
      issues.push(
        `Could not resolve: ${unknownNames.map(capitalize).join(", ")}`);
    }
    if (!sumValid) issues.push("Owed amounts did not add up");

    const fallbackDetails = [fullDetails, issues.join("; ")]
      .filter(Boolean).join("\n\n");
    const result = await createSoloExpense(
      description, amount, currency, fallbackDetails, date);
    return {expense: result.data.expenses?.[0], fallback: "solo", issues};
  }

  // The payer is always a participant, even if they don't owe anything
  const payerIncluded = resolvedOwed.some((s) => s.userId === payerId);
  const shares = resolvedOwed.map(({userId, owed}) => ({
    userId,
    paid: userId === payerId ? amount.toFixed(2) : "0.00",
    owed: owed.toFixed(2),
  }));
  if (!payerIncluded) {
    shares.push({userId: payerId, paid: amount.toFixed(2), owed: "0.00"});
  }

  const result = await createExpenseFromShares(
    description, amount, currency, shares, fullDetails, date, groupId ?? 0);
  return {expense: result.data.expenses?.[0]};
}

// Equal split among named friends (and/or Gui as payer)
async function resolveEqualSplit(
  {names, friends, payerId, description, amount, currency, fullDetails,
    date, groupId}) {
  const unknownNames = [];
  const namedIds = names.reduce((acc, n) => {
    const id = friends.get(n);
    if (id) acc.push(id);
    else unknownNames.push(n);
    return acc;
  }, []);

  // Fall back to solo expense if any names couldn't be resolved
  if (unknownNames.length > 0) {
    const unknownList = unknownNames.map(capitalize).join(", ");
    const fallbackDetails = [fullDetails, `Could not resolve: ${unknownList}`]
      .filter(Boolean).join("\n\n");
    const result = await createSoloExpense(
      description, amount, currency, fallbackDetails, date);
    return {
      expense: result.data.expenses?.[0], fallback: "solo", unknownNames,
    };
  }

  const allIds = [...new Set([process.env.SPLITWISE_ID_GUI, ...namedIds])];
  const otherIds = allIds.filter((id) => id !== payerId);

  const result = await createSharedExpense({
    description, amount, currency, otherPersonIds: otherIds, payerId,
    details: fullDetails, date, groupId: groupId ?? 0,
  });
  return {expense: result.data.expenses?.[0]};
}

// Fires a fire-and-forget Settle Up mirror for successful household-only
// (gui+georgia) expenses. Errors are logged to Sentry but never surface to
// callers — called without await so the SW response is unaffected.
function mirrorToSettleUp(
  {names, owedAmounts, hasOwedAmounts, description, amount, currency,
    details, date, paidBy, source}) {
  const isHouseholdOnly = hasOwedAmounts ?
    owedAmounts.every(
      ({name}) => ["gui", "georgia"].includes(name.toLowerCase())) :
    names.length === 1 && names[0] === "georgia";
  if (!isHouseholdOnly) return;

  const purpose = [source && `[${source}]`, description]
    .filter(Boolean).join(" ") + (details ? ` - ${details}` : "");
  const payerName = paidBy?.toLowerCase() ?? "gui";
  const payerId = payerName === "gui" ? SU_GUI : SU_GEORGIA;

  let items;
  if (hasOwedAmounts) {
    const guiOwed =
      owedAmounts.find(({name}) => name.toLowerCase() === "gui")?.owed ?? 0;
    const georgiaOwed =
      owedAmounts.find(({name}) => name.toLowerCase() === "georgia")?.owed ?? 0;
    items = [{
      amount: amount.toFixed(2),
      forWhom: [
        {memberId: SU_GUI, weight: guiOwed.toFixed(2)},
        {memberId: SU_GEORGIA, weight: georgiaOwed.toFixed(2)},
      ],
    }];
  } else {
    items = [{
      amount: amount.toFixed(2),
      forWhom: [
        {memberId: SU_GUI, weight: "1"},
        {memberId: SU_GEORGIA, weight: "1"},
      ],
    }];
  }

  createSettleUpExpense({
    groupId: SU_HOUSEHOLD_GROUP, description: purpose, currency, date,
    whoPaid: [{memberId: payerId, weight: "1"}],
    items,
  }).catch((error) => Sentry.captureException(error, {
    extra: {description, amount, context: "settleup_mirror"},
  }));
}

// POST /splitwise/expenses
router.post("/expenses", async (req, res) => {
  const {
    description, amount, currency, details = "", date,
    splitWith, paidBy, owedAmounts, groupId, source,
  } = req.body;

  const validationError = validateExpenseRequest(
    {description, amount, currency, splitWith, paidBy, owedAmounts});
  if (validationError) {
    return res.status(400).json({error: validationError});
  }

  const fullDetails = [details, source && `Created with ${source}`]
    .filter(Boolean).join("\n\n");
  const names = (splitWith ?? []).map((n) => n.toLowerCase());
  const hasOwedAmounts = owedAmounts?.length > 0;

  try {
    // Solo expense, optionally against a group (no named co-payers)
    if (names.length === 0 && !hasOwedAmounts) {
      const result = await createSoloExpense(
        description, amount, currency, fullDetails, date, groupId ?? 0);

      // Mirror to Settle Up personal group
      const purpose = [source && `[${source}]`, description]
        .filter(Boolean).join(" ") + (details ? ` - ${details}` : "");
      createSettleUpExpense({
        groupId: SU_PERSONAL_GROUP, description: purpose, currency, date,
        whoPaid: [{memberId: SU_GUI_PERSONAL, weight: "1"}],
        items: [{
          amount: amount.toFixed(2),
          forWhom: [{memberId: SU_GUI_PERSONAL, weight: "1"}],
        }],
      }).catch((error) => Sentry.captureException(error, {
        extra: {description, amount, context: "settleup_mirror"},
      }));

      return res.json({expense: result.data.expenses?.[0]});
    }

    const friends = getFriendRegistry();
    const payerName = paidBy?.toLowerCase() ?? "gui";
    const payerId = resolveId(payerName, friends);
    if (!payerId) {
      return res.status(400).json({error: `Unknown payer: ${payerName}`});
    }

    const response = hasOwedAmounts ?
      await resolveUnevenSplit({
        owedAmounts, amount, currency, description, fullDetails, date,
        groupId, friends, payerId,
      }) :
      await resolveEqualSplit({
        names, friends, payerId, description, amount, currency, fullDetails,
        date, groupId,
      });

    // Mirror successful household expenses to Settle Up (parallel dual-write)
    if (!response.fallback) {
      mirrorToSettleUp({
        names, owedAmounts, hasOwedAmounts, description, amount, currency,
        details, date, paidBy, source,
      });
    }

    return res.json(response);
  } catch (error) {
    Sentry.captureException(error, {
      extra: {description, amount, consumer: req.consumer},
    });

    res.status(502).json({error: error.message});

    await Sentry.flush(2000);
    return;
  }
});

// GET /splitwise/friends
router.get("/friends", async (req, res) => {
  try {
    res.json({friends: getFriendsList()});
  } catch (error) {
    Sentry.captureException(error);

    res.status(502).json({error: error.message});

    await Sentry.flush(2000);
  }
});

// GET /splitwise/groups
router.get("/groups", async (req, res) => {
  try {
    res.json({groups: await getGroups()});
  } catch (error) {
    Sentry.captureException(error);

    res.status(502).json({error: error.message});

    await Sentry.flush(2000);
  }
});

export default router;
